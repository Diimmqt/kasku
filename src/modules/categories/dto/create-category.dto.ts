import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CategoryType } from '../../../generated/prisma/enums.js';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Investasi', minLength: 2, maxLength: 100 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(2, { message: 'Nama kategori minimal 2 karakter.' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @IsEnum(CategoryType, { message: 'Jenis kategori harus INCOME atau EXPENSE.' })
  type!: CategoryType;

  @ApiPropertyOptional({ example: 'tag', default: 'tag' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: '#059669', default: '#059669' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
