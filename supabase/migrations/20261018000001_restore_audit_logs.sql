
-- Restore the missing Davejoe audit log table.
-- This migration is intentionally limited to audit logging.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  module text NOT NULL,
  table_name text,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON public.audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_module
  ON public.audit_logs(module);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

-- Prevent changes to or deletion of historical audit entries.
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION
    'Audit logs are append-only; updates and deletions are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation
  ON public.audit_logs;

CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_audit_log_mutation();

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow both leadership roles and users with audit.view permission.
DROP POLICY IF EXISTS audit_logs_select_policy
  ON public.audit_logs;

CREATE POLICY audit_logs_select_policy
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_permission('audit.view')
);