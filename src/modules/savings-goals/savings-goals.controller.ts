import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireWorkspacePermissions } from '../../common/decorators/workspace-access.decorator.js';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { AddContributionDto } from './dto/add-contribution.dto.js';
import { CreateSavingsGoalDto } from './dto/create-savings-goal.dto.js';
import { UpdateSavingsGoalDto } from './dto/update-savings-goal.dto.js';
import { SavingsGoalsService } from './savings-goals.service.js';

@ApiTags('Savings Goals')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/savings-goals')
export class SavingsGoalsController {
  constructor(private readonly savingsGoalsService: SavingsGoalsService) {}

  @Get()
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Daftar target tabungan dan progress pencapaian' })
  listGoals(@Param('workspaceId') workspaceId: string) {
    return this.savingsGoalsService.listGoals(workspaceId);
  }

  @Get(':goalId')
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Detail target tabungan dan riwayat setoran' })
  getGoalDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('goalId') goalId: string,
  ) {
    return this.savingsGoalsService.getGoalDetail(workspaceId, goalId);
  }

  @Post()
  @RequireWorkspacePermissions('canManageGoals')
  @ApiOperation({ summary: 'Buat target tabungan baru' })
  createGoal(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavingsGoalDto,
  ) {
    return this.savingsGoalsService.createGoal(workspaceId, user.id, dto);
  }

  @Patch(':goalId')
  @RequireWorkspacePermissions('canManageGoals')
  @ApiOperation({ summary: 'Ubah detail atau status target tabungan' })
  updateGoal(
    @Param('workspaceId') workspaceId: string,
    @Param('goalId') goalId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSavingsGoalDto,
  ) {
    return this.savingsGoalsService.updateGoal(
      workspaceId,
      goalId,
      user.id,
      dto,
    );
  }

  @Post(':goalId/contributions')
  @RequireWorkspacePermissions('canManageGoals')
  @ApiOperation({
    summary: 'Tambah setoran ke target tabungan (memotong saldo dompet sumber)',
  })
  addContribution(
    @Param('workspaceId') workspaceId: string,
    @Param('goalId') goalId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddContributionDto,
  ) {
    return this.savingsGoalsService.addContribution(
      workspaceId,
      goalId,
      user.id,
      dto,
    );
  }

  @Delete(':goalId/contributions/:contributionId')
  @RequireWorkspacePermissions('canManageGoals')
  @ApiOperation({
    summary: 'Batalkan setoran tabungan dan kembalikan saldo ke dompet sumber',
  })
  deleteContribution(
    @Param('workspaceId') workspaceId: string,
    @Param('goalId') goalId: string,
    @Param('contributionId') contributionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.savingsGoalsService.deleteContribution(
      workspaceId,
      goalId,
      contributionId,
      user.id,
    );
  }

  @Delete(':goalId')
  @RequireWorkspacePermissions('canManageGoals')
  @ApiOperation({ summary: 'Hapus target tabungan dan kembalikan setoran ke dompet sumber' })
  deleteGoal(
    @Param('workspaceId') workspaceId: string,
    @Param('goalId') goalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.savingsGoalsService.deleteGoal(workspaceId, goalId, user.id);
  }
}

