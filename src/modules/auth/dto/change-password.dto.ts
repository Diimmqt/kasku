import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Password saat ini untuk verifikasi.' })
  @IsString()
  @MinLength(1, { message: 'Password saat ini wajib diisi.' })
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'Password baru minimal 8 karakter.' })
  @MaxLength(128, { message: 'Password baru maksimal 128 karakter.' })
  newPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'Konfirmasi password minimal 8 karakter.' })
  confirmPassword!: string;
}

