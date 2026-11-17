import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  OWNER_PERMISSIONS,
} from '../../common/constants/workspace-permissions.js';
import type { WorkspaceContext } from '../../common/decorators/workspace-access.decorator.js';
import {
  InvitationStatus,
  WorkspaceRole,
  WorkspaceType,
} from '../../generated/prisma/enums.js';
import { WorkspacesService } from './workspaces.service.js';

describe('WorkspacesService', () => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    workspace: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    workspaceMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    familyInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: { findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  };

  const mockAuditLogs = {
    record: vi.fn(),
  };

  const mockCategoriesService = {
    ensureDefaultCategories: vi.fn(),
  };

  let service: WorkspacesService;

  const ownerCtx: WorkspaceContext = {
    workspaceId: 'ws-fam-1',
    workspaceName: 'Keluarga Budi',
    workspaceType: WorkspaceType.FAMILY,
    currency: 'IDR',
    ownerId: 'user-owner',
    role: WorkspaceRole.OWNER,
    permissions: { ...OWNER_PERMISSIONS },
  };

  const adminCtx: WorkspaceContext = {
    ...ownerCtx,
    role: WorkspaceRole.ADMIN,
    permissions: { ...DEFAULT_ADMIN_PERMISSIONS, canManageMembers: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    service = new WorkspacesService(
      mockPrisma as never,
      mockAuditLogs as never,
      mockCategoriesService as never,
    );
  });

  it('creates a FAMILY workspace and assigns creator as OWNER', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ preferredCurrency: 'IDR' });
    mockPrisma.workspace.create.mockResolvedValue({
      id: 'ws-fam-1',
      name: 'Keluarga Budi',
      type: WorkspaceType.FAMILY,
      currency: 'IDR',
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createFamilyWorkspace('user-1', {
      name: 'Keluarga Budi',
    });

    expect(result.type).toBe(WorkspaceType.FAMILY);
    expect(result.myRole).toBe(WorkspaceRole.OWNER);
    expect(mockPrisma.workspaceMember.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-fam-1',
        userId: 'user-1',
        role: WorkspaceRole.OWNER,
      }),
    });
  });

  it('prevents inviting members into a PERSONAL workspace', async () => {
    const personalCtx: WorkspaceContext = {
      ...ownerCtx,
      workspaceType: WorkspaceType.PERSONAL,
    };

    await expect(
      service.createInvitation('ws-1', 'user-owner', personalCtx, {
        email: 'other@kasku.app',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents Admin from inviting another Admin or modifying Owner/Admin', async () => {
    await expect(
      service.createInvitation('ws-fam-1', 'user-admin', adminCtx, {
        email: 'new@kasku.app',
        role: 'ADMIN',
      }),
    ).rejects.toThrow(ForbiddenException);

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'mem-admin-2',
      userId: 'user-admin-2',
      role: WorkspaceRole.ADMIN,
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      user: { id: 'user-admin-2', name: 'Admin 2', email: 'a2@kasku.app' },
    });

    await expect(
      service.updateMember('ws-fam-1', 'mem-admin-2', 'user-admin', adminCtx, {
        role: 'MEMBER',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects duplicate pending invitations for the same email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.familyInvitation.findFirst.mockResolvedValue({ id: 'inv-1' });

    await expect(
      service.createInvitation('ws-fam-1', 'user-owner', ownerCtx, {
        email: 'spouse@kasku.app',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('verifies invitedEmail matches current user when accepting invitation', async () => {
    mockPrisma.familyInvitation.findUnique.mockResolvedValue({
      id: 'inv-1',
      workspaceId: 'ws-fam-1',
      invitedEmail: 'spouse@kasku.app',
      role: WorkspaceRole.MEMBER,
      permissions: {},
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 60_000),
      workspace: { id: 'ws-fam-1', name: 'Keluarga Budi' },
    });

    await expect(
      service.acceptInvitation('inv-1', 'wrong-user', 'wrong@kasku.app'),
    ).rejects.toThrow(ForbiddenException);

    mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);

    const accepted = await service.acceptInvitation(
      'inv-1',
      'spouse-user',
      'spouse@kasku.app',
    );
    expect(accepted).toEqual({
      accepted: true,
      workspaceId: 'ws-fam-1',
      workspaceName: 'Keluarga Budi',
    });
    expect(mockPrisma.workspaceMember.create).toHaveBeenCalled();
    expect(mockPrisma.familyInvitation.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: expect.objectContaining({ status: InvitationStatus.ACCEPTED }),
    });
  });
});
