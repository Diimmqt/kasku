import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest, tokenStorage } from '../lib/api-client';
import type { FamilyInvitationItem, WorkspaceSummary } from '../types/api';
import { useAuth } from './AuthContext';

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  pendingInvitations: FamilyInvitationItem[];
  loading: boolean;
  switchWorkspace: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshInvitations: () => Promise<void>;
  createFamilyWorkspace: (
    name: string,
    currency?: string,
  ) => Promise<WorkspaceSummary>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    () => tokenStorage.getActiveWorkspaceId(),
  );
  const [pendingInvitations, setPendingInvitations] = useState<
    FamilyInvitationItem[]
  >([]);
  const [loading, setLoading] = useState(false);

  const refreshWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      return;
    }

    setLoading(true);
    try {
      const list = await apiRequest<WorkspaceSummary[]>('/workspaces');
      setWorkspaces(list);

      const savedId = tokenStorage.getActiveWorkspaceId();
      const matched = list.find((w) => w.id === savedId);
      const fallback =
        matched ?? list.find((w) => w.type === 'PERSONAL') ?? list[0] ?? null;

      if (fallback) {
        tokenStorage.setActiveWorkspaceId(fallback.id);
        setActiveWorkspaceId(fallback.id);
      } else {
        setActiveWorkspaceId(null);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const refreshInvitations = useCallback(async () => {
    if (!isAuthenticated) {
      setPendingInvitations([]);
      return;
    }

    try {
      const list = await apiRequest<FamilyInvitationItem[]>('/invitations/me');
      setPendingInvitations(list);
    } catch {
      setPendingInvitations([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refreshWorkspaces();
    void refreshInvitations();
  }, [refreshWorkspaces, refreshInvitations]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      if (workspaces.some((w) => w.id === workspaceId)) {
        tokenStorage.setActiveWorkspaceId(workspaceId);
        setActiveWorkspaceId(workspaceId);
      }
    },
    [workspaces],
  );

  const createFamilyWorkspace = useCallback(
    async (name: string, currency?: string) => {
      const created = await apiRequest<WorkspaceSummary>('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name, currency }),
      });
      await refreshWorkspaces();
      tokenStorage.setActiveWorkspaceId(created.id);
      setActiveWorkspaceId(created.id);
      return created;
    },
    [refreshWorkspaces],
  );

  const acceptInvitation = useCallback(
    async (invitationId: string) => {
      const res = await apiRequest<{ workspaceId: string }>(
        `/invitations/${invitationId}/accept`,
        { method: 'POST' },
      );
      await Promise.all([refreshWorkspaces(), refreshInvitations()]);
      if (res.workspaceId) {
        tokenStorage.setActiveWorkspaceId(res.workspaceId);
        setActiveWorkspaceId(res.workspaceId);
      }
    },
    [refreshWorkspaces, refreshInvitations],
  );

  const rejectInvitation = useCallback(
    async (invitationId: string) => {
      await apiRequest(`/invitations/${invitationId}/reject`, {
        method: 'POST',
      });
      await refreshInvitations();
    },
    [refreshInvitations],
  );

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((w) => w.id === activeWorkspaceId) ??
      workspaces[0] ??
      null,
    [workspaces, activeWorkspaceId],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      pendingInvitations,
      loading,
      switchWorkspace,
      refreshWorkspaces,
      refreshInvitations,
      createFamilyWorkspace,
      acceptInvitation,
      rejectInvitation,
    }),
    [
      workspaces,
      activeWorkspace,
      pendingInvitations,
      loading,
      switchWorkspace,
      refreshWorkspaces,
      refreshInvitations,
      createFamilyWorkspace,
      acceptInvitation,
      rejectInvitation,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }
  return ctx;
}

