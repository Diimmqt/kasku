import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationType,
  Prisma,
  RecurringFrequency,
  TransactionType,
} from '../../generated/prisma/client.js';
import {
  decimalToString,
  parsePositiveDecimal,
} from '../../common/utils/decimal.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateRecurringDto } from './dto/create-recurring.dto.js';
import { UpdateRecurringDto } from './dto/update-recurring.dto.js';

const RECURRING_INCLUDE = {
  wallet: { select: { id: true, name: true, type: true, color: true } },
  category: {
    select: { id: true, name: true, type: true, icon: true, color: true },
  },
  createdBy: { select: { id: true, name: true, email: true } },
  executionLogs: {
    orderBy: { executedAt: 'desc' as const },
    take: 5,
    select: {
      id: true,
      scheduledForDate: true,
      transactionId: true,
      executedAt: true,
    },
  },
} satisfies Prisma.RecurringTransactionInclude;

type RecurringWithRelations = Prisma.RecurringTransactionGetPayload<{
  include: typeof RECURRING_INCLUDE;
}>;

@Injectable()
export class RecurringTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService,
  ) {}

  async listRecurring(workspaceId: string) {
    const items = await this.prisma.recurringTransaction.findMany({
      where: { workspaceId },
      include: RECURRING_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { nextRunDate: 'asc' }],
    });
    return items.map((item) => this.serializeRecurring(item));
  }

  async createRecurring(
    workspaceId: string,
    userId: string,
    dto: CreateRecurringDto,
  ) {
    const amount = parsePositiveDecimal(dto.amount, 'Nominal transaksi berulang');
    await this.validateWalletAndCategory(
      workspaceId,
      dto.walletId,
      dto.categoryId,
      dto.type,
    );

    const startDate = this.toUtcStartOfDay(new Date(dto.startDate));
    const endDate = dto.endDate
      ? this.toUtcStartOfDay(new Date(dto.endDate))
      : null;

    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'Tanggal berakhir tidak boleh sebelum tanggal mulai.',
      );
    }

    const created = await this.prisma.recurringTransaction.create({
      data: {
        workspaceId,
        walletId: dto.walletId,
        categoryId: dto.categoryId,
        createdByUserId: userId,
        type: dto.type,
        amount,
        description: dto.description.trim(),
        note: dto.note?.trim() || null,
        frequency: dto.frequency,
        startDate,
        endDate,
        nextRunDate: startDate,
        isActive: dto.isActive ?? true,
      },
      include: RECURRING_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'RECURRING_CREATED',
      entityType: 'RECURRING_TRANSACTION',
      entityId: created.id,
      metadata: {
        description: created.description,
        frequency: created.frequency,
        amount: decimalToString(amount),
      },
    });

    return this.serializeRecurring(created);
  }

  async updateRecurring(
    workspaceId: string,
    recurringId: string,
    userId: string,
    dto: UpdateRecurringDto,
  ) {
    const existing = await this.prisma.recurringTransaction.findFirst({
      where: { id: recurringId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Jadwal transaksi berulang tidak ditemukan.');
    }

    const nextType = dto.type ?? existing.type;
    const nextWalletId = dto.walletId ?? existing.walletId;
    const nextCategoryId = dto.categoryId ?? existing.categoryId;

    await this.validateWalletAndCategory(
      workspaceId,
      nextWalletId,
      nextCategoryId,
      nextType,
    );

    const nextStart = dto.startDate
      ? this.toUtcStartOfDay(new Date(dto.startDate))
      : existing.startDate;
    const nextEnd =
      dto.endDate === undefined
        ? existing.endDate
        : dto.endDate === null
          ? null
          : this.toUtcStartOfDay(new Date(dto.endDate));

    if (nextEnd && nextEnd < nextStart) {
      throw new BadRequestException(
        'Tanggal berakhir tidak boleh sebelum tanggal mulai.',
      );
    }

    const nextAmount = dto.amount
      ? parsePositiveDecimal(dto.amount, 'Nominal transaksi berulang')
      : existing.amount;

    const updated = await this.prisma.recurringTransaction.update({
      where: { id: recurringId },
      data: {
        walletId: nextWalletId,
        categoryId: nextCategoryId,
        type: nextType,
        amount: nextAmount,
        description: dto.description?.trim() ?? existing.description,
        note:
          dto.note === undefined
            ? existing.note
            : dto.note === null
              ? null
              : dto.note.trim() || null,
        frequency: dto.frequency ?? existing.frequency,
        startDate: nextStart,
        endDate: nextEnd,
        nextRunDate:
          dto.startDate && !existing.lastRunDate
            ? nextStart
            : existing.nextRunDate,
        isActive: dto.isActive ?? existing.isActive,
      },
      include: RECURRING_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'RECURRING_UPDATED',
      entityType: 'RECURRING_TRANSACTION',
      entityId: recurringId,
      metadata: {
        isActive: updated.isActive,
        frequency: updated.frequency,
      },
    });

    return this.serializeRecurring(updated);
  }

  async deleteRecurring(
    workspaceId: string,
    recurringId: string,
    userId: string,
  ) {
    const existing = await this.prisma.recurringTransaction.findFirst({
      where: { id: recurringId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Jadwal transaksi berulang tidak ditemukan.');
    }

    await this.prisma.recurringTransaction.delete({
      where: { id: recurringId },
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'RECURRING_DELETED',
      entityType: 'RECURRING_TRANSACTION',
      entityId: recurringId,
      metadata: { description: existing.description },
    });

    return { deleted: true };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processDueSchedules(workspaceId?: string, now: Date = new Date()) {
    const todayEnd = this.toUtcStartOfDay(now);
    todayEnd.setUTCHours(23, 59, 59, 999);

    const dueRules = await this.prisma.recurringTransaction.findMany({
      where: {
        ...(workspaceId ? { workspaceId } : {}),
        isActive: true,
        nextRunDate: { lte: todayEnd },
      },
      orderBy: { nextRunDate: 'asc' },
    });

    let executedCount = 0;
    let skippedCount = 0;

    for (const rule of dueRules) {
      // Catch up occurrences safely up to today, capped at 24 iterations per pass.
      let scheduledDate = this.toUtcStartOfDay(rule.nextRunDate);
      let steps = 0;

      while (scheduledDate <= todayEnd && steps < 24) {
        if (rule.endDate && scheduledDate > this.toUtcStartOfDay(rule.endDate)) {
          await this.prisma.recurringTransaction.update({
            where: { id: rule.id },
            data: { isActive: false },
          });
          break;
        }

        const outcome = await this.executeSingleOccurrence(
          rule.id,
          scheduledDate,
        );
        if (outcome.executed) {
          executedCount += 1;
        } else {
          skippedCount += 1;
        }

        scheduledDate = this.advanceDate(scheduledDate, rule.frequency);
        steps += 1;
      }
    }

    return {
      processedRules: dueRules.length,
      executedCount,
      skippedCount,
    };
  }

  async executeSingleOccurrence(
    recurringTransactionId: string,
    rawScheduledDate: Date,
  ): Promise<{ executed: boolean; transactionId?: string }> {
    const scheduledForDate = this.toUtcStartOfDay(rawScheduledDate);

    try {
      const outcome = await this.prisma.$transaction(async (tx) => {
        const rule = await tx.recurringTransaction.findUnique({
          where: { id: recurringTransactionId },
        });
        if (!rule || !rule.isActive) {
          return { executed: false as const };
        }

        const existingLog = await tx.recurringExecutionLog.findUnique({
          where: {
            recurringTransactionId_scheduledForDate: {
              recurringTransactionId: rule.id,
              scheduledForDate,
            },
          },
        });
        if (existingLog) {
          const nextDate = this.advanceDate(scheduledForDate, rule.frequency);
          if (rule.nextRunDate <= scheduledForDate) {
            await tx.recurringTransaction.update({
              where: { id: rule.id },
              data: {
                nextRunDate: nextDate,
                isActive:
                  rule.endDate && nextDate > this.toUtcStartOfDay(rule.endDate)
                    ? false
                    : rule.isActive,
              },
            });
          }
          return { executed: false as const };
        }

        const amount = new Prisma.Decimal(rule.amount);
        if (rule.type === TransactionType.INCOME) {
          await tx.wallet.update({
            where: { id: rule.walletId },
            data: { balance: { increment: amount } },
          });
        } else {
          await tx.wallet.update({
            where: { id: rule.walletId },
            data: { balance: { decrement: amount } },
          });
        }

        const createdTx = await tx.transaction.create({
          data: {
            workspaceId: rule.workspaceId,
            walletId: rule.walletId,
            categoryId: rule.categoryId,
            createdByUserId: rule.createdByUserId,
            type: rule.type,
            amount,
            transactionDate: scheduledForDate,
            description: `${rule.description} (Otomatis)`,
            note: rule.note,
          },
        });

        // Unique constraint on (recurringTransactionId, scheduledForDate) enforces DB-level idempotency.
        await tx.recurringExecutionLog.create({
          data: {
            recurringTransactionId: rule.id,
            workspaceId: rule.workspaceId,
            scheduledForDate,
            transactionId: createdTx.id,
          },
        });

        const nextDate = this.advanceDate(scheduledForDate, rule.frequency);
        const reachedEnd = Boolean(
          rule.endDate && nextDate > this.toUtcStartOfDay(rule.endDate),
        );

        await tx.recurringTransaction.update({
          where: { id: rule.id },
          data: {
            lastRunDate: scheduledForDate,
            nextRunDate: nextDate,
            isActive: reachedEnd ? false : rule.isActive,
          },
        });

        return {
          executed: true as const,
          transactionId: createdTx.id,
          rule,
        };
      });

      if (outcome.executed && outcome.rule) {
        await this.notifications.notifyWorkspaceMembers({
          workspaceId: outcome.rule.workspaceId,
          type: NotificationType.RECURRING_EXECUTED,
          title: 'Transaksi Berulang Dicatat',
          message: `${outcome.rule.description} sebesar ${decimalToString(outcome.rule.amount)} telah dicatat otomatis.`,
          referenceType: 'TRANSACTION',
          referenceId: outcome.transactionId,
        });

        if (outcome.rule.type === TransactionType.EXPENSE) {
          await this.notifications.evaluateBudgetNotifications(
            outcome.rule.workspaceId,
            outcome.rule.categoryId,
            scheduledForDate,
          );
        }
      }

      return {
        executed: outcome.executed,
        transactionId: outcome.transactionId,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { executed: false };
      }
      throw error;
    }
  }

  private async validateWalletAndCategory(
    workspaceId: string,
    walletId: string,
    categoryId: string,
    type: TransactionType,
  ) {
    if (type !== TransactionType.INCOME && type !== TransactionType.EXPENSE) {
      throw new BadRequestException(
        'Transaksi berulang hanya mendukung INCOME atau EXPENSE.',
      );
    }

    const [wallet, category] = await Promise.all([
      this.prisma.wallet.findFirst({
        where: { id: walletId, workspaceId, isArchived: false },
      }),
      this.prisma.category.findFirst({
        where: { id: categoryId, workspaceId, isArchived: false },
      }),
    ]);

    if (!wallet) {
      throw new NotFoundException('Dompet tidak ditemukan di workspace ini.');
    }
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan di workspace ini.');
    }
    if (String(category.type) !== String(type)) {
      throw new BadRequestException(
        'Jenis kategori tidak sesuai dengan jenis transaksi berulang.',
      );
    }
  }

  private toUtcStartOfDay(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private advanceDate(date: Date, frequency: RecurringFrequency): Date {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();

    if (frequency === RecurringFrequency.DAILY) {
      return new Date(Date.UTC(y, m, d + 1));
    }
    if (frequency === RecurringFrequency.WEEKLY) {
      return new Date(Date.UTC(y, m, d + 7));
    }
    if (frequency === RecurringFrequency.MONTHLY) {
      const targetLastDay = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
      return new Date(Date.UTC(y, m + 1, Math.min(d, targetLastDay)));
    }
    const targetLastDay = new Date(Date.UTC(y + 1, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y + 1, m, Math.min(d, targetLastDay)));
  }

  private serializeRecurring(item: RecurringWithRelations) {
    return {
      id: item.id,
      workspaceId: item.workspaceId,
      walletId: item.walletId,
      categoryId: item.categoryId,
      type: item.type,
      amount: decimalToString(item.amount),
      description: item.description,
      note: item.note,
      frequency: item.frequency,
      startDate: item.startDate,
      endDate: item.endDate,
      nextRunDate: item.nextRunDate,
      lastRunDate: item.lastRunDate,
      isActive: item.isActive,
      wallet: item.wallet,
      category: item.category,
      createdBy: item.createdBy,
      executionLogs: item.executionLogs,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }
}

