import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  type Profile,
  type VerifyCallback,
} from 'passport-google-oauth20';
import { GoogleOAuthStateStore } from './google-oauth-state.store.js';

export interface GoogleOAuthUser {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID =
      configService.get<string>('GOOGLE_CLIENT_ID')?.trim() ||
      'google-oauth-not-configured';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET')?.trim() ||
      'google-oauth-not-configured';
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL')?.trim() ||
      'http://localhost:3000/api/v1/auth/google/callback';
    const stateSecret =
      configService.get<string>('GOOGLE_OAUTH_STATE_SECRET')?.trim() ||
      configService.get<string>('JWT_ACCESS_SECRET')?.trim() ||
      'dev-insecure-oauth-state-secret-change-me';
    const isProduction = configService.get<string>('NODE_ENV') === 'production';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: false,
      store: new GoogleOAuthStateStore(stateSecret, isProduction),
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const googleId = profile.id?.trim();
    const verifiedEmailEntry = profile.emails?.find(
      (entry) => entry.verified === true,
    );
    const jsonEmailVerified = profile._json?.email_verified;
    const rawJsonEmail =
      jsonEmailVerified === true ? profile._json.email : undefined;

    const candidateEmail =
      jsonEmailVerified === false
        ? undefined
        : (verifiedEmailEntry?.value ?? rawJsonEmail);
    const verifiedEmail = candidateEmail?.trim().toLowerCase();

    if (!googleId || !verifiedEmail) {
      done(
        new UnauthorizedException(
          'Email akun Google belum terverifikasi atau tidak tersedia.',
        ),
        false,
      );
      return;
    }

    const fallbackName = verifiedEmail.split('@')[0] || 'Pengguna Kasku';
    const name = (profile.displayName?.trim() || fallbackName).slice(0, 120);
    const avatarUrl = profile.photos?.[0]?.value?.trim() || null;

    const user: GoogleOAuthUser = {
      googleId,
      email: verifiedEmail,
      name,
      avatarUrl,
    };

    done(null, user);
  }
}
