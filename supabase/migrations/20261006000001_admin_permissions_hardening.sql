-- ==============================================================================
-- DAVEJOE MANAGEMENT TOOL — PHASE 9.7 ADMIN PERMISSIONS HARDENING MIGRATION
-- ==============================================================================
-- Description: Ensures Admin role has full administrative management permissions
-- (users.manage, roles.manage, audit.view) and explicit RLS policy alignment
-- across profiles, user_roles, role_permissions, and audit_logs.
-- ==============================================================================

-- 1. SEED MISSING ADMIN ROLE PERMISSIONS
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin'
  AND p.name IN (
    'users.view',
    'users.manage',
    'roles.manage',
    'audit.view',
    'projects.view',
    'projects.create',
    'projects.update',
    'workforce.view',
    'workforce.manage',
    'attendance.view',
    'materials.view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2. HARDEN PROFILES UPDATE RLS TO EXPLICITLY INCLUDE ADMIN ROLE
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.manage')
)
WITH CHECK (
  (id = auth.uid() AND (status = (SELECT status FROM public.profiles WHERE id = auth.uid())))
  OR public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.manage')
);

-- 3. HARDEN USER_ROLES RLS TO EXPLICITLY INCLUDE ADMIN ROLE
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
CREATE POLICY "user_roles_insert_policy" ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);

DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
CREATE POLICY "user_roles_update_policy" ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);

DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;
CREATE POLICY "user_roles_delete_policy" ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);

-- 4. HARDEN AUDIT_LOGS SELECT RLS TO EXPLICITLY INCLUDE ADMIN ROLE
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('audit.view')
);

-- 5. HARDEN ROLE_PERMISSIONS MUTATION TO EXPLICITLY INCLUDE ADMIN ROLE
DROP POLICY IF EXISTS "role_permissions_mutate_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_mutate_policy" ON public.role_permissions
FOR ALL
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);
