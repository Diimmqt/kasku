import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Archive, Loader2, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ApiRequestError, apiRequest } from '../../lib/api-client';
import type { CategoryItem, CategoryType } from '../../types/api';

export function CategoriesPage() {
  const { activeWorkspace } = useWorkspace();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryType>('EXPENSE');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('EXPENSE');
  const [color, setColor] = useState('#059669');
  const [saving, setSaving] = useState(false);

  const canManageCategories =
    activeWorkspace?.myRole === 'OWNER' ||
    Boolean(activeWorkspace?.myPermissions.canManageCategories);

  const loadCategories = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const list = await apiRequest<CategoryItem[]>(
        `/workspaces/${activeWorkspace.id}/categories?type=${activeTab}`,
      );
      setCategories(list);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal memuat kategori.',
      });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, activeTab]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setType(activeTab);
    setColor(activeTab === 'INCOME' ? '#059669' : '#f97316');
    setModalOpen(true);
  };

  const openEdit = (cat: CategoryItem) => {
    setEditing(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setSaving(true);
    setFeedback(null);

    try {
      if (editing) {
        await apiRequest(
          `/workspaces/${activeWorkspace.id}/categories/${editing.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ name: name.trim(), color }),
          },
        );
        setFeedback({
          type: 'success',
          message: 'Kategori berhasil diperbarui.',
        });
      } else {
        await apiRequest(`/workspaces/${activeWorkspace.id}/categories`, {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), type, color }),
        });
        setFeedback({ type: 'success', message: 'Kategori berhasil dibuat.' });
      }
      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menyimpan kategori.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrArchive = async (cat: CategoryItem) => {
    if (!activeWorkspace) return;
    const actionLabel =
      cat.isDefault || (cat._count?.transactions ?? 0) > 0
        ? `Arsipkan kategori "${cat.name}"?`
        : `Hapus kategori "${cat.name}"?`;
    if (!window.confirm(actionLabel)) return;

    setFeedback(null);
    try {
      const res = await apiRequest<{ deleted: boolean; archived: boolean }>(
        `/workspaces/${activeWorkspace.id}/categories/${cat.id}`,
        { method: 'DELETE' },
      );
      await loadCategories();
      setFeedback({
        type: 'success',
        message: res.archived
          ? 'Kategori diarsipkan untuk menjaga riwayat transaksi.'
          : 'Kategori berhasil dihapus.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menghapus kategori.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Kategori
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Atur kategori pemasukan dan pengeluaran pada{' '}
            <span className="font-medium text-emerald-700 dark:text-emerald-400">
              {activeWorkspace?.name}
            </span>
          </p>
        </div>

        {canManageCategories && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Kategori
          </Button>
        )}
      </div>

      {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}

      <div className="flex gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {(
          [
            { id: 'EXPENSE', label: 'Pengeluaran' },
            { id: 'INCOME', label: 'Pemasukan' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Card key={cat.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ backgroundColor: cat.color }}
                >
                  <Tags className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {cat.isDefault ? 'Default' : 'Custom'} ·{' '}
                    {cat._count?.transactions ?? 0} transaksi
                  </p>
                </div>
              </div>

              {canManageCategories && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(cat)}
                    title="Edit kategori"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteOrArchive(cat)}
                    title={
                      cat.isDefault || (cat._count?.transactions ?? 0) > 0
                        ? 'Arsipkan'
                        : 'Hapus'
                    }
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                  >
                    {cat.isDefault || (cat._count?.transactions ?? 0) > 0 ? (
                      <Archive className="h-4 w-4" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editing ? 'Edit Kategori' : 'Tambah Kategori'}
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
              <Input
                label="Nama Kategori"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              {!editing && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Jenis Kategori
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CategoryType)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="EXPENSE">Pengeluaran (Expense)</option>
                    <option value="INCOME">Pemasukan (Income)</option>
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Warna Kategori
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
    </div>
  );
}

