import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_ACCESS_SECRET') ??
          'dev-insecure-access-secret-change-me',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
            '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GoogleOAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}

