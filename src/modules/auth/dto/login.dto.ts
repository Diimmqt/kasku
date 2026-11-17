import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'budi@kasku.app' })
  @IsEmail({}, { message: 'Format email tidak valid.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({ example: 'RahasiaKasku123!' })
  @IsString()
  @MinLength(1, { message: 'Password wajib diisi.' })
  password!: string;
}

