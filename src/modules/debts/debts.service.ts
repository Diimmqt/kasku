import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CategoryType,
  DebtStatus,
  DebtType,
  Prisma,
  TransactionType,
} from '../../generated/prisma/client.js';
import {
  decimalToString,
  parsePositiveDecimal,
} from '../../common/utils/decimal.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { QueryDebtsDto } from './dto/query-debts.dto.js';
import { RecordDebtPaymentDto } from './dto/record-debt-payment.dto.js';
import { UpdateDebtDto } from './dto/update-debt.dto.js';

const DEBT_INCLUDE = {
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  payments: {
    include: {
      wallet: { select: { id: true, name: true, type: true, color: true } },
      recordedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
  },
} satisfies Prisma.DebtInclude;

type DebtWithRelations = Prisma.DebtGetPayload<{
  include: typeof DEBT_INCLUDE;
}>;

@Injectable()
export class DebtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async listDebts(workspaceId: string, query: QueryDebtsDto) {
    const debts = await this.prisma.debt.findMany({
      where: {
        workspaceId,
        ...(query.type ? { type: query.type } : {}),
      },
      include: DEBT_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    const now = new Date();
    const serialized = debts.map((debt) => this.serializeDebt(debt, now));
    const filtered = query.status
      ? serialized.filter((d) => d.status === query.status)
      : serialized;

    let totalDebtRemaining = new Prisma.Decimal(0);
    let totalReceivableRemaining = new Prisma.Decimal(0);
    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const item of filtered) {
      if (item.status === DebtStatus.OVERDUE) overdueCount += 1;
      if (item.isDueSoon) dueSoonCount += 1;
      if (item.type === DebtType.DEBT) {
        totalDebtRemaining = totalDebtRemaining.plus(item.remainingAmount);
      } else {
        totalReceivableRemaining = totalReceivableRemaining.plus(
          item.remainingAmount,
        );
      }
    }

    return {
      items: filtered,
      summary: {
        totalDebtRemaining: decimalToString(totalDebtRemaining),
        totalReceivableRemaining: decimalToString(totalReceivableRemaining),
        overdueCount,
        dueSoonCount,
      },
    };
  }

  async getDebtDetail(workspaceId: string, debtId: string) {
    const debt = await this.prisma.debt.findFirst({
      where: { id: debtId, workspaceId },
      include: DEBT_INCLUDE,
    });
    if (!debt) {
      throw new NotFoundException('Data utang/piutang tidak ditemukan.');
    }
    return this.serializeDebt(debt, new Date());
  }

  async createDebt(workspaceId: string, userId: string, dto: CreateDebtDto) {
    const totalAmount = parsePositiveDecimal(dto.totalAmount, 'Nominal pokok');
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    const status = this.computeStatus(
      totalAmount,
      new Prisma.Decimal(0),
      dueDate,
      new Date(),
    );

    const created = await this.prisma.debt.create({
      data: {
        workspaceId,
        createdByUserId: userId,
        type: dto.type,
        counterpartyName: dto.counterpartyName.trim(),
        totalAmount,
        paidAmount: new Prisma.Decimal(0),
        debtDate: new Date(dto.debtDate),
        dueDate,
        status,
        description: dto.description?.trim() || null,
        note: dto.note?.trim() || null,
      },
      include: DEBT_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'DEBT_CREATED',
      entityType: 'DEBT',
      entityId: created.id,
      metadata: {
        type: created.type,
        counterpartyName: created.counterpartyName,
        totalAmount: decimalToString(totalAmount),
      },
    });

    return this.serializeDebt(created, new Date());
  }

  async updateDebt(
    workspaceId: string,
    debtId: string,
    userId: string,
    dto: UpdateDebtDto,
  ) {
    const existing = await this.prisma.debt.findFirst({
      where: { id: debtId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Data utang/piutang tidak ditemukan.');
    }

    const nextTotal = dto.totalAmount
      ? parsePositiveDecimal(dto.totalAmount, 'Nominal pokok')
      : new Prisma.Decimal(existing.totalAmount);
    const paid = new Prisma.Decimal(existing.paidAmount);

    if (nextTotal.lt(paid)) {
      throw new BadRequestException(
        'Nominal total tidak boleh lebih kecil dari jumlah yang sudah dibayar.',
      );
    }

    const nextDueDate =
      dto.dueDate === undefined
        ? existing.dueDate
        : dto.dueDate === null
          ? null
          : new Date(dto.dueDate);

    const status = this.computeStatus(nextTotal, paid, nextDueDate, new Date());

    const updated = await this.prisma.debt.update({
      where: { id: debtId },
      data: {
        type: dto.type ?? existing.type,
        counterpartyName:
          dto.counterpartyName?.trim() ?? existing.counterpartyName,
        totalAmount: nextTotal,
        debtDate: dto.debtDate ? new Date(dto.debtDate) : existing.debtDate,
        dueDate: nextDueDate,
        status,
        description:
          dto.description === undefined
            ? existing.description
            : dto.description === null
              ? null
              : dto.description.trim() || null,
        note:
          dto.note === undefined
            ? existing.note
            : dto.note === null
              ? null
              : dto.note.trim() || null,
      },
      include: DEBT_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'DEBT_UPDATED',
      entityType: 'DEBT',
      entityId: debtId,
      metadata: {
        counterpartyName: updated.counterpartyName,
        status: updated.status,
      },
    });

    return this.serializeDebt(updated, new Date());
  }

  async recordPayment(
    workspaceId: string,
    debtId: string,
    userId: string,
    dto: RecordDebtPaymentDto,
  ) {
    const amount = parsePositiveDecimal(dto.amount, 'Nominal pembayaran');

    const result = await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirst({
        where: { id: debtId, workspaceId },
      });
      if (!debt) {
        throw new NotFoundException('Data utang/piutang tidak ditemukan.');
      }

      const total = new Prisma.Decimal(debt.totalAmount);
      const paid = new Prisma.Decimal(debt.paidAmount);
      const remaining = total.minus(paid);

      if (remaining.lte(0)) {
        throw new BadRequestException('Utang/piutang ini sudah lunas.');
      }
      if (amount.gt(remaining)) {
        throw new BadRequestException(
          `Nominal pembayaran melebihi sisa kewajiban (${decimalToString(remaining)}).`,
        );
      }

      const wallet = await tx.wallet.findFirst({
        where: { id: dto.walletId, workspaceId, isArchived: false },
      });
      if (!wallet) {
        throw new NotFoundException('Dompet tidak ditemukan.');
      }

      const txType =
        debt.type === DebtType.DEBT
          ? TransactionType.EXPENSE
          : TransactionType.INCOME;
      const categoryType =
        debt.type === DebtType.DEBT
          ? CategoryType.EXPENSE
          : CategoryType.INCOME;

      // Link to fallback "Lainnya" category if present in the workspace so reports stay clean.
      const fallbackCategory = await tx.category.findFirst({
        where: {
          workspaceId,
          type: categoryType,
          name: 'Lainnya',
          isArchived: false,
        },
        select: { id: true },
      });

      if (txType === TransactionType.EXPENSE) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { decrement: amount } },
        });
      } else {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        });
      }

      const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
      const txDescription =
        debt.type === DebtType.DEBT
          ? `Pembayaran utang ke ${debt.counterpartyName}`
          : `Penerimaan piutang dari ${debt.counterpartyName}`;

      const linkedTx = await tx.transaction.create({
        data: {
          workspaceId,
          walletId: wallet.id,
          categoryId: fallbackCategory?.id ?? null,
          createdByUserId: userId,
          type: txType,
          amount,
          transactionDate: paymentDate,
          description: txDescription,
          note: dto.note?.trim() || null,
        },
      });

      await tx.debtPayment.create({
        data: {
          workspaceId,
          debtId: debt.id,
          walletId: wallet.id,
          transactionId: linkedTx.id,
          recordedByUserId: userId,
          amount,
          paymentDate,
          note: dto.note?.trim() || null,
        },
      });

      const nextPaid = paid.plus(amount);
      const nextStatus = this.computeStatus(
        total,
        nextPaid,
        debt.dueDate,
        new Date(),
      );

      const updatedDebt = await tx.debt.update({
        where: { id: debt.id },
        data: {
          paidAmount: nextPaid,
          status: nextStatus,
        },
        include: DEBT_INCLUDE,
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'DEBT_PAYMENT_RECORDED',
          entityType: 'DEBT',
          entityId: debt.id,
          metadata: {
            type: debt.type,
            counterpartyName: debt.counterpartyName,
            amount: decimalToString(amount),
            walletName: wallet.name,
            transactionId: linkedTx.id,
          },
        },
        tx,
      );

      return updatedDebt;
    });

    return this.serializeDebt(result, new Date());
  }

  async deletePayment(
    workspaceId: string,
    debtId: string,
    paymentId: string,
    userId: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.debtPayment.findFirst({
        where: { id: paymentId, debtId, workspaceId },
        include: { debt: true },
      });
      if (!payment) {
        throw new NotFoundException('Riwayat pembayaran tidak ditemukan.');
      }

      const amount = new Prisma.Decimal(payment.amount);

      if (payment.debt.type === DebtType.DEBT) {
        await tx.wallet.update({
          where: { id: payment.walletId },
          data: { balance: { increment: amount } },
        });
      } else {
        await tx.wallet.update({
          where: { id: payment.walletId },
          data: { balance: { decrement: amount } },
        });
      }

      await tx.debtPayment.delete({ where: { id: payment.id } });
      if (payment.transactionId) {
        await tx.transaction
          .delete({ where: { id: payment.transactionId } })
          .catch(() => null);
      }

      const nextPaid = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        new Prisma.Decimal(payment.debt.paidAmount).minus(amount),
      );
      const nextStatus = this.computeStatus(
        new Prisma.Decimal(payment.debt.totalAmount),
        nextPaid,
        payment.debt.dueDate,
        new Date(),
      );

      const updatedDebt = await tx.debt.update({
        where: { id: debtId },
        data: {
          paidAmount: nextPaid,
          status: nextStatus,
        },
        include: DEBT_INCLUDE,
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'DEBT_PAYMENT_REVERTED',
          entityType: 'DEBT',
          entityId: debtId,
          metadata: { paymentId, amount: decimalToString(amount) },
        },
        tx,
      );

      return updatedDebt;
    });

    return this.serializeDebt(result, new Date());
  }

  async deleteDebt(workspaceId: string, debtId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debt.findFirst({
        where: { id: debtId, workspaceId },
        include: { payments: true },
      });
      if (!debt) {
        throw new NotFoundException('Data utang/piutang tidak ditemukan.');
      }

      for (const payment of debt.payments) {
        if (debt.type === DebtType.DEBT) {
          await tx.wallet.update({
            where: { id: payment.walletId },
            data: { balance: { increment: payment.amount } },
          });
        } else {
          await tx.wallet.update({
            where: { id: payment.walletId },
            data: { balance: { decrement: payment.amount } },
          });
        }

        if (payment.transactionId) {
          await tx.transaction
            .delete({ where: { id: payment.transactionId } })
            .catch(() => null);
        }
      }

      await tx.debt.delete({ where: { id: debtId } });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'DEBT_DELETED',
          entityType: 'DEBT',
          entityId: debtId,
          metadata: {
            counterpartyName: debt.counterpartyName,
            revertedPayments: debt.payments.length,
          },
        },
        tx,
      );
    });

    return { deleted: true };
  }

  private computeStatus(
    totalAmount: Prisma.Decimal,
    paidAmount: Prisma.Decimal,
    dueDate: Date | null,
    now: Date,
  ): DebtStatus {
    if (paidAmount.gte(totalAmount)) {
      return DebtStatus.PAID;
    }
    if (dueDate && dueDate < now) {
      return DebtStatus.OVERDUE;
    }
    if (paidAmount.gt(0)) {
      return DebtStatus.PARTIALLY_PAID;
    }
    return DebtStatus.UNPAID;
  }

  private serializeDebt(debt: DebtWithRelations, now: Date) {
    const total = new Prisma.Decimal(debt.totalAmount);
    const paid = new Prisma.Decimal(debt.paidAmount);
    const remaining = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      total.minus(paid),
    );
    const status = this.computeStatus(total, paid, debt.dueDate, now);
    const threeDaysMs = 3 * 86_400_000;
    const isDueSoon = Boolean(
      debt.dueDate &&
        status !== DebtStatus.PAID &&
        debt.dueDate >= now &&
        debt.dueDate.getTime() - now.getTime() <= threeDaysMs,
    );

    return {
      id: debt.id,
      workspaceId: debt.workspaceId,
      type: debt.type,
      counterpartyName: debt.counterpartyName,
      totalAmount: decimalToString(total),
      paidAmount: decimalToString(paid),
      remainingAmount: decimalToString(remaining),
      progressPercent: total.gt(0)
        ? Math.min(
            100,
            Number(paid.div(total).mul(100).toDecimalPlaces(1).toString()),
          )
        : 0,
      debtDate: debt.debtDate,
      dueDate: debt.dueDate,
      status,
      isDueSoon,
      description: debt.description,
      note: debt.note,
      createdBy: debt.createdBy,
      payments: debt.payments.map((p) => ({
        id: p.id,
        walletId: p.walletId,
        transactionId: p.transactionId,
        amount: decimalToString(p.amount),
        paymentDate: p.paymentDate,
        note: p.note,
        wallet: p.wallet,
        recordedBy: p.recordedBy,
        createdAt: p.createdAt,
      })),
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
    };
  }
}

