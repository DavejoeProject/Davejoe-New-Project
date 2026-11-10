-- ==============================================================================
-- DAVEJOE INTERIORS — ADMIN STAFF & WORKFORCE VISIBILITY RLS HARDENING
-- Migration: 20261110000002_admin_staff_visibility_rls.sql
--
-- Objective:
-- Ensure that the Admin role has full visibility into all registered staff,
-- profiles, role assignments, and workforce members, matching exactly what
-- Management/CEO and Executive Director see on their dashboards.
-- ==============================================================================

-- 1. Profiles Table: Allow Admin, Management, and Executive Director to view all profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and leadership can view permitted profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.view')
);

-- 2. User Roles Table: Allow Admin, Management, and Executive Director to view all role assignments
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own role assignments" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_all" ON public.user_roles;

CREATE POLICY "user_roles_select_policy" ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.view')
);

-- 3. Workforce Members Table: Ensure full select access for all authenticated staff
ALTER TABLE public.workforce_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workforce_members_select_policy" ON public.workforce_members;

CREATE POLICY "workforce_members_select_policy" ON public.workforce_members
FOR SELECT
TO authenticated
USING (true);

-- 4. Project Workforce Assignments: Ensure full select access for all authenticated staff
ALTER TABLE public.project_workforce_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_workforce_assignments_select_policy" ON public.project_workforce_assignments;
CREATE POLICY "project_workforce_assignments_select_policy" ON public.project_workforce_assignments
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "project_workforce_assignments_insert_policy" ON public.project_workforce_assignments;
CREATE POLICY "project_workforce_assignments_insert_policy" ON public.project_workforce_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('supervisor')
);

DROP POLICY IF EXISTS "project_workforce_assignments_update_policy" ON public.project_workforce_assignments;
CREATE POLICY "project_workforce_assignments_update_policy" ON public.project_workforce_assignments
FOR UPDATE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('supervisor')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('supervisor')
);

-- 5. Roles and Permissions: Ensure viewable by all authenticated users
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
CREATE POLICY "roles_select_policy" ON public.roles
FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
CREATE POLICY "permissions_select_policy" ON public.permissions
FOR SELECT
TO authenticated
USING (true);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);
