import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { ApiRequestError } from '../../lib/api-client';

export function GoogleCallbackPage() {
  const { completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ''),
    );
    const queryParams = new URLSearchParams(window.location.search);

    const oauthError =
      hashParams.get('error') ?? queryParams.get('oauthError');
    if (oauthError) {
      setError('Login dengan Google dibatalkan atau ditolak.');
      return;
    }

    const accessToken = hashParams.get('accessToken');
    const refreshToken = hashParams.get('refreshToken');
    const expiresIn = hashParams.get('expiresIn') ?? '15m';
    const defaultWorkspaceId =
      hashParams.get('defaultWorkspaceId') ?? undefined;

    if (!accessToken || !refreshToken) {
      setError('Token autentikasi Google tidak ditemukan atau tidak valid.');
      return;
    }

    void completeOAuthLogin(
      { accessToken, refreshToken, expiresIn },
      defaultWorkspaceId,
    )
      .then(() => {
        if (cancelled) return;
        window.history.replaceState(null, '', window.location.pathname);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        window.history.replaceState(null, '', window.location.pathname);
        setError(
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menyelesaikan login Google. Silakan coba lagi.',
        );
      });

    return () => {
      cancelled = true;
    };
  }, [completeOAuthLogin, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <Card className="p-6 text-center sm:p-8">
          {error ? (
            <div className="space-y-4">
              <Alert variant="error">{error}</Alert>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Kembali ke halaman login
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Menyelesaikan login Google...
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

