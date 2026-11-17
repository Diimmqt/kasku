import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pencil,
  PiggyBank,
  Plus,
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
  BudgetItem,
  BudgetPeriodType,
  BudgetsListPayload,
  BudgetUsageStatus,
  CategoryItem,
} from '../../types/api';

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: BudgetUsageStatus }) {
  if (status === 'EXCEEDED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        Terlampaui
      </span>
    );
  }
  if (status === 'WARNING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        Hampir Habis
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Aman
    </span>
  );
}

export function BudgetsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [monthFilter, setMonthFilter] = useState(currentYearMonth());
  const [showAllPeriods, setShowAllPeriods] = useState(false);
  const [data, setData] = useState<BudgetsListPayload | null>(null);
  const [expenseCategories, setExpenseCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('MONTHLY');
  const [month, setMonth] = useState(currentYearMonth());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [amountLimit, setAmountLimit] = useState('');
  const [warningThresholdPercent, setWarningThresholdPercent] = useState('80');
  const [submitting, setSubmitting] = useState(false);

  const canManage = activeWorkspace?.myPermissions?.canManageBudgets ?? false;
  const currency = activeWorkspace?.currency || user?.preferredCurrency || 'IDR';
  const dateFormat = user?.dateFormat || 'DD/MM/YYYY';

  const loadData = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!showAllPeriods && monthFilter) {
        params.set('month', monthFilter);
      }
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const [budgetsRes, categoriesRes] = await Promise.all([
        apiRequest<BudgetsListPayload>(
          `/workspaces/${activeWorkspace.id}/budgets${queryStr}`,
        ),
        apiRequest<CategoryItem[]>(
          `/workspaces/${activeWorkspace.id}/categories?type=EXPENSE`,
        ),
      ]);
      setData(budgetsRes);
      setExpenseCategories(categoriesRes);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memuat data anggaran.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, monthFilter, showAllPeriods]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingBudget(null);
    setCategoryId(expenseCategories[0]?.id ?? '');
    setName('');
    setPeriodType('MONTHLY');
    setMonth(monthFilter || currentYearMonth());
    setStartDate('');
    setEndDate('');
    setAmountLimit('');
    setWarningThresholdPercent('80');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (budget: BudgetItem) => {
    setEditingBudget(budget);
    setCategoryId(budget.categoryId);
    setName(budget.name);
    setPeriodType(budget.periodType);
    setMonth(budget.startDate.slice(0, 7));
    setStartDate(budget.startDate.slice(0, 10));
    setEndDate(budget.endDate.slice(0, 10));
    setAmountLimit(budget.amountLimit);
    setWarningThresholdPercent(String(budget.warningThresholdPercent));
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSubmitting(true);
    setError(null);
    setFeedback(null);

    try {
      const payload = {
        categoryId,
        name: name.trim() || undefined,
        periodType,
        ...(periodType === 'MONTHLY'
          ? { month }
          : { startDate, endDate }),
        amountLimit: amountLimit.trim(),
        warningThresholdPercent: Number(warningThresholdPercent) || 80,
      };

      if (editingBudget) {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/budgets/${editingBudget.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          },
        );
        setFeedback('Anggaran berhasil diperbarui.');
      } else {
        await apiRequest(`/workspaces/${activeWorkspace.id}/budgets`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback('Anggaran baru berhasil dibuat.');
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menyimpan anggaran.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (budget: BudgetItem) => {
    if (!activeWorkspace) return;
    if (
      !window.confirm(
        `Hapus anggaran "${budget.name}"? Transaksi pengeluaran tidak akan terhapus.`,
      )
    ) {
      return;
    }
    setError(null);
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/budgets/${budget.id}`,
        { method: 'DELETE' },
      );
      setFeedback('Anggaran berhasil dihapus.');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menghapus anggaran.',
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
            Anggaran
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Rencanakan batas pengeluaran per kategori dan pantau realisasinya secara otomatis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!showAllPeriods && (
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAllPeriods((prev) => !prev)}
          >
            {showAllPeriods ? 'Filter Bulan' : 'Semua Periode'}
          </Button>
          {canManage && (
            <Button
              type="button"
              onClick={openCreateModal}
              disabled={expenseCategories.length === 0}
            >
              <Plus className="h-4 w-4" />
              Buat Anggaran
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {feedback && <Alert variant="success">{feedback}</Alert>}

      {summary && (summary.exceededCount > 0 || summary.warningCount > 0) && (
        <Alert variant="warning">
          {summary.exceededCount > 0 && (
            <span>
              <strong>{summary.exceededCount} anggaran</strong> telah melampaui batas.{' '}
            </span>
          )}
          {summary.warningCount > 0 && (
            <span>
              <strong>{summary.warningCount} anggaran</strong> mendekati batas maksimal.
            </span>
          )}
        </Alert>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Batas Anggaran
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(summary.totalLimit, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total Terpakai
            </p>
            <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(summary.totalSpent, currency)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sisa Anggaran
            </p>
            <p
              className={`mt-1 text-xl font-bold ${
                Number(summary.totalRemaining) < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {formatCurrency(summary.totalRemaining, currency)}
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
            <PiggyBank className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Belum ada anggaran untuk periode ini
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Tetapkan batas pengeluaran per kategori agar pengeluaran keluarga atau pribadi tetap terkendali.
          </p>
          {canManage && expenseCategories.length > 0 && (
            <Button type="button" className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Buat Anggaran Pertama
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((budget) => {
            const barWidth = Math.min(100, budget.percentageUsed);
            const barColor =
              budget.status === 'EXCEEDED'
                ? 'bg-rose-600'
                : budget.status === 'WARNING'
                  ? 'bg-amber-500'
                  : 'bg-emerald-600';

            return (
              <Card key={budget.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: budget.category.color }}
                      />
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {budget.name}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Kategori: {budget.category.name} •{' '}
                      {formatDate(budget.startDate, dateFormat)} –{' '}
                      {formatDate(budget.endDate, dateFormat)}
                    </p>
                  </div>
                  <StatusBadge status={budget.status} />
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      Terpakai{' '}
                      <strong className="text-slate-900 dark:text-slate-100">
                        {formatCurrency(budget.spentAmount, currency)}
                      </strong>{' '}
                      dari {formatCurrency(budget.amountLimit, currency)}
                    </span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {budget.percentageUsed.toFixed(1)}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span
                      className={
                        Number(budget.remainingAmount) < 0
                          ? 'font-medium text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }
                    >
                      {Number(budget.remainingAmount) < 0
                        ? `Melebihi batas ${formatCurrency(String(Math.abs(Number(budget.remainingAmount))), currency)}`
                        : `Sisa ${formatCurrency(budget.remainingAmount, currency)}`}
                    </span>

                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(budget)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          title="Edit anggaran"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(budget)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/60 dark:hover:text-rose-400"
                          title="Hapus anggaran"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {editingBudget ? 'Edit Anggaran' : 'Buat Anggaran Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Kategori Pengeluaran
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {expenseCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Nama Anggaran (Opsional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Kosongkan untuk pakai nama kategori"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Jenis Periode
                  </label>
                  <select
                    value={periodType}
                    onChange={(e) =>
                      setPeriodType(e.target.value as BudgetPeriodType)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="MONTHLY">Bulanan</option>
                    <option value="CUSTOM">Rentang Kustom</option>
                  </select>
                </div>

                {periodType === 'MONTHLY' ? (
                  <Input
                    label="Bulan"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    required
                  />
                ) : (
                  <Input
                    label="Ambang Peringatan (%)"
                    type="number"
                    min={1}
                    max={100}
                    value={warningThresholdPercent}
                    onChange={(e) => setWarningThresholdPercent(e.target.value)}
                    required
                  />
                )}
              </div>

              {periodType === 'CUSTOM' && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Tanggal Mulai"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  <Input
                    label="Tanggal Berakhir"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <AmountInput
                  label="Batas Nominal"
                  value={amountLimit}
                  onValueChange={setAmountLimit}
                  placeholder="2.500.000"
                  required
                />
                {periodType === 'MONTHLY' && (
                  <Input
                    label="Ambang Peringatan (%)"
                    type="number"
                    min={1}
                    max={100}
                    value={warningThresholdPercent}
                    onChange={(e) => setWarningThresholdPercent(e.target.value)}
                    required
                  />
                )}
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
