import {
  BadRequestException,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter.js';
import { WorkspaceRole, WorkspaceType } from '../../generated/prisma/enums.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  GoogleOAuthStateStore,
} from './strategies/google-oauth-state.store.js';
import { GoogleStrategy } from './strategies/google.strategy.js';

describe('Google OAuth 2.0 Integration', () => {
  describe('GoogleOAuthStateStore', () => {
    const store = new GoogleOAuthStateStore('test-oauth-state-secret', false);

    it('issues an HMAC-signed state and HttpOnly SameSite=Lax CSRF cookie, and verifies matching pair', () => {
      const cookieJar: Record<string, { value: string; options: unknown }> = {};
      const clearedCookies: string[] = [];

      const storeReq = {
        res: {
          cookie: (name: string, value: string, options: unknown) => {
            cookieJar[name] = { value, options };
          },
        },
      } as unknown as Request;

      let issuedState = '';
      store.store(storeReq, (err, state) => {
        expect(err).toBeNull();
        issuedState = String(state);
      });

      expect(issuedState).toContain('.');
      const savedCookie = cookieJar[GOOGLE_OAUTH_STATE_COOKIE];
      expect(savedCookie).toBeDefined();
      expect(savedCookie.options).toEqual(
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/api/v1/auth',
        }),
      );

      const verifyReq = {
        headers: {
          cookie: `${GOOGLE_OAUTH_STATE_COOKIE}=${encodeURIComponent(savedCookie.value)}`,
        },
        res: {
          clearCookie: (name: string) => {
            clearedCookies.push(name);
          },
        },
      } as unknown as Request;

      store.verify(verifyReq, issuedState, (err, ok) => {
        expect(err).toBeNull();
        expect(ok).toBe(true);
      });
      expect(clearedCookies).toContain(GOOGLE_OAUTH_STATE_COOKIE);
    });

    it('rejects tampered state or missing/mismatched CSRF cookie', () => {
      const cookieJar: Record<string, string> = {};
      const storeReq = {
        res: {
          cookie: (name: string, value: string) => {
            cookieJar[name] = value;
          },
        },
      } as unknown as Request;

      let issuedState = '';
      store.store(storeReq, (_err, state) => {
        issuedState = String(state);
      });

      const missingCookieReq = {
        headers: {},
        res: { clearCookie: vi.fn() },
      } as unknown as Request;

      store.verify(missingCookieReq, issuedState, (err, ok) => {
        expect(err).toBeNull();
        expect(ok).toBe(false);
      });

      const tamperedStateReq = {
        headers: {
          cookie: `${GOOGLE_OAUTH_STATE_COOKIE}=${encodeURIComponent(cookieJar[GOOGLE_OAUTH_STATE_COOKIE])}`,
        },
        res: { clearCookie: vi.fn() },
      } as unknown as Request;

      store.verify(tamperedStateReq, `${issuedState}tampered`, (err, ok) => {
        expect(err).toBeNull();
        expect(ok).toBe(false);
      });
    });
  });

  describe('GoogleStrategy', () => {
    const configService = {
      get: vi.fn((key: string) => {
        const map: Record<string, string> = {
          GOOGLE_CLIENT_ID: 'client-id-test',
          GOOGLE_CLIENT_SECRET: 'client-secret-test',
          GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/google/callback',
          JWT_ACCESS_SECRET: 'jwt-secret-test',
          NODE_ENV: 'test',
        };
        return map[key];
      }),
    } as unknown as ConfigService;

    const strategy = new GoogleStrategy(configService);

    it('accepts a verified Google profile and normalizes email', () => {
      const done = vi.fn();
      strategy.validate(
        'google-access-token',
        'google-refresh-token',
        {
          id: 'google-sub-123',
          provider: 'google',
          displayName: 'Siti Aminah',
          profileUrl: '',
          emails: [{ value: 'Siti.Aminah@Gmail.com', verified: true }],
          photos: [{ value: 'https://lh3.googleusercontent.com/avatar.png' }],
          _raw: '{}',
          _json: {
            iss: 'https://accounts.google.com',
            aud: 'client-id-test',
            sub: 'google-sub-123',
            email: 'Siti.Aminah@Gmail.com',
            email_verified: true,
            iat: 1,
            exp: 2,
          },
        },
        done,
      );

      expect(done).toHaveBeenCalledWith(null, {
        googleId: 'google-sub-123',
        email: 'siti.aminah@gmail.com',
        name: 'Siti Aminah',
        avatarUrl: 'https://lh3.googleusercontent.com/avatar.png',
      });
    });

    it('rejects Google profiles whose email is not verified', () => {
      const done = vi.fn();
      strategy.validate(
        'google-access-token',
        'google-refresh-token',
        {
          id: 'google-sub-456',
          provider: 'google',
          displayName: 'Unverified User',
          profileUrl: '',
          emails: [{ value: 'unverified@gmail.com', verified: false }],
          _raw: '{}',
          _json: {
            iss: 'https://accounts.google.com',
            aud: 'client-id-test',
            sub: 'google-sub-456',
            email: 'unverified@gmail.com',
            email_verified: false,
            iat: 1,
            exp: 2,
          },
        },
        done,
      );

      expect(done).toHaveBeenCalledWith(expect.any(UnauthorizedException), false);
    });
  });

  describe('AuthService.loginWithGoogle & passwordHash guards', () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      workspace: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      workspaceMember: {
        create: vi.fn(),
        findFirst: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const mockJwtService = {
      signAsync: vi.fn(),
    };

    const mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
        if (key === 'FRONTEND_URL') return 'http://localhost:5173';
        return undefined;
      }),
    };

    const mockAuditLogs = {
      record: vi.fn(),
    };

    const mockCategoriesService = {
      ensureDefaultCategories: vi.fn(),
    };

    let authService: AuthService;

    beforeEach(() => {
      vi.clearAllMocks();
      mockJwtService.signAsync.mockResolvedValue('signed-jwt-access');
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
      );
      authService = new AuthService(
        mockPrisma as never,
        mockJwtService as unknown as JwtService,
        mockConfigService as unknown as ConfigService,
        mockAuditLogs as never,
        mockCategoriesService as never,
      );
    });

    it('creates a new Google user with null passwordHash and Personal Workspace atomically', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-g-1',
        name: 'Andi',
        email: 'andi@gmail.com',
        avatarUrl: 'https://example.com/photo.jpg',
        preferredCurrency: 'IDR',
        dateFormat: 'DD/MM/YYYY',
        theme: 'LIGHT',
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.workspace.create.mockResolvedValue({ id: 'ws-personal-g1' });

      const result = await authService.loginWithGoogle({
        googleId: 'sub-andi',
        email: 'andi@gmail.com',
        name: 'Andi',
        avatarUrl: 'https://example.com/photo.jpg',
      });

      expect(result.defaultWorkspaceId).toBe('ws-personal-g1');
      expect(result.tokens.accessToken).toBe('signed-jwt-access');
      expect(result.tokens.refreshToken).toHaveLength(96);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'andi@gmail.com',
          googleId: 'sub-andi',
          passwordHash: null,
        }),
        select: expect.any(Object),
      });

      expect(mockPrisma.workspace.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: WorkspaceType.PERSONAL,
          ownerId: 'user-g-1',
        }),
      });
      expect(mockPrisma.workspaceMember.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws-personal-g1',
          userId: 'user-g-1',
          role: WorkspaceRole.OWNER,
        }),
      });
      expect(mockCategoriesService.ensureDefaultCategories).toHaveBeenCalledWith(
        'ws-personal-g1',
        mockPrisma,
      );
    });

    it('links Google account to an existing email/password user without modifying passwordHash', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'user-existing',
          name: 'Budi',
          email: 'budi@gmail.com',
          avatarUrl: null,
          googleId: null,
          preferredCurrency: 'IDR',
          dateFormat: 'DD/MM/YYYY',
          theme: 'LIGHT',
          notificationPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-existing',
        name: 'Budi',
        email: 'budi@gmail.com',
        avatarUrl: 'https://example.com/budi.jpg',
        preferredCurrency: 'IDR',
        dateFormat: 'DD/MM/YYYY',
        theme: 'LIGHT',
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'ws-existing-1' });

      const result = await authService.loginWithGoogle({
        googleId: 'sub-budi',
        email: 'budi@gmail.com',
        name: 'Budi Google',
        avatarUrl: 'https://example.com/budi.jpg',
      });

      expect(result.defaultWorkspaceId).toBe('ws-existing-1');
      expect(mockPrisma.workspace.create).not.toHaveBeenCalled();

      const updateCallData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(updateCallData).toEqual({
        googleId: 'sub-budi',
        avatarUrl: 'https://example.com/budi.jpg',
      });
      expect('passwordHash' in updateCallData).toBe(false);
    });

    it('rejects password login and changePassword cleanly for Google-only accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-g-only',
        email: 'googleonly@gmail.com',
        passwordHash: null,
      });

      await expect(
        authService.login({
          email: 'googleonly@gmail.com',
          password: 'SomePassword123!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        authService.changePassword('user-g-only', {
          currentPassword: 'SomePassword123!',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('builds frontend callback redirect URL with tokens in URL fragment', () => {
      const url = authService.buildGoogleCallbackRedirectUrl({
        user: {
          id: 'user-1',
          name: 'Andi',
          email: 'andi@gmail.com',
          avatarUrl: null,
          preferredCurrency: 'IDR',
          dateFormat: 'DD/MM/YYYY',
          theme: 'LIGHT',
          notificationPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tokens: {
          accessToken: 'acc.jwt.tok',
          refreshToken: 'ref-tok',
          expiresIn: '15m',
        },
        defaultWorkspaceId: 'ws-1',
      });

      expect(url).toBe(
        'http://localhost:5173/auth/google/callback#accessToken=acc.jwt.tok&refreshToken=ref-tok&expiresIn=15m&defaultWorkspaceId=ws-1',
      );
    });
  });

  describe('AuthController Google OAuth endpoints', () => {
    let app: INestApplication;
    let mockEnv: Record<string, string | undefined>;
    let mockAuthService: {
      loginWithGoogle: ReturnType<typeof vi.fn>;
      buildGoogleCallbackRedirectUrl: ReturnType<typeof vi.fn>;
    };

    async function createOAuthTestApp(envOverrides: Record<string, string | undefined>) {
      const moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            ignoreEnvVars: true,
            load: [() => envOverrides],
          }),
          PassportModule.register({ defaultStrategy: 'jwt' }),
        ],
        controllers: [AuthController],
        providers: [
          GoogleStrategy,
          GoogleOAuthGuard,
          { provide: AuthService, useValue: mockAuthService },
        ],
      }).compile();

      const testApp = moduleRef.createNestApplication();
      testApp.setGlobalPrefix('api/v1');
      testApp.useGlobalFilters(new HttpExceptionFilter());
      await testApp.init();
      return testApp;
    }

    beforeEach(async () => {
      mockEnv = {
        GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:3000/api/v1/auth/google/callback',
        JWT_ACCESS_SECRET: 'test-jwt-secret-min-32-characters-long',
        FRONTEND_URL: 'http://localhost:5173',
      };

      mockAuthService = {
        loginWithGoogle: vi.fn(),
        buildGoogleCallbackRedirectUrl: vi.fn(),
      };

      app = await createOAuthTestApp(mockEnv);
    });

    afterEach(async () => {
      if (app) {
        await app.close();
      }
    });

    it('redirects GET /api/v1/auth/google to Google OAuth with signed state and CSRF cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/google')
        .expect(302);

      const location = response.headers.location;
      expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(location).toContain('state=');
      expect(location).toContain('client_id=test-google-client-id.apps.googleusercontent.com');

      const rawCookies = response.headers['set-cookie'];
      const cookies = Array.isArray(rawCookies)
        ? rawCookies
        : rawCookies
          ? [rawCookies]
          : [];
      expect(
        cookies.some((c) => c.startsWith(`${GOOGLE_OAUTH_STATE_COOKIE}=`)),
      ).toBe(true);
    });

    it('rejects GET /api/v1/auth/google/callback with 403 when state/CSRF cookie is missing or invalid', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/google/callback?code=fake-code&state=forged.state')
        .expect(403);

      expect(mockAuthService.loginWithGoogle).not.toHaveBeenCalled();
    });

    it('returns 503 when GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing', async () => {
      const unconfiguredApp = await createOAuthTestApp({
        JWT_ACCESS_SECRET: 'test-jwt-secret-min-32-characters-long',
        FRONTEND_URL: 'http://localhost:5173',
      });

      try {
        await request(unconfiguredApp.getHttpServer())
          .get('/api/v1/auth/google')
          .expect(503);
      } finally {
        await unconfiguredApp.close();
      }
    });
  });
});
