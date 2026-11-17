import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceRole, WorkspaceType } from '../../generated/prisma/enums.js';
import { WorkspaceAccessGuard } from './workspace-access.guard.js';

describe('WorkspaceAccessGuard', () => {
  const mockReflector = {
    getAllAndOverride: vi.fn(),
  };

  const mockPrisma = {
    workspaceMember: {
      findUnique: vi.fn(),
    },
  };

  let guard: WorkspaceAccessGuard;

  const createContext = (
    userId = 'user-1',
    workspaceId = 'ws-1',
  ): { ctx: ExecutionContext; req: Record<string, unknown> } => {
    const req: Record<string, unknown> = {
      user: { id: userId, email: 'user@kasku.app', name: 'User' },
      params: { workspaceId },
    };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    return { ctx, req };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    guard = new WorkspaceAccessGuard(
      mockReflector as unknown as Reflector,
      mockPrisma as never,
    );
  });

  it('rejects user who is not a member of the workspace', async () => {
    mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
    const { ctx } = createContext('stranger', 'ws-1');

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('blocks non-owner access to PERSONAL workspace even if membership existed', async () => {
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
      permissions: {},
      workspace: {
        id: 'ws-personal',
        name: 'Private',
        type: WorkspaceType.PERSONAL,
        currency: 'IDR',
        ownerId: 'owner-1',
      },
    });
    const { ctx } = createContext('other-user', 'ws-personal');

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('blocks MEMBER lacking required permission and allows OWNER', async () => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(['canManageWallets']);

    mockPrisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
      permissions: { canManageWallets: false },
      workspace: {
        id: 'ws-fam',
        name: 'Keluarga',
        type: WorkspaceType.FAMILY,
        currency: 'IDR',
        ownerId: 'owner-1',
      },
    });
    const { ctx: memberCtx } = createContext('member-1', 'ws-fam');

    await expect(guard.canActivate(memberCtx)).rejects.toThrow(
      ForbiddenException,
    );

    mockReflector.getAllAndOverride
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(['canManageWallets']);
    mockPrisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
      permissions: { canManageWallets: true },
      workspace: {
        id: 'ws-fam',
        name: 'Keluarga',
        type: WorkspaceType.FAMILY,
        currency: 'IDR',
        ownerId: 'owner-1',
      },
    });
    const { ctx: ownerCtx, req } = createContext('owner-1', 'ws-fam');

    await expect(guard.canActivate(ownerCtx)).resolves.toBe(true);
    expect(req.workspaceContext).toMatchObject({
      workspaceId: 'ws-fam',
      role: WorkspaceRole.OWNER,
    });
  });
});

