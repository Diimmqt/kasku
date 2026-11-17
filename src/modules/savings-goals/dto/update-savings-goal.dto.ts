import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SavingsGoalStatus } from '../../../generated/prisma/client.js';

export class UpdateSavingsGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ example: '20000000' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  targetAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @ApiPropertyOptional({ enum: SavingsGoalStatus })
  @IsOptional()
  @IsEnum(SavingsGoalStatus)
  status?: SavingsGoalStatus;
}

