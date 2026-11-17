import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Plus,
  Settings,
  Tags,
  Target,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { apiRequest } from '../../lib/api-client';

interface NavSection {
  title: string;
  items: {
    label: string;
    to: string;
    icon: typeof LayoutDashboard;
    disabled?: boolean;
    badge?: number;
  }[];
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const {
    workspaces,
    activeWorkspace,
    pendingInvitations,
    switchWorkspace,
  } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<{ unreadCount: number }>('/notifications/unread-count')
      .then((res) => {
        if (active) setUnreadNotifications(res.unreadCount);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [location.pathname, activeWorkspace?.id]);

  const navSections: NavSection[] = [
    {
      title: 'MENU UTAMA',
      items: [
        { label: 'Dashboard', to: '/', icon: LayoutDashboard },
        { label: 'Transaksi', to: '/transactions', icon: ArrowLeftRight },
        { label: 'Dompet', to: '/wallets', icon: Wallet },
        { label: 'Anggaran', to: '/budgets', icon: PiggyBank },
        { label: 'Target Tabungan', to: '/savings-goals', icon: Target },
        { label: 'Laporan', to: '/reports', icon: BarChart3 },
      ],
    },
    {
      title: 'PENGELOLAAN',
      items: [
        { label: 'Kategori', to: '/categories', icon: Tags },
        { label: 'Utang & Piutang', to: '/debts', icon: HandCoins },
      ],
    },
    {
      title: 'KELUARGA',
      items: [
        {
          label: 'Kelola Keluarga',
          to: '/family',
          icon: Users,
          badge: pendingInvitations.length,
        },
      ],
    },
    {
      title: 'PREFERENSI',
      items: [{ label: 'Pengaturan', to: '/settings', icon: Settings }],
    },
  ];

  const handleLogout = async () => {
    await logout(false);
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 font-bold text-white shadow-xs">
            K
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Kasku
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Personal & Family Finance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/notifications"
            title="Notifikasi"
            aria-label="Notifikasi"
            className="relative rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Workspace Switcher Dropdown */}
      <div className="relative border-b border-slate-200 px-3 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setSwitcherOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-emerald-700"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {activeWorkspace?.type === 'FAMILY'
                ? `Family · ${activeWorkspace.myRole}`
                : 'Personal Workspace'}
            </p>
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              {activeWorkspace?.name ?? 'Memuat workspace...'}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              switcherOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {switcherOpen && (
          <div className="absolute left-3 right-3 top-full z-30 mt-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div className="max-h-56 space-y-0.5 overflow-y-auto">
              {workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspace?.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      switchWorkspace(ws.id);
                      setSwitcherOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{ws.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ws.type === 'FAMILY'
                          ? `Family · ${ws.memberCount} anggota`
                          : 'Personal'}
                      </p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSwitcherOpen(false);
                  setMobileOpen(false);
                  navigate('/family');
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
              >
                <Plus className="h-3.5 w-3.5" />
                Buat / Kelola Keluarga
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <li key={item.to}>
                      <span
                        title="Akan diaktifkan pada tahap modul berikutnya"
                        className="flex cursor-not-allowed items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-400 dark:text-slate-600"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          Segera
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                        }`
                      }
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile & Logout */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <div className="flex min-w-0 items-center gap-2.5">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                {user?.name?.charAt(0).toUpperCase() ?? 'K'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                {user?.name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            title="Logout"
            aria-label="Logout"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 lg:block dark:border-slate-800">
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] border-r border-slate-200 dark:border-slate-800">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {activeWorkspace?.name ?? 'Kasku'}
          </span>
          <Link
            to="/notifications"
            aria-label="Notifikasi"
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
