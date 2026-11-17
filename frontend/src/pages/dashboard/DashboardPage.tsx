import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  HeartPulse,
  Loader2,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ApiRequestError, apiRequest } from '../../lib/api-client';
import { formatCurrency, formatDate } from '../../lib/format';
import type { DashboardPayload, ReportPeriodPreset } from '../../types/api';

const PERIOD_OPTIONS: { value: ReportPeriodPreset; label: string }[] = [
  { value: 'THIS_WEEK', label: 'Minggu Ini' },
  { value: 'THIS_MONTH', label: 'Bulan Ini' },
  { value: 'THIS_YEAR', label: 'Tahun Ini' },
  { value: 'CUSTOM', label: 'Kustom' },
];

export function DashboardPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [period, setPeriod] = useState<ReportPeriodPreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currency = activeWorkspace?.currency || user?.preferredCurrency || 'IDR';
  const dateFormat = user?.dateFormat || 'DD/MM/YYYY';

  const loadDashboard = useCallback(async () => {
    if (!activeWorkspace) return;
    if (period === 'CUSTOM' && (!startDate || !endDate)) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (period === 'CUSTOM') {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }
      const res = await apiRequest<DashboardPayload>(
        `/workspaces/${activeWorkspace.id}/dashboard?${params.toString()}`,
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memuat data dashboard.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, period, startDate, endDate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const healthBadge = (health: DashboardPayload['summary']['financialHealth']) => {
    if (health === 'DEFICIT') {
      return {
        label: 'Defisit (Pengeluaran > Pemasukan)',
        className:
          'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
      };
    }
    if (health === 'CAUTION') {
      return {
        label: 'Perlu Perhatian',
        className:
          'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      };
    }
    return {
      label: 'Sehat & Terkendali',
      className:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Dashboard {activeWorkspace?.name ?? ''}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ringkasan kondisi keuangan real-time untuk workspace aktif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  period === opt.value
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <span className="text-xs text-slate-400">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading || !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Total Saldo
                </span>
                <Wallet className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(data.summary.totalBalance, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Dari {data.summary.activeWalletsCount} dompet aktif
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pemasukan Bulan Ini
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.summary.monthlyIncome, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Periode filter: {formatCurrency(data.summary.periodIncome, currency)}
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pengeluaran Bulan Ini
                </span>
                <TrendingDown className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(data.summary.monthlyExpense, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Periode filter: {formatCurrency(data.summary.periodExpense, currency)}
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sisa Anggaran
                </span>
                <PiggyBank className="h-4 w-4 text-amber-600" />
              </div>
              <p
                className={`mt-2 text-2xl font-bold ${
                  Number(data.summary.remainingBudget) < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formatCurrency(data.summary.remainingBudget, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {data.budgetSummary.length} pos anggaran aktif
              </p>
            </Card>
          </div>

          <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Ringkasan Kondisi Keuangan
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${healthBadge(data.summary.financialHealth).className}`}
                  >
                    {healthBadge(data.summary.financialHealth).label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Arus kas bersih periode:{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {formatCurrency(data.summary.netCashflow, currency)}
                  </strong>{' '}
                  • Rasio tabungan:{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {data.summary.savingsRatePercent}%
                  </strong>
                </p>
              </div>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Lihat Laporan Lengkap →
            </Link>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Pemasukan vs Pengeluaran
                </h2>
                <span className="text-xs text-slate-400">
                  {formatDate(data.period.startDate, dateFormat)} –{' '}
                  {formatDate(data.period.endDate, dateFormat)}
                </span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.incomeVsExpenseSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: number) =>
                        formatCurrency(String(val), currency)
                      }
                    />
                    <Bar
                      dataKey="income"
                      name="Pemasukan"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expense"
                      name="Pengeluaran"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Pengeluaran per Kategori
              </h2>
              {data.expenseByCategory.length === 0 ? (
                <div className="flex h-60 items-center justify-center text-sm text-slate-400">
                  Belum ada pengeluaran di periode ini.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.expenseByCategory}
                          dataKey="numericAmount"
                          nameKey="categoryName"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {data.expenseByCategory.map((entry) => (
                            <Cell key={entry.categoryId} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: number) =>
                            formatCurrency(String(val), currency)
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5">
                    {data.expenseByCategory.slice(0, 5).map((cat) => (
                      <div
                        key={cat.categoryId}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.categoryName}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {cat.percentage}% • {formatCurrency(cat.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-1">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Ringkasan Anggaran
                </h2>
                <Link
                  to="/budgets"
                  className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Kelola
                </Link>
              </div>
              {data.budgetSummary.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Belum ada anggaran aktif pada periode ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.budgetSummary.slice(0, 5).map((b) => (
                    <div key={b.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {b.name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {b.percentageUsed}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            b.status === 'EXCEEDED'
                              ? 'bg-rose-600'
                              : b.status === 'WARNING'
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.min(100, b.percentageUsed)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 lg:col-span-1">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Target Tabungan
                </h2>
                <Link
                  to="/savings-goals"
                  className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Kelola
                </Link>
              </div>
              {data.savingsGoalsSummary.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Belum ada target tabungan.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.savingsGoalsSummary.map((g) => (
                    <div key={g.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {g.name}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {g.progressPercent}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-600"
                          style={{ width: `${g.progressPercent}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {formatCurrency(g.currentAmount, currency)} /{' '}
                        {formatCurrency(g.targetAmount, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 lg:col-span-1">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Transaksi Terbaru
                </h2>
                <Link
                  to="/transactions"
                  className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  Semua
                </Link>
              </div>
              {data.recentTransactions.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Belum ada transaksi tercatat.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.recentTransactions.slice(0, 6).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            tx.type === 'INCOME'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60'
                              : tx.type === 'EXPENSE'
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60'
                                : 'bg-sky-50 text-sky-600 dark:bg-sky-950/60'
                          }`}
                        >
                          {tx.type === 'INCOME' ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : tx.type === 'EXPENSE' ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                            {tx.description}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {formatDate(tx.transactionDate, dateFormat)} •{' '}
                            {tx.wallet.name}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 font-semibold ${
                          tx.type === 'INCOME'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.type === 'EXPENSE'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {tx.type === 'INCOME'
                          ? '+'
                          : tx.type === 'EXPENSE'
                            ? '-'
                            : ''}
                        {formatCurrency(tx.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

