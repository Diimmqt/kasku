import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

export const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  preferredCurrency: true,
  dateFormat: true,
  theme: true,
  notificationPreferences: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof USER_SAFE_SELECT }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async getMe(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_SAFE_SELECT,
    });
    if (!user) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!existing) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (emailTaken) {
        throw new ConflictException('Email sudah digunakan oleh akun lain.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        },
        select: USER_SAFE_SELECT,
      });

      await this.auditLogs.record(
        {
          userId,
          action: 'USER_PROFILE_UPDATED',
          entityType: 'User',
          entityId: userId,
          metadata: {
            fields: Object.keys(dto).filter(
              (key) => dto[key as keyof UpdateProfileDto] !== undefined,
            ),
          },
        },
        tx,
      );

      return updated;
    });
  }

  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, notificationPreferences: true },
    });
    if (!existing) {
      throw new NotFoundException('Pengguna tidak ditemukan.');
    }

    const currentPrefs =
      existing.notificationPreferences &&
      typeof existing.notificationPreferences === 'object' &&
      !Array.isArray(existing.notificationPreferences)
        ? (existing.notificationPreferences as Record<string, unknown>)
        : {};

    const mergedNotificationPreferences = dto.notificationPreferences
      ? {
          ...currentPrefs,
          ...(dto.notificationPreferences.budgetAlerts !== undefined
            ? { budgetAlerts: dto.notificationPreferences.budgetAlerts }
            : {}),
          ...(dto.notificationPreferences.savingsGoalAlerts !== undefined
            ? { savingsGoalAlerts: dto.notificationPreferences.savingsGoalAlerts }
            : {}),
          ...(dto.notificationPreferences.debtDueReminders !== undefined
            ? { debtDueReminders: dto.notificationPreferences.debtDueReminders }
            : {}),
          ...(dto.notificationPreferences.familyActivityAlerts !== undefined
            ? {
                familyActivityAlerts:
                  dto.notificationPreferences.familyActivityAlerts,
              }
            : {}),
        }
      : undefined;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.preferredCurrency !== undefined
          ? { preferredCurrency: dto.preferredCurrency }
          : {}),
        ...(dto.dateFormat !== undefined ? { dateFormat: dto.dateFormat } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
        ...(mergedNotificationPreferences !== undefined
          ? { notificationPreferences: mergedNotificationPreferences }
          : {}),
      },
      select: USER_SAFE_SELECT,
    });
  }
}
