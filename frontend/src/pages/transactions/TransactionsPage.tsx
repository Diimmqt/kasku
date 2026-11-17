import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
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
import {
  ApiRequestError,
  apiRequest,
  apiRequestWithMeta,
} from '../../lib/api-client';
import { formatCurrency, formatDate } from '../../lib/format';
import type {
  CategoryItem,
  PaginationMeta,
  TransactionItem,
  TransactionType,
  WalletItem,
  WalletsListPayload,
} from '../../types/api';

export function TransactionsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterWalletId, setFilterWalletId] = useState<string>('');
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Form Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [txType, setTxType] = useState<TransactionType>('EXPENSE');
  const [walletId, setWalletId] = useState('');
  const [destinationWalletId, setDestinationWalletId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Detail Modal
  const [detailTx, setDetailTx] = useState<TransactionItem | null>(null);

  const canManageTx =
    activeWorkspace?.myRole === 'OWNER' ||
    Boolean(activeWorkspace?.myPermissions.canManageTransactions);

  const loadReferenceData = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const [walletData, categoryData] = await Promise.all([
        apiRequest<WalletsListPayload>(
          `/workspaces/${activeWorkspace.id}/wallets`,
        ),
        apiRequest<CategoryItem[]>(
          `/workspaces/${activeWorkspace.id}/categories`,
        ),
      ]);
      setWallets(walletData.wallets);
      setCategories(categoryData);
    } catch {
      // Errors surfaced when loading transactions.
    }
  }, [activeWorkspace]);

  const loadTransactions = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
      });
      if (filterType) params.set('type', filterType);
      if (filterWalletId) params.set('walletId', filterWalletId);
      if (filterCategoryId) params.set('categoryId', filterCategoryId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (search.trim()) params.set('search', search.trim());

      const res = await apiRequestWithMeta<TransactionItem[]>(
        `/workspaces/${activeWorkspace.id}/transactions?${params.toString()}`,
      );
      setTransactions(res.data);
      if (res.meta) {
        setMeta(res.meta as unknown as PaginationMeta);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal memuat daftar transaksi.',
      });
    } finally {
      setLoading(false);
    }
  }, [
    activeWorkspace,
    page,
    filterType,
    filterWalletId,
    filterCategoryId,
    startDate,
    endDate,
    search,
  ]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const matchingCategories = (targetType: TransactionType) => {
    if (targetType === 'TRANSFER') return [];
    return categories.filter((c) => c.type === targetType);
  };

  const openCreateModal = () => {
    setEditingTx(null);
    const defaultType: TransactionType = 'EXPENSE';
    setTxType(defaultType);
    setWalletId(wallets[0]?.id ?? '');
    setDestinationWalletId(wallets[1]?.id ?? '');
    setCategoryId(matchingCategories(defaultType)[0]?.id ?? '');
    setAmount('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setNote('');
    setModalOpen(true);
  };

  const openEditModal = (tx: TransactionItem) => {
    setEditingTx(tx);
    setTxType(tx.type);
    setWalletId(tx.walletId);
    setDestinationWalletId(tx.destinationWalletId ?? wallets[1]?.id ?? '');
    setCategoryId(tx.categoryId ?? matchingCategories(tx.type)[0]?.id ?? '');
    setAmount(tx.amount);
    setTransactionDate(tx.transactionDate.slice(0, 10));
    setDescription(tx.description);
    setNote(tx.note ?? '');
    setModalOpen(true);
  };

  const handleTypeSwitch = (nextType: TransactionType) => {
    setTxType(nextType);
    if (nextType !== 'TRANSFER') {
      const valid = matchingCategories(nextType);
      if (!valid.some((c) => c.id === categoryId)) {
        setCategoryId(valid[0]?.id ?? '');
      }
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSaving(true);
    setFeedback(null);

    const payload = {
      type: txType,
      walletId,
      ...(txType === 'TRANSFER'
        ? { destinationWalletId }
        : { categoryId }),
      amount: amount.trim(),
      transactionDate: new Date(transactionDate).toISOString(),
      description: description.trim(),
      note: note.trim() ? note.trim() : undefined,
    };

    try {
      if (editingTx) {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/transactions/${editingTx.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          },
        );
        setFeedback({
          type: 'success',
          message: 'Transaksi berhasil diperbarui dan saldo disinkronkan.',
        });
      } else {
        await apiRequest(`/workspaces/${activeWorkspace.id}/transactions`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({
          type: 'success',
          message: 'Transaksi berhasil dicatat.',
        });
      }
      setModalOpen(false);
      await Promise.all([loadTransactions(), loadReferenceData()]);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menyimpan transaksi.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tx: TransactionItem) => {
    if (!activeWorkspace) return;
    if (!window.confirm(`Hapus transaksi "${tx.description}"?`)) return;
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/transactions/${tx.id}`,
        { method: 'DELETE' },
      );
      await Promise.all([loadTransactions(), loadReferenceData()]);
      setFeedback({
        type: 'success',
        message: 'Transaksi dihapus dan saldo dompet dikembalikan.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menghapus transaksi.',
      });
    }
  };

  const resetFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterWalletId('');
    setFilterCategoryId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Transaksi
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Catat dan pantau pemasukan, pengeluaran, serta transfer antar dompet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/recurring"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <CalendarClock className="h-4 w-4 text-emerald-600" />
            Transaksi Berulang
          </Link>
          {canManageTx && (
            <Button onClick={openCreateModal} disabled={wallets.length === 0}>
              <Plus className="h-4 w-4" />
              Tambah Transaksi
            </Button>
          )}
        </div>
      </div>

      {wallets.length === 0 && !loading && (
        <Alert variant="info">
          Anda belum memiliki dompet di workspace ini. Silakan buat dompet
          terlebih dahulu di menu <strong>Dompet</strong> sebelum mencatat
          transaksi.
        </Alert>
      )}

      {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari deskripsi atau catatan..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Semua Jenis</option>
            <option value="INCOME">Pemasukan</option>
            <option value="EXPENSE">Pengeluaran</option>
            <option value="TRANSFER">Transfer</option>
          </select>

          <select
            value={filterWalletId}
            onChange={(e) => {
              setFilterWalletId(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Semua Dompet</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={filterCategoryId}
            onChange={(e) => {
              setFilterCategoryId(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type === 'INCOME' ? 'Masuk' : 'Keluar'})
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              aria-label="Tanggal mulai"
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              aria-label="Tanggal selesai"
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        {(search ||
          filterType ||
          filterWalletId ||
          filterCategoryId ||
          startDate ||
          endDate) && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Reset Filter
            </button>
          </div>
        )}
      </Card>

      {/* Transactions List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <ArrowLeftRight className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              Belum ada transaksi ditemukan
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Catat transaksi pertama Anda atau ubah filter pencarian.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const isTransfer = tx.type === 'TRANSFER';
              return (
                <div
                  key={tx.id}
                  className="flex flex-col justify-between gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center dark:hover:bg-slate-800/40"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isIncome
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : isTransfer
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                            : 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="h-5 w-5" />
                      ) : isTransfer ? (
                        <ArrowLeftRight className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(tx.transactionDate, user?.dateFormat)} ·{' '}
                        {isTransfer
                          ? `${tx.wallet.name} → ${tx.destinationWallet?.name ?? ''}`
                          : `${tx.category?.name ?? '-'} · ${tx.wallet.name}`}
                        {' · '}Oleh {tx.createdBy.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span
                      className={`text-sm font-bold ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isTransfer
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isIncome ? '+' : isTransfer ? '' : '-'}
                      {formatCurrency(tx.amount, activeWorkspace?.currency)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDetailTx(tx)}
                        title="Detail transaksi"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canManageTx && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(tx)}
                            title="Edit transaksi"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(tx)}
                            title="Hapus transaksi"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
            <span>
              Halaman {meta.page} dari {meta.totalPages} ({meta.total}{' '}
              transaksi)
            </span>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Sebelumnya
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Berikutnya
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add / Edit Transaction Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingTx ? 'Edit Transaksi' : 'Catat Transaksi Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSave(e)}
              className="mt-4 space-y-4"
            >
              {/* Type Tabs */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'EXPENSE', label: 'Pengeluaran' },
                    { id: 'INCOME', label: 'Pemasukan' },
                    { id: 'TRANSFER', label: 'Transfer' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTypeSwitch(t.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      txType === t.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AmountInput
                  label="Nominal"
                  required
                  placeholder="50.000"
                  value={amount}
                  onValueChange={setAmount}
                />

                <Input
                  label="Tanggal"
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {txType === 'TRANSFER' ? 'Dompet Asal' : 'Dompet'}
                  </label>
                  <select
                    value={walletId}
                    onChange={(e) => setWalletId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatCurrency(w.balance, w.currency)})
                      </option>
                    ))}
                  </select>
                </div>

                {txType === 'TRANSFER' ? (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Dompet Tujuan
                    </label>
                    <select
                      value={destinationWalletId}
                      onChange={(e) => setDestinationWalletId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({formatCurrency(w.balance, w.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Kategori
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      {matchingCategories(txType).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <Input
                label="Deskripsi"
                required
                placeholder="Contoh: Belanja bulanan"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Catatan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
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
                <Button type="submit" loading={saving}>
                  {editingTx ? 'Perbarui' : 'Simpan Transaksi'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Detail Modal */}
      {detailTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Detail Transaksi
              </h3>
              <button
                type="button"
                onClick={() => setDetailTx(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Deskripsi</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">
                  {detailTx.description}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Nominal</dt>
                <dd className="font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(detailTx.amount, activeWorkspace?.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Jenis</dt>
                <dd>{detailTx.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Tanggal</dt>
                <dd>{formatDate(detailTx.transactionDate, user?.dateFormat)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Dompet</dt>
                <dd>
                  {detailTx.type === 'TRANSFER'
                    ? `${detailTx.wallet.name} → ${detailTx.destinationWallet?.name ?? ''}`
                    : detailTx.wallet.name}
                </dd>
              </div>
              {detailTx.category && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Kategori</dt>
                  <dd>{detailTx.category.name}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">Dicatat oleh</dt>
                <dd>
                  {detailTx.createdBy.name} ({detailTx.createdBy.email})
                </dd>
              </div>
              {detailTx.note && (
                <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
                  <dt className="text-xs text-slate-500">Catatan</dt>
                  <dd className="mt-1 text-slate-700 dark:text-slate-300">
                    {detailTx.note}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      )}
    </div>
  );
}
