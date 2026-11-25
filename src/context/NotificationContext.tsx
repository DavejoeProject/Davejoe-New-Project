import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { AppNotification, NotificationService } from '../services/notificationService';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  unreadByModule: Record<string, number>;
  loading: boolean;
  error: string | null;
  migrationPending: boolean;
  realtimeConnected: boolean;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: (sourceModule?: string) => Promise<void>;
  getModuleUnreadCount: (modules: string | string[]) => number;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const isActiveUser = Boolean(user?.id && profile?.status?.toLowerCase().trim() === 'active');
  const userId = isActiveUser ? user?.id ?? null : null;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState<boolean>(false);
  const [realtimeConnected, setRealtimeConnected] = useState<boolean>(false);

  const deadlineCheckedForUserRef = useRef<string | null>(null);

  const loadNotifications = useCallback(async (uid: string, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    const res = await NotificationService.fetchNotifications(uid, 120);
    setNotifications(res.data);
    setError(res.error);
    setMigrationPending(res.migrationPending);
    if (showSpinner) setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    await loadNotifications(userId, false);
  }, [userId, loadNotifications]);

  // Initial fetch, one-time session deadline check, single user-scoped Realtime channel, and visibility-safe fallback sync
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setError(null);
      setMigrationPending(false);
      setRealtimeConnected(false);
      setLoading(false);
      deadlineCheckedForUserRef.current = null;
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      await loadNotifications(userId, true);

      if (isMounted && deadlineCheckedForUserRef.current !== userId) {
        deadlineCheckedForUserRef.current = userId;
        await NotificationService.runDeadlineCheck();
        if (isMounted) {
          await loadNotifications(userId, false);
        }
      }
    };

    void initialize();

    // Single centralized Realtime channel for the authenticated user
    const channel = NotificationService.subscribeToUserNotifications(userId, {
      onInsert: (incoming) => {
        if (!isMounted) return;
        setNotifications((prev) => {
          if (prev.some((n) => n.id === incoming.id)) {
            return prev.map((n) => (n.id === incoming.id ? incoming : n));
          }
          return [incoming, ...prev].slice(0, 150);
        });
      },
      onUpdate: (updated) => {
        if (!isMounted) return;
        setNotifications((prev) => {
          const exists = prev.some((n) => n.id === updated.id);
          if (!exists) return [updated, ...prev].slice(0, 150);
          return prev.map((n) => (n.id === updated.id ? updated : n));
        });
      },
      onDelete: (deletedId) => {
        if (!isMounted) return;
        setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
      },
      onStatusChange: (status) => {
        if (!isMounted) return;
        const connected = status === 'SUBSCRIBED';
        setRealtimeConnected(connected);
        // Reconcile state whenever the channel reconnects
        if (connected) {
          void loadNotifications(userId, false);
        }
      },
    });

    // Re-sync when browser tab regains focus/visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        void loadNotifications(userId, false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Lightweight periodic safety sync only while tab is visible (catches environments where Realtime publication isn't enabled yet)
    const fallbackTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && isMounted) {
        void loadNotifications(userId, false);
      }
    }, 60_000);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(fallbackTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId, loadNotifications]);

  // Derived unread count and per-module unread counts from the EXACT same source array
  const unreadCount = useMemo(
    () => notifications.reduce((acc, item) => (item.is_read ? acc : acc + 1), 0),
    [notifications]
  );

  const unreadByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of notifications) {
      if (!item.is_read) {
        const key = item.source_module || 'projects';
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [notifications]);

  const getModuleUnreadCount = useCallback(
    (modules: string | string[]): number => {
      const keys = Array.isArray(modules) ? modules : [modules];
      let total = 0;
      for (const k of keys) {
        total += unreadByModule[k] || 0;
      }
      return total;
    },
    [unreadByModule]
  );

  const markRead = useCallback(
    async (notificationId: string) => {
      const target = notifications.find((n) => n.id === notificationId);
      if (!target || target.is_read) return;

      const nowIso = new Date().toISOString();
      // Optimistic local state update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: nowIso } : n
        )
      );

      const { error: updateErr } = await NotificationService.markAsRead(notificationId);
      if (updateErr && userId) {
        // Reconcile from database if update failed
        await loadNotifications(userId, false);
      }
    },
    [notifications, userId, loadNotifications]
  );

  const markAllRead = useCallback(
    async (sourceModule?: string) => {
      const hasUnread = notifications.some(
        (n) => !n.is_read && (!sourceModule || n.source_module === sourceModule)
      );
      if (!hasUnread) return;

      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          !n.is_read && (!sourceModule || n.source_module === sourceModule)
            ? { ...n, is_read: true, read_at: nowIso }
            : n
        )
      );

      const { error: updateErr } = await NotificationService.markAllAsRead(sourceModule);
      if (updateErr && userId) {
        await loadNotifications(userId, false);
      }
    },
    [notifications, userId, loadNotifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      unreadByModule,
      loading,
      error,
      migrationPending,
      realtimeConnected,
      refresh,
      markRead,
      markAllRead,
      getModuleUnreadCount,
    }),
    [
      notifications,
      unreadCount,
      unreadByModule,
      loading,
      error,
      migrationPending,
      realtimeConnected,
      refresh,
      markRead,
      markAllRead,
      getModuleUnreadCount,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
};
