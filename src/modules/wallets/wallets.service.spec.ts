import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { WalletType } from '../../generated/prisma/enums.js';
import { WalletsService } from './wallets.service.js';

describe('WalletsService', () => {
  const mockPrisma = {
    wallet: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockAuditLogs = { record: vi.fn() };
  let service: WalletsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    service = new WalletsService(mockPrisma as never, mockAuditLogs as never);
  });

  it('sums active wallet balances accurately using Decimal without floating point errors', async () => {
    mockPrisma.wallet.findMany.mockResolvedValue([
      {
        id: 'w-1',
        name: 'Cash',
        balance: new Prisma.Decimal('0.1'),
        initialBalance: new Prisma.Decimal('0.1'),
        isArchived: false,
        _count: { outgoingTransactions: 0, incomingTransactions: 0 },
      },
      {
        id: 'w-2',
        name: 'Bank',
        balance: new Prisma.Decimal('0.2'),
        initialBalance: new Prisma.Decimal('0.2'),
        isArchived: false,
        _count: { outgoingTransactions: 0, incomingTransactions: 0 },
      },
      {
        id: 'w-3',
        name: 'Archived',
        balance: new Prisma.Decimal('999'),
        initialBalance: new Prisma.Decimal('999'),
        isArchived: true,
        _count: { outgoingTransactions: 0, incomingTransactions: 0 },
      },
    ]);

    const result = await service.listWallets('ws-1', {});
    expect(result.totalBalance).toBe('0.3');
  });

  it('creates wallet with initialBalance copied to balance', async () => {
    mockPrisma.wallet.create.mockResolvedValue({
      id: 'w-1',
      name: 'BCA',
      type: WalletType.BANK,
      balance: new Prisma.Decimal('2500000'),
      initialBalance: new Prisma.Decimal('2500000'),
    });

    const result = await service.createWallet('ws-1', 'IDR', 'user-1', {
      name: 'BCA',
      type: WalletType.BANK,
      initialBalance: '2500000',
    });

    expect(result.balance).toBe('2500000');
  });

  it('rejects deleting a wallet that still has transaction history', async () => {
    mockPrisma.wallet.findFirst.mockResolvedValue({
      id: 'w-1',
      name: 'BCA',
      _count: { outgoingTransactions: 1, incomingTransactions: 0 },
    });

    await expect(
      service.deleteWallet('ws-1', 'w-1', 'user-1'),
    ).rejects.toThrow(ConflictException);
  });
});

