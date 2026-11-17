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
import { PaginatedOrMessageResponse } from '../../common/interceptors/response.interceptor.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { CreateTransactionDto } from './dto/create-transaction.dto.js';
import { QueryTransactionsDto } from './dto/query-transactions.dto.js';
import { UpdateTransactionDto } from './dto/update-transaction.dto.js';
import { TransactionsService } from './transactions.service.js';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({
    summary: 'Daftar transaksi dengan filter tanggal, kategori, jenis, pencarian, dan pagination',
  })
  async listTransactions(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryTransactionsDto,
  ) {
    const result = await this.transactionsService.listTransactions(
      workspaceId,
      query,
    );
    return new PaginatedOrMessageResponse(result.items, result.meta);
  }

  @Get(':transactionId')
  @RequireWorkspacePermissions('canViewTransactions')
  @ApiOperation({ summary: 'Detail transaksi beserta riwayat pembuat' })
  getTransactionDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionsService.getTransactionDetail(
      workspaceId,
      transactionId,
    );
  }

  @Post()
  @RequireWorkspacePermissions('canManageTransactions')
  @ApiOperation({ summary: 'Catat transaksi baru (Income, Expense, atau Transfer)' })
  createTransaction(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.createTransaction(
      workspaceId,
      user.id,
      dto,
    );
  }

  @Patch(':transactionId')
  @RequireWorkspacePermissions('canManageTransactions')
  @ApiOperation({ summary: 'Edit transaksi dan sinkronkan saldo dompet secara atomik' })
  updateTransaction(
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.updateTransaction(
      workspaceId,
      transactionId,
      user.id,
      dto,
    );
  }

  @Delete(':transactionId')
  @RequireWorkspacePermissions('canManageTransactions')
  @ApiOperation({ summary: 'Hapus transaksi dan kembalikan saldo dompet secara atomik' })
  deleteTransaction(
    @Param('workspaceId') workspaceId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.deleteTransaction(
      workspaceId,
      transactionId,
      user.id,
    );
  }
}

