-- Migration: 20261019000001_fix_account_status_management.sql
-- Description: Authoritative account status management (active, suspended, inactive, pending)
-- Provides server-side transactional RPC admin_update_user_status and validates RLS enforcement.

-- 1. TRANSACTIONAL SERVER-SIDE STATUS UPDATE FUNCTION
CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean;
  v_old_status text;
  v_new_status text;
  v_target_email text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- 1. Verify caller authorization: Management, Executive Director, or Admin with users.manage permission
  SELECT (
    public.auth_has_role('management')
    OR public.auth_has_role('executive_director')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('users.manage')
  ) INTO v_is_authorized;

  IF NOT COALESCE(v_is_authorized, false) THEN
    RAISE EXCEPTION 'Access denied: Only Management / CEO, Executive Director, and authorized administrators may update account status.';
  END IF;

  -- 2. Validate target status
  v_new_status := lower(trim(p_status));
  IF v_new_status NOT IN ('active', 'inactive', 'suspended', 'pending') THEN
    RAISE EXCEPTION 'Invalid status "%". Supported values are: active, inactive, suspended, pending.', p_status;
  END IF;

  -- 3. Prevent self-deactivation or self-suspension by administrator
  IF v_caller_id = p_user_id AND v_new_status != 'active' THEN
    RAISE EXCEPTION 'You cannot deactivate or suspend your own administrator account.';
  END IF;

  -- 4. Load target profile
  SELECT status, email INTO v_old_status, v_target_email
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user profile with ID % was not found.', p_user_id;
  END IF;

  -- 5. Update profiles record
  UPDATE public.profiles
  SET
    status = v_new_status,
    updated_at = now()
  WHERE id = p_user_id;

  -- 6. Log audit event
  BEGIN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      module,
      table_name,
      record_id,
      old_values,
      new_values,
      created_at
    ) VALUES (
      v_caller_id,
      'admin.user_status_changed',
      'administration',
      'profiles',
      p_user_id::text,
      jsonb_build_object('status', v_old_status, 'email', v_target_email),
      jsonb_build_object('status', v_new_status, 'email', v_target_email),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Audit logging failure should not abort the status transition
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'old_status', v_old_status,
    'new_status', v_new_status,
    'message', 'Account status updated successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, text) TO authenticated;

-- 2. ENSURE PROFILES UPDATE POLICY COVERS EQUAL LEADERSHIP ROLES
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.manage')
)
WITH CHECK (
  (id = auth.uid() AND (status = (SELECT status FROM public.profiles WHERE id = auth.uid())))
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.manage')
);
