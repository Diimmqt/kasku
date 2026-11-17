import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BudgetPeriodType,
  CategoryType,
  Prisma,
  TransactionType,
} from '../../generated/prisma/client.js';
import {
  decimalToString,
  parsePositiveDecimal,
} from '../../common/utils/decimal.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CreateBudgetDto } from './dto/create-budget.dto.js';
import { BudgetUsageStatus, QueryBudgetsDto } from './dto/query-budgets.dto.js';
import { UpdateBudgetDto } from './dto/update-budget.dto.js';

const BUDGET_INCLUDE = {
  category: {
    select: {
      id: true,
      name: true,
      type: true,
      icon: true,
      color: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.BudgetInclude;

type BudgetWithRelations = Prisma.BudgetGetPayload<{
  include: typeof BUDGET_INCLUDE;
}>;

@Injectable()
export class BudgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async listBudgets(workspaceId: string, query: QueryBudgetsDto) {
    const monthRange = query.month ? this.monthToRange(query.month) : null;

    const budgets = await this.prisma.budget.findMany({
      where: {
        workspaceId,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(monthRange
          ? {
              startDate: { lte: monthRange.endDate },
              endDate: { gte: monthRange.startDate },
            }
          : {}),
      },
      include: BUDGET_INCLUDE,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });

    const computed = await Promise.all(
      budgets.map((budget) => this.buildBudgetUsage(budget)),
    );

    const filtered = query.status
      ? computed.filter((item) => item.status === query.status)
      : computed;

    let totalLimit = new Prisma.Decimal(0);
    let totalSpent = new Prisma.Decimal(0);
    let warningCount = 0;
    let exceededCount = 0;

    for (const item of filtered) {
      totalLimit = totalLimit.plus(item.amountLimit);
      totalSpent = totalSpent.plus(item.spentAmount);
      if (item.status === BudgetUsageStatus.WARNING) warningCount += 1;
      if (item.status === BudgetUsageStatus.EXCEEDED) exceededCount += 1;
    }

    const totalRemaining = totalLimit.minus(totalSpent);

    return {
      items: filtered,
      summary: {
        totalBudgets: filtered.length,
        totalLimit: decimalToString(totalLimit),
        totalSpent: decimalToString(totalSpent),
        totalRemaining: decimalToString(totalRemaining),
        warningCount,
        exceededCount,
      },
    };
  }

  async getBudgetDetail(workspaceId: string, budgetId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, workspaceId },
      include: BUDGET_INCLUDE,
    });
    if (!budget) {
      throw new NotFoundException('Anggaran tidak ditemukan.');
    }
    return this.buildBudgetUsage(budget);
  }

  async createBudget(workspaceId: string, userId: string, dto: CreateBudgetDto) {
    const category = await this.ensureExpenseCategory(workspaceId, dto.categoryId);
    const periodType = dto.periodType ?? BudgetPeriodType.MONTHLY;
    const { startDate, endDate } = this.resolveDateRange(
      periodType,
      dto.month,
      dto.startDate,
      dto.endDate,
    );
    const amountLimit = parsePositiveDecimal(dto.amountLimit, 'Batas anggaran');

    const created = await this.prisma.budget.create({
      data: {
        workspaceId,
        categoryId: category.id,
        createdByUserId: userId,
        name: dto.name?.trim() || null,
        periodType,
        startDate,
        endDate,
        amountLimit,
        warningThresholdPercent: dto.warningThresholdPercent ?? 80,
      },
      include: BUDGET_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'BUDGET_CREATED',
      entityType: 'BUDGET',
      entityId: created.id,
      metadata: {
        categoryId: category.id,
        categoryName: category.name,
        amountLimit: decimalToString(amountLimit),
      },
    });

    return this.buildBudgetUsage(created);
  }

  async updateBudget(
    workspaceId: string,
    budgetId: string,
    userId: string,
    dto: UpdateBudgetDto,
  ) {
    const existing = await this.prisma.budget.findFirst({
      where: { id: budgetId, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException('Anggaran tidak ditemukan.');
    }

    const nextCategoryId = dto.categoryId ?? existing.categoryId;
    if (dto.categoryId) {
      await this.ensureExpenseCategory(workspaceId, dto.categoryId);
    }

    const nextPeriodType = dto.periodType ?? existing.periodType;
    const hasDateChange =
      dto.month !== undefined ||
      dto.startDate !== undefined ||
      dto.endDate !== undefined;

    const range = hasDateChange
      ? this.resolveDateRange(
          nextPeriodType,
          dto.month,
          dto.startDate ?? existing.startDate.toISOString(),
          dto.endDate ?? existing.endDate.toISOString(),
        )
      : { startDate: existing.startDate, endDate: existing.endDate };

    const nextLimit = dto.amountLimit
      ? parsePositiveDecimal(dto.amountLimit, 'Batas anggaran')
      : existing.amountLimit;

    const updated = await this.prisma.budget.update({
      where: { id: budgetId },
      data: {
        categoryId: nextCategoryId,
        name:
          dto.name === undefined
            ? existing.name
            : dto.name === null
              ? null
              : dto.name.trim() || null,
        periodType: nextPeriodType,
        startDate: range.startDate,
        endDate: range.endDate,
        amountLimit: nextLimit,
        warningThresholdPercent:
          dto.warningThresholdPercent ?? existing.warningThresholdPercent,
      },
      include: BUDGET_INCLUDE,
    });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'BUDGET_UPDATED',
      entityType: 'BUDGET',
      entityId: budgetId,
      metadata: {
        amountLimit: decimalToString(nextLimit),
      },
    });

    return this.buildBudgetUsage(updated);
  }

  async deleteBudget(workspaceId: string, budgetId: string, userId: string) {
    const existing = await this.prisma.budget.findFirst({
      where: { id: budgetId, workspaceId },
      include: { category: { select: { name: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Anggaran tidak ditemukan.');
    }

    await this.prisma.budget.delete({ where: { id: budgetId } });

    await this.auditLogs.record({
      workspaceId,
      userId,
      action: 'BUDGET_DELETED',
      entityType: 'BUDGET',
      entityId: budgetId,
      metadata: {
        categoryName: existing.category.name,
      },
    });

    return { deleted: true };
  }

  private async ensureExpenseCategory(workspaceId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, workspaceId, isArchived: false },
    });
    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan di workspace ini.');
    }
    if (category.type !== CategoryType.EXPENSE) {
      throw new BadRequestException(
        'Anggaran hanya dapat dibuat untuk kategori pengeluaran (EXPENSE).',
      );
    }
    return category;
  }

  private async buildBudgetUsage(budget: BudgetWithRelations) {
    // Only count EXPENSE transactions; TRANSFER and INCOME are strictly excluded.
    const aggregate = await this.prisma.transaction.aggregate({
      where: {
        workspaceId: budget.workspaceId,
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
    const spent = new Prisma.Decimal(aggregate._sum.amount ?? 0);
    const remaining = limit.minus(spent);
    const percentageUsed = limit.gt(0)
      ? Number(spent.div(limit).mul(100).toDecimalPlaces(2).toString())
      : 0;

    let status: BudgetUsageStatus = BudgetUsageStatus.SAFE;
    if (spent.gt(limit)) {
      status = BudgetUsageStatus.EXCEEDED;
    } else if (percentageUsed >= budget.warningThresholdPercent) {
      status = BudgetUsageStatus.WARNING;
    }

    return {
      id: budget.id,
      workspaceId: budget.workspaceId,
      categoryId: budget.categoryId,
      name: budget.name ?? budget.category.name,
      periodType: budget.periodType,
      startDate: budget.startDate,
      endDate: budget.endDate,
      amountLimit: decimalToString(limit),
      spentAmount: decimalToString(spent),
      remainingAmount: decimalToString(remaining),
      percentageUsed,
      warningThresholdPercent: budget.warningThresholdPercent,
      status,
      category: budget.category,
      createdBy: budget.createdBy,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }

  private monthToRange(month: string) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
    return { startDate, endDate };
  }

  private resolveDateRange(
    periodType: BudgetPeriodType,
    month?: string,
    rawStart?: string,
    rawEnd?: string,
  ) {
    if (month) {
      return this.monthToRange(month);
    }

    if (!rawStart || !rawEnd) {
      if (periodType === BudgetPeriodType.MONTHLY) {
        const now = new Date();
        const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        return this.monthToRange(ym);
      }
      throw new BadRequestException(
        'Periode anggaran kustom wajib menyertakan tanggal mulai dan tanggal berakhir.',
      );
    }

    const startDate = new Date(rawStart);
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(rawEnd)
      ? new Date(`${rawEnd}T23:59:59.999Z`)
      : new Date(rawEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Format tanggal periode anggaran tidak valid.');
    }

    if (endDate < startDate) {
      throw new BadRequestException(
        'Tanggal berakhir anggaran tidak boleh sebelum tanggal mulai.',
      );
    }

    return { startDate, endDate };
  }
}

