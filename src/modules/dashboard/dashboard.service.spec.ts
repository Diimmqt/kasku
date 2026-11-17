import { vi } from 'vitest';
import { Prisma, SavingsGoalStatus, TransactionType } from '../../generated/prisma/client.js';
import { ReportPeriodPreset } from '../../common/utils/date-range.util.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  const prisma = {
    wallet: { findMany: vi.fn() },
    transaction: { findMany: vi.fn(), aggregate: vi.fn() },
    budget: { findMany: vi.fn() },
    savingsGoal: { findMany: vi.fn() },
  };

  const service = new DashboardService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes totals, category breakdown, and health strictly from database records', async () => {
    prisma.wallet.findMany.mockResolvedValue([
      { id: 'w-1', name: 'Bank BCA', type: 'BANK', balance: new Prisma.Decimal('4000000'), color: '#059669' },
      { id: 'w-2', name: 'Cash', type: 'CASH', balance: new Prisma.Decimal('500000'), color: '#10b981' },
    ]);
    prisma.transaction.findMany
      .mockResolvedValueOnce([
        {
          type: TransactionType.INCOME,
          amount: new Prisma.Decimal('6000000'),
          transactionDate: new Date('2026-11-05T10:00:00.000Z'),
          categoryId: 'c-gaji',
          category: { id: 'c-gaji', name: 'Gaji', color: '#059669', icon: 'briefcase' },
        },
        {
          type: TransactionType.EXPENSE,
          amount: new Prisma.Decimal('1500000'),
          transactionDate: new Date('2026-11-06T10:00:00.000Z'),
          categoryId: 'c-makan',
          category: { id: 'c-makan', name: 'Makanan', color: '#f59e0b', icon: 'utensils' },
        },
      ])
      .mockResolvedValueOnce([]); // recent transactions

    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('6000000') } }) // monthly income
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('1500000') } }) // monthly expense
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('1500000') } }); // budget spent

    prisma.budget.findMany.mockResolvedValue([
      {
        id: 'b-1',
        name: 'Anggaran Makanan',
        categoryId: 'c-makan',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-30T23:59:59.999Z'),
        amountLimit: new Prisma.Decimal('2000000'),
        warningThresholdPercent: 80,
        category: { id: 'c-makan', name: 'Makanan', color: '#f59e0b', icon: 'utensils' },
      },
    ]);

    prisma.savingsGoal.findMany.mockResolvedValue([
      {
        id: 'g-1',
        name: 'Dana Darurat',
        targetAmount: new Prisma.Decimal('10000000'),
        currentAmount: new Prisma.Decimal('4000000'),
        status: SavingsGoalStatus.ACTIVE,
        deadline: null,
      },
    ]);

    const res = await service.getDashboard('ws-1', {
      period: ReportPeriodPreset.CUSTOM,
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    });

    expect(res.summary.totalBalance).toBe('4500000');
    expect(res.summary.periodIncome).toBe('6000000');
    expect(res.summary.periodExpense).toBe('1500000');
    expect(res.summary.netCashflow).toBe('4500000');
    expect(res.summary.remainingBudget).toBe('500000');
    expect(res.summary.financialHealth).toBe('HEALTHY');
    expect(res.expenseByCategory[0].percentage).toBe(100);
    expect(res.savingsGoalsSummary[0].progressPercent).toBe(40);
  });
});

