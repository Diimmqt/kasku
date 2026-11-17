import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import {
  BudgetPeriodType,
  CategoryType,
  Prisma,
} from '../../generated/prisma/client.js';
import { BudgetsService } from './budgets.service.js';
import { BudgetUsageStatus } from './dto/query-budgets.dto.js';

describe('BudgetsService', () => {
  const prisma = {
    budget: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    transaction: {
      aggregate: vi.fn(),
    },
  };

  const auditLogs = {
    record: vi.fn(),
  };

  const service = new BudgetsService(prisma as never, auditLogs as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects creating a budget for an INCOME category', async () => {
    prisma.category.findFirst.mockResolvedValue({
      id: 'cat-income',
      workspaceId: 'ws-1',
      type: CategoryType.INCOME,
      isArchived: false,
    });

    await expect(
      service.createBudget('ws-1', 'user-1', {
        categoryId: 'cat-income',
        month: '2026-11',
        amountLimit: '1000000',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('calculates WARNING and EXCEEDED statuses accurately from EXPENSE sums only', async () => {
    const start = new Date('2026-11-01T00:00:00.000Z');
    const end = new Date('2026-11-30T23:59:59.999Z');

    prisma.budget.findMany.mockResolvedValue([
      {
        id: 'b-warn',
        workspaceId: 'ws-1',
        categoryId: 'cat-food',
        createdByUserId: 'user-1',
        name: null,
        periodType: BudgetPeriodType.MONTHLY,
        startDate: start,
        endDate: end,
        amountLimit: new Prisma.Decimal('1000000'),
        warningThresholdPercent: 80,
        createdAt: start,
        updatedAt: start,
        category: {
          id: 'cat-food',
          name: 'Makanan',
          type: CategoryType.EXPENSE,
          icon: 'utensils',
          color: '#059669',
        },
        createdBy: { id: 'user-1', name: 'Dimm', email: 'dimm@kasku.app' },
      },
      {
        id: 'b-over',
        workspaceId: 'ws-1',
        categoryId: 'cat-shop',
        createdByUserId: 'user-1',
        name: 'Belanja Bulanan',
        periodType: BudgetPeriodType.MONTHLY,
        startDate: start,
        endDate: end,
        amountLimit: new Prisma.Decimal('500000'),
        warningThresholdPercent: 80,
        createdAt: start,
        updatedAt: start,
        category: {
          id: 'cat-shop',
          name: 'Belanja',
          type: CategoryType.EXPENSE,
          icon: 'shopping-bag',
          color: '#0284c7',
        },
        createdBy: { id: 'user-1', name: 'Dimm', email: 'dimm@kasku.app' },
      },
    ]);

    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('850000') } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('600000') } });

    const result = await service.listBudgets('ws-1', { month: '2026-11' });

    expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'EXPENSE' }),
      }),
    );
    expect(result.items[0].status).toBe(BudgetUsageStatus.WARNING);
    expect(result.items[0].remainingAmount).toBe('150000');
    expect(result.items[1].status).toBe(BudgetUsageStatus.EXCEEDED);
    expect(result.items[1].remainingAmount).toBe('-100000');
    expect(result.summary.totalLimit).toBe('1500000');
    expect(result.summary.totalSpent).toBe('1450000');
    expect(result.summary.warningCount).toBe(1);
    expect(result.summary.exceededCount).toBe(1);
  });
});

