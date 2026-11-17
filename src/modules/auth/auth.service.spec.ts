import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRole, WorkspaceType } from '../../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    workspaceMember: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockJwtService = {
    signAsync: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn((key: string) => {
      if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return undefined;
    }),
  };

  const mockAuditLogs = {
    record: vi.fn(),
  };

  const mockCategoriesService = {
    ensureDefaultCategories: vi.fn(),
  };

  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwtService.signAsync.mockResolvedValue('signed-access-token');
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    authService = new AuthService(
      mockPrisma as never,
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService,
      mockAuditLogs as never,
      mockCategoriesService as never,
    );
  });

  it('registers a user with Argon2id hash and auto-creates a Personal Workspace', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Budi',
      email: 'budi@kasku.app',
      preferredCurrency: 'IDR',
      dateFormat: 'DD/MM/YYYY',
      theme: 'LIGHT',
      avatarUrl: null,
      notificationPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.workspace.create.mockResolvedValue({ id: 'ws-personal-1' });

    const result = await authService.register({
      name: 'Budi',
      email: 'budi@kasku.app',
      password: 'Password123!',
    });

    expect(result.defaultWorkspaceId).toBe('ws-personal-1');
    expect(result.tokens.accessToken).toBe('signed-access-token');
    expect(result.tokens.refreshToken).toHaveLength(96);

    const createUserCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createUserCall.data.passwordHash).toMatch(/^\$argon2id\$/);

    expect(mockPrisma.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: WorkspaceType.PERSONAL,
        ownerId: 'user-1',
      }),
    });
    expect(mockPrisma.workspaceMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-personal-1',
        userId: 'user-1',
        role: WorkspaceRole.OWNER,
      }),
    });
  });

  it('rejects duplicate email on register', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      authService.register({
        name: 'Budi',
        email: 'budi@kasku.app',
        password: 'Password123!',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('logs in valid user and returns defaultWorkspaceId', async () => {
    const hash = await argon2.hash('Password123!', { type: argon2.argon2id });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Budi',
      email: 'budi@kasku.app',
      passwordHash: hash,
      preferredCurrency: 'IDR',
      dateFormat: 'DD/MM/YYYY',
      theme: 'LIGHT',
      avatarUrl: null,
      notificationPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'ws-personal-1' });

    const result = await authService.login({
      email: 'budi@kasku.app',
      password: 'Password123!',
    });

    expect(result.user.email).toBe('budi@kasku.app');
    expect('passwordHash' in result.user).toBe(false);
    expect(result.defaultWorkspaceId).toBe('ws-personal-1');
  });

  it('rejects login with invalid password', async () => {
    const hash = await argon2.hash('Password123!', { type: argon2.argon2id });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'budi@kasku.app',
      passwordHash: hash,
    });

    await expect(
      authService.login({ email: 'budi@kasku.app', password: 'WrongPassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rotates valid refresh token and revokes previous one', async () => {
    const rawToken = 'a'.repeat(96);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      tokenHash,
      familyId: 'fam-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', email: 'budi@kasku.app' },
    });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-2' });

    const result = await authService.refresh({ refreshToken: rawToken });

    expect(result.tokens.accessToken).toBe('signed-access-token');
    expect(result.tokens.refreshToken).not.toBe(rawToken);
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: expect.objectContaining({
        replacedByTokenId: 'rt-2',
      }),
    });
  });

  it('revokes entire token family if refresh token reuse is detected', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      familyId: 'fam-compromised',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 'user-1', email: 'budi@kasku.app' },
    });

    await expect(
      authService.refresh({ refreshToken: 'r'.repeat(96) }),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-compromised', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('verifies current password and revokes active refresh tokens on changePassword', async () => {
    const oldHash = await argon2.hash('OldPass123!', { type: argon2.argon2id });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      passwordHash: oldHash,
    });

    await expect(
      authService.changePassword('user-1', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
        confirmPassword: 'Mismatch!',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      authService.changePassword('user-1', {
        currentPassword: 'WrongCurrent',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!',
      }),
    ).rejects.toThrow(UnauthorizedException);

    const ok = await authService.changePassword('user-1', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    });

    expect(ok).toEqual({ changed: true });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: expect.stringMatching(/^\$argon2id\$/) },
    });
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

