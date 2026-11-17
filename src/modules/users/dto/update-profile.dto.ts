import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Budi Santoso', minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Nama minimal 2 karakter.' })
  @MaxLength(120, { message: 'Nama maksimal 120 karakter.' })
  name?: string;

  @ApiPropertyOptional({ example: 'budi@kasku.app' })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'URL foto profil harus berupa http/https yang valid.' },
  )
  @MaxLength(500)
  avatarUrl?: string | null;
}

