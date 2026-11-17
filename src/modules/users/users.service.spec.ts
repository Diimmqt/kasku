import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemePreference } from '../../generated/prisma/enums.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockAuditLogs = {
    record: vi.fn(),
  };

  let usersService: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    usersService = new UsersService(mockPrisma as never, mockAuditLogs as never);
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(usersService.getMe('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('prevents updating email to an email already used by another user', async () => {
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: 'user-1', email: 'a@kasku.app' })
      .mockResolvedValueOnce({ id: 'user-2' });

    await expect(
      usersService.updateProfile('user-1', { email: 'taken@kasku.app' }),
    ).rejects.toThrow(ConflictException);
  });

  it('merges notificationPreferences when updating user preferences', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      notificationPreferences: { budgetAlerts: true, debtDueReminders: true },
    });
    mockPrisma.user.update.mockResolvedValue({
      id: 'user-1',
      theme: ThemePreference.DARK,
      notificationPreferences: {
        budgetAlerts: false,
        debtDueReminders: true,
      },
    });

    const result = await usersService.updatePreferences('user-1', {
      theme: ThemePreference.DARK,
      notificationPreferences: { budgetAlerts: false },
    });

    expect(result.theme).toBe(ThemePreference.DARK);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          theme: ThemePreference.DARK,
          notificationPreferences: {
            budgetAlerts: false,
            debtDueReminders: true,
          },
        }),
      }),
    );
  });
});

