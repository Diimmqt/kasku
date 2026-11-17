import { BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import {
  DebtStatus,
  DebtType,
  Prisma,
  TransactionType,
} from '../../generated/prisma/client.js';
import { DebtsService } from './debts.service.js';

describe('DebtsService', () => {
  const tx = {
    debt: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    wallet: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    debtPayment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn((cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const auditLogs = { record: vi.fn() };
  const service = new DebtsService(prisma as never, auditLogs as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an EXPENSE transaction and updates wallet balance when paying DEBT', async () => {
    tx.debt.findFirst.mockResolvedValue({
      id: 'debt-1',
      workspaceId: 'ws-1',
      type: DebtType.DEBT,
      counterpartyName: 'Budi',
      totalAmount: new Prisma.Decimal('1000000'),
      paidAmount: new Prisma.Decimal('0'),
      dueDate: new Date('2027-01-01'),
    });
    tx.wallet.findFirst.mockResolvedValue({
      id: 'wallet-1',
      workspaceId: 'ws-1',
      name: 'Bank BCA',
      isArchived: false,
    });
    tx.category.findFirst.mockResolvedValue({ id: 'cat-other' });
    tx.transaction.create.mockResolvedValue({ id: 'tx-pay-1' });
    tx.debt.update.mockResolvedValue({
      id: 'debt-1',
      workspaceId: 'ws-1',
      type: DebtType.DEBT,
      counterpartyName: 'Budi',
      totalAmount: new Prisma.Decimal('1000000'),
      paidAmount: new Prisma.Decimal('400000'),
      debtDate: new Date('2026-11-01'),
      dueDate: new Date('2027-01-01'),
      status: DebtStatus.PARTIALLY_PAID,
      description: null,
      note: null,
      createdBy: { id: 'u-1', name: 'Dimm', email: 'dimm@kasku.app' },
      payments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await service.recordPayment('ws-1', 'debt-1', 'u-1', {
      walletId: 'wallet-1',
      amount: '400000',
    });

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: { decrement: new Prisma.Decimal('400000') } },
    });
    expect(tx.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: TransactionType.EXPENSE }),
      }),
    );
    expect(res.status).toBe(DebtStatus.PARTIALLY_PAID);
    expect(res.remainingAmount).toBe('600000');
  });

  it('creates an INCOME transaction when receiving RECEIVABLE payment and rejects overpayment', async () => {
    tx.debt.findFirst.mockResolvedValue({
      id: 'debt-2',
      workspaceId: 'ws-1',
      type: DebtType.RECEIVABLE,
      counterpartyName: 'Andi',
      totalAmount: new Prisma.Decimal('500000'),
      paidAmount: new Prisma.Decimal('200000'),
      dueDate: null,
    });

    await expect(
      service.recordPayment('ws-1', 'debt-2', 'u-1', {
        walletId: 'wallet-1',
        amount: '350000',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

