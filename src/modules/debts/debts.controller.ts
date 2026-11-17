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
import { CreateDebtDto } from './dto/create-debt.dto.js';
import { QueryDebtsDto } from './dto/query-debts.dto.js';
import { RecordDebtPaymentDto } from './dto/record-debt-payment.dto.js';
import { UpdateDebtDto } from './dto/update-debt.dto.js';
import { DebtsService } from './debts.service.js';

@ApiTags('Debts & Receivables')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/debts')
export class DebtsController {
  constructor(private readonly debtsService: DebtsService) {}

  @Get()
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Daftar utang dan piutang beserta status jatuh tempo' })
  listDebts(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryDebtsDto,
  ) {
    return this.debtsService.listDebts(workspaceId, query);
  }

  @Get(':debtId')
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Detail utang/piutang dan riwayat pembayaran' })
  getDebtDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('debtId') debtId: string,
  ) {
    return this.debtsService.getDebtDetail(workspaceId, debtId);
  }

  @Post()
  @RequireWorkspacePermissions('canManageDebts')
  @ApiOperation({ summary: 'Catat utang atau piutang baru' })
  createDebt(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDebtDto,
  ) {
    return this.debtsService.createDebt(workspaceId, user.id, dto);
  }

  @Patch(':debtId')
  @RequireWorkspacePermissions('canManageDebts')
  @ApiOperation({ summary: 'Ubah detail utang atau piutang' })
  updateDebt(
    @Param('workspaceId') workspaceId: string,
    @Param('debtId') debtId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDebtDto,
  ) {
    return this.debtsService.updateDebt(workspaceId, debtId, user.id, dto);
  }

  @Post(':debtId/payments')
  @RequireWorkspacePermissions('canManageDebts')
  @ApiOperation({
    summary:
      'Catat pembayaran utang/piutang dan otomatis buat transaksi pada dompet terkait',
  })
  recordPayment(
    @Param('workspaceId') workspaceId: string,
    @Param('debtId') debtId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordDebtPaymentDto,
  ) {
    return this.debtsService.recordPayment(workspaceId, debtId, user.id, dto);
  }

  @Delete(':debtId/payments/:paymentId')
  @RequireWorkspacePermissions('canManageDebts')
  @ApiOperation({
    summary:
      'Batalkan pembayaran utang/piutang serta transaksi dan perubahan saldo terkait',
  })
  deletePayment(
    @Param('workspaceId') workspaceId: string,
    @Param('debtId') debtId: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.debtsService.deletePayment(
      workspaceId,
      debtId,
      paymentId,
      user.id,
    );
  }

  @Delete(':debtId')
  @RequireWorkspacePermissions('canManageDebts')
  @ApiOperation({ summary: 'Hapus data utang/piutang beserta pembalikan transaksinya' })
  deleteDebt(
    @Param('workspaceId') workspaceId: string,
    @Param('debtId') debtId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.debtsService.deleteDebt(workspaceId, debtId, user.id);
  }
}

