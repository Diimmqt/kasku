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
import {
  CurrentWorkspace,
  RequireWorkspacePermissions,
  type WorkspaceContext,
} from '../../common/decorators/workspace-access.decorator.js';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { CreateWalletDto } from './dto/create-wallet.dto.js';
import { QueryWalletsDto } from './dto/query-wallets.dto.js';
import { UpdateWalletDto } from './dto/update-wallet.dto.js';
import { WalletsService } from './wallets.service.js';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar dompet dan total saldo workspace aktif' })
  listWallets(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryWalletsDto,
  ) {
    return this.walletsService.listWallets(workspaceId, query);
  }

  @Get(':walletId')
  @ApiOperation({ summary: 'Detail dompet dan riwayat transaksi terkait' })
  getWalletDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('walletId') walletId: string,
  ) {
    return this.walletsService.getWalletDetail(workspaceId, walletId);
  }

  @Post()
  @RequireWorkspacePermissions('canManageWallets')
  @ApiOperation({ summary: 'Buat dompet baru pada workspace aktif' })
  createWallet(
    @Param('workspaceId') workspaceId: string,
    @CurrentWorkspace() ctx: WorkspaceContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWalletDto,
  ) {
    return this.walletsService.createWallet(
      workspaceId,
      ctx.currency,
      user.id,
      dto,
    );
  }

  @Patch(':walletId')
  @RequireWorkspacePermissions('canManageWallets')
  @ApiOperation({ summary: 'Ubah informasi atau status arsip dompet' })
  updateWallet(
    @Param('workspaceId') workspaceId: string,
    @Param('walletId') walletId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.walletsService.updateWallet(
      workspaceId,
      walletId,
      user.id,
      dto,
    );
  }

  @Delete(':walletId')
  @RequireWorkspacePermissions('canManageWallets')
  @ApiOperation({ summary: 'Hapus dompet jika belum memiliki transaksi' })
  deleteWallet(
    @Param('workspaceId') workspaceId: string,
    @Param('walletId') walletId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.walletsService.deleteWallet(workspaceId, walletId, user.id);
  }
}

