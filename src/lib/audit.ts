import { supabase, isSupabaseConfigured } from './supabase';

export interface AuditEventParams {
  action: string;
  module: string;
  tableName?: string;
  recordId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export class AuditLogger {
  /**
   * Securely records an audit event to the append-only audit_logs table
   */
  static async log(params: AuditEventParams): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // First attempt using secure RPC function log_audit_event
      const { error: rpcError } = await supabase.rpc('log_audit_event', {
        p_action: params.action,
        p_module: params.module,
        p_table_name: params.tableName ?? null,
        p_record_id: params.recordId ?? null,
        p_old_values: params.oldValues ? (params.oldValues as unknown) : null,
        p_new_values: params.newValues ? (params.newValues as unknown) : null,
      });

      if (rpcError) {
        // Fallback to direct insert if RPC not yet deployed
        const { error: insertError } = await supabase.from('audit_logs').insert({
          action: params.action,
          module: params.module,
          table_name: params.tableName,
          record_id: params.recordId,
          old_values: params.oldValues,
          new_values: params.newValues,
        });

        if (insertError) {
          console.warn('[AuditLogger] Could not record audit log:', insertError.message);
        }
      }
    } catch (err) {
      // Never crash the primary UI flow due to audit logging failure
      console.warn('[AuditLogger] Audit capture exception:', err);
    }
  }
}
