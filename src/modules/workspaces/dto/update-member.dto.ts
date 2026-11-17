import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, ValidateNested } from 'class-validator';
import { WorkspacePermissionsDto } from './workspace-permissions.dto.js';

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ['ADMIN', 'MEMBER'] })
  @IsOptional()
  @IsIn(['ADMIN', 'MEMBER'], {
    message: 'Role anggota hanya boleh ADMIN atau MEMBER.',
  })
  role?: 'ADMIN' | 'MEMBER';

  @ApiPropertyOptional({ type: WorkspacePermissionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspacePermissionsDto)
  permissions?: WorkspacePermissionsDto;
}

