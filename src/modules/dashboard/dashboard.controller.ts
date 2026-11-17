import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireWorkspacePermissions } from '../../common/decorators/workspace-access.decorator.js';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import { DashboardService } from './dashboard.service.js';
import { QueryDashboardDto } from './dto/query-dashboard.dto.js';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({
    summary: 'Ringkasan dashboard keuangan workspace sesuai periode',
  })
  getDashboard(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryDashboardDto,
  ) {
    return this.dashboardService.getDashboard(workspaceId, query);
  }
}

