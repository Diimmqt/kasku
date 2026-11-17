import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token yang diperoleh saat login atau refresh sebelumnya.' })
  @IsString()
  @MinLength(16, { message: 'Refresh token tidak valid.' })
  refreshToken!: string;
}

