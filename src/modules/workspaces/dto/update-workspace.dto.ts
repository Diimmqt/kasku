import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Keluarga Besar Santoso' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Nama workspace minimal 2 karakter.' })
  @MaxLength(120, { message: 'Nama workspace maksimal 120 karakter.' })
  name?: string;

  @ApiPropertyOptional({
    example: 'IDR',
    enum: ['IDR', 'USD', 'SGD', 'MYR', 'EUR'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['IDR', 'USD', 'SGD', 'MYR', 'EUR'])
  currency?: string;
}

