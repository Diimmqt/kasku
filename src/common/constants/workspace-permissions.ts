/** Canonical permission keys for workspace members (Owner, Admin, Member). */
export interface WorkspacePermissions {
  canViewTransactions: boolean;
  canManageTransactions: boolean;
  canManageWallets: boolean;
  canManageCategories: boolean;
  canManageBudgets: boolean;
  canManageGoals: boolean;
  canManageDebts: boolean;
  canManageRecurring: boolean;
  canViewReports: boolean;
  canManageMembers: boolean;
  canManageSettings: boolean;
}

export const OWNER_PERMISSIONS: WorkspacePermissions = {
  canViewTransactions: true,
  canManageTransactions: true,
  canManageWallets: true,
  canManageCategories: true,
  canManageBudgets: true,
  canManageGoals: true,
  canManageDebts: true,
  canManageRecurring: true,
  canViewReports: true,
  canManageMembers: true,
  canManageSettings: true,
};

export const DEFAULT_ADMIN_PERMISSIONS: WorkspacePermissions = {
  canViewTransactions: true,
  canManageTransactions: true,
  canManageWallets: true,
  canManageCategories: true,
  canManageBudgets: true,
  canManageGoals: true,
  canManageDebts: true,
  canManageRecurring: true,
  canViewReports: true,
  canManageMembers: false,
  canManageSettings: false,
};

export const DEFAULT_MEMBER_PERMISSIONS: WorkspacePermissions = {
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

/** Normalizes partial permission overrides against the role's baseline permissions. */
export function resolvePermissionsForRole(
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
  overrides?: Partial<WorkspacePermissions> | null,
): WorkspacePermissions {
  if (role === 'OWNER') {
    return { ...OWNER_PERMISSIONS };
  }
  const base =
    role === 'ADMIN' ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_MEMBER_PERMISSIONS;
  if (!overrides) {
    return { ...base };
  }
  return {
    canViewTransactions:
      overrides.canViewTransactions ?? base.canViewTransactions,
    canManageTransactions:
      overrides.canManageTransactions ?? base.canManageTransactions,
    canManageWallets: overrides.canManageWallets ?? base.canManageWallets,
    canManageCategories:
      overrides.canManageCategories ?? base.canManageCategories,
    canManageBudgets: overrides.canManageBudgets ?? base.canManageBudgets,
    canManageGoals: overrides.canManageGoals ?? base.canManageGoals,
    canManageDebts: overrides.canManageDebts ?? base.canManageDebts,
    canManageRecurring: overrides.canManageRecurring ?? base.canManageRecurring,
    canViewReports: overrides.canViewReports ?? base.canViewReports,
    canManageMembers: overrides.canManageMembers ?? base.canManageMembers,
    canManageSettings: overrides.canManageSettings ?? base.canManageSettings,
  };
}

