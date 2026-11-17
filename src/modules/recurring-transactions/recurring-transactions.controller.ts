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
import { CreateRecurringDto } from './dto/create-recurring.dto.js';
import { UpdateRecurringDto } from './dto/update-recurring.dto.js';
import { RecurringTransactionsService } from './recurring-transactions.service.js';

@ApiTags('Recurring Transactions')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/recurring-transactions')
export class RecurringTransactionsController {
  constructor(
    private readonly recurringService: RecurringTransactionsService,
  ) {}

  @Get()
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Daftar jadwal transaksi berulang workspace' })
  listRecurring(@Param('workspaceId') workspaceId: string) {
    return this.recurringService.listRecurring(workspaceId);
  }

  @Post()
  @RequireWorkspacePermissions('canManageRecurring')
  @ApiOperation({ summary: 'Buat jadwal transaksi berulang baru' })
  createRecurring(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringDto,
  ) {
    return this.recurringService.createRecurring(workspaceId, user.id, dto);
  }

  @Post('run-due')
  @RequireWorkspacePermissions('canManageRecurring')
  @ApiOperation({
    summary:
      'Jalankan jadwal transaksi berulang yang sudah jatuh tempo (idempoten)',
  })
  runDueSchedules(@Param('workspaceId') workspaceId: string) {
    return this.recurringService.processDueSchedules(workspaceId);
  }

  @Patch(':recurringId')
  @RequireWorkspacePermissions('canManageRecurring')
  @ApiOperation({ summary: 'Ubah atau aktif/nonaktifkan transaksi berulang' })
  updateRecurring(
    @Param('workspaceId') workspaceId: string,
    @Param('recurringId') recurringId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.recurringService.updateRecurring(
      workspaceId,
      recurringId,
      user.id,
      dto,
    );
  }

  @Delete(':recurringId')
  @RequireWorkspacePermissions('canManageRecurring')
  @ApiOperation({ summary: 'Hapus jadwal transaksi berulang' })
  deleteRecurring(
    @Param('workspaceId') workspaceId: string,
    @Param('recurringId') recurringId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recurringService.deleteRecurring(
      workspaceId,
      recurringId,
      user.id,
    );
  }
}

