import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WalletType } from '../../../generated/prisma/enums.js';

export class CreateWalletDto {
  @ApiProperty({ example: 'BCA Utama', minLength: 2, maxLength: 100 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Nama dompet minimal 2 karakter.' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: WalletType, example: WalletType.BANK })
  @IsEnum(WalletType, { message: 'Jenis dompet tidak valid.' })
  type!: WalletType;

  @ApiPropertyOptional({
    example: '1500000',
    description: 'Saldo awal dompet (string angka desimal >= 0)',
    default: '0',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : value,
  )
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Saldo awal harus berupa angka valid (>= 0, maksimal 4 desimal).',
  })
  initialBalance?: string;

  @ApiPropertyOptional({ example: '#059669' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ example: 'landmark' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}
