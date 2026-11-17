import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class RecordDebtPaymentDto {
  @ApiProperty({ description: 'ID dompet yang digunakan untuk membayar/menerima' })
  @IsUUID()
  walletId!: string;

  @ApiProperty({ example: '500000' })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional({ example: '2026-11-13' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'Cicilan tahap 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

