import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  Loader2,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { ApiRequestError, apiRequest } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import type {
  NotificationItem,
  NotificationsListPayload,
  NotificationType,
} from '../../types/api';

function NotificationIcon({ type }: { type: NotificationType }) {
  if (type === 'BUDGET_WARNING' || type === 'BUDGET_EXCEEDED' || type === 'DEBT_OVERDUE' || type === 'DEBT_DUE_SOON') {
    return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  }
  if (type === 'GOAL_ACHIEVED') {
    return <Target className="h-4 w-4 text-emerald-600" />;
  }
  if (type === 'FAMILY_INVITATION' || type === 'FAMILY_ACTIVITY') {
    return <Users className="h-4 w-4 text-sky-600" />;
  }
  if (type === 'RECURRING_EXECUTED') {
    return <CalendarClock className="h-4 w-4 text-emerald-600" />;
  }
  return <Bell className="h-4 w-4 text-slate-500" />;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [data, setData] = useState<NotificationsListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateFormat = user?.dateFormat || 'DD/MM/YYYY';

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = unreadOnly ? '?unreadOnly=true' : '';
      const res = await apiRequest<NotificationsListPayload>(
        `/notifications${qs}`,
      );
      setData(res);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memuat notifikasi.',
      );
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (item: NotificationItem) => {
    if (item.isRead) return;
    try {
      await apiRequest(`/notifications/${item.id}/read`, { method: 'PATCH' });
      await loadNotifications();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menandai notifikasi.',
      );
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/notifications/read-all', { method: 'POST' });
      await loadNotifications();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal menandai seluruh notifikasi.',
      );
    }
  };

  const handleCheckReminders = async () => {
    setChecking(true);
    try {
      await apiRequest('/notifications/check-reminders', { method: 'POST' });
      await loadNotifications();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Gagal memeriksa pengingat jatuh tempo.',
      );
    } finally {
      setChecking(false);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Notifikasi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pantau peringatan anggaran, pencapaian target, jatuh tempo utang, dan aktivitas keluarga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleCheckReminders()}
            disabled={checking}
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            Periksa Jatuh Tempo
          </Button>
          {(data?.unreadCount ?? 0) > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleMarkAllRead()}
            >
              <CheckCheck className="h-4 w-4" />
              Tandai Semua Dibaca
            </Button>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setUnreadOnly(false)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            !unreadOnly
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Semua
        </button>
        <button
          type="button"
          onClick={() => setUnreadOnly(true)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            unreadOnly
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          Belum Dibaca ({data?.unreadCount ?? 0})
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <Bell className="mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {unreadOnly
              ? 'Tidak ada notifikasi yang belum dibaca.'
              : 'Belum ada notifikasi.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`flex items-start justify-between gap-4 p-4 transition ${
                item.isRead
                  ? 'opacity-80'
                  : 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/60 dark:bg-emerald-950/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs dark:bg-slate-800">
                  <NotificationIcon type={item.type} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h3>
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    )}
                    {item.workspace && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {item.workspace.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    {item.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(item.createdAt, dateFormat)}
                  </p>
                </div>
              </div>

              {!item.isRead && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleMarkRead(item)}
                >
                  Tandai Dibaca
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

