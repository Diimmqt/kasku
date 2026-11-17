import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.configService
      .get<string>('GOOGLE_CLIENT_SECRET')
      ?.trim();

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Google OAuth belum dikonfigurasi pada server.',
      );
    }

    return super.canActivate(context);
  }

  override getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const isCallback = Boolean(req.query?.code || req.query?.error);

    return isCallback
      ? { session: false }
      : { session: false, prompt: 'select_account' };
  }

  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    _context: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new UnauthorizedException('Autentikasi Google gagal.');
    }

    if (!user) {
      const infoMessage =
        typeof info === 'object' &&
        info !== null &&
        'message' in info &&
        typeof (info as { message?: unknown }).message === 'string'
          ? (info as { message: string }).message
          : undefined;

      if (status === 403) {
        throw new ForbiddenException(
          infoMessage ?? 'State OAuth tidak valid atau telah kedaluwarsa.',
        );
      }

      throw new UnauthorizedException(
        infoMessage ?? 'Autentikasi Google dibatalkan atau gagal.',
      );
    }

    return user;
  }
}

