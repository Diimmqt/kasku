import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Archive,
  ArrowLeftRight,
  Banknote,
  Building2,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  Users,
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
  TransactionItem,
  WalletItem,
  WalletsListPayload,
  WalletType,
} from '../../types/api';

const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  CASH: 'Tunai / Cash',
  BANK: 'Rekening Bank',
  E_WALLET: 'E-Wallet',
  FAMILY_WALLET: 'Dompet Keluarga',
  OTHER: 'Lainnya',
};

function WalletTypeIcon({ type }: { type: WalletType }) {
  if (type === 'BANK') return <Building2 className="h-5 w-5" />;
  if (type === 'E_WALLET') return <Smartphone className="h-5 w-5" />;
  if (type === 'FAMILY_WALLET') return <Users className="h-5 w-5" />;
  if (type === 'CASH') return <Banknote className="h-5 w-5" />;
  return <Wallet className="h-5 w-5" />;
}

export function WalletsPage() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  const [wallets, setWallets] = useState<WalletItem[]>([]);
  const [totalBalance, setTotalBalance] = useState('0');
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Create/Edit wallet modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletItem | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<WalletType>('CASH');
  const [initialBalance, setInitialBalance] = useState('0');
  const [color, setColor] = useState('#059669');
  const [saving, setSaving] = useState(false);

  // Wallet history modal
  const [detailWallet, setDetailWallet] = useState<
    (WalletItem & { recentTransactions: TransactionItem[] }) | null
  >(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Quick transfer modal
  const [transferOpen, setTransferOpen] = useState(false);
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [destinationWalletId, setDestinationWalletId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('Transfer antar dompet');
  const [transferDate, setTransferDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [transferring, setTransferring] = useState(false);

  const canManageWallets =
    activeWorkspace?.myRole === 'OWNER' ||
    Boolean(activeWorkspace?.myPermissions.canManageWallets);
  const canCreateTx =
    activeWorkspace?.myRole === 'OWNER' ||
    Boolean(activeWorkspace?.myPermissions.canManageTransactions);

  const loadWallets = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const data = await apiRequest<WalletsListPayload>(
        `/workspaces/${activeWorkspace.id}/wallets?includeArchived=${includeArchived}`,
      );
      setWallets(data.wallets);
      setTotalBalance(data.totalBalance);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal memuat daftar dompet.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, includeArchived]);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const openCreateModal = () => {
    setEditingWallet(null);
    setName('');
    setType(activeWorkspace?.type === 'FAMILY' ? 'FAMILY_WALLET' : 'CASH');
    setInitialBalance('0');
    setColor('#059669');
    setModalOpen(true);
  };

  const openEditModal = (wallet: WalletItem) => {
    setEditingWallet(wallet);
    setName(wallet.name);
    setType(wallet.type);
    setInitialBalance(wallet.initialBalance);
    setColor(wallet.color);
    setModalOpen(true);
  };

  const handleSaveWallet = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSaving(true);
    setFeedback(null);

    try {
      if (editingWallet) {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/wallets/${editingWallet.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ name: name.trim(), type, color }),
          },
        );
        setFeedback({ type: 'success', message: 'Dompet berhasil diperbarui.' });
      } else {
        await apiRequest(`/workspaces/${activeWorkspace.id}/wallets`, {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            type,
            initialBalance: initialBalance.trim() || '0',
            color,
          }),
        });
        setFeedback({ type: 'success', message: 'Dompet berhasil dibuat.' });
      }
      setModalOpen(false);
      await loadWallets();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menyimpan dompet.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async (wallet: WalletItem) => {
    if (!activeWorkspace) return;
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/wallets/${wallet.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ isArchived: !wallet.isArchived }),
        },
      );
      await loadWallets();
      setFeedback({
        type: 'success',
        message: wallet.isArchived
          ? 'Dompet dipulihkan dari arsip.'
          : 'Dompet diarsipkan.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal mengubah status arsip dompet.',
      });
    }
  };

  const handleDeleteWallet = async (wallet: WalletItem) => {
    if (!activeWorkspace) return;
    if (!window.confirm(`Hapus dompet "${wallet.name}"?`)) return;
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/wallets/${wallet.id}`,
        { method: 'DELETE' },
      );
      await loadWallets();
      setFeedback({ type: 'success', message: 'Dompet berhasil dihapus.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menghapus dompet.',
      });
    }
  };

  const openWalletHistory = async (walletId: string) => {
    if (!activeWorkspace) return;
    setLoadingDetail(true);
    try {
      const detail = await apiRequest<
        WalletItem & { recentTransactions: TransactionItem[] }
      >(`/workspaces/${activeWorkspace.id}/wallets/${walletId}`);
      setDetailWallet(detail);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal memuat riwayat transaksi dompet.',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const openTransferModal = () => {
    const activeWallets = wallets.filter((w) => !w.isArchived);
    setSourceWalletId(activeWallets[0]?.id ?? '');
    setDestinationWalletId(activeWallets[1]?.id ?? '');
    setTransferAmount('');
    setTransferDesc('Transfer antar dompet');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferOpen(true);
  };

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setTransferring(true);
    setFeedback(null);
    try {
      await apiRequest(`/workspaces/${activeWorkspace.id}/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'TRANSFER',
          walletId: sourceWalletId,
          destinationWalletId,
          amount: transferAmount.trim(),
          transactionDate: new Date(transferDate).toISOString(),
          description: transferDesc.trim(),
        }),
      });
      setTransferOpen(false);
      await loadWallets();
      setFeedback({
        type: 'success',
        message: 'Transfer antar dompet berhasil dicatat.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal melakukan transfer antar dompet.',
      });
    } finally {
      setTransferring(false);
    }
  };

  const activeWalletList = wallets.filter((w) => !w.isArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dompet
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola akun kas, bank, e-wallet, dan dompet keluarga pada{' '}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {activeWorkspace?.name}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canCreateTx && activeWalletList.length >= 2 && (
            <Button variant="secondary" onClick={openTransferModal}>
              <ArrowLeftRight className="h-4 w-4" />
              Transfer Antar Dompet
            </Button>
          )}
          {canManageWallets && (
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Tambah Dompet
            </Button>
          )}
        </div>
      </div>

      {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}

      {/* Total Balance Card */}
      <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-6 text-white border-none">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-emerald-100">
              Total Saldo Dompet Aktif
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">
              {formatCurrency(totalBalance, activeWorkspace?.currency)}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-emerald-100">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            Tampilkan dompet diarsipkan
          </label>
        </div>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </Card>
      ) : wallets.length === 0 ? (
        <Card className="p-10 text-center">
          <Wallet className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
          <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
            Belum ada dompet
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Buat dompet pertama Anda untuk mulai mencatat transaksi.
          </p>
          {canManageWallets && (
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Tambah Dompet
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((w) => (
            <Card
              key={w.id}
              className={`p-5 transition ${w.isArchived ? 'opacity-65' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: w.color || '#059669' }}
                  >
                    <WalletTypeIcon type={w.type} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {w.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {WALLET_TYPE_LABELS[w.type]}
                      {w.isArchived ? ' · Diarsipkan' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Saldo saat ini
                </p>
                <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(w.balance, w.currency)}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => void openWalletHistory(w.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Riwayat ({w.transactionCount ?? 0})
                </button>

                {canManageWallets && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(w)}
                      title="Edit dompet"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleArchive(w)}
                      title={w.isArchived ? 'Pulihkan' : 'Arsipkan'}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                    {(w.transactionCount ?? 0) === 0 && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteWallet(w)}
                        title="Hapus dompet"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingWallet ? 'Edit Dompet' : 'Tambah Dompet Baru'}
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
              onSubmit={(e) => void handleSaveWallet(e)}
              className="mt-4 space-y-4"
            >
              <Input
                label="Nama Dompet"
                required
                minLength={2}
                placeholder="Contoh: BCA Utama, GoPay, Dompet Tunai"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Jenis Dompet
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as WalletType)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {Object.entries(WALLET_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {!editingWallet && (
                <AmountInput
                  label="Saldo Awal"
                  required
                  value={initialBalance}
                  onValueChange={setInitialBalance}
                />
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Warna Kartu
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
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
                  Simpan
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Transfer Modal */}
      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Transfer Antar Dompet
              </h3>
              <button
                type="button"
                onClick={() => setTransferOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleTransfer(e)}
              className="mt-4 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Dompet Asal
                </label>
                <select
                  value={sourceWalletId}
                  onChange={(e) => setSourceWalletId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {activeWalletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(w.balance, w.currency)})
                    </option>
                  ))}
                </select>
              </div>

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
                  {activeWalletList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatCurrency(w.balance, w.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <AmountInput
                label="Nominal Transfer"
                required
                placeholder="100.000"
                value={transferAmount}
                onValueChange={setTransferAmount}
              />

              <Input
                label="Tanggal"
                type="date"
                required
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />

              <Input
                label="Deskripsi"
                required
                value={transferDesc}
                onChange={(e) => setTransferDesc(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setTransferOpen(false)}
                >
                  Batal
                </Button>
                <Button type="submit" loading={transferring}>
                  Kirim Transfer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Wallet History Modal */}
      {(detailWallet || loadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Riwayat Transaksi · {detailWallet?.name}
                </h3>
                {detailWallet && (
                  <p className="text-xs text-slate-500">
                    Saldo saat ini:{' '}
                    {formatCurrency(
                      detailWallet.balance,
                      detailWallet.currency,
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetailWallet(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : detailWallet && detailWallet.recentTransactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Belum ada transaksi pada dompet ini.
              </p>
            ) : (
              <ul className="mt-4 max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                {detailWallet?.recentTransactions.map((tx) => {
                  const isIncomingTransfer =
                    tx.type === 'TRANSFER' &&
                    tx.destinationWalletId === detailWallet.id;
                  const isCredit = tx.type === 'INCOME' || isIncomingTransfer;

                  return (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-white">
                          {tx.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(tx.transactionDate, user?.dateFormat)} ·{' '}
                          {tx.type === 'TRANSFER'
                            ? `${tx.wallet.name} → ${tx.destinationWallet?.name ?? ''}`
                            : (tx.category?.name ?? tx.type)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-semibold ${
                          isCredit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatCurrency(tx.amount, detailWallet.currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

