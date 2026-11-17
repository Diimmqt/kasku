import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AddContributionDto {
  @ApiProperty({ description: 'ID dompet sumber dana setoran' })
  @IsUUID()
  walletId!: string;

  @ApiProperty({ example: '1000000' })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional({ example: '2026-11-13' })
  @IsOptional()
  @IsDateString()
  contributionDate?: string;

  @ApiPropertyOptional({ example: 'Sisihan gaji bulan ini' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

