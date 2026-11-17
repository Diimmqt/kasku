import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ReportPeriodPreset } from '../../../common/utils/date-range.util.js';

export class QueryReportsDto {
  @ApiPropertyOptional({
    enum: ReportPeriodPreset,
    default: ReportPeriodPreset.THIS_MONTH,
  })
  @IsOptional()
  @IsEnum(ReportPeriodPreset)
  period?: ReportPeriodPreset;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Tahun untuk tren bulanan 12 bulan (laporan tahunan)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

