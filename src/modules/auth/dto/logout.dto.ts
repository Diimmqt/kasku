import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token sesi saat ini yang akan dicabut.' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'Jika true, cabut seluruh sesi refresh token milik pengguna.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  allDevices?: boolean;
}

