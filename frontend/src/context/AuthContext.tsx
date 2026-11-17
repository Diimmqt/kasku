import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  apiRequest,
  registerUnauthorizedHandler,
  tokenStorage,
} from '../lib/api-client';
import type {
  AuthResponsePayload,
  AuthTokens,
  ThemePreference,
  UserProfile,
} from '../types/api';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  completeOAuthLogin: (
    tokens: AuthTokens,
    defaultWorkspaceId?: string,
  ) => Promise<void>;
  logout: (allDevices?: boolean) => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyTheme(theme?: ThemePreference) {
  const root = document.documentElement;
  if (theme === 'DARK') {
    root.classList.add('dark');
  } else if (theme === 'SYSTEM') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.remove('dark');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleUnauthorized = useCallback(() => {
    tokenStorage.clearTokens();
    setUser(null);
    applyTheme('LIGHT');
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(handleUnauthorized);
  }, [handleUnauthorized]);

  const refreshUser = useCallback(async () => {
    const token = tokenStorage.getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await apiRequest<UserProfile>('/users/me');
      setUser(me);
      applyTheme(me.theme);
    } catch {
      tokenStorage.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) {
      applyTheme(user.theme);
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<AuthResponsePayload>('/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });
    tokenStorage.setTokens(data.tokens);
    if (data.defaultWorkspaceId && !tokenStorage.getActiveWorkspaceId()) {
      tokenStorage.setActiveWorkspaceId(data.defaultWorkspaceId);
    }
    setUser(data.user);
    applyTheme(data.user.theme);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await apiRequest<AuthResponsePayload>('/auth/register', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ name, email, password }),
      });
      tokenStorage.setTokens(data.tokens);
      if (data.defaultWorkspaceId) {
        tokenStorage.setActiveWorkspaceId(data.defaultWorkspaceId);
      }
      setUser(data.user);
      applyTheme(data.user.theme);
    },
    [],
  );

  const completeOAuthLogin = useCallback(
    async (tokens: AuthTokens, defaultWorkspaceId?: string) => {
      tokenStorage.setTokens(tokens);
      if (defaultWorkspaceId && !tokenStorage.getActiveWorkspaceId()) {
        tokenStorage.setActiveWorkspaceId(defaultWorkspaceId);
      }

      try {
        const me = await apiRequest<UserProfile>('/users/me');
        setUser(me);
        applyTheme(me.theme);
        setLoading(false);
      } catch (err) {
        tokenStorage.clearTokens();
        setUser(null);
        setLoading(false);
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(async (allDevices = false) => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (tokenStorage.getAccessToken()) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken, allDevices }),
        });
      }
    } catch {
      // Clear local session regardless of server revocation response.
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
      applyTheme('LIGHT');
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      completeOAuthLogin,
      logout,
      refreshUser,
      setUser,
    }),
    [user, loading, login, register, completeOAuthLogin, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

