import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  History,
  Loader2,
  Pencil,
  Plus,
  Target,
  Trash2,
  Wallet,
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
  SavingsGoalItem,
  SavingsGoalsListPayload,
  SavingsGoalStatus,
  WalletsListPayload,
} from '../../types/api';

function GoalStatusBadge({ status }: { status: SavingsGoalStatus }) {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Tercapai
      </span>
    );
  }
  if (status === 'ARCHIVED') {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Diarsipkan
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
      Aktif
    </span>
  );
}

export function SavingsGoalsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [data, setData] = useState<SavingsGoalsListPayload | null>(null);
  const [walletsData, setWalletsData] = useState<WalletsListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoalItem | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [goalStatus, setGoalStatus] = useState<SavingsGoalStatus>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  const [depositGoal, setDepositGoal] = useState<SavingsGoalItem | null>(null);
  const [depositWalletId, setDepositWalletId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [depositNote, setDepositNote] = useState('');

  const [historyGoal, setHistoryGoal] = useState<SavingsGoalItem | null>(null);

  const canManage = activeWorkspace?.myPermissions?.canManageGoals ?? false;
  const currency = activeWorkspace?.currency || user?.preferredCurrency || 'IDR';
  const dateFormat = user?.dateFormat || 'DD/MM/YYYY';

  const loadData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const [goalsRes, walletsRes] = await Promise.all([
        apiRequest<SavingsGoalsListPayload>(
          `/workspaces/${activeWorkspace.id}/savings-goals`,
        ),
        apiRequest<WalletsListPayload>(
          `/workspaces/${activeWorkspace.id}/wallets`,
        ),
      ]);
      setData(goalsRes);
      setWalletsData(walletsRes);
      if (historyGoal) {
        const refreshed = goalsRes.items.find((item) => item.id === historyGoal.id);
        setHistoryGoal(refreshed ?? null);
      }
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memuat target tabungan.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, historyGoal]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);

  const activeWallets = (walletsData?.wallets ?? []).filter((w) => !w.isArchived);

  const openCreateModal = () => {
    setEditingGoal(null);
    setGoalName('');
    setGoalDescription('');
    setTargetAmount('');
    setDeadline('');
    setGoalStatus('ACTIVE');
    setError(null);
    setGoalModalOpen(true);
  };

  const openEditModal = (goal: SavingsGoalItem) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalDescription(goal.description ?? '');
    setTargetAmount(goal.targetAmount);
    setDeadline(goal.deadline ? goal.deadline.slice(0, 10) : '');
    setGoalStatus(goal.status);
    setError(null);
    setGoalModalOpen(true);
  };

  const openDepositModal = (goal: SavingsGoalItem) => {
    setDepositGoal(goal);
    setDepositWalletId(activeWallets[0]?.id ?? '');
    setDepositAmount('');
    setDepositDate(new Date().toISOString().slice(0, 10));
    setDepositNote('');
    setError(null);
  };

  const handleSaveGoal = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        name: goalName.trim(),
        description: goalDescription.trim() || undefined,
        targetAmount: targetAmount.trim(),
        deadline: deadline || undefined,
        ...(editingGoal ? { status: goalStatus } : {}),
      };

      if (editingGoal) {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/savings-goals/${editingGoal.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...payload,
              description: goalDescription.trim() || null,
              deadline: deadline || null,
            }),
          },
        );
        setFeedback('Target tabungan berhasil diperbarui.');
      } else {
        await apiRequest(`/workspaces/${activeWorkspace.id}/savings-goals`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('Target tabungan baru berhasil dibuat.');
      }

      setGoalModalOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menyimpan target tabungan.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDeposit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !depositGoal) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/savings-goals/${depositGoal.id}/contributions`,
        {
          method: 'POST',
          body: JSON.stringify({
            walletId: depositWalletId,
            amount: depositAmount.trim(),
            contributionDate: depositDate,
            note: depositNote.trim() || undefined,
          }),
        },
      );
      setFeedback(
        `Setoran ke "${depositGoal.name}" tercatat & saldo dompet diperbarui.`,
      );
      setDepositGoal(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal mencatat setoran tabungan.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevertContribution = async (
    goalId: string,
    contributionId: string,
  ) => {
    if (!activeWorkspace) return;
    if (
      !window.confirm(
        'Batalkan setoran ini dan kembalikan saldonya ke dompet sumber?',
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    try {
      const updated = await apiRequest<SavingsGoalItem>(
        `/workspaces/${activeWorkspace.id}/savings-goals/${goalId}/contributions/${contributionId}`,
        { method: 'DELETE' },
      );
      setHistoryGoal(updated);
      setFeedback('Setoran berhasil dibatalkan dan saldo dompet dikembalikan.');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal membatalkan setoran.',
      );
    }
  };

  const handleDeleteGoal = async (goal: SavingsGoalItem) => {
    if (!activeWorkspace) return;
    if (
      !window.confirm(
        `Hapus target "${goal.name}"? Semua riwayat setoran (${formatCurrency(goal.currentAmount, currency)}) akan dikembalikan ke dompet sumber.`,
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/savings-goals/${goal.id}`,
        { method: 'DELETE' },
      );
      setFeedback('Target tabungan dihapus dan setoran dikembalikan ke dompet.');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menghapus target tabungan.',
      );
    }
  };

  const items = data?.items ?? [];
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Target Tabungan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sisihkan dana dari dompet ke tujuan keuangan Anda tanpa mengganggu laporan pengeluaran.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Buat Target
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {feedback && <Alert variant="success">{feedback}</Alert>}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Terkumpul
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.totalSaved, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Target Aktif
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.totalTarget, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Target Aktif
            </p>
            <p className="mt-1 text-xl font-bold text-sky-600 dark:text-sky-400">
              {summary.activeCount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tercapai
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary.completedCount}
            </p>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Belum ada target tabungan
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Mulai buat target dana darurat, laptop, pendidikan, atau liburan keluarga Anda.
          </p>
          {canManage && (
            <Button type="button" className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Buat Target Pertama
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((goal) => (
            <Card key={goal.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {goal.name}
                    </h3>
                    {goal.description && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <GoalStatusBadge status={goal.status} />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(goal.currentAmount, currency)}
                      </strong>{' '}
                      / {formatCurrency(goal.targetAmount, currency)}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {goal.progressPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all"
                      style={{ width: `${goal.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Kurang {formatCurrency(goal.remainingAmount, currency)}
                    </span>
                    {goal.deadline && (
                      <span>
                        Deadline: {formatDate(goal.deadline, dateFormat)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {canManage && goal.status !== 'ARCHIVED' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openDepositModal(goal)}
                      disabled={activeWallets.length === 0}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      Tambah Setoran
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setHistoryGoal(goal)}
                  >
                    <History className="h-3.5 w-3.5" />
                    Riwayat ({goal.contributions.length})
                  </Button>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(goal)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      title="Edit target"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteGoal(goal)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                      title="Hapus target"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {goalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingGoal ? 'Edit Target Tabungan' : 'Buat Target Tabungan'}
              </h2>
              <button
                type="button"
                onClick={() => setGoalModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveGoal(e)}
              className="space-y-4"
            >
              <Input
                label="Nama Target"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder="Contoh: Dana Darurat Keluarga"
                required
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Deskripsi (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={goalDescription}
                  onChange={(e) => setGoalDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Tujuan atau catatan target ini..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <AmountInput
                  label="Nominal Target"
                  value={targetAmount}
                  onValueChange={setTargetAmount}
                  placeholder="15.000.000"
                  required
                />
                <Input
                  label="Deadline (Opsional)"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              {editingGoal && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Status Target
                  </label>
                  <select
                    value={goalStatus}
                    onChange={(e) =>
                      setGoalStatus(e.target.value as SavingsGoalStatus)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="ACTIVE">Aktif</option>
                    <option value="COMPLETED">Tercapai</option>
                    <option value="ARCHIVED">Diarsipkan</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setGoalModalOpen(false)}
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

      {depositGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Tambah Setoran Tabungan
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target: {depositGoal.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDepositGoal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleAddDeposit(e)}
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Dompet Sumber
                </label>
                <select
                  value={depositWalletId}
                  onChange={(e) => setDepositWalletId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(w.balance, currency)})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Saldo dompet sumber akan berkurang otomatis sebesar nominal setoran.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <AmountInput
                  label="Nominal Setoran"
                  value={depositAmount}
                  onValueChange={setDepositAmount}
                  placeholder="1.000.000"
                  required
                />
                <Input
                  label="Tanggal Setoran"
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Catatan (Opsional)"
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                placeholder="Sisihan gaji bulan ini"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDepositGoal(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Memproses...' : 'Setor Sekarang'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {historyGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Riwayat Setoran
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {historyGoal.name} — Terkumpul{' '}
                  {formatCurrency(historyGoal.currentAmount, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryGoal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {historyGoal.contributions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Belum ada setoran tercatat untuk target ini.
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {historyGoal.contributions.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.amount, currency)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(item.contributionDate, dateFormat)} • dari{' '}
                        {item.wallet.name} • oleh {item.contributedBy.name}
                      </p>
                      {item.note && (
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {item.note}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleRevertContribution(historyGoal.id, item.id)
                        }
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
                        title="Batalkan setoran & kembalikan saldo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
