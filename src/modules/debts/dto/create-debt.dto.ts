import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { DebtType } from '../../../generated/prisma/client.js';

export class CreateDebtDto {
  @ApiProperty({ enum: DebtType })
  @IsEnum(DebtType)
  type!: DebtType;

  @ApiProperty({ example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  counterpartyName!: string;

  @ApiProperty({ example: '2000000' })
  @IsString()
  @IsNotEmpty()
  totalAmount!: string;

  @ApiProperty({ example: '2026-11-10' })
  @IsDateString()
  debtDate!: string;

  @ApiPropertyOptional({ example: '2026-12-10' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'Pinjaman modal usaha sementara' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

