import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  OWNER_PERMISSIONS,
  resolvePermissionsForRole,
  type WorkspacePermissions,
} from '../../common/constants/workspace-permissions.js';
import type { WorkspaceContext } from '../../common/decorators/workspace-access.decorator.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  InvitationStatus,
  NotificationType,
  WorkspaceRole,
  WorkspaceType,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { QueryActivitiesDto } from './dto/query-activities.dto.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly categoriesService: CategoriesService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async listMyWorkspaces(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: [{ workspace: { type: 'asc' } }, { joinedAt: 'asc' }],
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      type: m.workspace.type,
      currency: m.workspace.currency,
      ownerId: m.workspace.ownerId,
      myRole: m.role,
      myPermissions: resolvePermissionsForRole(
        m.role,
        m.permissions as Partial<WorkspacePermissions> | null,
      ),
      memberCount: m.workspace._count.members,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
    }));
  }

  async createFamilyWorkspace(userId: string, dto: CreateWorkspaceDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredCurrency: true },
    });
    const currency = dto.currency ?? user?.preferredCurrency ?? 'IDR';

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          type: WorkspaceType.FAMILY,
          currency,
          ownerId: userId,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
          permissions: OWNER_PERMISSIONS as unknown as Prisma.InputJsonValue,
        },
      });

      await this.categoriesService.ensureDefaultCategories(workspace.id, tx);

      await this.auditLogs.record(
        {
          workspaceId: workspace.id,
          userId,
          action: 'FAMILY_WORKSPACE_CREATED',
          entityType: 'Workspace',
          entityId: workspace.id,
          metadata: { name: workspace.name, currency: workspace.currency },
        },
        tx,
      );

      return {
        id: workspace.id,
        name: workspace.name,
        type: workspace.type,
        currency: workspace.currency,
        ownerId: workspace.ownerId,
        myRole: WorkspaceRole.OWNER,
        myPermissions: { ...OWNER_PERMISSIONS },
        memberCount: 1,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      };
    });
  }

  async getWorkspaceDetail(ctx: WorkspaceContext) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      include: {
        _count: { select: { members: true } },
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace tidak ditemukan.');
    }

    return {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      currency: workspace.currency,
      ownerId: workspace.ownerId,
      myRole: ctx.role,
      myPermissions: ctx.permissions,
      memberCount: workspace._count.members,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        },
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'WORKSPACE_UPDATED',
          entityType: 'Workspace',
          entityId: workspaceId,
          metadata: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          },
        },
        tx,
      );

      return updated;
    });
  }

  async listMembers(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role,
      permissions: resolvePermissionsForRole(
        m.role,
        m.permissions as Partial<WorkspacePermissions> | null,
      ),
      joinedAt: m.joinedAt,
      user: m.user,
    }));
  }

  async updateMember(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
    actorCtx: WorkspaceContext,
    dto: UpdateMemberDto,
  ) {
    if (actorCtx.workspaceType !== WorkspaceType.FAMILY) {
      throw new BadRequestException(
        'Pengaturan anggota hanya tersedia pada Family Workspace.',
      );
    }

    const target = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });
    if (!target) {
      throw new NotFoundException('Anggota keluarga tidak ditemukan.');
    }

    if (target.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Role Owner tidak dapat diubah atau diturunkan.',
      );
    }

    if (target.userId === actorUserId) {
      throw new BadRequestException(
        'Anda tidak dapat mengubah role atau permission diri sendiri.',
      );
    }

    if (actorCtx.role !== WorkspaceRole.OWNER) {
      if (target.role === WorkspaceRole.ADMIN) {
        throw new ForbiddenException(
          'Hanya Owner yang dapat mengubah pengaturan Admin.',
        );
      }
      if (dto.role === WorkspaceRole.ADMIN) {
        throw new ForbiddenException(
          'Hanya Owner yang dapat menaikkan role anggota menjadi Admin.',
        );
      }
    }

    const nextRole =
      (dto.role as WorkspaceRole | undefined) ?? target.role;
    const currentPerms = target.permissions as Partial<WorkspacePermissions> | null;
    const basePerms = resolvePermissionsForRole(
      nextRole,
      dto.role && dto.role !== target.role ? undefined : currentPerms,
    );
    const mergedPerms = dto.permissions
      ? resolvePermissionsForRole(nextRole, {
          canViewTransactions:
            dto.permissions.canViewTransactions ?? basePerms.canViewTransactions,
          canManageTransactions:
            dto.permissions.canManageTransactions ??
            basePerms.canManageTransactions,
          canManageWallets:
            dto.permissions.canManageWallets ?? basePerms.canManageWallets,
          canManageCategories:
            dto.permissions.canManageCategories ??
            basePerms.canManageCategories,
          canManageBudgets:
            dto.permissions.canManageBudgets ?? basePerms.canManageBudgets,
          canManageGoals:
            dto.permissions.canManageGoals ?? basePerms.canManageGoals,
          canManageDebts:
            dto.permissions.canManageDebts ?? basePerms.canManageDebts,
          canManageRecurring:
            dto.permissions.canManageRecurring ?? basePerms.canManageRecurring,
          canViewReports:
            dto.permissions.canViewReports ?? basePerms.canViewReports,
          canManageMembers:
            dto.permissions.canManageMembers ?? basePerms.canManageMembers,
          canManageSettings:
            dto.permissions.canManageSettings ?? basePerms.canManageSettings,
        })
      : basePerms;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.workspaceMember.update({
        where: { id: target.id },
        data: {
          role: nextRole,
          permissions: mergedPerms as unknown as Prisma.InputJsonValue,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId: actorUserId,
          action: 'FAMILY_MEMBER_UPDATED',
          entityType: 'WorkspaceMember',
          entityId: target.id,
          metadata: {
            targetUserId: target.userId,
            targetEmail: target.user.email,
            role: nextRole,
          },
        },
        tx,
      );

      return {
        id: updated.id,
        workspaceId: updated.workspaceId,
        userId: updated.userId,
        role: updated.role,
        permissions: mergedPerms,
        joinedAt: updated.joinedAt,
        user: updated.user,
      };
    });
  }

  async removeMember(
    workspaceId: string,
    memberId: string,
    actorUserId: string,
    actorCtx: WorkspaceContext,
  ): Promise<{ removed: true }> {
    if (actorCtx.workspaceType !== WorkspaceType.FAMILY) {
      throw new BadRequestException(
        'Penghapusan anggota hanya berlaku pada Family Workspace.',
      );
    }

    const target = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!target) {
      throw new NotFoundException('Anggota keluarga tidak ditemukan.');
    }

    if (target.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Owner tidak dapat dihapus dari workspace.');
    }

    if (target.userId === actorUserId) {
      throw new BadRequestException(
        'Gunakan fitur keluar workspace untuk meninggalkan keluarga.',
      );
    }

    if (
      actorCtx.role !== WorkspaceRole.OWNER &&
      target.role === WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Hanya Owner yang dapat menghapus anggota dengan role Admin.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.delete({ where: { id: target.id } });
      await this.auditLogs.record(
        {
          workspaceId,
          userId: actorUserId,
          action: 'FAMILY_MEMBER_REMOVED',
          entityType: 'WorkspaceMember',
          entityId: target.id,
          metadata: {
            removedUserId: target.userId,
            removedEmail: target.user.email,
          },
        },
        tx,
      );
    });

    return { removed: true };
  }

  async leaveWorkspace(
    workspaceId: string,
    userId: string,
    ctx: WorkspaceContext,
  ): Promise<{ left: true }> {
    if (ctx.workspaceType !== WorkspaceType.FAMILY) {
      throw new BadRequestException(
        'Anda tidak dapat keluar dari Personal Workspace.',
      );
    }
    if (ctx.role === WorkspaceRole.OWNER) {
      throw new BadRequestException(
        'Owner tidak dapat meninggalkan Family Workspace.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.delete({
        where: {
          workspaceId_userId: { workspaceId, userId },
        },
      });
      await this.auditLogs.record(
        {
          workspaceId,
          userId,
          action: 'FAMILY_MEMBER_LEFT',
          entityType: 'Workspace',
          entityId: workspaceId,
        },
        tx,
      );
    });

    return { left: true };
  }

  async listWorkspaceInvitations(workspaceId: string) {
    return this.prisma.familyInvitation.findMany({
      where: { workspaceId },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvitation(
    workspaceId: string,
    actorUserId: string,
    actorCtx: WorkspaceContext,
    dto: CreateInvitationDto,
  ) {
    if (actorCtx.workspaceType !== WorkspaceType.FAMILY) {
      throw new BadRequestException(
        'Undangan anggota hanya dapat dikirim pada Family Workspace.',
      );
    }

    const inviteRole = (dto.role ?? 'MEMBER') as 'ADMIN' | 'MEMBER';
    if (
      actorCtx.role !== WorkspaceRole.OWNER &&
      inviteRole === WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Hanya Owner yang dapat mengundang anggota sebagai Admin.',
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
        select: { id: true },
      });
      if (existingMember) {
        throw new ConflictException(
          'Pengguna dengan email tersebut sudah menjadi anggota workspace ini.',
        );
      }
    }

    const existingPending = await this.prisma.familyInvitation.findFirst({
      where: {
        workspaceId,
        invitedEmail: dto.email,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (existingPending) {
      throw new ConflictException(
        'Undangan aktif untuk email tersebut sudah pernah dikirim.',
      );
    }

    const permissions = resolvePermissionsForRole(inviteRole, dto.permissions);

    const invitation = await this.prisma.$transaction(async (tx) => {
      const createdInv = await tx.familyInvitation.create({
        data: {
          workspaceId,
          invitedEmail: dto.email,
          invitedByUserId: actorUserId,
          role: inviteRole,
          permissions: permissions as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        },
        include: {
          invitedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await this.auditLogs.record(
        {
          workspaceId,
          userId: actorUserId,
          action: 'FAMILY_INVITATION_SENT',
          entityType: 'FamilyInvitation',
          entityId: createdInv.id,
          metadata: { invitedEmail: dto.email, role: inviteRole },
        },
        tx,
      );

      return createdInv;
    });

    if (existingUser && this.notifications) {
      await this.notifications.notifyUser({
        userId: existingUser.id,
        workspaceId,
        type: NotificationType.FAMILY_INVITATION,
        title: 'Undangan Workspace Keluarga',
        message: `${invitation.invitedBy.name} mengundang Anda bergabung ke ${actorCtx.workspaceName} sebagai ${inviteRole}.`,
        referenceType: 'FAMILY_INVITATION',
        referenceId: invitation.id,
        deduplicate: true,
      });
    }

    return invitation;
  }

  async cancelInvitation(
    workspaceId: string,
    invitationId: string,
    actorUserId: string,
  ): Promise<{ cancelled: true }> {
    const invitation = await this.prisma.familyInvitation.findFirst({
      where: { id: invitationId, workspaceId },
    });
    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan.');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        'Hanya undangan berstatus PENDING yang dapat dibatalkan.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.CANCELLED },
      });
      await this.auditLogs.record(
        {
          workspaceId,
          userId: actorUserId,
          action: 'FAMILY_INVITATION_CANCELLED',
          entityType: 'FamilyInvitation',
          entityId: invitation.id,
          metadata: { invitedEmail: invitation.invitedEmail },
        },
        tx,
      );
    });

    return { cancelled: true };
  }

  async listMyPendingInvitations(userEmail: string) {
    return this.prisma.familyInvitation.findMany({
      where: {
        invitedEmail: userEmail.toLowerCase(),
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: {
        workspace: { select: { id: true, name: true, currency: true, type: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptInvitation(
    invitationId: string,
    userId: string,
    userEmail: string,
  ) {
    const invitation = await this.prisma.familyInvitation.findUnique({
      where: { id: invitationId },
      include: { workspace: { select: { id: true, name: true } } },
    });

    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan.');
    }

    if (invitation.invitedEmail.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        'Undangan ini tidak ditujukan untuk akun Anda.',
      );
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Undangan sudah tidak berlaku.');
    }

    if (invitation.expiresAt <= new Date()) {
      await this.prisma.familyInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.EXPIRED },
      });
      throw new BadRequestException('Undangan telah kedaluwarsa.');
    }

    const acceptedResult = await this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
      });

      const resolvedPerms = resolvePermissionsForRole(
        invitation.role,
        invitation.permissions as Partial<WorkspacePermissions> | null,
      );

      if (!existingMember) {
        await tx.workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId,
            role: invitation.role,
            permissions: resolvedPerms as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await tx.familyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      await this.auditLogs.record(
        {
          workspaceId: invitation.workspaceId,
          userId,
          action: 'FAMILY_INVITATION_ACCEPTED',
          entityType: 'FamilyInvitation',
          entityId: invitation.id,
          metadata: { role: invitation.role },
        },
        tx,
      );

      return {
        accepted: true,
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspace.name,
      };
    });

    if (this.notifications) {
      await this.notifications.notifyWorkspaceMembers({
        workspaceId: invitation.workspaceId,
        excludeUserId: userId,
        type: NotificationType.FAMILY_ACTIVITY,
        title: 'Anggota Keluarga Baru Bergabung',
        message: `${userEmail} menerima undangan dan bergabung ke ${invitation.workspace.name}.`,
        referenceType: 'FAMILY_INVITATION',
        referenceId: invitation.id,
        deduplicate: true,
      });
    }

    return acceptedResult;
  }

  async rejectInvitation(
    invitationId: string,
    userId: string,
    userEmail: string,
  ): Promise<{ rejected: true }> {
    const invitation = await this.prisma.familyInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Undangan tidak ditemukan.');
    }

    if (invitation.invitedEmail.toLowerCase() !== userEmail.toLowerCase()) {
      throw new ForbiddenException(
        'Undangan ini tidak ditujukan untuk akun Anda.',
      );
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Undangan sudah diproses sebelumnya.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.familyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.REJECTED,
          respondedAt: new Date(),
        },
      });

      await this.auditLogs.record(
        {
          workspaceId: invitation.workspaceId,
          userId,
          action: 'FAMILY_INVITATION_REJECTED',
          entityType: 'FamilyInvitation',
          entityId: invitation.id,
        },
        tx,
      );
    });

    return { rejected: true };
  }

  async listActivities(workspaceId: string, query: QueryActivitiesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where: { workspaceId } }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }
}
