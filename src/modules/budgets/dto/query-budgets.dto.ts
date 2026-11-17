import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';

export enum BudgetUsageStatus {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  EXCEEDED = 'EXCEEDED',
}

export class QueryBudgetsDto {
  @ApiPropertyOptional({ example: '2026-11', description: 'Filter anggaran yang mencakup bulan YYYY-MM' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Format bulan harus YYYY-MM (contoh: 2026-11).',
  })
  month?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: BudgetUsageStatus })
  @IsOptional()
  @IsEnum(BudgetUsageStatus)
  status?: BudgetUsageStatus;
}

