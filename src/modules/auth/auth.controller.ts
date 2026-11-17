import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../../common/types/auth.types.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import type { GoogleOAuthUser } from './strategies/google.strategy.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Registrasi akun baru dan otomatis membuat Personal Workspace',
  })
  @ApiResponse({ status: 201, description: 'Registrasi berhasil.' })
  @ApiResponse({ status: 409, description: 'Email sudah terdaftar.' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.extractMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login dengan email dan password' })
  @ApiResponse({ status: 200, description: 'Login berhasil.' })
  @ApiResponse({ status: 401, description: 'Kredensial salah.' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractMeta(req));
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Rotasi access token & refresh token' })
  @ApiResponse({ status: 200, description: 'Token berhasil diperbarui.' })
  @ApiResponse({ status: 401, description: 'Refresh token tidak valid.' })
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto, this.extractMeta(req));
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Logout dan cabut refresh token' })
  @ApiResponse({ status: 200, description: 'Logout berhasil.' })
  logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    return this.authService.logout(user.id, dto);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  @ApiOperation({
    summary: 'Ganti password setelah memverifikasi password saat ini',
  })
  @ApiResponse({ status: 200, description: 'Password berhasil diganti.' })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleOAuthGuard)
  @Get('google')
  @ApiOperation({
    summary: 'Memulai autentikasi Google OAuth 2.0',
  })
  @ApiResponse({
    status: 302,
    description: 'Mengarahkan browser ke halaman login Google.',
  })
  @ApiResponse({
    status: 503,
    description: 'Google OAuth belum dikonfigurasi.',
  })
  googleAuth() {
    // Redirect ke Google ditangani oleh GoogleOAuthGuard.
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(GoogleOAuthGuard)
  @Get('google/callback')
  @ApiOperation({
    summary:
      'Callback Google OAuth 2.0 untuk menerbitkan JWT Access Token & Refresh Token lalu mengarahkan ke frontend',
  })
  @ApiResponse({
    status: 302,
    description: 'Mengarahkan kembali ke frontend setelah login berhasil.',
  })
  @ApiResponse({
    status: 401,
    description: 'Email Google belum terverifikasi atau autentikasi gagal.',
  })
  @ApiResponse({
    status: 403,
    description: 'Validasi state/CSRF OAuth gagal.',
  })
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = req.user as GoogleOAuthUser;
    const authPayload = await this.authService.loginWithGoogle(
      googleUser,
      this.extractMeta(req),
    );
    const redirectUrl =
      this.authService.buildGoogleCallbackRedirectUrl(authPayload);
    res.redirect(redirectUrl);
  }

  private extractMeta(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}

