-- ==============================================================================
-- DAVEJOE INTERIORS — UNIVERSAL ATTENDANCE IDENTITY & RLS MIGRATION
-- Fixes ensure_user_workforce_member RPC, removes nonexistent updated_at column,
-- and grants full self-attendance permissions across all non-leadership roles:
-- Site Supervisor, Artisan, Technical, Procurement/Logistics, Social Media, Accounts, Admin
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.ensure_user_workforce_member(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_wf_id uuid;
  v_target_id uuid;
  v_trade text := 'Enterprise Staff';
  v_code text;
  v_job_title text;
  v_phone text;
  v_first_role text;
BEGIN
  -- Determine target user id
  v_target_id := COALESCE(p_user_id, auth.uid());
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required to ensure workforce member';
  END IF;

  -- 1. Check if workforce member already exists for this profile_id
  SELECT id INTO v_wf_id 
  FROM public.workforce_members 
  WHERE profile_id = v_target_id 
  LIMIT 1;

  IF v_wf_id IS NOT NULL THEN
    RETURN v_wf_id;
  END IF;

  -- 2. Read user profile details
  SELECT job_title, phone INTO v_job_title, v_phone 
  FROM public.profiles 
  WHERE id = v_target_id;

  -- 3. Determine trade from assigned role if job_title is empty
  SELECT r.slug INTO v_first_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_target_id
  LIMIT 1;

  IF v_job_title IS NOT NULL AND trim(v_job_title) <> '' THEN
    v_trade := v_job_title;
  ELSIF v_first_role = 'supervisor' THEN
    v_trade := 'Site Supervisor';
  ELSIF v_first_role = 'technical' THEN
    v_trade := 'Technical Inspection & QC Officer';
  ELSIF v_first_role = 'procurement' THEN
    v_trade := 'Procurement & Logistics Officer';
  ELSIF v_first_role = 'accounts' THEN
    v_trade := 'Accounts & Finance Officer';
  ELSIF v_first_role = 'artisan' THEN
    v_trade := 'Site Artisan';
  ELSIF v_first_role = 'social_media_manager' THEN
    v_trade := 'Social Media & Communications Manager';
  ELSIF v_first_role = 'admin' THEN
    v_trade := 'Admin & Workforce Coordinator';
  ELSE
    v_trade := 'Operations Staff';
  END IF;

  -- 4. Check if an unlinked workforce member exists with the same phone
  IF v_phone IS NOT NULL AND trim(v_phone) <> '' THEN
    SELECT id INTO v_wf_id 
    FROM public.workforce_members 
    WHERE phone = v_phone AND profile_id IS NULL 
    LIMIT 1;

    IF v_wf_id IS NOT NULL THEN
      UPDATE public.workforce_members 
      SET profile_id = v_target_id 
      WHERE id = v_wf_id;
      RETURN v_wf_id;
    END IF;
  END IF;

  -- 5. Generate unique workforce code
  v_code := 'STF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- 6. Insert new workforce member (workforce_members has created_at, NOT updated_at)
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
    v_phone,
    v_target_id,
    v_target_id,
    'Auto-linked staff profile for daily operational attendance',
    now()
  ) RETURNING id INTO v_wf_id;

  RETURN v_wf_id;
END;
$$;

-- Grant EXECUTE permissions to all authenticated and anon users
GRANT EXECUTE ON FUNCTION public.ensure_user_workforce_member(uuid) TO authenticated, anon, service_role;

-- Ensure RLS Policies on workforce_members permit self-registration and self-linking
ALTER TABLE public.workforce_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workforce_members_select_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_select_policy" ON public.workforce_members
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "workforce_members_self_insert_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_self_insert_policy" ON public.workforce_members
FOR INSERT TO authenticated
WITH CHECK (
  profile_id = auth.uid() 
  OR created_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('admin')
  OR public.auth_has_role('supervisor')
);

DROP POLICY IF EXISTS "workforce_members_self_update_policy" ON public.workforce_members;
CREATE POLICY "workforce_members_self_update_policy" ON public.workforce_members
FOR UPDATE TO authenticated
USING (
  profile_id = auth.uid() 
  OR created_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('admin')
)
WITH CHECK (
  profile_id = auth.uid() 
  OR created_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('admin')
);

-- Ensure RLS Policies on attendance_records permit daily clock-in and clock-out
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
  OR public.auth_has_role('admin') 
  OR public.auth_has_role('supervisor')
);

DROP POLICY IF EXISTS "attendance_records_update_policy" ON public.attendance_records;
CREATE POLICY "attendance_records_update_policy" ON public.attendance_records
FOR UPDATE TO authenticated
USING (
  recorded_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('admin') 
  OR public.auth_has_role('supervisor')
)
WITH CHECK (
  recorded_by = auth.uid() 
  OR public.auth_has_role('management') 
  OR public.auth_has_role('admin') 
  OR public.auth_has_role('supervisor')
);
