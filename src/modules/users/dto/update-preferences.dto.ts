import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ThemePreference } from '../../../generated/prisma/enums.js';

export class NotificationPreferencesDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  budgetAlerts?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  savingsGoalAlerts?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  debtDueReminders?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  familyActivityAlerts?: boolean;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: 'IDR', enum: ['IDR', 'USD', 'SGD', 'MYR', 'EUR'] })
  @IsOptional()
  @IsString()
  @IsIn(['IDR', 'USD', 'SGD', 'MYR', 'EUR'], {
    message: 'Mata uang yang didukung: IDR, USD, SGD, MYR, EUR.',
  })
  preferredCurrency?: string;

  @ApiPropertyOptional({
    example: 'DD/MM/YYYY',
    enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], {
    message: 'Format tanggal tidak valid.',
  })
  dateFormat?: string;

  @ApiPropertyOptional({ enum: ThemePreference, example: ThemePreference.LIGHT })
  @IsOptional()
  @IsEnum(ThemePreference, { message: 'Tema harus LIGHT, DARK, atau SYSTEM.' })
  theme?: ThemePreference;

  @ApiPropertyOptional({ type: NotificationPreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;
}

