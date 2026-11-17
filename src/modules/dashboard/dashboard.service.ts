import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SavingsGoalStatus,
  TransactionType,
} from '../../generated/prisma/client.js';
import {
  buildTimeBuckets,
  ReportPeriodPreset,
  resolvePeriodRange,
} from '../../common/utils/date-range.util.js';
import { decimalToString } from '../../common/utils/decimal.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { QueryDashboardDto } from './dto/query-dashboard.dto.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(workspaceId: string, query: QueryDashboardDto) {
    const now = new Date();
    const range = resolvePeriodRange(
      query.period ?? ReportPeriodPreset.THIS_MONTH,
      query.startDate,
      query.endDate,
      now,
    );

    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );

    const [
      wallets,
      periodTransactions,
      monthlyIncomeAgg,
      monthlyExpenseAgg,
      recentTransactions,
      budgets,
      savingsGoals,
    ] = await Promise.all([
      this.prisma.wallet.findMany({
        where: { workspaceId, isArchived: false },
        select: { id: true, name: true, type: true, balance: true, color: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.transaction.findMany({
        where: {
          workspaceId,
          type: { in: [TransactionType.INCOME, TransactionType.EXPENSE] },
          transactionDate: {
            gte: range.startDate,
            lte: range.endDate,
          },
        },
        select: {
          type: true,
          amount: true,
          transactionDate: true,
          categoryId: true,
          category: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          workspaceId,
          type: TransactionType.INCOME,
          transactionDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          workspaceId,
          type: TransactionType.EXPENSE,
          transactionDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: { workspaceId },
        include: {
          wallet: { select: { id: true, name: true, type: true, color: true } },
          destinationWallet: {
            select: { id: true, name: true, type: true, color: true },
          },
          category: {
            select: { id: true, name: true, type: true, icon: true, color: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      this.prisma.budget.findMany({
        where: {
          workspaceId,
          startDate: { lte: range.endDate },
          endDate: { gte: range.startDate },
        },
        include: {
          category: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
        orderBy: { amountLimit: 'desc' },
      }),
      this.prisma.savingsGoal.findMany({
        where: {
          workspaceId,
          status: { in: [SavingsGoalStatus.ACTIVE, SavingsGoalStatus.COMPLETED] },
        },
        orderBy: [{ status: 'asc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
        take: 5,
      }),
    ]);

    const totalBalance = wallets.reduce(
      (acc, w) => acc.plus(w.balance),
      new Prisma.Decimal(0),
    );

    const buckets = buildTimeBuckets(range.startDate, range.endDate, range.groupBy);
    const seriesMap = new Map<
      string,
      { label: string; dateKey: string; income: Prisma.Decimal; expense: Prisma.Decimal }
    >();
    for (const bucket of buckets) {
      seriesMap.set(bucket.dateKey, {
        dateKey: bucket.dateKey,
        label: bucket.label,
        income: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
      });
    }

    let periodIncome = new Prisma.Decimal(0);
    let periodExpense = new Prisma.Decimal(0);
    const categoryExpenseMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        color: string;
        icon: string;
        amount: Prisma.Decimal;
      }
    >();

    for (const tx of periodTransactions) {
      const amount = new Prisma.Decimal(tx.amount);
      const iso = tx.transactionDate.toISOString();
      const key = range.groupBy === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
      const bucket = seriesMap.get(key);

      if (tx.type === TransactionType.INCOME) {
        periodIncome = periodIncome.plus(amount);
        if (bucket) bucket.income = bucket.income.plus(amount);
      } else if (tx.type === TransactionType.EXPENSE) {
        periodExpense = periodExpense.plus(amount);
        if (bucket) bucket.expense = bucket.expense.plus(amount);

        const catId = tx.category?.id ?? 'uncategorized';
        const existingCat = categoryExpenseMap.get(catId);
        if (existingCat) {
          existingCat.amount = existingCat.amount.plus(amount);
        } else {
          categoryExpenseMap.set(catId, {
            categoryId: catId,
            categoryName: tx.category?.name ?? 'Tanpa Kategori',
            color: tx.category?.color ?? '#64748b',
            icon: tx.category?.icon ?? 'tag',
            amount,
          });
        }
      }
    }

    const incomeVsExpenseSeries = Array.from(seriesMap.values()).map((b) => ({
      dateKey: b.dateKey,
      label: b.label,
      income: Number(b.income.toDecimalPlaces(2).toString()),
      expense: Number(b.expense.toDecimalPlaces(2).toString()),
    }));

    const expenseByCategory = Array.from(categoryExpenseMap.values())
      .sort((a, b) => b.amount.comparedTo(a.amount))
      .map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        color: item.color,
        icon: item.icon,
        amount: decimalToString(item.amount),
        numericAmount: Number(item.amount.toDecimalPlaces(2).toString()),
        percentage: periodExpense.gt(0)
          ? Number(
              item.amount
                .div(periodExpense)
                .mul(100)
                .toDecimalPlaces(1)
                .toString(),
            )
          : 0,
      }));

    // Compute budget usage for each matching budget cleanly
    const budgetSummary = await Promise.all(
      budgets.map(async (budget) => {
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
        const remaining = limit.minus(spent);
        const percentageUsed = limit.gt(0)
          ? Number(spent.div(limit).mul(100).toDecimalPlaces(1).toString())
          : 0;
        const status = spent.gt(limit)
          ? 'EXCEEDED'
          : percentageUsed >= budget.warningThresholdPercent
            ? 'WARNING'
            : 'SAFE';
        return {
          id: budget.id,
          name: budget.name ?? budget.category.name,
          categoryName: budget.category.name,
          categoryColor: budget.category.color,
          amountLimit: decimalToString(limit),
          spentAmount: decimalToString(spent),
          remainingAmount: decimalToString(remaining),
          percentageUsed,
          status,
        };
      }),
    );

    const remainingBudget = budgetSummary.reduce(
      (acc, b) => acc.plus(b.remainingAmount),
      new Prisma.Decimal(0),
    );

    const savingsGoalsSummary = savingsGoals.map((goal) => {
      const target = new Prisma.Decimal(goal.targetAmount);
      const current = new Prisma.Decimal(goal.currentAmount);
      const progressPercent = target.gt(0)
        ? Math.min(
            100,
            Number(current.div(target).mul(100).toDecimalPlaces(1).toString()),
          )
        : 0;
      return {
        id: goal.id,
        name: goal.name,
        targetAmount: decimalToString(target),
        currentAmount: decimalToString(current),
        progressPercent,
        status: goal.status,
        deadline: goal.deadline,
      };
    });

    const netCashflow = periodIncome.minus(periodExpense);
    const savingsRatePercent = periodIncome.gt(0)
      ? Number(
          netCashflow
            .div(periodIncome)
            .mul(100)
            .toDecimalPlaces(1)
            .toString(),
        )
      : 0;
    const hasExceededBudget = budgetSummary.some((b) => b.status === 'EXCEEDED');
    const financialHealth =
      periodExpense.gt(periodIncome)
        ? 'DEFICIT'
        : hasExceededBudget || (periodIncome.gt(0) && savingsRatePercent < 10)
          ? 'CAUTION'
          : 'HEALTHY';

    return {
      period: {
        type: range.type,
        startDate: range.startDate,
        endDate: range.endDate,
      },
      summary: {
        totalBalance: decimalToString(totalBalance),
        monthlyIncome: decimalToString(monthlyIncomeAgg._sum.amount ?? 0),
        monthlyExpense: decimalToString(monthlyExpenseAgg._sum.amount ?? 0),
        periodIncome: decimalToString(periodIncome),
        periodExpense: decimalToString(periodExpense),
        netCashflow: decimalToString(netCashflow),
        remainingBudget: decimalToString(remainingBudget),
        savingsRatePercent,
        financialHealth,
        activeWalletsCount: wallets.length,
      },
      incomeVsExpenseSeries,
      expenseByCategory,
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: decimalToString(tx.amount),
        transactionDate: tx.transactionDate,
        description: tx.description,
        wallet: tx.wallet,
        destinationWallet: tx.destinationWallet,
        category: tx.category,
        createdBy: tx.createdBy,
      })),
      budgetSummary,
      savingsGoalsSummary,
    };
  }
}

