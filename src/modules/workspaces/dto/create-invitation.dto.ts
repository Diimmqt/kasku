import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { WorkspacePermissionsDto } from './workspace-permissions.dto.js';

export class CreateInvitationDto {
  @ApiProperty({ example: 'pasangan@kasku.app' })
  @IsEmail({}, { message: 'Format email anggota tidak valid.' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' })
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'], {
    message: 'Role undangan hanya boleh ADMIN atau MEMBER.',
  })
  role?: 'ADMIN' | 'MEMBER';

  @ApiPropertyOptional({ type: WorkspacePermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspacePermissionsDto)
  permissions?: WorkspacePermissionsDto;
}

