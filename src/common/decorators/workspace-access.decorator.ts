import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { WorkspacePermissions } from '../constants/workspace-permissions.js';
import type { WorkspaceRole, WorkspaceType } from '../../generated/prisma/enums.js';

export const WORKSPACE_PERMISSIONS_KEY = 'workspacePermissions';
export const WORKSPACE_ROLES_KEY = 'workspaceRoles';

/** Authenticated user's verified membership and permissions inside the requested workspace. */
export interface WorkspaceContext {
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  currency: string;
  ownerId: string;
  role: WorkspaceRole;
  permissions: WorkspacePermissions;
}

/** Requires all specified permission flags (OWNER always bypasses). */
export const RequireWorkspacePermissions = (
  ...permissions: (keyof WorkspacePermissions)[]
) => SetMetadata(WORKSPACE_PERMISSIONS_KEY, permissions);

/** Requires the caller to hold one of the specified workspace roles. */
export const RequireWorkspaceRoles = (...roles: WorkspaceRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);

/** Extracts the verified WorkspaceContext populated by WorkspaceAccessGuard. */
export const CurrentWorkspace = createParamDecorator(
  (field: keyof WorkspaceContext | undefined, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ workspaceContext?: WorkspaceContext }>();
    const ws = request.workspaceContext;
    if (!ws) return undefined;
    return field ? ws[field] : ws;
  },
);

