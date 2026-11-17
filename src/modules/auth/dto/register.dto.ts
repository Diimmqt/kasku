import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Budi Santoso', minLength: 2, maxLength: 120 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Nama minimal 2 karakter.' })
  @MaxLength(120, { message: 'Nama maksimal 120 karakter.' })
  name!: string;

  @ApiProperty({ example: 'budi@kasku.app' })
  @IsEmail({}, { message: 'Format email tidak valid.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ example: 'RahasiaKasku123!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8, { message: 'Password minimal 8 karakter.' })
  @MaxLength(128, { message: 'Password maksimal 128 karakter.' })
  password!: string;
}

