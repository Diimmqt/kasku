import type { ApiErrorResponse, ApiSuccessResponse, AuthTokens } from '../types/api';

const API_BASE = '/api/v1';

const ACCESS_TOKEN_KEY = 'kasku_access_token';
const REFRESH_TOKEN_KEY = 'kasku_refresh_token';
const ACTIVE_WORKSPACE_KEY = 'kasku_active_workspace_id';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (tokens: AuthTokens) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },
  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  },
  getActiveWorkspaceId: () => localStorage.getItem(ACTIVE_WORKSPACE_KEY),
  setActiveWorkspaceId: (id: string) => {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  },
};

let refreshPromise: Promise<string | null> | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(cb: () => void) {
  onUnauthorizedCallback = cb;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          tokenStorage.clearTokens();
          onUnauthorizedCallback?.();
          return null;
        }

        const json = (await res.json()) as ApiSuccessResponse<{
          tokens: AuthTokens;
        }>;
        tokenStorage.setTokens(json.data.tokens);
        return json.data.tokens.accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean; _retry?: boolean } = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const { skipAuth, _retry, headers, ...fetchOptions } = options;
  const reqHeaders = new Headers(headers);

  if (!reqHeaders.has('Content-Type') && fetchOptions.body) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = tokenStorage.getAccessToken();
    if (token) {
      reqHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: reqHeaders,
  });

  if (response.status === 401 && !skipAuth && !_retry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return apiRequestWithMeta<T>(path, { ...options, _retry: true });
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccessResponse<T>
    | ApiErrorResponse
    | null;

  if (!response.ok || !payload || !payload.success) {
    const errorBody = payload as ApiErrorResponse | null;
    throw new ApiRequestError(
      errorBody?.message ?? 'Terjadi kesalahan saat menghubungi server.',
      response.status,
      errorBody?.details,
    );
  }

  return { data: payload.data, meta: payload.meta };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean; _retry?: boolean } = {},
): Promise<T> {
  const result = await apiRequestWithMeta<T>(path, options);
  return result.data;
}

export async function apiDownloadFile(
  path: string,
  fallbackFilename: string,
  _retry = false,
): Promise<void> {
  const reqHeaders = new Headers();
  const token = tokenStorage.getAccessToken();
  if (token) {
    reqHeaders.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { headers: reqHeaders });
  if (response.status === 401 && !_retry) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      return apiDownloadFile(path, fallbackFilename, true);
    }
  }

  if (!response.ok) {
    throw new ApiRequestError(
      'Gagal mengunduh berkas laporan.',
      response.status,
    );
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

