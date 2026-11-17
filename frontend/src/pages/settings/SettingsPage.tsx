import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Sliders, User } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { ApiRequestError, apiRequest } from '../../lib/api-client';
import type { ThemePreference, UserProfile } from '../../types/api';

type SettingsTab = 'profile' | 'preferences' | 'security';

export function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Profile state
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [profileStatus, setProfileStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences state
  const [preferredCurrency, setPreferredCurrency] = useState(
    user?.preferredCurrency ?? 'IDR',
  );
  const [dateFormat, setDateFormat] = useState(
    user?.dateFormat ?? 'DD/MM/YYYY',
  );
  const [theme, setTheme] = useState<ThemePreference>(user?.theme ?? 'LIGHT');
  const [budgetAlerts, setBudgetAlerts] = useState(
    user?.notificationPreferences?.budgetAlerts ?? true,
  );
  const [savingsGoalAlerts, setSavingsGoalAlerts] = useState(
    user?.notificationPreferences?.savingsGoalAlerts ?? true,
  );
  const [debtDueReminders, setDebtDueReminders] = useState(
    user?.notificationPreferences?.debtDueReminders ?? true,
  );
  const [familyActivityAlerts, setFamilyActivityAlerts] = useState(
    user?.notificationPreferences?.familyActivityAlerts ?? true,
  );
  const [prefStatus, setPrefStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityStatus, setSecurityStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setAvatarUrl(user.avatarUrl ?? '');
    setPreferredCurrency(user.preferredCurrency);
    setDateFormat(user.dateFormat);
    setTheme(user.theme);
    setBudgetAlerts(user.notificationPreferences?.budgetAlerts ?? true);
    setSavingsGoalAlerts(
      user.notificationPreferences?.savingsGoalAlerts ?? true,
    );
    setDebtDueReminders(user.notificationPreferences?.debtDueReminders ?? true);
    setFamilyActivityAlerts(
      user.notificationPreferences?.familyActivityAlerts ?? true,
    );
  }, [user]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileStatus(null);
    setSavingProfile(true);

    try {
      const updated = await apiRequest<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
        }),
      });
      setUser(updated);
      setProfileStatus({
        type: 'success',
        message: 'Profil berhasil diperbarui.',
      });
    } catch (err) {
      setProfileStatus({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal memperbarui profil.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePreferences = async (e: FormEvent) => {
    e.preventDefault();
    setPrefStatus(null);
    setSavingPrefs(true);

    try {
      const updated = await apiRequest<UserProfile>('/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          preferredCurrency,
          dateFormat,
          theme,
          notificationPreferences: {
            budgetAlerts,
            savingsGoalAlerts,
            debtDueReminders,
            familyActivityAlerts,
          },
        }),
      });
      setUser(updated);
      setPrefStatus({
        type: 'success',
        message: 'Preferensi berhasil disimpan.',
      });
    } catch (err) {
      setPrefStatus({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menyimpan preferensi.',
      });
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setSecurityStatus(null);

    if (newPassword.length < 8) {
      setSecurityStatus({
        type: 'error',
        message: 'Password baru minimal 8 karakter.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityStatus({
        type: 'error',
        message: 'Konfirmasi password baru tidak cocok.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityStatus({
        type: 'success',
        message:
          'Password berhasil diubah. Semua sesi lain telah dicabut demi keamanan.',
      });
    } catch (err) {
      setSecurityStatus({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal mengubah password.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Sliders },
    { id: 'security', label: 'Security', icon: KeyRound },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kelola profil akun, preferensi tampilan, dan keamanan akun Anda.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'profile' && (
        <Card className="max-w-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Informasi Profil
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Perbarui nama, email, dan URL foto profil Anda.
          </p>

          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="mt-5 space-y-4"
          >
            {profileStatus && (
              <Alert variant={profileStatus.type}>{profileStatus.message}</Alert>
            )}

            <Input
              label="Nama Lengkap"
              name="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="URL Foto Profil (Opsional)"
              name="avatarUrl"
              type="url"
              placeholder="https://example.com/avatar.png"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />

            <div className="pt-2">
              <Button type="submit" loading={savingProfile}>
                Simpan Profil
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeTab === 'preferences' && (
        <Card className="max-w-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Preferensi Aplikasi
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sesuaikan mata uang, format tanggal, tema, dan notifikasi.
          </p>

          <form
            onSubmit={(e) => void handleSavePreferences(e)}
            className="mt-5 space-y-5"
          >
            {prefStatus && (
              <Alert variant={prefStatus.type}>{prefStatus.message}</Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Mata Uang Utama
                </label>
                <select
                  value={preferredCurrency}
                  onChange={(e) => setPreferredCurrency(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="IDR">IDR — Rupiah Indonesia</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="SGD">SGD — Singapore Dollar</option>
                  <option value="MYR">MYR — Malaysian Ringgit</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Format Tanggal
                </label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (13/11/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (11/13/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-13)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Tema Tampilan
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['LIGHT', 'DARK', 'SYSTEM'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTheme(option)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      theme === option
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                    }`}
                  >
                    {option === 'LIGHT'
                      ? 'Terang'
                      : option === 'DARK'
                        ? 'Gelap'
                        : 'Sistem'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Preferensi Notifikasi
              </p>
              <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Peringatan anggaran hampir habis / terlampaui</span>
                <input
                  type="checkbox"
                  checked={budgetAlerts}
                  onChange={(e) => setBudgetAlerts(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Notifikasi pencapaian target tabungan</span>
                <input
                  type="checkbox"
                  checked={savingsGoalAlerts}
                  onChange={(e) => setSavingsGoalAlerts(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Pengingat utang & piutang mendekati jatuh tempo</span>
                <input
                  type="checkbox"
                  checked={debtDueReminders}
                  onChange={(e) => setDebtDueReminders(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>Aktivitas penting workspace keluarga</span>
                <input
                  type="checkbox"
                  checked={familyActivityAlerts}
                  onChange={(e) => setFamilyActivityAlerts(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600"
                />
              </label>
            </div>

            <Button type="submit" loading={savingPrefs}>
              Simpan Preferensi
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'security' && (
        <div className="max-w-2xl space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Ganti Password
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Verifikasi password saat ini sebelum mengganti dengan password
              baru.
            </p>

            <form
              onSubmit={(e) => void handleChangePassword(e)}
              className="mt-5 space-y-4"
            >
              {securityStatus && (
                <Alert variant={securityStatus.type}>
                  {securityStatus.message}
                </Alert>
              )}

              <Input
                label="Password Saat Ini"
                name="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />

              <Input
                label="Password Baru"
                name="newPassword"
                type="password"
                required
                minLength={8}
                hint="Minimal 8 karakter"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                label="Konfirmasi Password Baru"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <Button type="submit" loading={savingPassword}>
                Perbarui Password
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Keluar dari Akun
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Cabut sesi saat ini atau seluruh perangkat yang sedang login.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    void logout(false).then(() =>
                      navigate('/login', { replace: true }),
                    )
                  }
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    void logout(true).then(() =>
                      navigate('/login', { replace: true }),
                    )
                  }
                >
                  Logout Semua Perangkat
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

