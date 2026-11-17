import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { WorkspacesService } from './workspaces.service.js';

@ApiTags('Family Invitations')
@ApiBearerAuth()
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Daftar undangan keluarga yang masuk untuk pengguna aktif' })
  listMyInvitations(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.listMyPendingInvitations(user.email);
  }

  @Post(':invitationId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terima undangan Family Workspace' })
  acceptInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspacesService.acceptInvitation(
      invitationId,
      user.id,
      user.email,
    );
  }

  @Post(':invitationId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tolak undangan Family Workspace' })
  rejectInvitation(
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspacesService.rejectInvitation(
      invitationId,
      user.id,
      user.email,
    );
  }
}

