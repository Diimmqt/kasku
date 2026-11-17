import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  Check,
  Clock,
  Crown,
  Loader2,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ApiRequestError, apiRequest } from '../../lib/api-client';
import type {
  FamilyInvitationItem,
  WorkspaceActivityItem,
  WorkspaceMemberItem,
  WorkspacePermissions,
  WorkspaceRole,
} from '../../types/api';

const PERMISSION_LABELS: { key: keyof WorkspacePermissions; label: string }[] = [
  { key: 'canViewTransactions', label: 'Lihat transaksi' },
  { key: 'canManageTransactions', label: 'Catat & ubah transaksi' },
  { key: 'canManageWallets', label: 'Kelola dompet' },
  { key: 'canManageCategories', label: 'Kelola kategori' },
  { key: 'canManageBudgets', label: 'Kelola anggaran' },
  { key: 'canManageGoals', label: 'Kelola target tabungan' },
  { key: 'canManageDebts', label: 'Kelola utang & piutang' },
  { key: 'canManageRecurring', label: 'Kelola transaksi berulang' },
  { key: 'canViewReports', label: 'Lihat laporan keuangan' },
  { key: 'canManageMembers', label: 'Kelola anggota keluarga' },
  { key: 'canManageSettings', label: 'Ubah pengaturan keluarga' },
];

const DEFAULT_MEMBER_PERMS: WorkspacePermissions = {
  canViewTransactions: true,
  canManageTransactions: true,
  canManageWallets: false,
  canManageCategories: false,
  canManageBudgets: false,
  canManageGoals: true,
  canManageDebts: false,
  canManageRecurring: false,
  canViewReports: true,
  canManageMembers: false,
  canManageSettings: false,
};

export function FamilyPage() {
  const { user } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    pendingInvitations,
    switchWorkspace,
    refreshWorkspaces,
    createFamilyWorkspace,
    acceptInvitation,
    rejectInvitation,
  } = useWorkspace();

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Create family modal/form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyCurrency, setNewFamilyCurrency] = useState('IDR');
  const [creatingFamily, setCreatingFamily] = useState(false);

  // Active family workspace data
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitationItem[]>([]);
  const [activities, setActivities] = useState<WorkspaceActivityItem[]>([]);
  const [loadingFamilyData, setLoadingFamilyData] = useState(false);

  // Edit family name
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Invite member form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [inviting, setInviting] = useState(false);

  // Edit member modal
  const [editingMember, setEditingMember] = useState<WorkspaceMemberItem | null>(
    null,
  );
  const [editMemberRole, setEditMemberRole] = useState<'ADMIN' | 'MEMBER'>(
    'MEMBER',
  );
  const [editMemberPerms, setEditMemberPerms] =
    useState<WorkspacePermissions>(DEFAULT_MEMBER_PERMS);
  const [savingMember, setSavingMember] = useState(false);

  const isFamily = activeWorkspace?.type === 'FAMILY';
  const canManageMembers =
    isFamily &&
    (activeWorkspace.myRole === 'OWNER' ||
      activeWorkspace.myPermissions.canManageMembers);
  const canManageSettings =
    isFamily &&
    (activeWorkspace.myRole === 'OWNER' ||
      activeWorkspace.myPermissions.canManageSettings);

  const loadFamilyDetails = useCallback(async () => {
    if (!activeWorkspace || activeWorkspace.type !== 'FAMILY') {
      setMembers([]);
      setInvitations([]);
      setActivities([]);
      return;
    }

    setLoadingFamilyData(true);
    setEditName(activeWorkspace.name);

    try {
      const [memberList, activityList, invitationList] = await Promise.all([
        apiRequest<WorkspaceMemberItem[]>(
          `/workspaces/${activeWorkspace.id}/members`,
        ),
        apiRequest<WorkspaceActivityItem[]>(
          `/workspaces/${activeWorkspace.id}/activities?limit=15`,
        ),
        canManageMembers
          ? apiRequest<FamilyInvitationItem[]>(
              `/workspaces/${activeWorkspace.id}/invitations`,
            )
          : Promise.resolve([]),
      ]);
      setMembers(memberList);
      setActivities(activityList);
      setInvitations(invitationList);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal memuat data workspace keluarga.',
      });
    } finally {
      setLoadingFamilyData(false);
    }
  }, [activeWorkspace, canManageMembers]);

  useEffect(() => {
    void loadFamilyDetails();
  }, [loadFamilyDetails]);

  const handleCreateFamily = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setCreatingFamily(true);
    try {
      await createFamilyWorkspace(newFamilyName.trim(), newFamilyCurrency);
      setNewFamilyName('');
      setShowCreateForm(false);
      setFeedback({
        type: 'success',
        message: 'Family Workspace berhasil dibuat dan diaktifkan.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal membuat Family Workspace.',
      });
    } finally {
      setCreatingFamily(false);
    }
  };

  const handleUpdateFamilyName = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setFeedback(null);
    setSavingName(true);
    try {
      await apiRequest(`/workspaces/${activeWorkspace.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim() }),
      });
      await refreshWorkspaces();
      setFeedback({
        type: 'success',
        message: 'Nama keluarga berhasil diperbarui.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal mengubah nama keluarga.',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    setFeedback(null);
    setInviting(true);
    try {
      await apiRequest(`/workspaces/${activeWorkspace.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      setInviteEmail('');
      setInviteRole('MEMBER');
      await loadFamilyDetails();
      setFeedback({
        type: 'success',
        message: 'Undangan anggota berhasil dikirim.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal mengirim undangan.',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!activeWorkspace) return;
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/invitations/${invitationId}`,
        { method: 'DELETE' },
      );
      await loadFamilyDetails();
      setFeedback({ type: 'success', message: 'Undangan dibatalkan.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal membatalkan undangan.',
      });
    }
  };

  const openEditMember = (member: WorkspaceMemberItem) => {
    setEditingMember(member);
    setEditMemberRole(member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER');
    setEditMemberPerms({ ...member.permissions });
  };

  const handleSaveMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !editingMember) return;
    setSavingMember(true);
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/members/${editingMember.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            role: editMemberRole,
            permissions: editMemberPerms,
          }),
        },
      );
      setEditingMember(null);
      await loadFamilyDetails();
      setFeedback({
        type: 'success',
        message: 'Role dan izin akses anggota berhasil diperbarui.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal memperbarui anggota.',
      });
    } finally {
      setSavingMember(false);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMemberItem) => {
    if (!activeWorkspace) return;
    if (!window.confirm(`Hapus ${member.user.name} dari workspace keluarga?`)) {
      return;
    }
    setFeedback(null);
    try {
      await apiRequest(
        `/workspaces/${activeWorkspace.id}/members/${member.id}`,
        { method: 'DELETE' },
      );
      await Promise.all([loadFamilyDetails(), refreshWorkspaces()]);
      setFeedback({
        type: 'success',
        message: `${member.user.name} telah dihapus dari workspace.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal menghapus anggota.',
      });
    }
  };

  const handleLeaveFamily = async () => {
    if (!activeWorkspace) return;
    if (
      !window.confirm(
        `Keluar dari Family Workspace "${activeWorkspace.name}"?`,
      )
    ) {
      return;
    }
    setFeedback(null);
    try {
      await apiRequest(`/workspaces/${activeWorkspace.id}/leave`, {
        method: 'POST',
      });
      await refreshWorkspaces();
      setFeedback({
        type: 'success',
        message: 'Anda telah keluar dari Family Workspace.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof ApiRequestError
            ? err.message
            : 'Gagal keluar dari workspace.',
      });
    }
  };

  const renderRoleBadge = (role: WorkspaceRole) => {
    if (role === 'OWNER') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <Crown className="h-3 w-3" />
          Owner
        </span>
      );
    }
    if (role === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Shield className="h-3 w-3" />
          Admin
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Member
      </span>
    );
  };

  const familyWorkspaces = workspaces.filter((w) => w.type === 'FAMILY');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Kelola Keluarga
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola Family Workspace, undangan anggota, role, dan izin akses
            keuangan bersama.
          </p>
        </div>

        <Button onClick={() => setShowCreateForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          Buat Family Workspace
        </Button>
      </div>

      {feedback && <Alert variant={feedback.type}>{feedback.message}</Alert>}

      {/* Pending Invitations Received */}
      {pendingInvitations.length > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-900 dark:text-emerald-200">
            <Mail className="h-4 w-4" />
            Undangan Keluarga Masuk ({pendingInvitations.length})
          </h2>
          <div className="mt-3 space-y-3">
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-200 bg-white p-4 sm:flex-row sm:items-center dark:border-emerald-900/50 dark:bg-slate-900"
              >
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {inv.workspace?.name ?? 'Family Workspace'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Diundang oleh {inv.invitedBy.name} ({inv.invitedBy.email})
                    sebagai <span className="font-semibold">{inv.role}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      void acceptInvitation(inv.id)
                        .then(() =>
                          setFeedback({
                            type: 'success',
                            message: 'Anda berhasil bergabung ke keluarga.',
                          }),
                        )
                        .catch((err: unknown) =>
                          setFeedback({
                            type: 'error',
                            message:
                              err instanceof ApiRequestError
                                ? err.message
                                : 'Gagal menerima undangan.',
                          }),
                        )
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    Terima
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void rejectInvitation(inv.id).then(() =>
                        setFeedback({
                          type: 'success',
                          message: 'Undangan telah ditolak.',
                        }),
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                    Tolak
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create Family Form */}
      {showCreateForm && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Buat Family Workspace Baru
          </h2>
          <form
            onSubmit={(e) => void handleCreateFamily(e)}
            className="mt-4 grid gap-4 sm:grid-cols-3"
          >
            <div className="sm:col-span-2">
              <Input
                label="Nama Keluarga"
                required
                minLength={2}
                placeholder="Contoh: Keluarga Santoso"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Mata Uang
              </label>
              <select
                value={newFamilyCurrency}
                onChange={(e) => setNewFamilyCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
                <option value="SGD">SGD</option>
                <option value="MYR">MYR</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" loading={creatingFamily}>
                Simpan & Aktifkan
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateForm(false)}
              >
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* If Personal Workspace is currently active */}
      {!isFamily ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Anda sedang berada di Personal Workspace
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Data di Personal Workspace bersifat pribadi dan terisolasi dari
                  anggota keluarga. Pilih atau buat Family Workspace untuk
                  mengelola keuangan bersama.
                </p>
              </div>

              {familyWorkspaces.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Family Workspace Anda
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {familyWorkspaces.map((fw) => (
                      <button
                        key={fw.id}
                        type="button"
                        onClick={() => switchWorkspace(fw.id)}
                        className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-700 dark:hover:border-emerald-700"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {fw.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {fw.memberCount} anggota · {fw.currency}
                          </p>
                        </div>
                        {renderRoleBadge(fw.myRole)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : loadingFamilyData ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Family Overview & Settings */}
          <Card className="p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {activeWorkspace.name}
                  </h2>
                  {renderRoleBadge(activeWorkspace.myRole)}
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {members.length} anggota · Mata uang {activeWorkspace.currency}
                </p>
              </div>

              {activeWorkspace.myRole !== 'OWNER' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void handleLeaveFamily()}
                >
                  Keluar dari Keluarga
                </Button>
              )}
            </div>

            {canManageSettings && (
              <form
                onSubmit={(e) => void handleUpdateFamilyName(e)}
                className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-end dark:border-slate-800"
              >
                <div className="flex-1">
                  <Input
                    label="Ubah Nama Keluarga"
                    required
                    minLength={2}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <Button type="submit" loading={savingName}>
                  Simpan Nama
                </Button>
              </form>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Members List */}
            <Card className="p-6 lg:col-span-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Daftar Anggota ({members.length})
              </h3>
              <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => {
                  const isSelf = m.userId === user?.id;
                  const canEditTarget =
                    canManageMembers &&
                    !isSelf &&
                    m.role !== 'OWNER' &&
                    (activeWorkspace.myRole === 'OWNER' || m.role !== 'ADMIN');

                  return (
                    <div
                      key={m.id}
                      className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          {m.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {m.user.name} {isSelf && '(Anda)'}
                            </p>
                            {renderRoleBadge(m.role)}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {m.user.email}
                          </p>
                        </div>
                      </div>

                      {canEditTarget && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditMember(m)}
                          >
                            Atur Akses
                          </Button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveMember(m)}
                            title="Hapus anggota"
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Invite Member */}
            <Card className="p-6">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                Undang Anggota
              </h3>
              {canManageMembers ? (
                <>
                  <form
                    onSubmit={(e) => void handleInvite(e)}
                    className="mt-4 space-y-3"
                  >
                    <Input
                      label="Email Anggota"
                      type="email"
                      required
                      placeholder="anggota@email.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                        Role
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) =>
                          setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                      >
                        <option value="MEMBER">Member</option>
                        {activeWorkspace.myRole === 'OWNER' && (
                          <option value="ADMIN">Admin</option>
                        )}
                      </select>
                    </div>
                    <Button type="submit" loading={inviting} className="w-full">
                      Kirim Undangan
                    </Button>
                  </form>

                  {invitations.length > 0 && (
                    <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Riwayat Undangan
                      </p>
                      <ul className="space-y-2">
                        {invitations.slice(0, 5).map((inv) => (
                          <li
                            key={inv.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                                {inv.invitedEmail}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {inv.role} · {inv.status}
                              </p>
                            </div>
                            {inv.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleCancelInvitation(inv.id)
                                }
                                className="text-red-600 hover:underline"
                              >
                                Batal
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Hanya Owner atau Admin dengan izin kelola anggota yang dapat
                  mengundang anggota baru.
                </p>
              )}
            </Card>
          </div>

          {/* Activity Log */}
          <Card className="p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
              <Activity className="h-4 w-4 text-emerald-600" />
              Aktivitas Anggota Terbaru
            </h3>
            {activities.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Belum ada aktivitas tercatat di workspace ini.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {activities.map((act) => (
                  <li
                    key={act.id}
                    className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-none last:pb-0 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {act.user?.name ?? 'Sistem'}{' '}
                        <span className="font-normal text-slate-500">
                          — {act.action.replaceAll('_', ' ')}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {act.entityType}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      {new Date(act.createdAt).toLocaleString('id-ID')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* Edit Member Permissions Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Atur Role & Izin Akses
                </h3>
                <p className="text-xs text-slate-500">
                  {editingMember.user.name} ({editingMember.user.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleSaveMember(e)}
              className="mt-4 space-y-4"
            >
              {activeWorkspace?.myRole === 'OWNER' && (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Role
                  </label>
                  <select
                    value={editMemberRole}
                    onChange={(e) =>
                      setEditMemberRole(e.target.value as 'ADMIN' | 'MEMBER')
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              )}

              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Permission Keuangan
                </p>
                {PERMISSION_LABELS.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center justify-between py-1 text-sm text-slate-700 dark:text-slate-200"
                  >
                    <span>{perm.label}</span>
                    <input
                      type="checkbox"
                      checked={editMemberPerms[perm.key]}
                      onChange={(e) =>
                        setEditMemberPerms((prev) => ({
                          ...prev,
                          [perm.key]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 accent-emerald-600"
                    />
                  </label>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingMember(null)}
                >
                  Batal
                </Button>
                <Button type="submit" loading={savingMember}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

