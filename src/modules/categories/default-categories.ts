import { CategoryType } from '../../generated/prisma/enums.js';

export interface DefaultCategorySeed {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  // Income
  { name: 'Gaji', type: CategoryType.INCOME, icon: 'briefcase', color: '#059669' },
  { name: 'Bonus', type: CategoryType.INCOME, icon: 'gift', color: '#10b981' },
  { name: 'Bisnis', type: CategoryType.INCOME, icon: 'store', color: '#0d9488' },
  { name: 'Hadiah', type: CategoryType.INCOME, icon: 'sparkles', color: '#14b8a6' },
  { name: 'Lainnya', type: CategoryType.INCOME, icon: 'circle-dollar-sign', color: '#64748b' },
  // Expense
  { name: 'Makanan', type: CategoryType.EXPENSE, icon: 'utensils', color: '#f97316' },
  { name: 'Transportasi', type: CategoryType.EXPENSE, icon: 'car', color: '#3b82f6' },
  { name: 'Pendidikan', type: CategoryType.EXPENSE, icon: 'graduation-cap', color: '#6366f1' },
  { name: 'Kesehatan', type: CategoryType.EXPENSE, icon: 'heart-pulse', color: '#ef4444' },
  { name: 'Hiburan', type: CategoryType.EXPENSE, icon: 'film', color: '#ec4899' },
  { name: 'Tagihan', type: CategoryType.EXPENSE, icon: 'receipt', color: '#eab308' },
  { name: 'Belanja', type: CategoryType.EXPENSE, icon: 'shopping-bag', color: '#8b5cf6' },
  { name: 'Lainnya', type: CategoryType.EXPENSE, icon: 'tag', color: '#64748b' },
];

