import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { Prisma, SavingsGoalStatus } from '../../generated/prisma/client.js';
import { SavingsGoalsService } from './savings-goals.service.js';

describe('SavingsGoalsService', () => {
  const tx = {
    savingsGoal: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    wallet: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    savingsContribution: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn((cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const auditLogs = {
    record: vi.fn(),
  };

  const service = new SavingsGoalsService(prisma as never, auditLogs as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects contribution when source wallet balance is insufficient', async () => {
    tx.savingsGoal.findFirst.mockResolvedValue({
      id: 'goal-1',
      workspaceId: 'ws-1',
      name: 'Laptop Baru',
      targetAmount: new Prisma.Decimal('10000000'),
      currentAmount: new Prisma.Decimal('0'),
      status: SavingsGoalStatus.ACTIVE,
    });
    tx.wallet.findFirst.mockResolvedValue({
      id: 'wallet-1',
      workspaceId: 'ws-1',
      name: 'Cash',
      balance: new Prisma.Decimal('500000'),
      isArchived: false,
    });

    await expect(
      service.addContribution('ws-1', 'goal-1', 'user-1', {
        walletId: 'wallet-1',
        amount: '1000000',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('deducts source wallet balance and marks goal COMPLETED when target is reached', async () => {
    tx.savingsGoal.findFirst.mockResolvedValue({
      id: 'goal-1',
      workspaceId: 'ws-1',
      name: 'Laptop Baru',
      targetAmount: new Prisma.Decimal('5000000'),
      currentAmount: new Prisma.Decimal('4000000'),
      status: SavingsGoalStatus.ACTIVE,
    });
    tx.wallet.findFirst.mockResolvedValue({
      id: 'wallet-1',
      workspaceId: 'ws-1',
      name: 'Bank BCA',
      balance: new Prisma.Decimal('3000000'),
      isArchived: false,
    });
    tx.savingsGoal.update.mockResolvedValue({
      id: 'goal-1',
      workspaceId: 'ws-1',
      name: 'Laptop Baru',
      description: null,
      targetAmount: new Prisma.Decimal('5000000'),
      currentAmount: new Prisma.Decimal('5000000'),
      deadline: null,
      status: SavingsGoalStatus.COMPLETED,
      createdBy: { id: 'user-1', name: 'Dimm', email: 'dimm@kasku.app' },
      contributions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.addContribution('ws-1', 'goal-1', 'user-1', {
      walletId: 'wallet-1',
      amount: '1000000',
      note: 'Setoran terakhir',
    });

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { decrement: new Prisma.Decimal('1000000') } },
    });
    expect(tx.savingsGoal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SavingsGoalStatus.COMPLETED,
        }),
      }),
    );
    expect(result.progressPercent).toBe(100);
    expect(result.status).toBe(SavingsGoalStatus.COMPLETED);
  });

  it('refunds wallet balance and reopens goal when reverting a contribution', async () => {
    tx.savingsContribution.findFirst.mockResolvedValue({
      id: 'contrib-1',
      walletId: 'wallet-1',
      amount: new Prisma.Decimal('1000000'),
      savingsGoal: {
        id: 'goal-1',
        targetAmount: new Prisma.Decimal('5000000'),
        currentAmount: new Prisma.Decimal('5000000'),
        status: SavingsGoalStatus.COMPLETED,
      },
    });
    tx.savingsGoal.update.mockResolvedValue({
      id: 'goal-1',
      workspaceId: 'ws-1',
      name: 'Laptop Baru',
      description: null,
      targetAmount: new Prisma.Decimal('5000000'),
      currentAmount: new Prisma.Decimal('4000000'),
      deadline: null,
      status: SavingsGoalStatus.ACTIVE,
      createdBy: { id: 'user-1', name: 'Dimm', email: 'dimm@kasku.app' },
      contributions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.deleteContribution(
      'ws-1',
      'goal-1',
      'contrib-1',
      'user-1',
    );

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { increment: new Prisma.Decimal('1000000') } },
    });
    expect(result.status).toBe(SavingsGoalStatus.ACTIVE);
  });
});

