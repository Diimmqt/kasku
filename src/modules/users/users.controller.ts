import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { UpdatePreferencesDto } from './dto/update-preferences.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Ambil profil pengguna yang sedang login' })
  @ApiResponse({ status: 200, description: 'Profil pengguna berhasil diambil.' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Perbarui profil pengguna (nama, email, avatar)' })
  @ApiResponse({ status: 200, description: 'Profil berhasil diperbarui.' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('me/preferences')
  @ApiOperation({
    summary: 'Perbarui preferensi mata uang, format tanggal, tema, dan notifikasi',
  })
  @ApiResponse({ status: 200, description: 'Preferensi berhasil diperbarui.' })
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(user.id, dto);
  }
}

