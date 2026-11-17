import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ReportPeriodPreset } from '../../../common/utils/date-range.util.js';

export class QueryDashboardDto {
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
}

