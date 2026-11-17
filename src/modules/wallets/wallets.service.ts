import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  decimalToString,
  parseNonNegativeDecimal,
} from '../../common/utils/decimal.util.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { QueryWalletsDto } from './dto/query-wallets.dto.js';
import { UpdateWalletDto } from './dto/update-wallet.dto.js';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async listWallets(workspaceId: string, query: QueryWalletsDto) {
    const wallets = await this.prisma.wallet.findMany({
      where: {
        workspaceId,
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
      include: {
        _count: {
          select: {
            outgoingTransactions: true,
            incomingTransactions: true,
          },
        },
      },
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'asc' }],
    });

    const totalBalance = wallets
      .filter((w) => !w.isArchived)
      .reduce((acc, w) => acc.plus(w.balance), new Prisma.Decimal(0));

    return {
      wallets: wallets.map((w) => ({
        ...w,
        balance: decimalToString(w.balance),
        initialBalance: decimalToString(w.initialBalance),
        transactionCount:
          w._count.outgoingTransactions + w._count.incomingTransactions,
      })),
      totalBalance: decimalToString(totalBalance),
    };
  }

  async getWalletDetail(workspaceId: string, walletId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
    });
    if (!wallet) {
      throw new NotFoundException('Dompet tidak ditemukan di workspace ini.');
    }

    const recentTransactions = await this.prisma.transaction.findMany({
      where: {
        workspaceId,
        OR: [{ walletId }, { destinationWalletId: walletId }],
      },
      include: {
        wallet: { select: { id: true, name: true, type: true } },
        destinationWallet: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, type: true, color: true, icon: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 25,
    });

    return {
      ...wallet,
      balance: decimalToString(wallet.balance),
      initialBalance: decimalToString(wallet.initialBalance),
      recentTransactions: recentTransactions.map((t) => ({
        ...t,
        amount: decimalToString(t.amount),
      })),
    };
  }

  async createWallet(
    workspaceId: string,
    workspaceCurrency: string,
    userId: string,
    dto: CreateWalletDto,
  ) {
    const initial = parseNonNegativeDecimal(
      dto.initialBalance ?? '0',
      'Saldo awal',
    );

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.create({
        data: {
          workspaceId,
          name: dto.name,
          type: dto.type,
          balance: initial,
          initialBalance: initial,
          currency: workspaceCurrency,
          color: dto.color ?? '#059669',
          icon: dto.icon ?? 'wallet',
        },
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'WALLET_CREATED',
          entityType: 'Wallet',
          entityId: wallet.id,
          metadata: {
            name: wallet.name,
            type: wallet.type,
            initialBalance: decimalToString(initial),
          },
        },
        tx,
      );

      return {
        ...wallet,
        balance: decimalToString(wallet.balance),
        initialBalance: decimalToString(wallet.initialBalance),
      };
    });
  }

  async updateWallet(
    workspaceId: string,
    walletId: string,
    userId: string,
    dto: UpdateWalletDto,
  ) {
    const existing = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Dompet tidak ditemukan.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.color !== undefined ? { color: dto.color } : {}),
          ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
          ...(dto.isArchived !== undefined
            ? { isArchived: dto.isArchived }
            : {}),
        },
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'WALLET_UPDATED',
          entityType: 'Wallet',
          entityId: existing.id,
          metadata: { name: updated.name, isArchived: updated.isArchived },
        },
        tx,
      );

      return {
        ...updated,
        balance: decimalToString(updated.balance),
        initialBalance: decimalToString(updated.initialBalance),
      };
    });
  }

  async deleteWallet(
    workspaceId: string,
    walletId: string,
    userId: string,
  ): Promise<{ deleted: true }> {
    const existing = await this.prisma.wallet.findFirst({
      where: { id: walletId, workspaceId },
      include: {
        _count: {
          select: {
            outgoingTransactions: true,
            incomingTransactions: true,
          },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Dompet tidak ditemukan.');
    }

    const totalTx =
      existing._count.outgoingTransactions +
      existing._count.incomingTransactions;
    if (totalTx > 0) {
      throw new ConflictException(
        'Dompet masih memiliki riwayat transaksi dan tidak dapat dihapus. Anda dapat mengarsipkan dompet ini.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.delete({ where: { id: existing.id } });
      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'WALLET_DELETED',
          entityType: 'Wallet',
          entityId: existing.id,
          metadata: { name: existing.name },
        },
        tx,
      );
    });

    return { deleted: true };
  }
}

