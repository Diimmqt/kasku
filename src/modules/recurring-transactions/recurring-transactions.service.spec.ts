import { vi } from 'vitest';
import {
  Prisma,
  RecurringFrequency,
  TransactionType,
} from '../../generated/prisma/client.js';
import { RecurringTransactionsService } from './recurring-transactions.service.js';

describe('RecurringTransactionsService', () => {
  const tx = {
    recurringTransaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    recurringExecutionLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    wallet: { update: vi.fn() },
    transaction: { create: vi.fn() },
  };

  const prisma = {
    $transaction: vi.fn((cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    recurringTransaction: { findMany: vi.fn() },
  };

  const auditLogs = { record: vi.fn() };
  const notifications = {
    notifyWorkspaceMembers: vi.fn(),
    evaluateBudgetNotifications: vi.fn(),
  };

  const service = new RecurringTransactionsService(
    prisma as never,
    auditLogs as never,
    notifications as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents duplicate execution when RecurringExecutionLog already exists for the scheduled date (idempotency)', async () => {
    const scheduled = new Date('2026-11-13T00:00:00.000Z');
    tx.recurringTransaction.findUnique.mockResolvedValue({
      id: 'rec-1',
      workspaceId: 'ws-1',
      walletId: 'w-1',
      categoryId: 'c-1',
      createdByUserId: 'u-1',
      type: TransactionType.EXPENSE,
      amount: new Prisma.Decimal('150000'),
      description: 'Internet',
      frequency: RecurringFrequency.MONTHLY,
      nextRunDate: scheduled,
      endDate: null,
      isActive: true,
    });
    tx.recurringExecutionLog.findUnique.mockResolvedValue({
      id: 'log-1',
      transactionId: 'tx-existing',
    });

    const outcome = await service.executeSingleOccurrence('rec-1', scheduled);

    expect(outcome.executed).toBe(false);
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('creates transaction, logs execution, and advances nextRunDate on first run', async () => {
    const scheduled = new Date('2026-11-13T00:00:00.000Z');
    tx.recurringTransaction.findUnique.mockResolvedValue({
      id: 'rec-1',
      workspaceId: 'ws-1',
      walletId: 'w-1',
      categoryId: 'c-1',
      createdByUserId: 'u-1',
      type: TransactionType.EXPENSE,
      amount: new Prisma.Decimal('150000'),
      description: 'Internet',
      note: null,
      frequency: RecurringFrequency.MONTHLY,
      nextRunDate: scheduled,
      endDate: null,
      isActive: true,
    });
    tx.recurringExecutionLog.findUnique.mockResolvedValue(null);
    tx.transaction.create.mockResolvedValue({ id: 'tx-new-1' });

    const outcome = await service.executeSingleOccurrence('rec-1', scheduled);

    expect(outcome.executed).toBe(true);
    expect(outcome.transactionId).toBe('tx-new-1');
    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'w-1' },
      data: { balance: { decrement: new Prisma.Decimal('150000') } },
    });
    expect(tx.recurringExecutionLog.create).toHaveBeenCalled();
    expect(tx.recurringTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextRunDate: new Date('2026-12-13T00:00:00.000Z'),
        }),
      }),
    );
    expect(notifications.evaluateBudgetNotifications).toHaveBeenCalled();
  });
});

