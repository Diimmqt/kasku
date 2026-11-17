import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryType } from '../../generated/prisma/enums.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService', () => {
  const mockPrisma = {
    category: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockAuditLogs = { record: vi.fn() };
  let service: CategoriesService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    service = new CategoriesService(mockPrisma as never, mockAuditLogs as never);
  });

  it('seeds default categories when workspace has none', async () => {
    mockPrisma.category.count.mockResolvedValue(0);
    await service.ensureDefaultCategories('ws-1');
    expect(mockPrisma.category.createMany).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate category name within the same type and workspace', async () => {
    mockPrisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });

    await expect(
      service.createCategory('ws-1', 'user-1', {
        name: 'Makanan',
        type: CategoryType.EXPENSE,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('archives instead of deleting when category is used in transactions', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({
      id: 'cat-1',
      name: 'Kopi',
      isDefault: false,
      _count: { transactions: 3 },
    });

    const res = await service.deleteOrArchiveCategory('ws-1', 'cat-1', 'user-1');

    expect(res).toEqual({ deleted: false, archived: true });
    expect(mockPrisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1' },
      data: { isArchived: true },
    });
    expect(mockPrisma.category.delete).not.toHaveBeenCalled();
  });
});

