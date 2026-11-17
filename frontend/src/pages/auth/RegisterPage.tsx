import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { ApiRequestError } from '../../lib/api-client';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal mendaftar. Periksa koneksi dan coba lagi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white shadow-sm">
            K
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Buat Akun Kasku
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Personal Workspace otomatis dibuat untuk keuangan pribadi Anda
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}

            <Input
              label="Nama Lengkap"
              type="text"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              placeholder="Contoh: Budi Santoso"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              hint="Minimal 8 karakter"
              placeholder="Buat password yang kuat"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Input
              label="Konfirmasi Password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              placeholder="Ulangi password Anda"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button type="submit" loading={submitting} className="w-full">
              Daftar & Buat Workspace
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
            Sudah punya akun?{' '}
            <Link
              to="/login"
              className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Masuk di sini
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

