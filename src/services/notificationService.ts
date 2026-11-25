import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type NotificationType =
  | 'assignment'
  | 'approval_request'
  | 'approval_decision'
  | 'communication'
  | 'blocker_delay'
  | 'status_update'
  | 'deadline_alert'
  | 'confidential_escalation';

export type NotificationSeverity = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationSourceModule =
  | 'work_packages'
  | 'approvals'
  | 'tasks'
  | 'projects'
  | 'procurement'
  | 'materials'
  | 'finance'
  | 'technical_qc'
  | 'client_portal'
  | 'variations'
  | 'requests_complaints'
  | 'workforce'
  | 'overtime'
  | 'completions'
  | 'quotations'
  | 'specifications'
  | 'service_requests'
  | string;

export interface AppNotification {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  title: string;
  message: string;
  notification_type: NotificationType;
  source_module: NotificationSourceModule;
  severity: NotificationSeverity;
  related_table: string | null;
  related_record_id: string | null;
  project_id: string | null;
  action_route: string | null;
  event_key: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface FetchNotificationsResult {
  data: AppNotification[];
  error: string | null;
  migrationPending: boolean;
}

const isMissingRelationError = (error: any): boolean => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('notifications') && (msg.includes('does not exist') || msg.includes('schema cache')))
  );
};

export const MODULE_LABELS: Record<string, string> = {
  work_packages: 'Work Packages',
  approvals: 'Approvals',
  tasks: 'Tasks & Handovers',
  projects: 'Projects',
  procurement: 'Procurement',
  materials: 'Materials',
  finance: 'Finance & Costing',
  technical_qc: 'Technical & QC',
  client_portal: 'Client Portal',
  variations: 'Variations',
  requests_complaints: 'Requests & Escalations',
  workforce: 'Workforce',
  overtime: 'Overtime',
  completions: 'Area Completions',
  quotations: 'Quotations',
  specifications: 'Specifications',
  service_requests: 'Service Requests',
};

export const NotificationService = {
  async fetchNotifications(userId: string, limit = 100): Promise<FetchNotificationsResult> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (isMissingRelationError(error)) {
          return { data: [], error: null, migrationPending: true };
        }
        return { data: [], error: error.message, migrationPending: false };
      }

      return {
        data: ((data || []) as AppNotification[]).map((row) => ({
          ...row,
          metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
        })),
        error: null,
        migrationPending: false,
      };
    } catch (err: any) {
      return {
        data: [],
        error: err?.message || 'Unable to load notifications.',
        migrationPending: false,
      };
    }
  },

  async markAsRead(notificationId: string): Promise<{ error: string | null }> {
    try {
      const rpcRes = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (!rpcRes.error) {
        return { error: null };
      }

      // Direct RLS-scoped update fallback if RPC is unavailable
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to mark notification as read.' };
    }
  },

  async markAllAsRead(sourceModule?: string): Promise<{ error: string | null }> {
    try {
      const rpcRes = await supabase.rpc('mark_all_notifications_read', {
        p_source_module: sourceModule || null,
      });

      if (!rpcRes.error) {
        return { error: null };
      }

      let query = supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('is_read', false);

      if (sourceModule) {
        query = query.eq('source_module', sourceModule);
      }

      const { error } = await query;
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to mark all notifications as read.' };
    }
  },

  async runDeadlineCheck(): Promise<void> {
    try {
      await supabase.rpc('check_overdue_and_upcoming_notifications');
    } catch {
      // Silent: RPC may not exist before migration is applied
    }
  },

  subscribeToUserNotifications(
    userId: string,
    callbacks: {
      onInsert: (notification: AppNotification) => void;
      onUpdate: (notification: AppNotification) => void;
      onDelete?: (notificationId: string) => void;
      onStatusChange?: (status: string) => void;
    }
  ): RealtimeChannel {
    const channelName = `notifications:user:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AppNotification;
          if (row && row.id) {
            callbacks.onInsert({
              ...row,
              metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as AppNotification;
          if (row && row.id) {
            callbacks.onUpdate({
              ...row,
              metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const oldId = (payload.old as any)?.id;
          if (oldId && callbacks.onDelete) {
            callbacks.onDelete(String(oldId));
          }
        }
      )
      .subscribe((status) => {
        callbacks.onStatusChange?.(status);
      });

    return channel;
  },
};
