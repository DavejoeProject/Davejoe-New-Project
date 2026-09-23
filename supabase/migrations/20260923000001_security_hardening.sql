-- ==============================================================================
-- DAVEJOE MANAGEMENT TOOL — SUPABASE PHASE 1 SECURITY HARDENING MIGRATION
-- ==============================================================================
-- Description: Comprehensive database-level authorization boundary, Row Level
-- Security (RLS) policies, Security Definer utility isolation, granular permissions,
-- and append-only audit trail for Davejoe Interiors & Rehab Global Resources.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. VERIFY / CREATE CORE PHASE 1 TABLES (IF NOT ALREADY EXISTING)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  first_name text,
  last_name text,
  display_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  job_title text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL, -- format: 'module.action'
  module text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- 3. AUDIT TRAIL ARCHITECTURE (APPEND-ONLY, IMMUTABLE)
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

-- Index for rapid audit queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Trigger to guarantee audit_logs is append-only (No updates, no deletes allowed)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Security Policy Violation: audit_logs is an immutable append-only ledger. Row modification or deletion is prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_mutation ON public.audit_logs;
CREATE TRIGGER trg_prevent_audit_log_mutation
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 4. HARDENED SECURITY DEFINER AUTHORIZATION FUNCTIONS
-- Strict search_path = public, pg_temp protects against search-path injection

CREATE OR REPLACE FUNCTION public.auth_is_active(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_status text;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT status INTO v_status
  FROM public.profiles
  WHERE id = target_user_id;

  RETURN v_status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_has_role(requested_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_has_role boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify active status first
  IF NOT public.auth_is_active(v_user_id) THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
      AND (
        lower(r.slug) = lower(requested_role)
        OR lower(r.name) = lower(requested_role)
      )
  ) INTO v_has_role;

  RETURN COALESCE(v_has_role, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.auth_has_permission(requested_permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_is_management boolean;
  v_has_perm boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Ensure active status
  IF NOT public.auth_is_active(v_user_id) THEN
    RETURN false;
  END IF;

  -- 1. Management role has global access to modules
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_user_id
      AND (r.slug = 'management' OR lower(r.name) LIKE '%management%' OR lower(r.name) LIKE '%ceo%')
  ) INTO v_is_management;

  IF v_is_management THEN
    RETURN true;
  END IF;

  -- 2. Check granular permission
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = v_user_id
      AND p.name = requested_permission
  ) INTO v_has_perm;

  RETURN COALESCE(v_has_perm, false);
END;
$$;

-- Secure execution privileges
REVOKE ALL ON FUNCTION public.auth_is_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_active(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.auth_has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_has_role(text) TO authenticated;

REVOKE ALL ON FUNCTION public.auth_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_has_permission(text) TO authenticated;

-- Function for securely logging audit events from authenticated clients or procedures
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_module text,
  p_table_name text DEFAULT NULL,
  p_record_id text DEFAULT NULL,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id uuid;
  v_actor_id uuid;
BEGIN
  v_actor_id := auth.uid();

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    module,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    v_actor_id,
    p_action,
    p_module,
    p_table_name,
    p_record_id,
    p_old_values,
    p_new_values
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, text, jsonb, jsonb) TO authenticated;

-- 5. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. REMOVE ANY PREVIOUS WEAK / PERMISSIVE POLICIES
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_all" ON public.profiles;
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;
DROP POLICY IF EXISTS "roles_select_all" ON public.roles;

-- 7. DEFINE HARDENED RLS POLICIES

-- ====================
-- A. PROFILES POLICIES
-- ====================
-- 1. Users can view their own profile; Management/Admin can view all profiles
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.view')
);

-- 2. Insert: Only matching auth.uid() on signup / provisioning
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
);

-- 3. Update: Users can update basic personal details, but CANNOT modify status without users.manage permission
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_permission('users.manage')
)
WITH CHECK (
  (id = auth.uid() AND (status = (SELECT status FROM public.profiles WHERE id = auth.uid())))
  OR public.auth_has_role('management')
  OR public.auth_has_permission('users.manage')
);

-- ====================
-- B. ROLES POLICIES
-- ====================
-- Roles are viewable by all authenticated users (needed for display and dropdowns)
CREATE POLICY "roles_select_policy" ON public.roles
FOR SELECT
TO authenticated
USING (true);

-- Only Management or users with roles.manage can modify roles
CREATE POLICY "roles_mutate_policy" ON public.roles
FOR ALL
TO authenticated
USING (public.auth_has_role('management') OR public.auth_has_permission('roles.manage'))
WITH CHECK (public.auth_has_role('management') OR public.auth_has_permission('roles.manage'));

-- ====================
-- C. PERMISSIONS POLICIES
-- ====================
CREATE POLICY "permissions_select_policy" ON public.permissions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "permissions_mutate_policy" ON public.permissions
FOR ALL
TO authenticated
USING (public.auth_has_role('management') OR public.auth_has_permission('roles.manage'))
WITH CHECK (public.auth_has_role('management') OR public.auth_has_permission('roles.manage'));

-- ====================
-- D. USER_ROLES POLICIES (CRITICAL: PREVENTS PRIVILEGE ESCALATION)
-- ====================
-- Users can only view their own assigned roles; Management/Admin can view all
CREATE POLICY "user_roles_select_policy" ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.view')
);

-- Users can NEVER insert, update, or delete their own or other roles
-- Only Management or users with roles.manage can assign roles
CREATE POLICY "user_roles_insert_policy" ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_permission('roles.manage')
);

CREATE POLICY "user_roles_update_policy" ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_permission('roles.manage')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_permission('roles.manage')
);

CREATE POLICY "user_roles_delete_policy" ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_permission('roles.manage')
);

-- ====================
-- E. ROLE_PERMISSIONS POLICIES
-- ====================
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "role_permissions_mutate_policy" ON public.role_permissions
FOR ALL
TO authenticated
USING (public.auth_has_role('management') OR public.auth_has_permission('roles.manage'))
WITH CHECK (public.auth_has_role('management') OR public.auth_has_permission('roles.manage'));

-- ====================
-- F. AUDIT_LOGS POLICIES
-- ====================
-- Only Management or authorized Auditors can read audit logs
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_permission('audit.view')
);

-- Authenticated users can write log entries for their own actions
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid() OR actor_id IS NULL
);

-- Notice: NO UPDATE and NO DELETE policies exist on audit_logs.

-- 8. SEED ROLES & GRANULAR PERMISSIONS (IDEMPOTENT)
INSERT INTO public.roles (slug, name, description)
VALUES
  ('management', 'Management / CEO', 'Executive leadership with comprehensive oversight'),
  ('admin', 'Admin / Client & Workforce Coordinator', 'Administrative coordinator for clients and workforce'),
  ('technical', 'Technical Inspection & QC Officer', 'Technical compliance, quality control, and certification'),
  ('supervisor', 'Site Supervisor', 'On-site operations, daily work oversight, and attendance'),
  ('procurement', 'Procurement & Logistics', 'Supply chain, material requisitions, and inventory'),
  ('accounts', 'Accounts', 'Financial ledgers, payments, invoicing, and compensation'),
  ('artisan', 'Artisan / Workforce', 'Direct project execution and task participation')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Seed Granular Permissions
INSERT INTO public.permissions (name, module, description)
VALUES
  ('projects.view', 'projects', 'View project details and milestones'),
  ('projects.create', 'projects', 'Create new projects and charters'),
  ('projects.update', 'projects', 'Modify project plans and schedules'),
  ('projects.approve', 'projects', 'Approve project scopes and signoffs'),
  ('projects.delete', 'projects', 'Archive or delete project records'),

  ('finance.view', 'finance', 'View financial accounts, costs, and ledgers'),
  ('finance.create', 'finance', 'Create invoices, bills, and expense requests'),
  ('finance.approve', 'finance', 'Authorize financial disbursements and budgets'),
  ('finance.pay', 'finance', 'Execute payments and compensation'),

  ('materials.view', 'materials', 'View material inventory and logs'),
  ('materials.request', 'materials', 'Submit material requisition'),
  ('materials.approve', 'materials', 'Approve material purchase or dispatch'),
  ('materials.receive', 'materials', 'Confirm delivery of materials on-site'),
  ('materials.issue', 'materials', 'Issue materials from store to site'),

  ('inspection.view', 'inspection', 'View technical inspections and QC logs'),
  ('inspection.create', 'inspection', 'File technical inspection report'),
  ('inspection.update', 'inspection', 'Update snagging and rectification entries'),
  ('inspection.certify', 'inspection', 'Issue formal quality certifications'),

  ('workforce.view', 'workforce', 'View workforce registry and assignments'),
  ('workforce.manage', 'workforce', 'Assign artisans and manage workforce'),
  ('attendance.record', 'attendance', 'Record daily artisan and site attendance'),
  ('attendance.view', 'attendance', 'View site attendance records'),

  ('users.view', 'administration', 'View user profiles'),
  ('users.manage', 'administration', 'Manage user accounts and statuses'),
  ('roles.manage', 'administration', 'Assign and configure user roles and permissions'),
  ('audit.view', 'administration', 'Inspect immutable audit logs')
ON CONFLICT (name) DO UPDATE
SET module = EXCLUDED.module, description = EXCLUDED.description;

-- Map Role Permissions for Accounts
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'accounts' AND p.name IN (
  'finance.view', 'finance.create', 'finance.approve', 'finance.pay',
  'materials.view', 'projects.view', 'workforce.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map Role Permissions for Technical / QC
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'technical' AND p.name IN (
  'inspection.view', 'inspection.create', 'inspection.update', 'inspection.certify',
  'projects.view', 'materials.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map Role Permissions for Site Supervisor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'supervisor' AND p.name IN (
  'projects.view', 'materials.view', 'materials.request', 'materials.receive',
  'inspection.view', 'inspection.create', 'attendance.record', 'attendance.view',
  'workforce.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map Role Permissions for Procurement
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'procurement' AND p.name IN (
  'materials.view', 'materials.request', 'materials.approve', 'materials.receive', 'materials.issue',
  'finance.view', 'projects.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map Role Permissions for Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'admin' AND p.name IN (
  'projects.view', 'projects.create', 'projects.update',
  'workforce.view', 'workforce.manage', 'attendance.view',
  'users.view', 'materials.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map Role Permissions for Artisan
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'artisan' AND p.name IN (
  'attendance.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ==============================================================================
-- END OF HARDENING MIGRATION
-- ==============================================================================
