import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequireWorkspacePermissions } from '../../common/decorators/workspace-access.decorator.js';
import { WorkspaceAccessGuard } from '../../common/guards/workspace-access.guard.js';
import { QueryReportsDto } from './dto/query-reports.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(WorkspaceAccessGuard)
@Controller('workspaces/:workspaceId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @RequireWorkspacePermissions('canViewReports')
  @ApiOperation({
    summary:
      'Laporan keuangan lengkap: pemasukan, pengeluaran, saldo, kategori, bulanan, tahunan, dan perbandingan periode',
  })
  getSummary(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryReportsDto,
  ) {
    return this.reportsService.getSummary(workspaceId, query);
  }

  @Get('export/excel')
  @RequireWorkspacePermissions('canViewReports')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiOperation({ summary: 'Ekspor laporan keuangan ke Excel (.xlsx)' })
  async exportExcel(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryReportsDto,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportExcel(workspaceId, query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-kasku-${stamp}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('export/pdf')
  @RequireWorkspacePermissions('canViewReports')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Ekspor laporan keuangan ke PDF (.pdf)' })
  async exportPdf(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryReportsDto,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportPdf(workspaceId, query);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-kasku-${stamp}.pdf"`,
    );
    res.send(buffer);
  }
}

