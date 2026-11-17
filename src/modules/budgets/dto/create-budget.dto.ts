import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { BudgetPeriodType } from '../../../generated/prisma/client.js';

export class CreateBudgetDto {
  @ApiProperty({ description: 'ID kategori pengeluaran' })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ example: 'Anggaran Makan Bulanan' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: BudgetPeriodType, default: BudgetPeriodType.MONTHLY })
  @IsOptional()
  @IsEnum(BudgetPeriodType)
  periodType?: BudgetPeriodType;

  @ApiPropertyOptional({
    example: '2026-11',
    description: 'Format YYYY-MM untuk periode bulanan otomatis',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'Format bulan harus YYYY-MM (contoh: 2026-11).',
  })
  month?: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ example: '2500000' })
  @IsString()
  @IsNotEmpty()
  amountLimit!: string;

  @ApiPropertyOptional({ default: 80, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  warningThresholdPercent?: number;
}

