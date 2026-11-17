import { Global, Module } from '@nestjs/common';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import { InvitationsController } from './invitations.controller.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Global()
@Module({
  controllers: [WorkspacesController, InvitationsController],
  providers: [WorkspacesService, WorkspaceAccessGuard],
  exports: [WorkspacesService, WorkspaceAccessGuard],
})
export class WorkspacesModule {}

