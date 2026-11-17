import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { CategoryType, TransactionType } from '../../generated/prisma/enums.js';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsService', () => {
  const mockPrisma = {
    wallet: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockAuditLogs = { record: vi.fn() };
  let service: TransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    service = new TransactionsService(mockPrisma as never, mockAuditLogs as never);
  });

  it('rejects category type mismatch (INCOME category on EXPENSE transaction)', async () => {
    mockPrisma.wallet.findFirst.mockResolvedValue({ id: 'w-1' });
    mockPrisma.category.findFirst.mockResolvedValue({
      id: 'cat-income',
      type: CategoryType.INCOME,
    });

    await expect(
      service.createTransaction('ws-1', 'user-1', {
        type: TransactionType.EXPENSE,
        walletId: 'w-1',
        categoryId: 'cat-income',
        amount: '50000',
        transactionDate: '2026-11-13T10:00:00.000Z',
        description: 'Belanja',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transfer to the same wallet or missing destination wallet', async () => {
    mockPrisma.wallet.findFirst.mockResolvedValue({ id: 'w-1' });

    await expect(
      service.createTransaction('ws-1', 'user-1', {
        type: TransactionType.TRANSFER,
        walletId: 'w-1',
        destinationWalletId: 'w-1',
        amount: '100000',
        transactionDate: '2026-11-13T10:00:00.000Z',
        description: 'Pindah dana',
      }),
    ).rejects.toThrow(BadRequestException);

    mockPrisma.wallet.findFirst
      .mockResolvedValueOnce({ id: 'w-1' })
      .mockResolvedValueOnce(null);

    await expect(
      service.createTransaction('ws-1', 'user-1', {
        type: TransactionType.TRANSFER,
        walletId: 'w-1',
        destinationWalletId: 'w-other-ws',
        amount: '100000',
        transactionDate: '2026-11-13T10:00:00.000Z',
        description: 'Pindah lintas workspace',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('applies TRANSFER balance delta atomically on source (-) and destination (+)', async () => {
    mockPrisma.wallet.findFirst
      .mockResolvedValueOnce({ id: 'w-src' })
      .mockResolvedValueOnce({ id: 'w-dst' });
    mockPrisma.transaction.create.mockResolvedValue({
      id: 'tx-1',
      type: TransactionType.TRANSFER,
      amount: new Prisma.Decimal('250000'),
      description: 'Top up e-wallet',
    });

    const result = await service.createTransaction('ws-1', 'user-1', {
      type: TransactionType.TRANSFER,
      walletId: 'w-src',
      destinationWalletId: 'w-dst',
      amount: '250000',
      transactionDate: '2026-11-13T10:00:00.000Z',
      description: 'Top up e-wallet',
    });

    expect(result.amount).toBe('250000');
    expect(mockPrisma.wallet.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'w-src' },
      data: { balance: { increment: new Prisma.Decimal('-250000') } },
    });
    expect(mockPrisma.wallet.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'w-dst' },
      data: { balance: { increment: new Prisma.Decimal('250000') } },
    });
  });

  it('reverts original balance effect and applies new effect on updateTransaction', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-1',
      workspaceId: 'ws-1',
      type: TransactionType.EXPENSE,
      walletId: 'w-1',
      destinationWalletId: null,
      categoryId: 'cat-exp',
      amount: new Prisma.Decimal('50000'),
      transactionDate: new Date('2026-11-13T10:00:00.000Z'),
      description: 'Makan',
      note: null,
    });
    mockPrisma.wallet.findFirst.mockResolvedValue({ id: 'w-1' });
    mockPrisma.category.findFirst.mockResolvedValue({
      id: 'cat-exp',
      type: CategoryType.EXPENSE,
    });
    mockPrisma.transaction.update.mockResolvedValue({
      id: 'tx-1',
      type: TransactionType.EXPENSE,
      amount: new Prisma.Decimal('75000'),
    });

    const updated = await service.updateTransaction('ws-1', 'tx-1', 'user-1', {
      amount: '75000',
    });

    expect(updated.amount).toBe('75000');
    // 1st update reverts -50000 -> +50000; 2nd update applies -75000
    expect(mockPrisma.wallet.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'w-1' },
      data: { balance: { increment: new Prisma.Decimal('50000') } },
    });
    expect(mockPrisma.wallet.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'w-1' },
      data: { balance: { increment: new Prisma.Decimal('-75000') } },
    });
  });

  it('reverts balance effect when deleting an INCOME transaction', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 'tx-inc',
      workspaceId: 'ws-1',
      type: TransactionType.INCOME,
      walletId: 'w-1',
      destinationWalletId: null,
      amount: new Prisma.Decimal('1000000'),
      description: 'Bonus',
    });

    await service.deleteTransaction('ws-1', 'tx-inc', 'user-1');

    expect(mockPrisma.wallet.update).toHaveBeenCalledWith({
      where: { id: 'w-1' },
      data: { balance: { increment: new Prisma.Decimal('-1000000') } },
    });
    expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'tx-inc' },
    });
  });
});

