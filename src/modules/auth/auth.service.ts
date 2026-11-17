import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OWNER_PERMISSIONS } from '../../common/constants/workspace-permissions.js';
import { JwtPayload } from '../../common/types/auth.types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { WorkspaceRole, WorkspaceType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { SafeUser, USER_SAFE_SELECT } from '../users/users.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { GoogleOAuthUser } from './strategies/google.strategy.js';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  budgetAlerts: true,
  savingsGoalAlerts: true,
  debtDueReminders: true,
  familyActivityAlerts: true,
};

export interface RequestMetaContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponsePayload {
  user: SafeUser;
  tokens: AuthTokenPair;
  defaultWorkspaceId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogs: AuditLogsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: RequestMetaContext = {},
  ): Promise<AuthResponsePayload> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Email sudah terdaftar.');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
        },
        select: USER_SAFE_SELECT,
      });

      const workspace = await this.createPersonalWorkspaceForUser(tx, user);
      const tokens = await this.issueSessionTokens(user, randomUUID(), meta, tx);

      await this.auditLogs.record(
        {
          workspaceId: workspace.id,
          userId: user.id,
          action: 'USER_REGISTERED',
          entityType: 'User',
          entityId: user.id,
        },
        tx,
      );

      return { user, tokens, defaultWorkspaceId: workspace.id };
    });

    return result;
  }

  async login(
    dto: LoginDto,
    meta: RequestMetaContext = {},
  ): Promise<AuthResponsePayload> {
    const userRecord = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        ...USER_SAFE_SELECT,
        passwordHash: true,
      },
    });

    if (!userRecord) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    if (!userRecord.passwordHash) {
      throw new UnauthorizedException(
        'Akun ini terdaftar menggunakan Google. Silakan masuk dengan Google.',
      );
    }

    const validPassword = await argon2.verify(
      userRecord.passwordHash,
      dto.password,
    );
    if (!validPassword) {
      throw new UnauthorizedException('Email atau password salah.');
    }

    const { passwordHash: _omitted, ...user } = userRecord;
    const defaultWorkspaceId = await this.resolveDefaultWorkspaceId(
      this.prisma,
      user.id,
    );

    const tokens = await this.prisma.$transaction(async (tx) => {
      const issued = await this.issueSessionTokens(
        user,
        randomUUID(),
        meta,
        tx,
      );

      await this.auditLogs.record(
        {
          userId: user.id,
          action: 'USER_LOGGED_IN',
          entityType: 'User',
          entityId: user.id,
        },
        tx,
      );

      return issued;
    });

    return {
      user,
      tokens,
      defaultWorkspaceId,
    };
  }

  /** Authenticates or provisions a user from a verified Google OAuth profile. */
  async loginWithGoogle(
    googleUser: GoogleOAuthUser,
    meta: RequestMetaContext = {},
  ): Promise<AuthResponsePayload> {
    const normalizedEmail = googleUser.email.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      let existing = await tx.user.findUnique({
        where: { googleId: googleUser.googleId },
        select: {
          ...USER_SAFE_SELECT,
          googleId: true,
        },
      });

      if (!existing) {
        existing = await tx.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            ...USER_SAFE_SELECT,
            googleId: true,
          },
        });
      }

      if (
        existing?.googleId &&
        existing.googleId !== googleUser.googleId
      ) {
        throw new UnauthorizedException(
          'Akun email ini sudah terhubung dengan akun Google lain.',
        );
      }

      let user: SafeUser;
      let defaultWorkspaceId: string;
      let isNewUser = false;

      if (!existing) {
        isNewUser = true;
        user = await tx.user.create({
          data: {
            name: googleUser.name,
            email: normalizedEmail,
            passwordHash: null,
            googleId: googleUser.googleId,
            avatarUrl: googleUser.avatarUrl,
            notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
          },
          select: USER_SAFE_SELECT,
        });

        const workspace = await this.createPersonalWorkspaceForUser(tx, user);
        defaultWorkspaceId = workspace.id;
      } else {
        const shouldLinkGoogle = !existing.googleId;
        const shouldSetAvatar = !existing.avatarUrl && Boolean(googleUser.avatarUrl);

        if (shouldLinkGoogle || shouldSetAvatar) {
          user = await tx.user.update({
            where: { id: existing.id },
            data: {
              ...(shouldLinkGoogle ? { googleId: googleUser.googleId } : {}),
              ...(shouldSetAvatar ? { avatarUrl: googleUser.avatarUrl } : {}),
            },
            select: USER_SAFE_SELECT,
          });
        } else {
          const { googleId: _omitted, ...safeUser } = existing;
          user = safeUser;
        }

        defaultWorkspaceId = await this.resolveDefaultWorkspaceId(tx, user.id);
      }

      const tokens = await this.issueSessionTokens(
        user,
        randomUUID(),
        meta,
        tx,
      );

      await this.auditLogs.record(
        {
          ...(isNewUser ? { workspaceId: defaultWorkspaceId } : {}),
          userId: user.id,
          action: isNewUser
            ? 'USER_REGISTERED_GOOGLE'
            : 'USER_LOGGED_IN_GOOGLE',
          entityType: 'User',
          entityId: user.id,
        },
        tx,
      );

      return {
        user,
        tokens,
        defaultWorkspaceId,
      };
    });
  }

  buildGoogleCallbackRedirectUrl(payload: AuthResponsePayload): string {
    const rawFrontendUrls =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const frontendOrigin = rawFrontendUrls
      .split(',')[0]
      .trim()
      .replace(/\/+$/, '');

    const fragmentParams = new URLSearchParams({
      accessToken: payload.tokens.accessToken,
      refreshToken: payload.tokens.refreshToken,
      expiresIn: payload.tokens.expiresIn,
      defaultWorkspaceId: payload.defaultWorkspaceId,
    });

    return `${frontendOrigin}/auth/google/callback#${fragmentParams.toString()}`;
  }

  /** Rotates a refresh token and revokes the whole token family if reuse is detected. */
  async refresh(
    dto: RefreshTokenDto,
    meta: RequestMetaContext = {},
  ): Promise<{ tokens: AuthTokenPair }> {
    const incomingHash = this.hashToken(dto.refreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: incomingHash },
      include: {
        user: {
          select: USER_SAFE_SELECT,
        },
      },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token tidak valid.');
    }

    if (existing.revokedAt !== null) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditLogs.record({
        userId: existing.userId,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entityType: 'RefreshToken',
        entityId: existing.id,
        metadata: { familyId: existing.familyId },
      });

      throw new UnauthorizedException(
        'Sesi tidak valid atau terdeteksi penggunaan ulang token. Silakan login kembali.',
      );
    }

    if (existing.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Refresh token telah kedaluwarsa. Silakan login kembali.',
      );
    }

    const tokens = await this.prisma.$transaction(async (tx) => {
      const rawNextRefresh = this.generateOpaqueToken();
      const nextHash = this.hashToken(rawNextRefresh);
      const nextExpiresAt = this.computeRefreshExpiryDate();

      const createdToken = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: nextHash,
          familyId: existing.familyId,
          expiresAt: nextExpiresAt,
          userAgent: meta.userAgent?.slice(0, 255) ?? null,
          ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
        },
      });

      await tx.refreshToken.update({
        where: { id: existing.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: createdToken.id,
        },
      });

      const { accessToken, expiresIn } = await this.signAccessToken(existing.user);

      return {
        accessToken,
        refreshToken: rawNextRefresh,
        expiresIn,
      };
    });

    return { tokens };
  }

  async logout(userId: string, dto: LogoutDto): Promise<{ loggedOut: true }> {
    if (dto.allDevices) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else if (dto.refreshToken) {
      const tokenHash = this.hashToken(dto.refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditLogs.record({
      userId,
      action: 'USER_LOGGED_OUT',
      entityType: 'User',
      entityId: userId,
      metadata: { allDevices: Boolean(dto.allDevices) },
    });

    return { loggedOut: true };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ changed: true }> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'Konfirmasi password baru tidak cocok dengan password baru.',
      );
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'Password baru tidak boleh sama dengan password saat ini.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException('Akun pengguna tidak ditemukan.');
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Akun yang masuk menggunakan Google belum memiliki password lokal.',
      );
    }

    const isCurrentValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Password saat ini tidak sesuai.');
    }

    const newHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditLogs.record(
        {
          userId,
          action: 'USER_PASSWORD_CHANGED',
          entityType: 'User',
          entityId: userId,
        },
        tx,
      );
    });

    return { changed: true };
  }

  private async createPersonalWorkspaceForUser(
    tx: Prisma.TransactionClient,
    user: Pick<SafeUser, 'id' | 'preferredCurrency'>,
  ) {
    const workspace = await tx.workspace.create({
      data: {
        name: 'Keuangan Pribadi',
        type: WorkspaceType.PERSONAL,
        currency: user.preferredCurrency,
        ownerId: user.id,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: WorkspaceRole.OWNER,
        permissions: OWNER_PERMISSIONS as unknown as Prisma.InputJsonValue,
      },
    });

    await this.categoriesService.ensureDefaultCategories(workspace.id, tx);
    return workspace;
  }

  private async resolveDefaultWorkspaceId(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
  ): Promise<string> {
    const personalWorkspace = await db.workspace.findFirst({
      where: { ownerId: userId, type: WorkspaceType.PERSONAL },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (personalWorkspace) {
      return personalWorkspace.id;
    }

    const fallbackMembership = await db.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
      orderBy: { joinedAt: 'asc' },
    });
    return fallbackMembership?.workspaceId ?? '';
  }

  private async issueSessionTokens(
    user: Pick<SafeUser, 'id' | 'email'>,
    familyId: string,
    meta: RequestMetaContext,
    tx: Prisma.TransactionClient,
  ): Promise<AuthTokenPair> {
    const rawRefreshToken = this.generateOpaqueToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = this.computeRefreshExpiryDate();

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
        ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      },
    });

    const { accessToken, expiresIn } = await this.signAccessToken(user);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn,
    };
  }

  private async signAccessToken(
    user: Pick<SafeUser, 'id' | 'email'>,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const expiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    return { accessToken, expiresIn };
  }

  private generateOpaqueToken(): string {
    return randomBytes(48).toString('hex');
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private computeRefreshExpiryDate(): Date {
    const raw =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(raw.trim());
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    const ms = match
      ? Number(match[1]) * (multipliers[match[2]] ?? 86_400_000)
      : 7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  }
}

