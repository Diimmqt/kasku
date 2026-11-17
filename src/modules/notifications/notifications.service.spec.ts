import { vi } from 'vitest';
import { NotificationType, Prisma, TransactionType } from '../../generated/prisma/client.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    workspaceMember: { findMany: vi.fn() },
    budget: { findMany: vi.fn() },
    transaction: { aggregate: vi.fn() },
    debt: { findMany: vi.fn(), update: vi.fn() },
  };

  const service = new NotificationsService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deduplicates repeated budget warning notifications for the same budget', async () => {
    prisma.budget.findMany.mockResolvedValue([
      {
        id: 'budget-1',
        categoryId: 'cat-food',
        name: 'Makanan',
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-30T23:59:59.999Z'),
        amountLimit: new Prisma.Decimal('1000000'),
        warningThresholdPercent: 80,
        category: { name: 'Makanan' },
      },
    ]);
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('850000') },
    });
    prisma.workspaceMember.findMany.mockResolvedValue([{ userId: 'user-1' }]);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      notificationPreferences: { inApp: true },
    });
    prisma.notification.findFirst.mockResolvedValue({ id: 'notif-existing' });

    await service.evaluateBudgetNotifications(
      'ws-1',
      'cat-food',
      new Date('2026-11-10T00:00:00.000Z'),
    );

    expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: TransactionType.EXPENSE }),
      }),
    );
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('marks unread notification as read', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      id: 'n-1',
      userId: 'u-1',
      type: NotificationType.GOAL_ACHIEVED,
      isRead: false,
    });
    prisma.notification.update.mockResolvedValue({
      id: 'n-1',
      isRead: true,
    });

    const updated = await service.markAsRead('u-1', 'n-1');
    expect(updated.isRead).toBe(true);
    expect(prisma.notification.update).toHaveBeenCalled();
  });
});

