-- ==============================================================================
-- DAVEJOE DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261114000002_admin_staff_directory_and_project_assignment.sql
--
-- Purpose:
--   1. Guarantee Admin visibility into all registered staff profiles, roles,
--      user_roles assignments, workforce_members, and project assignments
--      (regardless of whether roles were assigned by Management/CEO,
--      Executive Director, or Admin).
--   2. Provide a hardened SECURITY DEFINER RPC `public.get_staff_directory`
--      that returns all staff accounts + aggregated assigned roles + linked
--      workforce metadata, with optional exclusion of Management/CEO and
--      Executive Director accounts for the Admin Staff menu view.
--   3. Ensure Admin can provision/link workforce_members records and assign
--      any non-leadership staff member to projects.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. SCHEMA SAFETY & ORPHANED AUTH USER PROFILE BACKFILL
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill email / phone / display_name on existing profiles from auth.users
UPDATE public.profiles p
SET
  email = COALESCE(NULLIF(trim(p.email), ''), lower(trim(au.email))),
  phone = COALESCE(
    NULLIF(trim(p.phone), ''),
    NULLIF(trim(COALESCE(au.raw_user_meta_data->>'phone', '')), '')
  ),
  first_name = COALESCE(
    NULLIF(trim(p.first_name), ''),
    NULLIF(trim(COALESCE(au.raw_user_meta_data->>'first_name', '')), '')
  ),
  last_name = COALESCE(
    NULLIF(trim(p.last_name), ''),
    NULLIF(trim(COALESCE(au.raw_user_meta_data->>'last_name', '')), '')
  ),
  display_name = COALESCE(
    NULLIF(trim(p.display_name), ''),
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    NULLIF(trim(COALESCE(au.raw_user_meta_data->>'display_name', '')), ''),
    split_part(COALESCE(au.email, ''), '@', 1)
  )
FROM auth.users au
WHERE p.id = au.id
  AND (
    p.email IS NULL OR trim(p.email) = ''
    OR p.display_name IS NULL OR trim(p.display_name) = ''
  );

-- Ensure any existing auth.users row without a public.profiles row is visible
INSERT INTO public.profiles (
  id,
  email,
  first_name,
  last_name,
  display_name,
  phone,
  status,
  created_at,
  updated_at
)
SELECT
  au.id,
  lower(trim(au.email)),
  NULLIF(trim(COALESCE(au.raw_user_meta_data->>'first_name', '')), ''),
  NULLIF(trim(COALESCE(au.raw_user_meta_data->>'last_name', '')), ''),
  COALESCE(
    NULLIF(trim(COALESCE(au.raw_user_meta_data->>'display_name', '')), ''),
    NULLIF(trim(COALESCE(au.raw_user_meta_data->>'first_name', '') || ' ' || COALESCE(au.raw_user_meta_data->>'last_name', '')), ''),
    split_part(COALESCE(au.email, ''), '@', 1)
  ),
  NULLIF(trim(COALESCE(au.raw_user_meta_data->>'phone', '')), ''),
  'active',
  COALESCE(au.created_at, now()),
  now()
FROM auth.users au
WHERE au.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = au.id
  )
ON CONFLICT (id) DO NOTHING;

-- Helper to detect any active Admin role variant consistently across RLS and RPCs
CREATE OR REPLACE FUNCTION public.auth_is_admin_or_leadership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    public.auth_is_active(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND (
          lower(COALESCE(r.slug, '')) IN (
            'management',
            'ceo',
            'managing_director',
            'executive_director',
            'admin',
            'administrator',
            'admin_coordinator',
            'coordinator'
          )
          OR lower(COALESCE(r.name, '')) LIKE '%admin%'
          OR lower(COALESCE(r.name, '')) LIKE '%coordinator%'
          OR lower(COALESCE(r.name, '')) LIKE '%executive director%'
          OR lower(COALESCE(r.name, '')) LIKE '%management / ceo%'
        )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_admin_or_leadership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_admin_or_leadership() TO authenticated;

-- ------------------------------------------------------------------------------
-- 1. ENSURE ADMIN SELECT VISIBILITY ON PROFILES, USER_ROLES & ROLES
-- ------------------------------------------------------------------------------
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
  OR public.auth_is_admin_or_leadership()
  OR public.auth_has_permission('users.view')
  OR public.auth_has_permission('workforce.view')
  OR public.auth_has_permission('View Workforce')
);

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
  OR public.auth_is_admin_or_leadership()
  OR public.auth_has_permission('users.view')
  OR public.auth_has_permission('workforce.view')
  OR public.auth_has_permission('View Workforce')
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
CREATE POLICY "roles_select_policy" ON public.roles
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON TABLE public.profiles, public.user_roles, public.roles TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. ENSURE WORKFORCE_MEMBERS & PROJECT_WORKFORCE_ASSIGNMENTS ALLOW ADMIN
-- ------------------------------------------------------------------------------
ALTER TABLE public.workforce_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workforce_members_select_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_select_policy" ON public.workforce_members
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "workforce_members_insert_policy" ON public.workforce_members;
DROP POLICY IF EXISTS "workforce_members_self_insert_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_insert_policy" ON public.workforce_members
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = auth.uid()
  OR created_by = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_is_admin_or_leadership()
  OR public.auth_has_role('supervisor')
);

DROP POLICY IF EXISTS "workforce_members_update_policy" ON public.workforce_members;
DROP POLICY IF EXISTS "workforce_members_self_update_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_update_policy" ON public.workforce_members
FOR UPDATE
TO authenticated
USING (
  profile_id = auth.uid()
  OR created_by = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_is_admin_or_leadership()
)
WITH CHECK (
  profile_id = auth.uid()
  OR created_by = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_is_admin_or_leadership()
);

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
  OR public.auth_is_admin_or_leadership()
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
  OR public.auth_is_admin_or_leadership()
  OR public.auth_has_role('supervisor')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_is_admin_or_leadership()
  OR public.auth_has_role('supervisor')
);

-- ------------------------------------------------------------------------------
-- 3. AUTHORITATIVE STAFF DIRECTORY RPC FOR ADMIN, EXEC, AND MANAGEMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_directory(
  p_exclude_leadership boolean DEFAULT false
)
RETURNS TABLE (
  profile_id uuid,
  email text,
  first_name text,
  last_name text,
  display_name text,
  phone text,
  job_title text,
  profile_status text,
  profile_created_at timestamptz,
  assigned_roles jsonb,
  workforce_id uuid,
  workforce_code text,
  workforce_trade text,
  workforce_status text,
  workforce_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean := false;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_active(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: active authenticated session required.' USING ERRCODE = '42501';
  END IF;

  -- Verify caller holds Management, Executive Director, Admin, Supervisor, or directory view permissions
  SELECT (
    public.auth_has_role('management')
    OR public.auth_has_role('executive_director')
    OR public.auth_has_role('admin')
    OR public.auth_has_role('supervisor')
    OR public.auth_is_admin_or_leadership()
    OR public.auth_has_permission('users.view')
    OR public.auth_has_permission('workforce.view')
    OR public.auth_has_permission('View Workforce')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Insufficient permissions to view staff directory.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id::uuid AS profile_id,
    COALESCE(NULLIF(trim(p.email::text), ''), au.email::text)::text AS email,
    p.first_name::text AS first_name,
    p.last_name::text AS last_name,
    COALESCE(
      NULLIF(trim(p.display_name::text), ''),
      NULLIF(trim(COALESCE(p.first_name::text, '') || ' ' || COALESCE(p.last_name::text, '')), ''),
      split_part(COALESCE(NULLIF(trim(p.email::text), ''), au.email::text, ''), '@', 1)
    )::text AS display_name,
    p.phone::text AS phone,
    p.job_title::text AS job_title,
    COALESCE(NULLIF(trim(p.status::text), ''), 'active')::text AS profile_status,
    p.created_at::timestamptz AS profile_created_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'slug', r.slug
          )
          ORDER BY r.name
        )
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p.id
      ),
      '[]'::jsonb
    ) AS assigned_roles,
    wm.id::uuid AS workforce_id,
    wm.workforce_code::text AS workforce_code,
    wm.trade::text AS workforce_trade,
    wm.status::text AS workforce_status,
    wm.phone::text AS workforce_phone
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN LATERAL (
    SELECT w.id, w.workforce_code, w.trade, w.status, w.phone
    FROM public.workforce_members w
    WHERE w.profile_id = p.id
    ORDER BY w.created_at DESC
    LIMIT 1
  ) wm ON true
  WHERE (
    NOT p_exclude_leadership
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = p.id
        AND (
          lower(COALESCE(r.slug, '')) IN (
            'management',
            'ceo',
            'managing_director',
            'executive_director',
            'executive_director_business_operations_strategy'
          )
          OR lower(COALESCE(r.name, '')) LIKE '%executive director%'
          OR lower(COALESCE(r.name, '')) LIKE '%management / ceo%'
          OR lower(COALESCE(r.name, '')) = 'management'
          OR lower(COALESCE(r.name, '')) = 'ceo'
        )
    )
  )
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_directory(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_directory(boolean) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. SERVER-SIDE TRANSACTIONAL USER CREATION RPC (WITH EXTENSIONS & ADMIN SUPPORT)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_roles text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_management boolean;
  v_is_executive boolean;
  v_is_admin boolean;
  v_new_user_id uuid;
  v_existing_profile_id uuid;
  v_display_name text;
  v_role_slug text;
  v_role_id uuid;
  v_assigned_roles text[] := ARRAY[]::text[];
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: No active session';
  END IF;

  -- 1. Check Caller Authority: Management/CEO, Executive Director, or Admin
  SELECT public.auth_has_role('management') INTO v_is_management;
  SELECT public.auth_has_role('executive_director') INTO v_is_executive;
  SELECT (
    public.auth_has_role('admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_caller_id
        AND (
          lower(COALESCE(r.slug, '')) IN ('admin', 'administrator', 'admin_coordinator', 'coordinator')
          OR lower(COALESCE(r.name, '')) LIKE '%admin%'
          OR lower(COALESCE(r.name, '')) LIKE '%coordinator%'
        )
    )
  ) INTO v_is_admin;

  IF NOT (v_is_management OR v_is_executive OR v_is_admin) THEN
    RAISE EXCEPTION 'Access Denied: Only Management / CEO, Executive Director, or Admin can create user accounts';
  END IF;

  -- Restrict Admin from creating/assigning leadership roles directly
  IF v_is_admin AND NOT (v_is_management OR v_is_executive) THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_roles, ARRAY[]::text[])) AS r_in
      WHERE lower(trim(r_in)) IN ('management', 'executive_director', 'ceo', 'managing_director')
    ) THEN
      RAISE EXCEPTION 'Access Denied: Admin cannot assign Management or Executive Director roles';
    END IF;
  END IF;

  -- 2. Validate Parameters
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email address is required';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  v_display_name := trim(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));
  IF v_display_name = '' THEN
    v_display_name := split_part(lower(trim(p_email)), '@', 1);
  END IF;

  -- Check if user already exists in auth.users
  SELECT id INTO v_new_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_new_user_id IS NOT NULL THEN
    SELECT id INTO v_existing_profile_id
    FROM public.profiles
    WHERE id = v_new_user_id;

    IF v_existing_profile_id IS NOT NULL THEN
      RAISE EXCEPTION 'An account with email "%" already exists.', lower(trim(p_email));
    END IF;
    -- Otherwise repair the orphaned auth.users account by creating its missing profile + roles
  ELSE
    v_new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_new_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      lower(trim(p_email)),
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'first_name', p_first_name,
        'last_name', p_last_name,
        'display_name', v_display_name,
        'phone', p_phone
      ),
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  END IF;

  -- 4. Upsert Profile
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    display_name,
    phone,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_new_user_id,
    lower(trim(p_email)),
    p_first_name,
    p_last_name,
    v_display_name,
    p_phone,
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    status = 'active',
    updated_at = now();

  -- 5. Assign Roles
  FOREACH v_role_slug IN ARRAY COALESCE(p_roles, ARRAY[]::text[]) LOOP
    SELECT id INTO v_role_id
    FROM public.roles
    WHERE lower(slug) = lower(trim(v_role_slug))
       OR lower(name) = lower(trim(v_role_slug))
    LIMIT 1;

    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, assigned_by)
      VALUES (v_new_user_id, v_role_id, v_caller_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;

      v_assigned_roles := array_append(v_assigned_roles, v_role_slug);
    END IF;
  END LOOP;

  -- 6. Record in immutable audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    module,
    table_name,
    record_id,
    new_values
  ) VALUES (
    v_caller_id,
    'admin.user_created',
    'administration',
    'profiles',
    v_new_user_id::text,
    jsonb_build_object(
      'user_id', v_new_user_id,
      'email', lower(trim(p_email)),
      'display_name', v_display_name,
      'roles', v_assigned_roles,
      'created_by', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'email', lower(trim(p_email)),
    'display_name', v_display_name,
    'assigned_roles', v_assigned_roles
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text[]) TO authenticated;

COMMIT;
