import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HandCoins,
  History,
  Loader2,
  Pencil,
  Plus,
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
  DebtItem,
  DebtsListPayload,
  DebtStatus,
  DebtType,
  WalletsListPayload,
} from '../../types/api';

function DebtStatusBadge({
  status,
  isDueSoon,
}: {
  status: DebtStatus;
  isDueSoon: boolean;
}) {
  if (status === 'PAID') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Lunas
      </span>
    );
  }
  if (status === 'OVERDUE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        Terlambat
      </span>
    );
  }
  if (isDueSoon) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        <Clock className="h-3.5 w-3.5" />
        Jatuh Tempo Dekat
      </span>
    );
  }
  if (status === 'PARTIALLY_PAID') {
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
        Sebagian Dibayar
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      Belum Dibayar
    </span>
  );
}

export function DebtsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [typeFilter, setTypeFilter] = useState<'ALL' | DebtType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DebtStatus>('ALL');
  const [data, setData] = useState<DebtsListPayload | null>(null);
  const [walletsData, setWalletsData] = useState<WalletsListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtItem | null>(null);
  const [type, setType] = useState<DebtType>('DEBT');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [debtDate, setDebtDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [paymentDebt, setPaymentDebt] = useState<DebtItem | null>(null);
  const [paymentWalletId, setPaymentWalletId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentNote, setPaymentNote] = useState('');

  const [historyDebt, setHistoryDebt] = useState<DebtItem | null>(null);

  const canManage = activeWorkspace?.myPermissions?.canManageDebts ?? false;
  const currency = activeWorkspace?.currency || user?.preferredCurrency || 'IDR';
  const dateFormat = user?.dateFormat || 'DD/MM/YYYY';

  const loadData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [debtsRes, walletsRes] = await Promise.all([
        apiRequest<DebtsListPayload>(
          `/workspaces/${activeWorkspace.id}/debts${qs}`,
        ),
        apiRequest<WalletsListPayload>(
          `/workspaces/${activeWorkspace.id}/wallets`,
        ),
      ]);
      setData(debtsRes);
      setWalletsData(walletsRes);
      if (historyDebt) {
        const refreshed = debtsRes.items.find((d) => d.id === historyDebt.id);
        setHistoryDebt(refreshed ?? null);
      }
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memuat data utang dan piutang.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, typeFilter, statusFilter, historyDebt]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id, typeFilter, statusFilter]);

  const activeWallets = (walletsData?.wallets ?? []).filter((w) => !w.isArchived);

  const openCreateModal = () => {
    setEditingDebt(null);
    setType('DEBT');
    setCounterpartyName('');
    setTotalAmount('');
    setDebtDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setDescription('');
    setNote('');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (debt: DebtItem) => {
    setEditingDebt(debt);
    setType(debt.type);
    setCounterpartyName(debt.counterpartyName);
    setTotalAmount(debt.totalAmount);
    setDebtDate(debt.debtDate.slice(0, 10));
    setDueDate(debt.dueDate ? debt.dueDate.slice(0, 10) : '');
    setDescription(debt.description ?? '');
    setNote(debt.note ?? '');
    setError(null);
    setModalOpen(true);
  };

  const openPaymentModal = (debt: DebtItem) => {
    setPaymentDebt(debt);
    setPaymentWalletId(activeWallets[0]?.id ?? '');
    setPaymentAmount(debt.remainingAmount);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNote('');
    setError(null);
  };

  const handleSaveDebt = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        type,
        counterpartyName: counterpartyName.trim(),
        totalAmount: totalAmount.trim(),
        debtDate,
        dueDate: dueDate || (editingDebt ? null : undefined),
        description: description.trim() || (editingDebt ? null : undefined),
        note: note.trim() || (editingDebt ? null : undefined),
      };

      if (editingDebt) {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/debts/${editingDebt.id}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
        );
        setFeedback('Catatan utang/piutang berhasil diperbarui.');
      } else {
        await apiRequest(`/workspaces/${activeWorkspace.id}/debts`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('Catatan utang/piutang baru berhasil ditambahkan.');
      }

      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menyimpan data utang/piutang.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !paymentDebt) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/debts/${paymentDebt.id}/payments`,
        {
          method: 'POST',
          body: JSON.stringify({
            walletId: paymentWalletId,
            amount: paymentAmount.trim(),
            paymentDate,
            note: paymentNote.trim() || undefined,
          }),
        },
      );
      setFeedback(
        'Pembayaran tercatat & transaksi dompet telah dibuat otomatis.',
      );
      setPaymentDebt(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal mencatat pembayaran.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (debtId: string, paymentId: string) => {
    if (!activeWorkspace) return;
    if (
      !window.confirm(
        'Batalkan pembayaran ini? Transaksi dompet terkait juga akan dihapus dan saldo dikembalikan.',
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    try {
      const updated = await apiRequest<DebtItem>(
        `/workspaces/${activeWorkspace.id}/debts/${debtId}/payments/${paymentId}`,
        { method: 'DELETE' },
      );
      setHistoryDebt(updated);
      setFeedback('Pembayaran dibatalkan & saldo dompet disinkronkan.');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal membatalkan pembayaran.',
      );
    }
  };

  const handleDeleteDebt = async (debt: DebtItem) => {
    if (!activeWorkspace) return;
    if (
      !window.confirm(
        `Hapus catatan ${debt.type === 'DEBT' ? 'utang' : 'piutang'} dengan "${debt.counterpartyName}"?`,
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/debts/${debt.id}`,
        { method: 'DELETE' },
      );
      setFeedback('Catatan berhasil dihapus.');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : 'Gagal menghapus data.',
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
            Utang & Piutang
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Catat kewajiban & piutang beserta jatuh tempo; setiap pembayaran otomatis tersinkron dengan dompet.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Catat Baru
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {feedback && <Alert variant="success">{feedback}</Alert>}

      {summary && (summary.overdueCount > 0 || summary.dueSoonCount > 0) && (
        <Alert variant="warning">
          {summary.overdueCount > 0 && (
            <span>
              <strong>{summary.overdueCount} catatan</strong> sudah melewati jatuh tempo.{' '}
            </span>
          )}
          {summary.dueSoonCount > 0 && (
            <span>
              <strong>{summary.dueSoonCount} catatan</strong> akan jatuh tempo dalam 3 hari.
            </span>
          )}
        </Alert>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sisa Utang (Kewajiban)
            </p>
            <p className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(summary.totalDebtRemaining, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sisa Piutang (Tagihan)
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.totalReceivableRemaining, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Jatuh Tempo Dekat
            </p>
            <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
              {summary.dueSoonCount}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Terlambat
            </p>
            <p className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-400">
              {summary.overdueCount}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {[
            { value: 'ALL' as const, label: 'Semua' },
            { value: 'DEBT' as const, label: 'Utang Saya' },
            { value: 'RECEIVABLE' as const, label: 'Piutang' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                typeFilter === tab.value
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'ALL' | DebtStatus)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="ALL">Semua Status</option>
          <option value="UNPAID">Belum Dibayar</option>
          <option value="PARTIALLY_PAID">Sebagian Dibayar</option>
          <option value="OVERDUE">Terlambat</option>
          <option value="PAID">Lunas</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
            <HandCoins className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Belum ada catatan utang atau piutang
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Tambahkan catatan pinjaman atau tagihan agar tidak melewatkan tanggal jatuh tempo.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((debt) => (
            <Card key={debt.id} className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          debt.type === 'DEBT'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {debt.type === 'DEBT' ? 'UTANG' : 'PIUTANG'}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {debt.counterpartyName}
                      </h3>
                    </div>
                    {debt.description && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {debt.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      Tanggal: {formatDate(debt.debtDate, dateFormat)}
                      {debt.dueDate
                        ? ` • Jatuh tempo: ${formatDate(debt.dueDate, dateFormat)}`
                        : ''}
                    </p>
                  </div>
                  <DebtStatusBadge
                    status={debt.status}
                    isDueSoon={debt.isDueSoon}
                  />
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Terbayar {formatCurrency(debt.paidAmount, currency)} dari{' '}
                      {formatCurrency(debt.totalAmount, currency)}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Sisa: {formatCurrency(debt.remainingAmount, currency)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        debt.status === 'PAID'
                          ? 'bg-emerald-600'
                          : debt.status === 'OVERDUE'
                            ? 'bg-rose-600'
                            : 'bg-sky-600'
                      }`}
                      style={{ width: `${debt.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {canManage && debt.status !== 'PAID' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={activeWallets.length === 0}
                      onClick={() => openPaymentModal(debt)}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {debt.type === 'DEBT' ? 'Bayar' : 'Terima'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setHistoryDebt(debt)}
                  >
                    <History className="h-3.5 w-3.5" />
                    Riwayat ({debt.payments.length})
                  </Button>
                </div>

                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(debt)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDebt(debt)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60"
                      title="Hapus"
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingDebt ? 'Edit Utang / Piutang' : 'Catat Utang / Piutang'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveDebt(e)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Jenis
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as DebtType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="DEBT">Utang (Kewajiban)</option>
                    <option value="RECEIVABLE">Piutang (Tagihan)</option>
                  </select>
                </div>
                <AmountInput
                  label="Nominal Total"
                  value={totalAmount}
                  onValueChange={setTotalAmount}
                  placeholder="2.000.000"
                  required
                />
              </div>

              <Input
                label="Nama Pihak Terkait"
                value={counterpartyName}
                onChange={(e) => setCounterpartyName(e.target.value)}
                placeholder="Nama orang / bank / instansi"
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Tanggal"
                  type="date"
                  value={debtDate}
                  onChange={(e) => setDebtDate(e.target.value)}
                  required
                />
                <Input
                  label="Jatuh Tempo"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <Input
                label="Deskripsi (Opsional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Keterangan singkat"
              />

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

      {paymentDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {paymentDebt.type === 'DEBT'
                    ? 'Catat Pembayaran Utang'
                    : 'Catat Penerimaan Piutang'}
                </h2>
                <p className="text-xs text-slate-500">
                  {paymentDebt.counterpartyName} • Sisa{' '}
                  {formatCurrency(paymentDebt.remainingAmount, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentDebt(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleRecordPayment(e)}
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Dompet
                </label>
                <select
                  value={paymentWalletId}
                  onChange={(e) => setPaymentWalletId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {activeWallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(w.balance, currency)})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Otomatis mencatat transaksi{' '}
                  {paymentDebt.type === 'DEBT' ? 'Pengeluaran' : 'Pemasukan'} pada dompet ini.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <AmountInput
                  label="Nominal"
                  value={paymentAmount}
                  onValueChange={setPaymentAmount}
                  placeholder="500.000"
                  required
                />
                <Input
                  label="Tanggal Pembayaran"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Catatan (Opsional)"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Cicilan tahap 1"
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPaymentDebt(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Memproses...' : 'Simpan Pembayaran'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {historyDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Riwayat Pembayaran
                </h2>
                <p className="text-xs text-slate-500">
                  {historyDebt.counterpartyName} — Terbayar{' '}
                  {formatCurrency(historyDebt.paidAmount, currency)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDebt(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {historyDebt.payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Belum ada riwayat pembayaran.
              </p>
            ) : (
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {historyDebt.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(p.amount, currency)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(p.paymentDate, dateFormat)} • {p.wallet.name}{' '}
                        • {p.recordedBy.name}
                      </p>
                      {p.note && (
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {p.note}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleDeletePayment(historyDebt.id, p.id)
                        }
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
                        title="Batalkan pembayaran"
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

