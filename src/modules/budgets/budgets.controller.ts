import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireWorkspacePermissions } from '../../common/decorators/workspace-access.decorator.js';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { BudgetsService } from './budgets.service.js';
import { CreateBudgetDto } from './dto/create-budget.dto.js';
import { QueryBudgetsDto } from './dto/query-budgets.dto.js';
import { UpdateBudgetDto } from './dto/update-budget.dto.js';

@ApiTags('Budgets')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Daftar anggaran dan ringkasan penggunaan kategori pengeluaran' })
  listBudgets(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryBudgetsDto,
  ) {
    return this.budgetsService.listBudgets(workspaceId, query);
  }

  @Get(':budgetId')
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Detail anggaran dan progress pengeluaran' })
  getBudgetDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('budgetId') budgetId: string,
  ) {
    return this.budgetsService.getBudgetDetail(workspaceId, budgetId);
  }

  @Post()
  @RequireWorkspacePermissions('canManageBudgets')
  @ApiOperation({ summary: 'Buat anggaran baru untuk kategori pengeluaran' })
  createBudget(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgetsService.createBudget(workspaceId, user.id, dto);
  }

  @Patch(':budgetId')
  @RequireWorkspacePermissions('canManageBudgets')
  @ApiOperation({ summary: 'Ubah batas atau periode anggaran' })
  updateBudget(
    @Param('workspaceId') workspaceId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.updateBudget(
      workspaceId,
      budgetId,
      user.id,
      dto,
    );
  }

  @Delete(':budgetId')
  @RequireWorkspacePermissions('canManageBudgets')
  @ApiOperation({ summary: 'Hapus anggaran' })
  deleteBudget(
    @Param('workspaceId') workspaceId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetsService.deleteBudget(workspaceId, budgetId, user.id);
  }
}

