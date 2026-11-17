import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTransactionDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  walletId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  destinationWalletId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @ApiPropertyOptional({ example: '75000' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : value,
  )
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Nominal harus berupa angka positif yang valid.',
  })
  amount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
