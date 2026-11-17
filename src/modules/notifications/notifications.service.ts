import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DebtStatus,
  NotificationType,
  Prisma,
  TransactionType,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';

export interface NotifyUserInput {
  userId: string;
  workspaceId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  deduplicate?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { isRead: false } : {}),
      ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: {
          workspace: { select: { id: true, name: true, type: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items,
      unreadCount,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Notifikasi tidak ditemukan.');
    }

    if (existing.isRead) {
      return existing;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, workspaceId?: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: { isRead: true, readAt: new Date() },
    });
    return { updatedCount: result.count };
  }

  async notifyUser(input: NotifyUserInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, notificationPreferences: true },
    });
    if (!user) return null;

    const prefs = user.notificationPreferences as Record<string, unknown> | null;
    if (prefs && prefs.inApp === false) {
      return null;
    }

    if (input.deduplicate && input.referenceType && input.referenceId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: input.userId,
          type: input.type,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
        },
        select: { id: true },
      });
      if (existing) {
        return null;
      }
    }

    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
      },
    });
  }

  async notifyWorkspaceMembers(params: {
    workspaceId: string;
    excludeUserId?: string;
    type: NotificationType;
    title: string;
    message: string;
    referenceType?: string;
    referenceId?: string;
    deduplicate?: boolean;
  }) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: params.workspaceId },
      select: { userId: true },
    });

    await Promise.all(
      members
        .filter((m) => m.userId !== params.excludeUserId)
        .map((m) =>
          this.notifyUser({
            userId: m.userId,
            workspaceId: params.workspaceId,
            type: params.type,
            title: params.title,
            message: params.message,
            referenceType: params.referenceType,
            referenceId: params.referenceId,
            deduplicate: params.deduplicate,
          }),
        ),
    );
  }

  async evaluateBudgetNotifications(
    workspaceId: string,
    categoryId: string,
    transactionDate: Date,
  ) {
    const budgets = await this.prisma.budget.findMany({
      where: {
        workspaceId,
        categoryId,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
      include: { category: { select: { name: true } } },
    });

    for (const budget of budgets) {
      const agg = await this.prisma.transaction.aggregate({
        where: {
          workspaceId,
          categoryId: budget.categoryId,
          type: TransactionType.EXPENSE,
          transactionDate: {
            gte: budget.startDate,
            lte: budget.endDate,
          },
        },
        _sum: { amount: true },
      });

      const limit = new Prisma.Decimal(budget.amountLimit);
      const spent = new Prisma.Decimal(agg._sum.amount ?? 0);
      if (limit.lte(0)) continue;

      const pct = Number(spent.div(limit).mul(100).toDecimalPlaces(1).toString());
      const budgetName = budget.name ?? budget.category.name;

      if (spent.gt(limit)) {
        await this.notifyWorkspaceMembers({
          workspaceId,
          type: NotificationType.BUDGET_EXCEEDED,
          title: `Anggaran Terlampaui: ${budgetName}`,
          message: `Pengeluaran kategori ${budget.category.name} sudah mencapai ${pct}% dari batas anggaran.`,
          referenceType: 'BUDGET',
          referenceId: budget.id,
          deduplicate: true,
        });
      } else if (pct >= budget.warningThresholdPercent) {
        await this.notifyWorkspaceMembers({
          workspaceId,
          type: NotificationType.BUDGET_WARNING,
          title: `Anggaran Hampir Habis: ${budgetName}`,
          message: `Penggunaan anggaran ${budget.category.name} telah mencapai ${pct}%.`,
          referenceType: 'BUDGET',
          referenceId: budget.id,
          deduplicate: true,
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkDueDebtsAndNotify(now: Date = new Date()) {
    const threeDaysAhead = new Date(now.getTime() + 3 * 86_400_000);
    const debts = await this.prisma.debt.findMany({
      where: {
        status: {
          in: [
            DebtStatus.UNPAID,
            DebtStatus.PARTIALLY_PAID,
            DebtStatus.OVERDUE,
          ],
        },
        dueDate: { lte: threeDaysAhead },
      },
    });

    let notified = 0;
    for (const debt of debts) {
      if (!debt.dueDate) continue;
      const isOverdue = debt.dueDate < now;
      if (isOverdue && debt.status !== DebtStatus.OVERDUE) {
        await this.prisma.debt.update({
          where: { id: debt.id },
          data: { status: DebtStatus.OVERDUE },
        });
      }

      const kindLabel = debt.type === 'DEBT' ? 'Utang' : 'Piutang';
      await this.notifyWorkspaceMembers({
        workspaceId: debt.workspaceId,
        type: isOverdue
          ? NotificationType.DEBT_OVERDUE
          : NotificationType.DEBT_DUE_SOON,
        title: isOverdue
          ? `${kindLabel} Melewati Jatuh Tempo`
          : `${kindLabel} Mendekati Jatuh Tempo`,
        message: `${kindLabel} dengan ${debt.counterpartyName} jatuh tempo pada ${debt.dueDate.toISOString().slice(0, 10)}.`,
        referenceType: 'DEBT',
        referenceId: debt.id,
        deduplicate: true,
      });
      notified += 1;
    }

    return { checked: debts.length, notified };
  }
}

