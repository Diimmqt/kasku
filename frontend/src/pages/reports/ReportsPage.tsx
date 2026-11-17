import { useCallback, useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  ApiRequestError,
  apiDownloadFile,
  apiRequest,
} from '../../lib/api-client';
import { formatCurrency, formatDate } from '../../lib/format';
import type { ReportPeriodPreset, ReportSummaryPayload } from '../../types/api';

const PERIOD_OPTIONS: { value: ReportPeriodPreset; label: string }[] = [
  { value: 'THIS_WEEK', label: 'Minggu Ini' },
  { value: 'THIS_MONTH', label: 'Bulan Ini' },
  { value: 'THIS_YEAR', label: 'Tahun Ini' },
  { value: 'CUSTOM', label: 'Kustom' },
];

export function ReportsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [period, setPeriod] = useState<ReportPeriodPreset>('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ReportSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canViewReports = activeWorkspace?.myPermissions?.canViewReports ?? false;
  const currency = activeWorkspace?.currency || user?.preferredCurrency || 'IDR';
  const dateFormat = user?.dateFormat || 'DD/MM/YYYY';

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams({
      period,
      year: String(year),
    });
    if (period === 'CUSTOM' && startDate && endDate) {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    }
    return params.toString();
  }, [period, startDate, endDate, year]);

  const loadReport = useCallback(async () => {
    if (!activeWorkspace || !canViewReports) {
      setLoading(false);
      return;
    }
    if (period === 'CUSTOM' && (!startDate || !endDate)) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<ReportSummaryPayload>(
        `/workspaces/${activeWorkspace.id}/reports/summary?${buildQueryString()}`,
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memuat laporan keuangan.',
      );
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, canViewReports, period, startDate, endDate, buildQueryString]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (!activeWorkspace) return;
    setExporting(type);
    setError(null);
    try {
      const ext = type === 'pdf' ? 'pdf' : 'xlsx';
      const stamp = new Date().toISOString().slice(0, 10);
      await apiDownloadFile(
        `/workspaces/${activeWorkspace.id}/reports/export/${type}?${buildQueryString()}`,
        `laporan-kasku-${stamp}.${ext}`,
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : `Gagal mengekspor laporan ${type.toUpperCase()}.`,
      );
    } finally {
      setExporting(null);
    }
  };

  if (!canViewReports) {
    return (
      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="mb-3 h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Akses Laporan Terbatas
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Anda belum memiliki izin untuk melihat laporan keuangan pada workspace ini. Hubungi Owner atau Admin keluarga.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Laporan Keuangan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Analisis pemasukan, pengeluaran, kategori, tren tahunan, dan perbandingan periode.
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
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <span className="text-xs text-slate-400">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {[year - 2, year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={exporting !== null}
            onClick={() => void handleExport('pdf')}
          >
            <FileText className="h-4 w-4 text-rose-600" />
            {exporting === 'pdf' ? 'Menyiapkan PDF...' : 'Ekspor PDF'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={exporting !== null}
            onClick={() => void handleExport('excel')}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            {exporting === 'excel' ? 'Menyiapkan Excel...' : 'Ekspor Excel'}
          </Button>
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
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pemasukan Periode
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.overview.totalIncome, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                vs periode lalu:{' '}
                <strong
                  className={
                    data.comparison.incomeChangePercent >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }
                >
                  {data.comparison.incomeChangePercent >= 0 ? '+' : ''}
                  {data.comparison.incomeChangePercent}%
                </strong>
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pengeluaran Periode
              </p>
              <p className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-400">
                {formatCurrency(data.overview.totalExpense, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                vs periode lalu:{' '}
                <strong
                  className={
                    data.comparison.expenseChangePercent <= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }
                >
                  {data.comparison.expenseChangePercent >= 0 ? '+' : ''}
                  {data.comparison.expenseChangePercent}%
                </strong>
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Arus Kas Bersih
              </p>
              <p
                className={`mt-1 text-xl font-bold ${
                  Number(data.overview.netCashflow) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(data.overview.netCashflow, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Sebelumnya: {formatCurrency(data.comparison.previousNetCashflow, currency)}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Total Saldo Saat Ini
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                {formatCurrency(data.overview.totalBalance, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {data.overview.transactionCount} transaksi di periode ini
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Grafik Income vs Expense (Periode Aktif)
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.periodTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: number) =>
                        formatCurrency(String(val), currency)
                      }
                    />
                    <Bar dataKey="income" name="Pemasukan" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Tren Keuangan Bulanan ({data.year})
              </h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: number) =>
                        formatCurrency(String(val), currency)
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="income"
                      name="Pemasukan"
                      stroke="#059669"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expense"
                      name="Pengeluaran"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Arus Kas Bersih"
                      stroke="#0284c7"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Pie Chart Pengeluaran Kategori
              </h2>
              {data.expenseByCategory.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">
                  Belum ada data pengeluaran.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.expenseByCategory}
                          dataKey="numericAmount"
                          nameKey="categoryName"
                          innerRadius={40}
                          outerRadius={72}
                        >
                          {data.expenseByCategory.map((item) => (
                            <Cell key={item.categoryId} fill={item.color} />
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
                    {data.expenseByCategory.map((c) => (
                      <div
                        key={c.categoryId}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                          {c.categoryName} ({c.count})
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(c.amount, currency)} ({c.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Laporan Pemasukan per Kategori
              </h2>
              {data.incomeByCategory.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">
                  Belum ada data pemasukan.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.incomeByCategory.map((c) => (
                    <div key={c.categoryId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {c.categoryName} ({c.count})
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(c.amount, currency)} ({c.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${c.percentage}%`,
                            backgroundColor: c.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                Laporan Saldo Dompet
              </h2>
              {data.walletBalances.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">
                  Belum ada dompet aktif.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.walletBalances.map((w) => (
                    <div key={w.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {w.name}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(w.balance, currency)} ({w.percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(0, w.percentage)}%`,
                            backgroundColor: w.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Rincian Transaksi Periode ({data.transactions.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Deskripsi</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3">Dompet</th>
                    <th className="px-4 py-3">Dicatat Oleh</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        Tidak ada transaksi pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    data.transactions.slice(0, 50).map((tx) => (
                      <tr key={tx.id}>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {formatDate(tx.transactionDate, dateFormat)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                          {tx.categoryName}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                          {tx.destinationWalletName
                            ? `${tx.walletName} → ${tx.destinationWalletName}`
                            : tx.walletName}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {tx.createdByName}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-semibold ${
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

