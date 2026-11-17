export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface NotificationPreferences {
  budgetAlerts?: boolean;
  savingsGoalAlerts?: boolean;
  debtDueReminders?: boolean;
  familyActivityAlerts?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  preferredCurrency: string;
  dateFormat: string;
  theme: ThemePreference;
  notificationPreferences: NotificationPreferences | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponsePayload {
  user: UserProfile;
  tokens: AuthTokens;
  defaultWorkspaceId: string;
}

export type WorkspaceType = 'PERSONAL' | 'FAMILY';
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

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

export interface WorkspaceSummary {
  id: string;
  name: string;
  type: WorkspaceType;
  currency: string;
  ownerId: string;
  myRole: WorkspaceRole;
  myPermissions: WorkspacePermissions;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberItem {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  permissions: WorkspacePermissions;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface FamilyInvitationItem {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  role: WorkspaceRole;
  permissions: WorkspacePermissions;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string;
    email: string;
  };
  workspace?: {
    id: string;
    name: string;
    currency: string;
    type: WorkspaceType;
  };
}

export interface WorkspaceActivityItem {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export type WalletType =
  | 'CASH'
  | 'BANK'
  | 'E_WALLET'
  | 'FAMILY_WALLET'
  | 'OTHER';

export interface WalletItem {
  id: string;
  workspaceId: string;
  name: string;
  type: WalletType;
  balance: string;
  initialBalance: string;
  currency: string;
  color: string;
  icon: string;
  isArchived: boolean;
  transactionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletsListPayload {
  wallets: WalletItem[];
  totalBalance: string;
}

export type CategoryType = 'INCOME' | 'EXPENSE';

export interface CategoryItem {
  id: string;
  workspaceId: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  isDefault: boolean;
  isArchived: boolean;
  _count?: { transactions: number };
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface TransactionItem {
  id: string;
  workspaceId: string;
  walletId: string;
  destinationWalletId: string | null;
  categoryId: string | null;
  createdByUserId: string;
  type: TransactionType;
  amount: string;
  transactionDate: string;
  description: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  wallet: { id: string; name: string; type: WalletType; color?: string };
  destinationWallet: {
    id: string;
    name: string;
    type: WalletType;
    color?: string;
  } | null;
  category: {
    id: string;
    name: string;
    type: CategoryType;
    icon: string;
    color: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type BudgetPeriodType = 'MONTHLY' | 'CUSTOM';
export type BudgetUsageStatus = 'SAFE' | 'WARNING' | 'EXCEEDED';

export interface BudgetItem {
  id: string;
  workspaceId: string;
  categoryId: string;
  name: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  amountLimit: string;
  spentAmount: string;
  remainingAmount: string;
  percentageUsed: number;
  warningThresholdPercent: number;
  status: BudgetUsageStatus;
  category: {
    id: string;
    name: string;
    type: CategoryType;
    icon: string;
    color: string;
  };
  createdBy: { id: string; name: string; email: string };
}

export interface BudgetsListPayload {
  items: BudgetItem[];
  summary: {
    totalBudgets: number;
    totalLimit: string;
    totalSpent: string;
    totalRemaining: string;
    warningCount: number;
    exceededCount: number;
  };
}

export type SavingsGoalStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface SavingsContributionItem {
  id: string;
  walletId: string;
  amount: string;
  contributionDate: string;
  note: string | null;
  wallet: { id: string; name: string; type: WalletType; color: string; icon: string };
  contributedBy: { id: string; name: string; email: string };
  createdAt: string;
}

export interface SavingsGoalItem {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  targetAmount: string;
  currentAmount: string;
  remainingAmount: string;
  progressPercent: number;
  deadline: string | null;
  status: SavingsGoalStatus;
  createdBy: { id: string; name: string; email: string };
  contributions: SavingsContributionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoalsListPayload {
  items: SavingsGoalItem[];
  summary: {
    totalGoals: number;
    activeCount: number;
    completedCount: number;
    totalTarget: string;
    totalSaved: string;
  };
}

export type ReportPeriodPreset = 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';

export interface DashboardPayload {
  period: {
    type: ReportPeriodPreset;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalBalance: string;
    monthlyIncome: string;
    monthlyExpense: string;
    periodIncome: string;
    periodExpense: string;
    netCashflow: string;
    remainingBudget: string;
    savingsRatePercent: number;
    financialHealth: 'HEALTHY' | 'CAUTION' | 'DEFICIT';
    activeWalletsCount: number;
  };
  incomeVsExpenseSeries: {
    dateKey: string;
    label: string;
    income: number;
    expense: number;
  }[];
  expenseByCategory: {
    categoryId: string;
    categoryName: string;
    color: string;
    icon: string;
    amount: string;
    numericAmount: number;
    percentage: number;
  }[];
  recentTransactions: {
    id: string;
    type: TransactionType;
    amount: string;
    transactionDate: string;
    description: string;
    wallet: { id: string; name: string; type: WalletType; color: string };
    destinationWallet: { id: string; name: string; type: WalletType; color: string } | null;
    category: { id: string; name: string; type: CategoryType; icon: string; color: string } | null;
    createdBy: { id: string; name: string; email: string; avatarUrl: string | null };
  }[];
  budgetSummary: {
    id: string;
    name: string;
    categoryName: string;
    categoryColor: string;
    amountLimit: string;
    spentAmount: string;
    remainingAmount: string;
    percentageUsed: number;
    status: BudgetUsageStatus;
  }[];
  savingsGoalsSummary: {
    id: string;
    name: string;
    targetAmount: string;
    currentAmount: string;
    progressPercent: number;
    status: SavingsGoalStatus;
    deadline: string | null;
  }[];
}

export interface ReportSummaryPayload {
  workspace: { id: string; name: string; currency: string; type: WorkspaceType };
  year: number;
  period: { type: ReportPeriodPreset; startDate: string; endDate: string };
  previousPeriod: { startDate: string; endDate: string };
  overview: {
    totalBalance: string;
    totalIncome: string;
    totalExpense: string;
    totalTransfer: string;
    netCashflow: string;
    transactionCount: number;
  };
  comparison: {
    previousIncome: string;
    previousExpense: string;
    previousNetCashflow: string;
    incomeChangePercent: number;
    expenseChangePercent: number;
  };
  walletBalances: {
    id: string;
    name: string;
    type: WalletType;
    color: string;
    balance: string;
    numericBalance: number;
    percentage: number;
  }[];
  incomeByCategory: {
    categoryId: string;
    categoryName: string;
    color: string;
    count: number;
    amount: string;
    numericAmount: number;
    percentage: number;
  }[];
  expenseByCategory: {
    categoryId: string;
    categoryName: string;
    color: string;
    count: number;
    amount: string;
    numericAmount: number;
    percentage: number;
  }[];
  periodTrend: { dateKey: string; label: string; income: number; expense: number }[];
  monthlyTrend: { month: number; label: string; income: number; expense: number; net: number }[];
  transactions: {
    id: string;
    type: TransactionType;
    amount: string;
    transactionDate: string;
    description: string;
    categoryName: string;
    walletName: string;
    destinationWalletName: string | null;
    createdByName: string;
  }[];
}

export type DebtType = 'DEBT' | 'RECEIVABLE';
export type DebtStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface DebtPaymentItem {
  id: string;
  walletId: string;
  transactionId: string | null;
  amount: string;
  paymentDate: string;
  note: string | null;
  wallet: { id: string; name: string; type: WalletType; color: string };
  recordedBy: { id: string; name: string; email: string };
  createdAt: string;
}

export interface DebtItem {
  id: string;
  workspaceId: string;
  type: DebtType;
  counterpartyName: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  progressPercent: number;
  debtDate: string;
  dueDate: string | null;
  status: DebtStatus;
  isDueSoon: boolean;
  description: string | null;
  note: string | null;
  createdBy: { id: string; name: string; email: string };
  payments: DebtPaymentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DebtsListPayload {
  items: DebtItem[];
  summary: {
    totalDebtRemaining: string;
    totalReceivableRemaining: string;
    overdueCount: number;
    dueSoonCount: number;
  };
}

export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export interface RecurringTransactionItem {
  id: string;
  workspaceId: string;
  walletId: string;
  categoryId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: string;
  description: string;
  note: string | null;
  frequency: RecurringFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  lastRunDate: string | null;
  isActive: boolean;
  wallet: { id: string; name: string; type: WalletType; color: string };
  category: {
    id: string;
    name: string;
    type: CategoryType;
    icon: string;
    color: string;
  };
  createdBy: { id: string; name: string; email: string };
  executionLogs: {
    id: string;
    scheduledForDate: string;
    transactionId: string;
    executedAt: string;
  }[];
}

export type NotificationType =
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'GOAL_ACHIEVED'
  | 'DEBT_DUE_SOON'
  | 'DEBT_OVERDUE'
  | 'FAMILY_INVITATION'
  | 'FAMILY_ACTIVITY'
  | 'RECURRING_EXECUTED';

export interface NotificationItem {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  readAt: string | null;
  referenceType: string | null;
  referenceId: string | null;
  workspace: { id: string; name: string; type: WorkspaceType } | null;
  createdAt: string;
}

export interface NotificationsListPayload {
  items: NotificationItem[];
  unreadCount: number;
  meta: PaginationMeta;
}



