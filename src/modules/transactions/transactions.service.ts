import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  decimalToString,
  parsePositiveDecimal,
} from '../../common/utils/decimal.util.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CategoryType, TransactionType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { QueryTransactionsDto } from './dto/query-transactions.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';

const TRANSACTION_INCLUDE = {
  wallet: { select: { id: true, name: true, type: true, color: true } },
  destinationWallet: {
    select: { id: true, name: true, type: true, color: true },
  },
  category: {
    select: { id: true, name: true, type: true, icon: true, color: true },
  },
  createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
} satisfies Prisma.TransactionInclude;

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: typeof TRANSACTION_INCLUDE;
}>;

interface ResolvedTransactionInput {
  type: TransactionType;
  walletId: string;
  destinationWalletId: string | null;
  categoryId: string | null;
  amount: Prisma.Decimal;
  transactionDate: Date;
  description: string;
  note: string | null;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async listTransactions(workspaceId: string, query: QueryTransactionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      workspaceId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.walletId
        ? {
            OR: [
              { walletId: query.walletId },
              { destinationWalletId: query.walletId },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            transactionDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: this.endOfDayIfDateOnly(query.endDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search } },
              { note: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: TRANSACTION_INCLUDE,
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((item) => this.serializeTransaction(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getTransactionDetail(workspaceId: string, transactionId: string) {
    const item = await this.prisma.transaction.findFirst({
      where: { id: transactionId, workspaceId },
      include: TRANSACTION_INCLUDE,
    });
    if (!item) {
      throw new NotFoundException('Transaksi tidak ditemukan.');
    }
    return this.serializeTransaction(item);
  }

  async createTransaction(
    workspaceId: string,
    userId: string,
    dto: CreateTransactionDto,
  ) {
    const resolved = await this.validateAndResolveInput(workspaceId, {
      type: dto.type,
      walletId: dto.walletId,
      destinationWalletId: dto.destinationWalletId ?? null,
      categoryId: dto.categoryId ?? null,
      amount: parsePositiveDecimal(dto.amount, 'Nominal transaksi'),
      transactionDate: new Date(dto.transactionDate),
      description: dto.description,
      note: dto.note ?? null,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      await this.applyBalanceEffect(tx, resolved, 1);

      const record = await tx.transaction.create({
        data: {
          workspaceId,
          walletId: resolved.walletId,
          destinationWalletId: resolved.destinationWalletId,
          categoryId: resolved.categoryId,
          createdByUserId: userId,
          type: resolved.type,
          amount: resolved.amount,
          transactionDate: resolved.transactionDate,
          description: resolved.description,
          note: resolved.note,
        },
        include: TRANSACTION_INCLUDE,
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'TRANSACTION_CREATED',
          entityType: 'Transaction',
          entityId: record.id,
          metadata: {
            type: record.type,
            amount: decimalToString(record.amount),
            description: record.description,
          },
        },
        tx,
      );

      return record;
    });

    if (
      created.type === TransactionType.EXPENSE &&
      created.categoryId &&
      this.notifications
    ) {
      await this.notifications.evaluateBudgetNotifications(
        workspaceId,
        created.categoryId,
        created.transactionDate,
      );
    }

    return this.serializeTransaction(created);
  }

  async updateTransaction(
    workspaceId: string,
    transactionId: string,
    userId: string,
    dto: UpdateTransactionDto,
  ) {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Transaksi tidak ditemukan.');
    }

    const nextType = dto.type ?? existing.type;
    const nextResolved = await this.validateAndResolveInput(workspaceId, {
      type: nextType,
      walletId: dto.walletId ?? existing.walletId,
      destinationWalletId:
        nextType === TransactionType.TRANSFER
          ? dto.destinationWalletId !== undefined
            ? dto.destinationWalletId
            : existing.destinationWalletId
          : null,
      categoryId:
        nextType === TransactionType.TRANSFER
          ? null
          : dto.categoryId !== undefined
            ? dto.categoryId
            : existing.categoryId,
      amount:
        dto.amount !== undefined
          ? parsePositiveDecimal(dto.amount, 'Nominal transaksi')
          : new Prisma.Decimal(existing.amount),
      transactionDate: dto.transactionDate
        ? new Date(dto.transactionDate)
        : existing.transactionDate,
      description: dto.description ?? existing.description,
      note: dto.note !== undefined ? dto.note : existing.note,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      // Revert original wallet balance mutations first, then apply the updated effect.
      await this.applyBalanceEffect(
        tx,
        {
          type: existing.type,
          walletId: existing.walletId,
          destinationWalletId: existing.destinationWalletId,
          amount: new Prisma.Decimal(existing.amount),
        },
        -1,
      );

      await this.applyBalanceEffect(tx, nextResolved, 1);

      const saved = await tx.transaction.update({
        where: { id: existing.id },
        data: {
          type: nextResolved.type,
          walletId: nextResolved.walletId,
          destinationWalletId: nextResolved.destinationWalletId,
          categoryId: nextResolved.categoryId,
          amount: nextResolved.amount,
          transactionDate: nextResolved.transactionDate,
          description: nextResolved.description,
          note: nextResolved.note,
        },
        include: TRANSACTION_INCLUDE,
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'TRANSACTION_UPDATED',
          entityType: 'Transaction',
          entityId: saved.id,
          metadata: {
            type: saved.type,
            amount: decimalToString(saved.amount),
            description: saved.description,
          },
        },
        tx,
      );

      return saved;
    });

    if (
      updated.type === TransactionType.EXPENSE &&
      updated.categoryId &&
      this.notifications
    ) {
      await this.notifications.evaluateBudgetNotifications(
        workspaceId,
        updated.categoryId,
        updated.transactionDate,
      );
    }

    return this.serializeTransaction(updated);
  }

  async deleteTransaction(
    workspaceId: string,
    transactionId: string,
    userId: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id: transactionId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Transaksi tidak ditemukan.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.applyBalanceEffect(
        tx,
        {
          type: existing.type,
          walletId: existing.walletId,
          destinationWalletId: existing.destinationWalletId,
          amount: new Prisma.Decimal(existing.amount),
        },
        -1,
      );

      await tx.transaction.delete({ where: { id: existing.id } });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'TRANSACTION_DELETED',
          entityType: 'Transaction',
          entityId: existing.id,
          metadata: {
            type: existing.type,
            amount: decimalToString(existing.amount),
            description: existing.description,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  private async validateAndResolveInput(
    workspaceId: string,
    input: ResolvedTransactionInput,
  ): Promise<ResolvedTransactionInput> {
    const sourceWallet = await this.prisma.wallet.findFirst({
      where: { id: input.walletId, workspaceId },
      select: { id: true, isArchived: true },
    });
    if (!sourceWallet) {
      throw new NotFoundException('Dompet sumber tidak ditemukan di workspace ini.');
    }

    if (input.type === TransactionType.TRANSFER) {
      if (!input.destinationWalletId) {
        throw new BadRequestException(
          'Dompet tujuan wajib dipilih untuk transaksi transfer.',
        );
      }
      if (input.destinationWalletId === input.walletId) {
        throw new BadRequestException(
          'Dompet asal dan dompet tujuan transfer tidak boleh sama.',
        );
      }
      const destWallet = await this.prisma.wallet.findFirst({
        where: { id: input.destinationWalletId, workspaceId },
        select: { id: true },
      });
      if (!destWallet) {
        throw new NotFoundException(
          'Dompet tujuan tidak ditemukan di workspace ini.',
        );
      }
      return {
        ...input,
        categoryId: null,
      };
    }

    if (!input.categoryId) {
      throw new BadRequestException(
        'Kategori wajib dipilih untuk transaksi pemasukan atau pengeluaran.',
      );
    }

    const category = await this.prisma.category.findFirst({
      where: { id: input.categoryId, workspaceId },
      select: { id: true, type: true },
    });
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan di workspace ini.');
    }

    const expectedCategoryType =
      input.type === TransactionType.INCOME
        ? CategoryType.INCOME
        : CategoryType.EXPENSE;
    if (category.type !== expectedCategoryType) {
      throw new BadRequestException(
        `Kategori bertipe ${category.type} tidak dapat digunakan untuk transaksi ${input.type}.`,
      );
    }

    return {
      ...input,
      destinationWalletId: null,
    };
  }

  /**
   * Mutates wallet balances inside a DB transaction.
   * Pass direction = 1 to apply transaction effect, or -1 to revert it.
   */
  private async applyBalanceEffect(
    tx: Prisma.TransactionClient,
    data: {
      type: TransactionType;
      walletId: string;
      destinationWalletId: string | null;
      amount: Prisma.Decimal;
    },
    direction: 1 | -1,
  ): Promise<void> {
    if (data.type === TransactionType.INCOME) {
      await tx.wallet.update({
        where: { id: data.walletId },
        data: { balance: { increment: data.amount.mul(direction) } },
      });
      return;
    }

    if (data.type === TransactionType.EXPENSE) {
      await tx.wallet.update({
        where: { id: data.walletId },
        data: { balance: { increment: data.amount.mul(-direction) } },
      });
      return;
    }

    // TRANSFER: subtract from source wallet, add to destination wallet.
    await tx.wallet.update({
      where: { id: data.walletId },
      data: { balance: { increment: data.amount.mul(-direction) } },
    });

    if (data.destinationWalletId) {
      await tx.wallet.update({
        where: { id: data.destinationWalletId },
        data: { balance: { increment: data.amount.mul(direction) } },
      });
    }
  }

  private endOfDayIfDateOnly(raw: string): Date {
    const parsed = new Date(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      parsed.setUTCHours(23, 59, 59, 999);
    }
    return parsed;
  }

  private serializeTransaction(item: TransactionWithRelations) {
    return {
      ...item,
      amount: decimalToString(item.amount),
    };
  }
}
