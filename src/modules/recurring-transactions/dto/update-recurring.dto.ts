import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  RecurringFrequency,
  TransactionType,
} from '../../../generated/prisma/client.js';

export class UpdateRecurringDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  walletId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ enum: [TransactionType.INCOME, TransactionType.EXPENSE] })
  @IsOptional()
  @IsEnum([TransactionType.INCOME, TransactionType.EXPENSE], {
    message: 'Transaksi berulang hanya mendukung jenis INCOME atau EXPENSE.',
  })
  type?: TransactionType;

  @ApiPropertyOptional({ example: '200000' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;

  @ApiPropertyOptional({ enum: RecurringFrequency })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

