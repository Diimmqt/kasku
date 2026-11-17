import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  resolvePermissionsForRole,
  type WorkspacePermissions,
} from '../constants/workspace-permissions.js';
import {
  WORKSPACE_PERMISSIONS_KEY,
  WORKSPACE_ROLES_KEY,
  type WorkspaceContext,
} from '../decorators/workspace-access.decorator.js';
import type { AuthenticatedUser } from '../types/auth.types.js';
import { WorkspaceRole, WorkspaceType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params?: Record<string, string>;
      workspaceContext?: WorkspaceContext;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Autentikasi diperlukan.');
    }

    const workspaceId = request.params?.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Parameter workspaceId wajib disertakan.');
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            type: true,
            currency: true,
            ownerId: true,
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Anda bukan anggota dari workspace ini atau workspace tidak ditemukan.',
      );
    }

    if (
      membership.workspace.type === WorkspaceType.PERSONAL &&
      membership.workspace.ownerId !== user.id
    ) {
      throw new ForbiddenException(
        'Workspace pribadi hanya dapat diakses oleh pemiliknya.',
      );
    }

    const permissions = resolvePermissionsForRole(
      membership.role,
      membership.permissions as Partial<WorkspacePermissions> | null,
    );

    const workspaceContext: WorkspaceContext = {
      workspaceId: membership.workspace.id,
      workspaceName: membership.workspace.name,
      workspaceType: membership.workspace.type,
      currency: membership.workspace.currency,
      ownerId: membership.workspace.ownerId,
      role: membership.role,
      permissions,
    };

    request.workspaceContext = workspaceContext;

    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(membership.role)) {
        throw new ForbiddenException(
          'Role Anda tidak memiliki izin untuk melakukan aksi ini.',
        );
      }
    }

    const requiredPermissions = this.reflector.getAllAndOverride<
      (keyof WorkspacePermissions)[]
    >(WORKSPACE_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (
      requiredPermissions &&
      requiredPermissions.length > 0 &&
      membership.role !== WorkspaceRole.OWNER
    ) {
      const missing = requiredPermissions.filter((perm) => !permissions[perm]);
      if (missing.length > 0) {
        throw new ForbiddenException(
          'Anda tidak memiliki izin akses untuk operasi keuangan ini.',
        );
      }
    }

    return true;
  }
}

