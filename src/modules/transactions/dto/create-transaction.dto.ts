import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TransactionType } from '../../../generated/prisma/enums.js';

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType, {
    message: 'Jenis transaksi harus INCOME, EXPENSE, atau TRANSFER.',
  })
  type!: TransactionType;

  @ApiProperty({ description: 'ID dompet utama atau dompet asal (untuk transfer)' })
  @IsUUID('4', { message: 'walletId harus berupa UUID valid.' })
  walletId!: string;

  @ApiPropertyOptional({
    description: 'ID dompet tujuan (wajib dan hanya untuk transaksi TRANSFER)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'destinationWalletId harus berupa UUID valid.' })
  destinationWalletId?: string;

  @ApiPropertyOptional({
    description: 'ID kategori (wajib untuk INCOME/EXPENSE, kosongkan untuk TRANSFER)',
  })
  @IsOptional()
  @IsUUID('4', { message: 'categoryId harus berupa UUID valid.' })
  categoryId?: string;

  @ApiProperty({
    example: '50000',
    description: 'Nominal transaksi positif (maksimal 4 desimal)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : value,
  )
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Nominal harus berupa angka positif yang valid.',
  })
  amount!: string;

  @ApiProperty({ example: '2026-11-13T10:00:00.000Z' })
  @IsDateString({}, { message: 'Tanggal transaksi harus berformat ISO tanggal valid.' })
  transactionDate!: string;

  @ApiProperty({ example: 'Makan siang keluarga' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1, { message: 'Deskripsi transaksi wajib diisi.' })
  @MaxLength(255)
  description!: string;

  @ApiPropertyOptional({ example: 'Pembayaran via QRIS' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
