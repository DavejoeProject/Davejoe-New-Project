import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FolderKanban,
  Layers,
  MessageSquare,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { AppNotification, MODULE_LABELS } from '../../services/notificationService';

interface MenuAlertBadgeProps {
  count: number;
  active?: boolean;
  compact?: boolean;
  title?: string;
}

/**
 * Shared bold red numeric alert indicator for sidebar and tab navigation items.
 * Driven exclusively by real unread notification records from NotificationContext.
 */
export const MenuAlertBadge: React.FC<MenuAlertBadgeProps> = ({
  count,
  active = false,
  compact = false,
  title,
}) => {
  if (!count || count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);

  if (compact) {
    return (
      <span
        title={title || `${count} unread notification${count === 1 ? '' : 's'}`}
        aria-label={`${count} unread notifications`}
        className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold leading-none flex items-center justify-center ring-2 ring-white tabular-nums shadow-xs"
      >
        {label}
      </span>
    );
  }

  return (
    <span
      title={title || `${count} unread alert${count === 1 ? '' : 's'}`}
      aria-label={`${count} unread notifications`}
      className={`ml-auto shrink-0 min-w-[20px] h-[18px] px-1.5 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center tabular-nums shadow-2xs ${
        active
          ? 'bg-red-600 text-white ring-1 ring-white/70'
          : 'bg-red-600 text-white'
      }`}
    >
      {label}
    </span>
  );
};

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function formatFullTimestamp(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function getNotificationIcon(n: AppNotification) {
  if (n.notification_type === 'confidential_escalation') {
    return <ShieldAlert className="w-4 h-4 text-red-600" />;
  }
  if (n.notification_type === 'blocker_delay' || n.severity === 'urgent') {
    return <AlertOctagon className="w-4 h-4 text-rose-600" />;
  }
  if (n.notification_type === 'deadline_alert') {
    return <Clock className="w-4 h-4 text-amber-600" />;
  }
  if (n.notification_type === 'approval_request') {
    return <ClipboardCheck className="w-4 h-4 text-amber-600" />;
  }
  if (n.notification_type === 'approval_decision') {
    return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
  }
  if (n.notification_type === 'communication') {
    return <MessageSquare className="w-4 h-4 text-sky-600" />;
  }
  if (n.source_module === 'work_packages') {
    return <Layers className="w-4 h-4 text-[#18b892]" />;
  }
  return <FolderKanban className="w-4 h-4 text-[#18b892]" />;
}

/**
 * Resolves the safe, role-appropriate destination route for a notification.
 */
function resolveDefaultRoute(notification: AppNotification, roleKey: string | null): string | null {
  const mod = notification.source_module;
  const projQuery = notification.project_id ? `?projectId=${notification.project_id}` : '';

  if (roleKey === 'client_partner') {
    const sectionMap: Record<string, string> = {
      work_packages: 'work-packages',
      quotations: 'quotations',
      specifications: 'brief',
      technical_qc: 'brief',
      completions: 'completions',
      variations: 'variations',
      requests_complaints: 'requests',
      client_portal: 'overview',
    };
    const sec = sectionMap[mod] || 'overview';
    const params = new URLSearchParams();
    params.set('section', sec);
    if (notification.project_id) params.set('projectId', notification.project_id);
    return `/client-portal?${params.toString()}`;
  }

  if (roleKey === 'management') {
    if (mod === 'work_packages') return `/management/work-packages${projQuery}`;
    if (mod === 'service_requests') return '/management/service-requests';
    if (mod === 'procurement' || mod === 'materials') return '/management/materials/requests';
    if (mod === 'finance') return '/management/financial-control/projects';
    if (mod === 'overtime' || mod === 'workforce') return '/management/workforce/overtime';
    if (
      mod === 'client_portal' ||
      mod === 'variations' ||
      mod === 'requests_complaints' ||
      mod === 'quotations' ||
      mod === 'specifications' ||
      mod === 'completions'
    ) {
      return '/management/client-portal';
    }
    if (mod === 'projects' && notification.project_id) {
      return `/management/projects/${notification.project_id}`;
    }
    return '/management/projects';
  }

  if (roleKey === 'admin') {
    if (mod === 'work_packages') return `/admin/work-packages${projQuery}`;
    if (mod === 'service_requests') return '/admin/service-requests';
    if (mod === 'tasks') return '/admin/tasks';
    if (mod === 'materials' || mod === 'procurement') return '/admin/materials';
    if (
      mod === 'client_portal' ||
      mod === 'variations' ||
      mod === 'requests_complaints' ||
      mod === 'quotations' ||
      mod === 'specifications' ||
      mod === 'completions'
    ) {
      return '/admin/clients';
    }
    if (mod === 'projects' && notification.project_id) {
      return `/admin/projects/${notification.project_id}`;
    }
    return '/admin/projects';
  }

  if (roleKey === 'executive_director') {
    if (mod === 'work_packages') return `/executive/work-packages${projQuery}`;
    return '/executive';
  }

  if (roleKey === 'supervisor') {
    if (notification.project_id && mod === 'projects') {
      return `/supervisor/projects/${notification.project_id}`;
    }
    return '/supervisor';
  }

  if (roleKey === 'technical') return '/technical';
  if (roleKey === 'procurement') return '/procurement';
  if (roleKey === 'accounts') return '/accounts';
  if (roleKey === 'artisan') return '/artisan';
  if (roleKey === 'social_media_manager') return '/social-media';

  return null;
}

export interface NotificationBellProps {
  /**
   * Optional dashboard-local handler for tabbed dashboards (e.g., Technical,
   * Supervisor, Procurement, Accounts, Artisan, Client Portal, Executive).
   * Return `true` if the dashboard handled navigation directly.
   */
  onNavigateNotification?: (notification: AppNotification) => boolean | void;
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  onNavigateNotification,
  className = '',
}) => {
  const { currentRoleKey } = useAuth();
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    migrationPending,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState<'all' | 'unread'>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  // Close full history modal on Escape
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const handleOpenNotification = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await markRead(notification.id);
    }
    setDropdownOpen(false);
    setModalOpen(false);

    if (onNavigateNotification) {
      const handled = onNavigateNotification(notification);
      if (handled === true) return;
    }

    const target = resolveDefaultRoute(notification, currentRoleKey);
    if (target) {
      navigate(target);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const availableModules = useMemo(() => {
    const set = new Set<string>();
    for (const n of notifications) {
      if (n.source_module) set.add(n.source_module);
    }
    return Array.from(set);
  }, [notifications]);

  const filteredModalNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (modalFilter === 'unread' && n.is_read) return false;
      if (moduleFilter !== 'all' && n.source_module !== moduleFilter) return false;
      return true;
    });
  }, [notifications, modalFilter, moduleFilter]);

  const recentNotifications = useMemo(() => notifications.slice(0, 12), [notifications]);
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Header Bell Trigger */}
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications (no unread alerts)'
        }
        aria-expanded={dropdownOpen}
        aria-haspopup="dialog"
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200/80 transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-[19px] h-[19px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[19px] h-[19px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white tabular-nums shadow-sm">
            {badgeText}
          </span>
        )}
      </button>

      {/* Popover Notification Dropdown */}
      {dropdownOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-full sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-[400px] max-w-[420px] bg-white rounded-2xl border border-slate-200/90 shadow-xl z-50 flex flex-col overflow-hidden"
        >
          {/* Dropdown Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-[#18b892] shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 truncate">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold tabular-nums">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleManualRefresh()}
                disabled={refreshing}
                title="Refresh notifications"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#18b892]' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#18b892] hover:bg-emerald-50 transition-colors cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Migration notice if DB migration hasn't been executed yet */}
          {migrationPending && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Notification database setup pending</p>
                <p className="mt-0.5 leading-relaxed">
                  Run migration <span className="font-mono">20261125000004_centralized_realtime_notifications.sql</span> in Supabase SQL Editor to activate live alerts.
                </p>
              </div>
            </div>
          )}

          {/* Dropdown Notification Feed */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Loading notifications...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">You're all caught up</p>
                <p className="text-[11px] text-slate-500">
                  Real-time alerts for assignments, approvals, blockers, and project updates will appear here.
                </p>
              </div>
            ) : (
              recentNotifications.map((item) => {
                const projectName = item.metadata?.project_name;
                const moduleLabel = MODULE_LABELS[item.source_module] || item.source_module.replace(/_/g, ' ');
                const isConfidential = item.notification_type === 'confidential_escalation';

                return (
                  <div
                    key={item.id}
                    className={`px-4 py-3 transition-colors ${
                      !item.is_read
                        ? isConfidential
                          ? 'bg-red-50/50 hover:bg-red-50/80'
                          : 'bg-emerald-50/35 hover:bg-emerald-50/60'
                        : 'bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                          !item.is_read
                            ? isConfidential
                              ? 'bg-red-100/80 border-red-200'
                              : 'bg-white border-slate-200 shadow-2xs'
                            : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        {getNotificationIcon(item)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => void handleOpenNotification(item)}
                            className="text-left group cursor-pointer min-w-0"
                          >
                            <p
                              className={`text-xs leading-snug group-hover:text-[#18b892] transition-colors ${
                                !item.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                              }`}
                            >
                              {item.title}
                            </p>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!item.is_read && (
                              <span
                                className="w-2 h-2 rounded-full bg-red-600 shrink-0"
                                title="Unread"
                              />
                            )}
                            <span
                              className="text-[10px] text-slate-400 font-medium whitespace-nowrap"
                              title={formatFullTimestamp(item.created_at)}
                            >
                              {formatRelativeTime(item.created_at)}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-2">
                          {item.message}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold capitalize">
                              {moduleLabel}
                            </span>
                            {projectName && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100/80 text-slate-600 text-[10px] font-medium truncate max-w-[160px]">
                                {projectName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!item.is_read && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void markRead(item.id);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark read</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleOpenNotification(item)}
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#18b892] hover:underline cursor-pointer"
                            >
                              <span>Open</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {notifications.length > 0
                ? `Showing ${recentNotifications.length} of ${notifications.length}`
                : 'Live alerts enabled'}
            </span>
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#18b892] hover:underline cursor-pointer"
            >
              <span>View all notifications</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Full Notification History Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-2xs flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            role="dialog"
            aria-label="All Notifications"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#18b892]" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">All Notifications</h2>
                  <p className="text-xs text-slate-500">
                    {unreadCount} unread &bull; {notifications.length} total recorded alerts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#18b892] text-xs font-bold cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all as read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close notifications modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModalFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    modalFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalFilter('unread')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    modalFilter === 'unread'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {availableModules.length > 0 && (
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  aria-label="Filter notifications by module"
                  className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#18b892]"
                >
                  <option value="all">All Modules</option>
                  {availableModules.map((mod) => (
                    <option key={mod} value={mod}>
                      {MODULE_LABELS[mod] || mod.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredModalNotifications.length === 0 ? (
                <div className="py-16 text-center px-6">
                  <p className="text-sm font-bold text-slate-700">No matching notifications</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {modalFilter === 'unread'
                      ? 'All notifications in this view have been read.'
                      : 'No notifications recorded yet for your account.'}
                  </p>
                </div>
              ) : (
                filteredModalNotifications.map((item) => {
                  const projectName = item.metadata?.project_name;
                  const moduleLabel = MODULE_LABELS[item.source_module] || item.source_module.replace(/_/g, ' ');
                  const isConfidential = item.notification_type === 'confidential_escalation';

                  return (
                    <div
                      key={item.id}
                      className={`px-5 py-4 flex items-start gap-3.5 transition-colors ${
                        !item.is_read
                          ? isConfidential
                            ? 'bg-red-50/45'
                            : 'bg-emerald-50/30'
                          : 'bg-white'
                      }`}
                    >
                      <div className="mt-0.5 w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs">
                        {getNotificationIcon(item)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {!item.is_read && (
                              <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                            )}
                            <p
                              className={`text-sm truncate ${
                                !item.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                              }`}
                            >
                              {item.title}
                            </p>
                          </div>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                            {formatFullTimestamp(item.created_at)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>

                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold capitalize">
                              {moduleLabel}
                            </span>
                            {projectName && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                                Project: {projectName}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-medium">
                              {item.is_read ? 'Read' : 'Unread'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {!item.is_read && (
                              <button
                                type="button"
                                onClick={() => void markRead(item.id)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Mark read</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleOpenNotification(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#18b892]/10 hover:bg-[#18b892]/20 text-[#18b892] text-xs font-bold cursor-pointer"
                            >
                              <span>Open item</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
