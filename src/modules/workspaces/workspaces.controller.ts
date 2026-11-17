import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  CurrentWorkspace,
  RequireWorkspacePermissions,
  type WorkspaceContext,
} from '../../common/decorators/workspace-access.decorator.js';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import { PaginatedOrMessageResponse } from '../../common/interceptors/response.interceptor.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import { QueryActivitiesDto } from './dto/query-activities.dto.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import { WorkspacesService } from './workspaces.service.js';

@ApiTags('Workspaces & Family')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar seluruh workspace milik pengguna aktif' })
  listMyWorkspaces(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.listMyWorkspaces(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Buat Family Workspace baru' })
  createFamilyWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.createFamilyWorkspace(user.id, dto);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceAccessGuard)
  @ApiOperation({ summary: 'Ambil detail workspace aktif' })
  getWorkspaceDetail(@CurrentWorkspace() ctx: WorkspaceContext) {
    return this.workspacesService.getWorkspaceDetail(ctx);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceAccessGuard)
  @RequireWorkspacePermissions('canManageSettings')
  @ApiOperation({ summary: 'Ubah nama atau mata uang workspace' })
  updateWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.updateWorkspace(workspaceId, user.id, dto);
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceAccessGuard)
  @ApiOperation({ summary: 'Lihat daftar anggota workspace' })
  listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listMembers(workspaceId);
  }

  @Patch(':workspaceId/members/:memberId')
  @UseGuards(WorkspaceAccessGuard)
  @RequireWorkspacePermissions('canManageMembers')
  @ApiOperation({ summary: 'Ubah role dan permission anggota keluarga' })
  updateMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.workspacesService.updateMember(
      workspaceId,
      memberId,
      user.id,
      ctx,
      dto,
    );
  }

  @Delete(':workspaceId/members/:memberId')
  @UseGuards(WorkspaceAccessGuard)
  @RequireWorkspacePermissions('canManageMembers')
  @ApiOperation({ summary: 'Hapus anggota dari Family Workspace' })
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
  ) {
    return this.workspacesService.removeMember(
      workspaceId,
      memberId,
      user.id,
      ctx,
    );
  }

  @Post(':workspaceId/leave')
  @UseGuards(WorkspaceAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Keluar dari Family Workspace (non-owner)' })
  leaveWorkspace(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
  ) {
    return this.workspacesService.leaveWorkspace(workspaceId, user.id, ctx);
  }

  @Get(':workspaceId/invitations')
  @UseGuards(WorkspaceAccessGuard)
  @RequireWorkspacePermissions('canManageMembers')
  @ApiOperation({ summary: 'Daftar undangan anggota pada Family Workspace' })
  listWorkspaceInvitations(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listWorkspaceInvitations(workspaceId);
  }

  @Post(':workspaceId/invitations')
  @UseGuards(WorkspaceAccessGuard)
  @RequireWorkspacePermissions('canManageMembers')
  @ApiOperation({ summary: 'Undang anggota baru ke Family Workspace via email' })
  createInvitation(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.workspacesService.createInvitation(
      workspaceId,
      user.id,
      ctx,
      dto,
    );
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @UseGuards(WorkspaceAccessGuard)
  @RequireWorkspacePermissions('canManageMembers')
  @ApiOperation({ summary: 'Batalkan undangan anggota yang masih pending' })
  cancelInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workspacesService.cancelInvitation(
      workspaceId,
      invitationId,
      user.id,
    );
  }

  @Get(':workspaceId/activities')
  @UseGuards(WorkspaceAccessGuard)
  @ApiOperation({ summary: 'Lihat log aktivitas anggota pada workspace' })
  async listActivities(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryActivitiesDto,
  ) {
    const result = await this.workspacesService.listActivities(
      workspaceId,
      query,
    );
    return new PaginatedOrMessageResponse(result.items, result.meta);
  }
}

