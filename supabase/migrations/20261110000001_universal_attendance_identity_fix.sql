-- ==============================================================================
-- DAVEJOE INTERIORS — UNIVERSAL ATTENDANCE IDENTITY & WORKFORCE RESOLUTION
-- Migration: 20261110000001_universal_attendance_identity_fix.sql
--
-- Fixes:
-- 1. Drops legacy conflicting definitions of ensure_user_workforce_member.
-- 2. Implements hardened SECURITY DEFINER ensure_user_workforce_member(p_user_id uuid)
--    with fixed search_path = public, auth, pg_temp, strict caller verification,
--    anti-impersonation rules, active-status checks, and NO reference to nonexistent updated_at.
-- 3. Covers ALL 9 enterprise and operational roles:
--    Management/CEO, Executive Director, Admin, Site Supervisor, Technical QC,
--    Procurement & Logistics, Accounts & Finance, Artisan, Social Media Manager.
-- 4. Ensures Row-Level Security (RLS) on workforce_members permits self-registration
--    and self-linking for all authenticated staff roles.
-- 5. Ensures Row-Level Security (RLS) on attendance_records permits daily clock-in/out
--    for all authenticated staff roles.
-- 6. Performs an idempotent backfill for all existing active profiles without workforce_members.
-- ==============================================================================

-- 1. Clean up legacy or conflicting function signatures
DROP FUNCTION IF EXISTS public.ensure_user_workforce_member(uuid);
DROP FUNCTION IF EXISTS public.ensure_user_workforce_member();

-- 2. Define hardened, authoritative ensure_user_workforce_member
CREATE OR REPLACE FUNCTION public.ensure_user_workforce_member(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_target_id uuid;
  v_wf_id uuid;
  v_trade text := 'Enterprise Staff';
  v_code text;
  v_prefix text := 'STF';
  v_job_title text;
  v_phone text;
  v_first_role text;
  v_user_status text;
  v_is_elevated boolean := false;
BEGIN
  -- 1. Identify caller
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: caller must be an authenticated user.';
  END IF;

  -- 2. Determine target user (prevent unauthorized impersonation)
  IF p_user_id IS NOT NULL AND p_user_id <> v_caller_id THEN
    -- Check if caller has management, executive, or admin role to act on behalf of another user
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = v_caller_id
        AND r.slug IN ('management', 'executive_director', 'admin')
    ) INTO v_is_elevated;

    IF v_is_elevated THEN
      v_target_id := p_user_id;
    ELSE
      -- Non-elevated users can only register their own attendance identity
      v_target_id := v_caller_id;
    END IF;
  ELSE
    v_target_id := v_caller_id;
  END IF;

  -- 3. Verify target user exists and account is active in profiles
  SELECT status, job_title, phone INTO v_user_status, v_job_title, v_phone
  FROM public.profiles
  WHERE id = v_target_id;

  IF v_user_status IS NOT NULL AND lower(trim(v_user_status)) NOT IN ('active', 'pending') THEN
    RAISE EXCEPTION 'User account is %; only active personnel may record attendance.', upper(v_user_status);
  END IF;

  -- 4. Idempotency Check: if workforce member already exists for this profile_id, return immediately
  SELECT id INTO v_wf_id 
  FROM public.workforce_members 
  WHERE profile_id = v_target_id 
  LIMIT 1;

  IF v_wf_id IS NOT NULL THEN
    RETURN v_wf_id;
  END IF;

  -- 5. Determine primary role slug for code prefix and default trade description
  SELECT r.slug INTO v_first_role
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = v_target_id
  ORDER BY 
    CASE r.slug
      WHEN 'management' THEN 1
      WHEN 'executive_director' THEN 2
      WHEN 'admin' THEN 3
      WHEN 'supervisor' THEN 4
      WHEN 'technical' THEN 5
      WHEN 'procurement' THEN 6
      WHEN 'accounts' THEN 7
      WHEN 'artisan' THEN 8
      WHEN 'social_media_manager' THEN 9
      ELSE 10
    END
  LIMIT 1;

  -- Map all 9 roles to distinctive prefixes and operational trade titles
  IF v_first_role = 'supervisor' THEN
    v_prefix := 'SUP';
    v_trade := 'Site Supervisor';
  ELSIF v_first_role = 'technical' THEN
    v_prefix := 'QC';
    v_trade := 'Technical Inspection & QC Officer';
  ELSIF v_first_role = 'procurement' THEN
    v_prefix := 'LOG';
    v_trade := 'Procurement & Logistics Officer';
  ELSIF v_first_role = 'accounts' THEN
    v_prefix := 'ACC';
    v_trade := 'Accounts & Finance Officer';
  ELSIF v_first_role = 'artisan' THEN
    v_prefix := 'ART';
    v_trade := 'Site Artisan';
  ELSIF v_first_role = 'social_media_manager' THEN
    v_prefix := 'SMM';
    v_trade := 'Social Media & Communications Manager';
  ELSIF v_first_role = 'admin' THEN
    v_prefix := 'ADM';
    v_trade := 'Admin & Workforce Coordinator';
  ELSIF v_first_role = 'executive_director' THEN
    v_prefix := 'EXEC';
    v_trade := 'Executive Director';
  ELSIF v_first_role = 'management' THEN
    v_prefix := 'MGT';
    v_trade := 'Management / CEO';
  ELSE
    v_prefix := 'STF';
    v_trade := 'Enterprise Staff';
  END IF;

  -- Prefer explicit job_title from profile if set
  IF v_job_title IS NOT NULL AND trim(v_job_title) <> '' THEN
    v_trade := trim(v_job_title);
  END IF;

  -- 6. Check if an unlinked workforce member exists with the same phone
  IF v_phone IS NOT NULL AND trim(v_phone) <> '' THEN
    SELECT id INTO v_wf_id 
    FROM public.workforce_members 
    WHERE phone = trim(v_phone) AND profile_id IS NULL 
    LIMIT 1;

    IF v_wf_id IS NOT NULL THEN
      UPDATE public.workforce_members 
      SET profile_id = v_target_id,
          status = 'active'
      WHERE id = v_wf_id;
      RETURN v_wf_id;
    END IF;
  END IF;

  -- 7. Generate unique workforce code (e.g., SUP-4A82B1)
  v_code := v_prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- 8. Safe insert into public.workforce_members (CRITICAL: workforce_members does NOT have updated_at)
  BEGIN
    INSERT INTO public.workforce_members (
      workforce_code,
      trade,
      status,
      phone,
      profile_id,
      created_by,
      notes,
      created_at
    ) VALUES (
      v_code,
      v_trade,
      'active',
      trim(v_phone),
      v_target_id,
      v_caller_id,
      'Auto-enrolled staff identity for daily attendance and operations',
      now()
    ) RETURNING id INTO v_wf_id;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback in case of race condition or concurrent insert
    SELECT id INTO v_wf_id 
    FROM public.workforce_members 
    WHERE profile_id = v_target_id 
    LIMIT 1;
  END;

  RETURN v_wf_id;
END;
$$;

-- Parameterless overload for client convenience
CREATE OR REPLACE FUNCTION public.ensure_user_workforce_member()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.ensure_user_workforce_member(auth.uid());
END;
$$;

-- Grant EXECUTE permissions
REVOKE ALL ON FUNCTION public.ensure_user_workforce_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_user_workforce_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_workforce_member(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_workforce_member() TO authenticated, anon, service_role;

-- 3. Hardened RLS Policies on workforce_members
ALTER TABLE public.workforce_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workforce_members_select_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_select_policy" ON public.workforce_members
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "workforce_members_insert_policy" ON public.workforce_members;
DROP POLICY IF EXISTS "workforce_members_self_insert_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_insert_policy" ON public.workforce_members
FOR INSERT TO authenticated
WITH CHECK (
  profile_id = auth.uid() 
  OR created_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('supervisor')
);

DROP POLICY IF EXISTS "workforce_members_update_policy" ON public.workforce_members;
DROP POLICY IF EXISTS "workforce_members_self_update_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_update_policy" ON public.workforce_members
FOR UPDATE TO authenticated
USING (
  profile_id = auth.uid() 
  OR created_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
)
WITH CHECK (
  profile_id = auth.uid() 
  OR created_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
);

-- 4. Hardened RLS Policies on attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_records_select_policy" ON public.attendance_records;
CREATE POLICY "attendance_records_select_policy" ON public.attendance_records
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "attendance_records_insert_policy" ON public.attendance_records;
CREATE POLICY "attendance_records_insert_policy" ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (
  recorded_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin') 
  OR public.auth_has_role('supervisor')
);

DROP POLICY IF EXISTS "attendance_records_update_policy" ON public.attendance_records;
CREATE POLICY "attendance_records_update_policy" ON public.attendance_records
FOR UPDATE TO authenticated
USING (
  recorded_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin') 
  OR public.auth_has_role('supervisor')
)
WITH CHECK (
  recorded_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin') 
  OR public.auth_has_role('supervisor')
);

-- 5. One-time Idempotent Backfill:
-- Ensure every existing active profile has an established workforce_members record.
DO $$
DECLARE
  r RECORD;
  v_role text;
  v_prefix text;
  v_trade text;
  v_code text;
BEGIN
  FOR r IN 
    SELECT p.id, p.job_title, p.phone, p.first_name, p.last_name, p.email
    FROM public.profiles p
    LEFT JOIN public.workforce_members wm ON wm.profile_id = p.id
    WHERE wm.id IS NULL AND (p.status = 'active' OR p.status IS NULL)
  LOOP
    -- Get primary role
    SELECT ro.slug INTO v_role
    FROM public.user_roles ur
    JOIN public.roles ro ON ur.role_id = ro.id
    WHERE ur.user_id = r.id
    ORDER BY 
      CASE ro.slug
        WHEN 'management' THEN 1
        WHEN 'executive_director' THEN 2
        WHEN 'admin' THEN 3
        WHEN 'supervisor' THEN 4
        WHEN 'technical' THEN 5
        WHEN 'procurement' THEN 6
        WHEN 'accounts' THEN 7
        WHEN 'artisan' THEN 8
        WHEN 'social_media_manager' THEN 9
        ELSE 10
      END
    LIMIT 1;

    IF v_role = 'supervisor' THEN
      v_prefix := 'SUP';
      v_trade := 'Site Supervisor';
    ELSIF v_role = 'technical' THEN
      v_prefix := 'QC';
      v_trade := 'Technical Inspection & QC Officer';
    ELSIF v_role = 'procurement' THEN
      v_prefix := 'LOG';
      v_trade := 'Procurement & Logistics Officer';
    ELSIF v_role = 'accounts' THEN
      v_prefix := 'ACC';
      v_trade := 'Accounts & Finance Officer';
    ELSIF v_role = 'artisan' THEN
      v_prefix := 'ART';
      v_trade := 'Site Artisan';
    ELSIF v_role = 'social_media_manager' THEN
      v_prefix := 'SMM';
      v_trade := 'Social Media & Communications Manager';
    ELSIF v_role = 'admin' THEN
      v_prefix := 'ADM';
      v_trade := 'Admin & Workforce Coordinator';
    ELSIF v_role = 'executive_director' THEN
      v_prefix := 'EXEC';
      v_trade := 'Executive Director';
    ELSIF v_role = 'management' THEN
      v_prefix := 'MGT';
      v_trade := 'Management / CEO';
    ELSE
      v_prefix := 'STF';
      v_trade := 'Enterprise Staff';
    END IF;

    IF r.job_title IS NOT NULL AND trim(r.job_title) <> '' THEN
      v_trade := trim(r.job_title);
    END IF;

    v_code := v_prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    INSERT INTO public.workforce_members (
      workforce_code,
      trade,
      status,
      phone,
      profile_id,
      notes,
      created_at
    ) VALUES (
      v_code,
      v_trade,
      'active',
      trim(r.phone),
      r.id,
      'Auto-backfilled staff profile for daily operational attendance',
      now()
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
