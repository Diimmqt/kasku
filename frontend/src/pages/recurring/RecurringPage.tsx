import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CalendarClock,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { AmountInput } from '../../components/ui/AmountInput';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ApiRequestError, apiRequest } from '../../lib/api-client';
import { formatCurrency, formatDate } from '../../lib/format';
import type {
  CategoryItem,
  RecurringFrequency,
  RecurringTransactionItem,
  WalletsListPayload,
} from '../../types/api';

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  DAILY: 'Harian',
  WEEKLY: 'Mingguan',
  MONTHLY: 'Bulanan',
  YEARLY: 'Tahunan',
};

export function RecurringPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [items, setItems] = useState<RecurringTransactionItem[]>([]);
  const [walletsData, setWalletsData] = useState<WalletsListPayload | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningDue, setRunningDue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransactionItem | null>(null);
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [walletId, setWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('MONTHLY');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = activeWorkspace?.myPermissions?.canManageRecurring ?? false;
  const currency = activeWorkspace?.currency || user?.preferredCurrency || 'IDR';
  const dateFormat = user?.dateFormat || 'DD/MM/YYYY';

  const loadData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const [recRes, walletsRes, catsRes] = await Promise.all([
        apiRequest<RecurringTransactionItem[]>(
          `/workspaces/${activeWorkspace.id}/recurring-transactions`,
        ),
        apiRequest<WalletsListPayload>(
          `/workspaces/${activeWorkspace.id}/wallets`,
        ),
        apiRequest<CategoryItem[]>(
          `/workspaces/${activeWorkspace.id}/categories`,
        ),
      ]);
      setItems(recRes);
      setWalletsData(walletsRes);
      setCategories(catsRes.filter((c) => !c.isArchived));
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memuat jadwal transaksi berulang.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeWallets = (walletsData?.wallets ?? []).filter((w) => !w.isArchived);
  const filteredCategories = categories.filter((c) => c.type === type);

  const openCreateModal = () => {
    const defaultType = 'EXPENSE';
    const matchingCats = categories.filter((c) => c.type === defaultType);
    setEditing(null);
    setType(defaultType);
    setWalletId(activeWallets[0]?.id ?? '');
    setCategoryId(matchingCats[0]?.id ?? '');
    setAmount('');
    setDescription('');
    setFrequency('MONTHLY');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setModalOpen(true);
  };

  const openEditModal = (rule: RecurringTransactionItem) => {
    setEditing(rule);
    setType(rule.type);
    setWalletId(rule.walletId);
    setCategoryId(rule.categoryId);
    setAmount(rule.amount);
    setDescription(rule.description);
    setFrequency(rule.frequency);
    setStartDate(rule.startDate.slice(0, 10));
    setEndDate(rule.endDate ? rule.endDate.slice(0, 10) : '');
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);
    try {
      const payload = {
        type,
        walletId,
        categoryId,
        amount: amount.trim(),
        description: description.trim(),
        frequency,
        startDate,
        endDate: endDate || (editing ? null : undefined),
      };

      if (editing) {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/recurring-transactions/${editing.id}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
        );
        setFeedback('Jadwal transaksi berulang diperbarui.');
      } else {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/recurring-transactions`,
          { method: 'POST', body: JSON.stringify(payload) },
        );
        setFeedback('Jadwal transaksi berulang berhasil dibuat.');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menyimpan transaksi berulang.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (rule: RecurringTransactionItem) => {
    if (!activeWorkspace) return;
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/recurring-transactions/${rule.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !rule.isActive }),
        },
      );
      setFeedback(
        rule.isActive ? 'Jadwal dinonaktifkan.' : 'Jadwal diaktifkan kembali.',
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal mengubah status jadwal.',
      );
    }
  };

  const handleRunDue = async () => {
    if (!activeWorkspace) return;
    setRunningDue(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await apiRequest<{
        executedCount: number;
        skippedCount: number;
      }>(`/workspaces/${activeWorkspace.id}/recurring-transactions/run-due`, {
        method: 'POST',
      });
      setFeedback(
        `Eksekusi selesai: ${res.executedCount} transaksi baru dicatat, ${res.skippedCount} sudah tercatat sebelumnya (idempoten).`,
      );
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menjalankan jadwal jatuh tempo.',
      );
    } finally {
      setRunningDue(false);
    }
  };

  const handleDelete = async (rule: RecurringTransactionItem) => {
    if (!activeWorkspace) return;
    if (!window.confirm(`Hapus jadwal "${rule.description}"?`)) return;
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/recurring-transactions/${rule.id}`,
        { method: 'DELETE' },
      );
      setFeedback('Jadwal berhasil dihapus.');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menghapus jadwal.',
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Transaksi Berulang
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Atur pemasukan atau pengeluaran rutin otomatis dengan proteksi anti-duplikasi.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleRunDue()}
              disabled={runningDue}
            >
              <RefreshCw
                className={`h-4 w-4 ${runningDue ? 'animate-spin' : ''}`}
              />
              Jalankan Jatuh Tempo
            </Button>
            <Button
              type="button"
              onClick={openCreateModal}
              disabled={activeWallets.length === 0 || categories.length === 0}
            >
              <Plus className="h-4 w-4" />
              Buat Jadwal
            </Button>
          </div>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {feedback && <Alert variant="success">{feedback}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CalendarClock className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Belum ada jadwal transaksi berulang
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Buat jadwal otomatis untuk gaji bulanan, tagihan listrik, internet, atau cicilan rutin.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((rule) => (
            <Card key={rule.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        rule.type === 'INCOME'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                      }`}
                    >
                      {FREQ_LABELS[rule.frequency]}
                    </span>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {rule.description}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {rule.category.name} • {rule.wallet.name}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    rule.isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {rule.isActive ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span
                  className={`text-lg font-bold ${
                    rule.type === 'INCOME'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {rule.type === 'INCOME' ? '+' : '-'}
                  {formatCurrency(rule.amount, currency)}
                </span>
                <span className="text-xs text-slate-500">
                  Berikutnya: {formatDate(rule.nextRunDate, dateFormat)}
                </span>
              </div>

              {canManage && (
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleToggle(rule)}
                  >
                    {rule.isActive ? (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        Nonaktifkan
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5" />
                        Aktifkan
                      </>
                    )}
                  </Button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(rule)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(rule)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editing ? 'Edit Jadwal Berulang' : 'Buat Transaksi Berulang'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Jenis
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const next = e.target.value as 'INCOME' | 'EXPENSE';
                      setType(next);
                      const first = categories.find((c) => c.type === next);
                      setCategoryId(first?.id ?? '');
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="EXPENSE">Pengeluaran</option>
                    <option value="INCOME">Pemasukan</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Frekuensi
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as RecurringFrequency)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="DAILY">Harian</option>
                    <option value="WEEKLY">Mingguan</option>
                    <option value="MONTHLY">Bulanan</option>
                    <option value="YEARLY">Tahunan</option>
                  </select>
                </div>
              </div>

              <Input
                label="Deskripsi"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Contoh: Tagihan Internet"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Dompet
                  </label>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {activeWallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Kategori
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {filteredCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <AmountInput
                label="Nominal"
                value={amount}
                onValueChange={setAmount}
                placeholder="150.000"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Tanggal Mulai"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
                <Input
                  label="Tanggal Berakhir (Opsional)"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

