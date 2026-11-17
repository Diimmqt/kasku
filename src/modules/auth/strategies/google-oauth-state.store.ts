import type { Request } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type OAuth2Strategy from 'passport-oauth2';

export const GOOGLE_OAUTH_STATE_COOKIE = 'kasku_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;
const COOKIE_PATH = '/api/v1/auth';

interface OAuthStatePayload {
  nonce: string;
  exp: number;
}

function parseCookieValue(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const separatorIdx = pair.indexOf('=');
    if (separatorIdx <= 0) {
      continue;
    }
    const key = pair.slice(0, separatorIdx).trim();
    if (key !== cookieName) {
      continue;
    }
    const rawValue = pair.slice(separatorIdx + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

function safeEqualText(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Stateless CSRF-protected OAuth 2.0 state store using an HMAC-signed state
 * token bound to an HttpOnly SameSite=Lax browser cookie.
 */
export class GoogleOAuthStateStore implements OAuth2Strategy.StateStore {
  private readonly signingKey: Buffer;

  constructor(
    secret: string,
    private readonly isProduction: boolean,
  ) {
    this.signingKey = createHmac('sha256', secret)
      .update('kasku-google-oauth-state-v1')
      .digest();
  }

  store(req: Request, callback: OAuth2Strategy.StateStoreStoreCallback): void;
  store(
    req: Request,
    meta: OAuth2Strategy.Metadata,
    callback: OAuth2Strategy.StateStoreStoreCallback,
  ): void;
  store(
    req: Request,
    metaOrCallback:
      | OAuth2Strategy.Metadata
      | OAuth2Strategy.StateStoreStoreCallback,
    maybeCallback?: OAuth2Strategy.StateStoreStoreCallback,
  ): void {
    const callback =
      typeof metaOrCallback === 'function' ? metaOrCallback : maybeCallback;
    if (!callback) {
      return;
    }

    const nonce = randomBytes(24).toString('hex');
    const payloadObj: OAuthStatePayload = {
      nonce,
      exp: Date.now() + STATE_TTL_MS,
    };

    const encodedPayload = Buffer.from(
      JSON.stringify(payloadObj),
      'utf8',
    ).toString('base64url');
    const state = `${encodedPayload}.${this.sign(encodedPayload)}`;
    const cookieValue = `${nonce}.${this.sign(nonce)}`;

    req.res?.cookie(GOOGLE_OAUTH_STATE_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      maxAge: STATE_TTL_MS,
      path: COOKIE_PATH,
    });

    callback(null, state);
  }

  verify(
    req: Request,
    providedState: string,
    callback: OAuth2Strategy.StateStoreVerifyCallback,
  ): void;
  verify(
    req: Request,
    providedState: string,
    meta: OAuth2Strategy.Metadata,
    callback: OAuth2Strategy.StateStoreVerifyCallback,
  ): void;
  verify(
    req: Request,
    providedState: string,
    metaOrCallback:
      | OAuth2Strategy.Metadata
      | OAuth2Strategy.StateStoreVerifyCallback,
    maybeCallback?: OAuth2Strategy.StateStoreVerifyCallback,
  ): void {
    const callback =
      typeof metaOrCallback === 'function' ? metaOrCallback : maybeCallback;
    if (!callback) {
      return;
    }

    req.res?.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.isProduction,
      path: COOKIE_PATH,
    });

    if (typeof providedState !== 'string' || !providedState.includes('.')) {
      callback(null, false, {
        message: 'State OAuth tidak valid atau tidak ditemukan.',
      });
      return;
    }

    const stateParts = providedState.split('.');
    if (stateParts.length !== 2) {
      callback(null, false, {
        message: 'Format state OAuth tidak valid.',
      });
      return;
    }

    const [encodedPayload, stateSignature] = stateParts;
    if (!safeEqualText(stateSignature, this.sign(encodedPayload))) {
      callback(null, false, {
        message: 'Signature state OAuth tidak valid.',
      });
      return;
    }

    let parsedPayload: Partial<OAuthStatePayload>;
    try {
      parsedPayload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as Partial<OAuthStatePayload>;
    } catch {
      callback(null, false, {
        message: 'Payload state OAuth tidak dapat dibaca.',
      });
      return;
    }

    if (
      typeof parsedPayload.nonce !== 'string' ||
      parsedPayload.nonce.length < 32 ||
      typeof parsedPayload.exp !== 'number' ||
      parsedPayload.exp <= Date.now()
    ) {
      callback(null, false, {
        message: 'State OAuth telah kedaluwarsa. Silakan coba login ulang.',
      });
      return;
    }

    const cookieRaw = parseCookieValue(
      req.headers.cookie,
      GOOGLE_OAUTH_STATE_COOKIE,
    );
    if (!cookieRaw || !cookieRaw.includes('.')) {
      callback(null, false, {
        message: 'Cookie CSRF OAuth tidak ditemukan atau tidak valid.',
      });
      return;
    }

    const cookieParts = cookieRaw.split('.');
    if (cookieParts.length !== 2) {
      callback(null, false, {
        message: 'Format cookie CSRF OAuth tidak valid.',
      });
      return;
    }

    const [cookieNonce, cookieSignature] = cookieParts;
    if (
      !safeEqualText(cookieSignature, this.sign(cookieNonce)) ||
      !safeEqualText(cookieNonce, parsedPayload.nonce)
    ) {
      callback(null, false, {
        message: 'Validasi CSRF OAuth gagal. Silakan mulai login dari awal.',
      });
      return;
    }

    callback(null, true, { nonce: parsedPayload.nonce });
  }

  private sign(data: string): string {
    return createHmac('sha256', this.signingKey)
      .update(data)
      .digest('base64url');
  }
}
