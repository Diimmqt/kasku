import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateRecurringDto {
  @ApiProperty({ description: 'ID dompet' })
  @IsUUID()
  walletId!: string;

  @ApiProperty({ description: 'ID kategori sesuai jenis transaksi' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ enum: [TransactionType.INCOME, TransactionType.EXPENSE] })
  @IsEnum([TransactionType.INCOME, TransactionType.EXPENSE], {
    message: 'Transaksi berulang hanya mendukung jenis INCOME atau EXPENSE.',
  })
  type!: TransactionType;

  @ApiProperty({ example: '150000' })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiProperty({ example: 'Langganan Internet Rumah' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ enum: RecurringFrequency })
  @IsEnum(RecurringFrequency)
  frequency!: RecurringFrequency;

  @ApiProperty({ example: '2026-11-15' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2027-11-15' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

