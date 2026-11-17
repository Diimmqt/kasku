import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Keluarga Santoso', minLength: 2, maxLength: 120 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Nama keluarga minimal 2 karakter.' })
  @MaxLength(120, { message: 'Nama keluarga maksimal 120 karakter.' })
  name!: string;

  @ApiPropertyOptional({
    example: 'IDR',
    enum: ['IDR', 'USD', 'SGD', 'MYR', 'EUR'],
    default: 'IDR',
  })
  @IsOptional()
  @IsString()
  @IsIn(['IDR', 'USD', 'SGD', 'MYR', 'EUR'])
  currency?: string;
}

