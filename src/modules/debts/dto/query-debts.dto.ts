import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DebtStatus, DebtType } from '../../../generated/prisma/client.js';

export class QueryDebtsDto {
  @ApiPropertyOptional({ enum: DebtType })
  @IsOptional()
  @IsEnum(DebtType)
  type?: DebtType;

  @ApiPropertyOptional({ enum: DebtStatus })
  @IsOptional()
  @IsEnum(DebtStatus)
  status?: DebtStatus;
}

