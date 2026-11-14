-- ==============================================================================
-- DAVEJOE DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261114000003_assigned_projects_visibility_and_clock_in.sql
--
-- Purpose:
--   1. Guarantee that ALL roles (Supervisor, Artisan, Technical/QC, Procurement,
--      Accounts, Social Media Manager, Admin, Executive, Management) can see
--      EVERY project assigned to them via project_workforce_assignments OR
--      project_members, regardless of whether they have multiple workforce_members
--      rows or were assigned via Admin Staff menu / Project Control Centre.
--   2. Sync project_workforce_assignments -> project_members automatically for
--      staff users with login profiles (plus one-time idempotent backfill).
--   3. Harden & expand RLS on projects, clients, project_members, project_tasks,
--      project_material_requirements, project_notes, attendance_records, etc.
--      so assigned staff always see complete project details.
--   4. Provide hardened SECURITY DEFINER RPCs:
--      - public.get_my_assigned_projects()
--      - public.get_my_project_full_details(p_project_id uuid)
--      - public.clock_in_to_project(p_project_id uuid, p_latitude float8, p_longitude float8)
--        enforcing project start-date eligibility (clock-in opens on start date).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SCHEMA SAFETY: ENSURE EXPECTED COLUMNS EXIST ON ASSIGNMENTS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.project_workforce_assignments') IS NOT NULL THEN
    ALTER TABLE public.project_workforce_assignments
      ADD COLUMN IF NOT EXISTS role_on_project text,
      ADD COLUMN IF NOT EXISTS start_date date,
      ADD COLUMN IF NOT EXISTS end_date date,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. AUTHORITATIVE HELPER: CHECK IF USER IS ASSIGNED TO A PROJECT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_assigned_to_project(
  p_project_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_phone text;
  v_is_assigned boolean := false;
BEGIN
  IF p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.auth_is_active(p_user_id) THEN
    RETURN false;
  END IF;

  -- Privileged organizational oversight roles
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND lower(r.slug) IN ('management', 'executive_director', 'admin')
  ) THEN
    RETURN true;
  END IF;

  -- Check direct project_members link
  IF to_regclass('public.project_members') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_user_id
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check profile phone for unlinked workforce match
  SELECT NULLIF(trim(COALESCE(to_jsonb(p)->>'phone', '')), '')
  INTO v_phone
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- Check ALL matching workforce_members rows -> project_workforce_assignments
  SELECT EXISTS (
    SELECT 1
    FROM public.project_workforce_assignments pwa
    JOIN public.workforce_members wm ON wm.id = pwa.workforce_member_id
    WHERE pwa.project_id = p_project_id
      AND COALESCE(pwa.is_active, true) = true
      AND (
        wm.profile_id = p_user_id
        OR (
          wm.profile_id IS NULL
          AND v_phone IS NOT NULL
          AND NULLIF(trim(COALESCE(wm.phone, '')), '') = v_phone
        )
      )
  ) INTO v_is_assigned;

  RETURN COALESCE(v_is_assigned, false);
END;
$$;

REVOKE ALL ON FUNCTION public.auth_is_assigned_to_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_assigned_to_project(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. AUTO-SYNC TRIGGER: project_workforce_assignments -> project_members
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_project_member_from_workforce_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_project_id uuid;
  v_wf_id uuid;
  v_is_active boolean;
  v_role_label text;
  v_has_role_col boolean := false;
BEGIN
  IF to_regclass('public.project_members') IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  v_wf_id := COALESCE(NEW.workforce_member_id, OLD.workforce_member_id);
  v_is_active := CASE WHEN TG_OP = 'DELETE' THEN false ELSE COALESCE(NEW.is_active, true) END;

  SELECT wm.profile_id INTO v_profile_id
  FROM public.workforce_members wm
  WHERE wm.id = v_wf_id;

  IF v_profile_id IS NULL OR v_project_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_members'
      AND column_name = 'role'
  ) INTO v_has_role_col;

  IF v_is_active THEN
    v_role_label := COALESCE(NULLIF(trim(NEW.role_on_project), ''), 'member');

    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = v_project_id
        AND pm.user_id = v_profile_id
    ) THEN
      BEGIN
        IF v_has_role_col THEN
          INSERT INTO public.project_members (project_id, user_id, role)
          VALUES (v_project_id, v_profile_id, v_role_label);
        ELSE
          INSERT INTO public.project_members (project_id, user_id)
          VALUES (v_project_id, v_profile_id);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Non-fatal guard in case project_members has enum/custom role constraints
        NULL;
      END;
    END IF;
  ELSE
    -- Only remove project_members row if no other active assignment exists for same user & project
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_workforce_assignments pwa
      JOIN public.workforce_members wm ON wm.id = pwa.workforce_member_id
      WHERE pwa.project_id = v_project_id
        AND wm.profile_id = v_profile_id
        AND COALESCE(pwa.is_active, true) = true
    ) THEN
      DELETE FROM public.project_members pm
      WHERE pm.project_id = v_project_id
        AND pm.user_id = v_profile_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.project_workforce_assignments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_sync_project_member_from_wf_assign ON public.project_workforce_assignments;
    CREATE TRIGGER trg_sync_project_member_from_wf_assign
      AFTER INSERT OR UPDATE OF is_active, role_on_project OR DELETE
      ON public.project_workforce_assignments
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_project_member_from_workforce_assignment();
  END IF;
END $$;

-- Idempotent one-time backfill for all existing active assignments with login profiles
DO $$
DECLARE
  r RECORD;
  v_has_role_col boolean := false;
BEGIN
  IF to_regclass('public.project_members') IS NOT NULL
     AND to_regclass('public.project_workforce_assignments') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'project_members' AND column_name = 'role'
    ) INTO v_has_role_col;

    FOR r IN
      SELECT DISTINCT
        pwa.project_id,
        wm.profile_id AS user_id,
        COALESCE(NULLIF(trim(pwa.role_on_project), ''), 'member') AS role_label
      FROM public.project_workforce_assignments pwa
      JOIN public.workforce_members wm ON wm.id = pwa.workforce_member_id
      WHERE wm.profile_id IS NOT NULL
        AND COALESCE(pwa.is_active, true) = true
        AND NOT EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = pwa.project_id AND pm.user_id = wm.profile_id
        )
    LOOP
      BEGIN
        IF v_has_role_col THEN
          INSERT INTO public.project_members (project_id, user_id, role)
          VALUES (r.project_id, r.user_id, r.role_label);
        ELSE
          INSERT INTO public.project_members (project_id, user_id)
          VALUES (r.project_id, r.user_id);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES FOR ASSIGNED STAFF VISIBILITY & ATTENDANCE
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "projects_assigned_staff_select_policy" ON public.projects;
    CREATE POLICY "projects_assigned_staff_select_policy" ON public.projects
      FOR SELECT TO authenticated
      USING (
        public.auth_is_assigned_to_project(id, auth.uid())
        OR created_by = auth.uid()
      );
  END IF;

  IF to_regclass('public.clients') IS NOT NULL THEN
    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "clients_assigned_staff_select_policy" ON public.clients;
    CREATE POLICY "clients_assigned_staff_select_policy" ON public.clients
      FOR SELECT TO authenticated
      USING (
        public.auth_has_role('management')
        OR public.auth_has_role('executive_director')
        OR public.auth_has_role('admin')
        OR EXISTS (
          SELECT 1
          FROM public.projects pr
          WHERE pr.client_id = clients.id
            AND public.auth_is_assigned_to_project(pr.id, auth.uid())
        )
      );
  END IF;

  IF to_regclass('public.project_members') IS NOT NULL THEN
    ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "project_members_assigned_staff_select_policy" ON public.project_members;
    CREATE POLICY "project_members_assigned_staff_select_policy" ON public.project_members
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR public.auth_is_assigned_to_project(project_id, auth.uid())
      );
  END IF;

  IF to_regclass('public.project_tasks') IS NOT NULL THEN
    ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "project_tasks_assigned_staff_select_policy" ON public.project_tasks;
    CREATE POLICY "project_tasks_assigned_staff_select_policy" ON public.project_tasks
      FOR SELECT TO authenticated
      USING (
        assigned_to = auth.uid()
        OR public.auth_is_assigned_to_project(project_id, auth.uid())
      );
  END IF;

  IF to_regclass('public.project_material_requirements') IS NOT NULL THEN
    ALTER TABLE public.project_material_requirements ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "pmr_assigned_staff_select_policy" ON public.project_material_requirements;
    CREATE POLICY "pmr_assigned_staff_select_policy" ON public.project_material_requirements
      FOR SELECT TO authenticated
      USING (public.auth_is_assigned_to_project(project_id, auth.uid()));
  END IF;

  IF to_regclass('public.project_notes') IS NOT NULL THEN
    ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "project_notes_assigned_staff_select_policy" ON public.project_notes;
    CREATE POLICY "project_notes_assigned_staff_select_policy" ON public.project_notes
      FOR SELECT TO authenticated
      USING (
        created_by = auth.uid()
        OR public.auth_is_assigned_to_project(project_id, auth.uid())
      );
  END IF;

  IF to_regclass('public.productivity_records') IS NOT NULL THEN
    ALTER TABLE public.productivity_records ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "productivity_assigned_staff_select_policy" ON public.productivity_records;
    CREATE POLICY "productivity_assigned_staff_select_policy" ON public.productivity_records
      FOR SELECT TO authenticated
      USING (public.auth_is_assigned_to_project(project_id, auth.uid()));
  END IF;

  IF to_regclass('public.technical_inspections') IS NOT NULL THEN
    ALTER TABLE public.technical_inspections ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tech_inspections_assigned_staff_select_policy" ON public.technical_inspections;
    CREATE POLICY "tech_inspections_assigned_staff_select_policy" ON public.technical_inspections
      FOR SELECT TO authenticated
      USING (public.auth_is_assigned_to_project(project_id, auth.uid()));
  END IF;
END $$;

-- Guarantee self clock-in/clock-out permissions for ALL 9 authenticated roles
DO $$
BEGIN
  IF to_regclass('public.attendance_records') IS NOT NULL THEN
    ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

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
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. RPC: get_my_assigned_projects()
-- Returns ALL projects assigned to the authenticated user (across all roles)
-- with complete project details, client details, assignment details, and clock-in
-- start-date readiness.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_assigned_projects();
CREATE OR REPLACE FUNCTION public.get_my_assigned_projects()
RETURNS TABLE (
  project_id uuid,
  project_code text,
  name text,
  description text,
  project_type text,
  status text,
  address text,
  city text,
  state text,
  country text,
  start_date date,
  expected_completion_date date,
  actual_completion_date date,
  client_name text,
  client_contact_person text,
  client_phone text,
  client_email text,
  assignment_id uuid,
  workforce_member_id uuid,
  role_on_project text,
  assignment_start_date date,
  assignment_end_date date,
  assignment_notes text,
  assigned_at timestamptz,
  effective_start_date date,
  can_clock_in_today boolean,
  is_starting_today boolean,
  is_upcoming boolean,
  workforce_count bigint,
  today_attendance_count bigint,
  open_tasks_count bigint,
  materials_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_phone text;
  v_wf_ids uuid[];
  v_today date;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR NOT public.auth_is_active(v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: active authenticated session required.' USING ERRCODE = '42501';
  END IF;

  v_today := (now() AT TIME ZONE 'Africa/Lagos')::date;

  SELECT NULLIF(trim(COALESCE(to_jsonb(p)->>'phone', '')), '')
  INTO v_phone
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT COALESCE(array_agg(wm.id), ARRAY[]::uuid[])
  INTO v_wf_ids
  FROM public.workforce_members wm
  WHERE wm.profile_id = v_user_id
     OR (
       wm.profile_id IS NULL
       AND v_phone IS NOT NULL
       AND NULLIF(trim(COALESCE(wm.phone, '')), '') = v_phone
     );

  RETURN QUERY
  WITH candidate_links AS (
    SELECT
      pwa.project_id,
      pwa.id AS assignment_id,
      pwa.workforce_member_id,
      NULLIF(trim(COALESCE(to_jsonb(pwa)->>'role_on_project', '')), '') AS role_on_project,
      pwa.start_date AS assignment_start_date,
      pwa.end_date AS assignment_end_date,
      NULLIF(trim(COALESCE(to_jsonb(pwa)->>'notes', '')), '') AS assignment_notes,
      pwa.created_at AS assigned_at,
      1 AS source_priority
    FROM public.project_workforce_assignments pwa
    WHERE COALESCE(pwa.is_active, true) = true
      AND pwa.workforce_member_id = ANY(v_wf_ids)

    UNION ALL

    SELECT
      pm.project_id,
      pm.id AS assignment_id,
      NULL::uuid AS workforce_member_id,
      NULLIF(trim(COALESCE(to_jsonb(pm)->>'role', '')), '') AS role_on_project,
      NULL::date AS assignment_start_date,
      NULL::date AS assignment_end_date,
      NULL::text AS assignment_notes,
      COALESCE((to_jsonb(pm)->>'created_at')::timestamptz, now()) AS assigned_at,
      2 AS source_priority
    FROM public.project_members pm
    WHERE pm.user_id = v_user_id
  ),
  deduped_links AS (
    SELECT DISTINCT ON (cl.project_id)
      cl.project_id,
      cl.assignment_id,
      cl.workforce_member_id,
      cl.role_on_project,
      cl.assignment_start_date,
      cl.assignment_end_date,
      cl.assignment_notes,
      cl.assigned_at
    FROM candidate_links cl
    ORDER BY cl.project_id, cl.source_priority ASC, cl.assigned_at DESC NULLS LAST
  )
  SELECT
    pr.id AS project_id,
    COALESCE(to_jsonb(pr)->>'project_code', to_jsonb(pr)->>'code', 'PRJ') AS project_code,
    pr.name,
    to_jsonb(pr)->>'description' AS description,
    to_jsonb(pr)->>'project_type' AS project_type,
    COALESCE(pr.status::text, 'in_progress') AS status,
    to_jsonb(pr)->>'address' AS address,
    to_jsonb(pr)->>'city' AS city,
    to_jsonb(pr)->>'state' AS state,
    to_jsonb(pr)->>'country' AS country,
    pr.start_date::date AS start_date,
    NULLIF(to_jsonb(pr)->>'expected_completion_date', '')::date AS expected_completion_date,
    NULLIF(to_jsonb(pr)->>'actual_completion_date', '')::date AS actual_completion_date,
    to_jsonb(c)->>'name' AS client_name,
    to_jsonb(c)->>'contact_person' AS client_contact_person,
    to_jsonb(c)->>'phone' AS client_phone,
    to_jsonb(c)->>'email' AS client_email,
    dl.assignment_id,
    dl.workforce_member_id,
    dl.role_on_project,
    dl.assignment_start_date,
    dl.assignment_end_date,
    dl.assignment_notes,
    dl.assigned_at,
    COALESCE(dl.assignment_start_date, pr.start_date::date) AS effective_start_date,
    (
      (COALESCE(dl.assignment_start_date, pr.start_date::date) IS NULL OR COALESCE(dl.assignment_start_date, pr.start_date::date) <= v_today)
      AND lower(COALESCE(pr.status::text, 'in_progress')) NOT IN ('cancelled', 'closed', 'completed')
    ) AS can_clock_in_today,
    (COALESCE(dl.assignment_start_date, pr.start_date::date) = v_today) AS is_starting_today,
    (COALESCE(dl.assignment_start_date, pr.start_date::date) > v_today) AS is_upcoming,
    COALESCE((
      SELECT count(*)::bigint
      FROM public.project_workforce_assignments pwa2
      WHERE pwa2.project_id = pr.id
        AND COALESCE(pwa2.is_active, true) = true
    ), 0) AS workforce_count,
    COALESCE((
      SELECT count(*)::bigint
      FROM public.attendance_records ar
      WHERE ar.project_id = pr.id
        AND ar.attendance_date = v_today
        AND ar.status::text IN ('present', 'late')
    ), 0) AS today_attendance_count,
    COALESCE((
      SELECT count(*)::bigint
      FROM public.project_tasks pt
      WHERE pt.project_id = pr.id
        AND lower(COALESCE(pt.status::text, 'pending')) NOT IN ('completed', 'cancelled')
    ), 0) AS open_tasks_count,
    COALESCE((
      SELECT count(*)::bigint
      FROM public.project_material_requirements pmr
      WHERE pmr.project_id = pr.id
    ), 0) AS materials_count
  FROM deduped_links dl
  JOIN public.projects pr ON pr.id = dl.project_id
  LEFT JOIN public.clients c ON c.id = pr.client_id
  ORDER BY
    (COALESCE(dl.assignment_start_date, pr.start_date::date) = v_today) DESC,
    (COALESCE(dl.assignment_start_date, pr.start_date::date) <= v_today) DESC NULLS LAST,
    pr.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_assigned_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_assigned_projects() TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. RPC: get_my_project_full_details(p_project_id uuid)
-- Returns complete details (project, client, team, tasks, materials, notes)
-- for any project the authenticated user is assigned to (or privileged).
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_project_full_details(uuid);
CREATE OR REPLACE FUNCTION public.get_my_project_full_details(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_project jsonb;
  v_team jsonb;
  v_tasks jsonb;
  v_materials jsonb;
  v_notes jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR NOT public.auth_is_active(v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: active authenticated session required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.auth_is_assigned_to_project(p_project_id, v_user_id) THEN
    RAISE EXCEPTION 'Access Denied: You are not assigned to this project.' USING ERRCODE = '42501';
  END IF;

  v_today := (now() AT TIME ZONE 'Africa/Lagos')::date;

  SELECT jsonb_build_object(
    'id', pr.id,
    'project_code', COALESCE(to_jsonb(pr)->>'project_code', to_jsonb(pr)->>'code', 'PRJ'),
    'name', pr.name,
    'description', to_jsonb(pr)->>'description',
    'project_type', to_jsonb(pr)->>'project_type',
    'status', COALESCE(pr.status::text, 'in_progress'),
    'address', to_jsonb(pr)->>'address',
    'city', to_jsonb(pr)->>'city',
    'state', to_jsonb(pr)->>'state',
    'country', to_jsonb(pr)->>'country',
    'start_date', pr.start_date,
    'expected_completion_date', NULLIF(to_jsonb(pr)->>'expected_completion_date', ''),
    'actual_completion_date', NULLIF(to_jsonb(pr)->>'actual_completion_date', ''),
    'client_name', to_jsonb(c)->>'name',
    'client_contact_person', to_jsonb(c)->>'contact_person',
    'client_phone', to_jsonb(c)->>'phone',
    'client_email', to_jsonb(c)->>'email'
  )
  INTO v_project
  FROM public.projects pr
  LEFT JOIN public.clients c ON c.id = pr.client_id
  WHERE pr.id = p_project_id;

  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
  END IF;

  -- Active team members on project
  SELECT COALESCE(jsonb_agg(team_row ORDER BY team_row->>'name'), '[]'::jsonb)
  INTO v_team
  FROM (
    SELECT jsonb_build_object(
      'assignment_id', pwa.id,
      'workforce_member_id', wm.id,
      'workforce_code', wm.workforce_code,
      'name', COALESCE(
        NULLIF(trim(COALESCE(to_jsonb(p)->>'display_name', '')), ''),
        NULLIF(trim(concat_ws(' ', to_jsonb(p)->>'first_name', to_jsonb(p)->>'last_name')), ''),
        NULLIF(trim(COALESCE(to_jsonb(wm)->>'emergency_contact_name', '')), ''),
        'Staff ' || COALESCE(wm.workforce_code, '')
      ),
      'trade', wm.trade,
      'role_on_project', COALESCE(NULLIF(trim(pwa.role_on_project), ''), wm.trade, 'Team Member'),
      'start_date', pwa.start_date,
      'end_date', pwa.end_date,
      'phone', COALESCE(to_jsonb(wm)->>'phone', to_jsonb(p)->>'phone'),
      'status', wm.status
    ) AS team_row
    FROM public.project_workforce_assignments pwa
    JOIN public.workforce_members wm ON wm.id = pwa.workforce_member_id
    LEFT JOIN public.profiles p ON p.id = wm.profile_id
    WHERE pwa.project_id = p_project_id
      AND COALESCE(pwa.is_active, true) = true
  ) t;

  -- Project tasks
  IF to_regclass('public.project_tasks') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(task_row ORDER BY task_row->>'created_at' DESC), '[]'::jsonb)
    INTO v_tasks
    FROM (
      SELECT jsonb_build_object(
        'id', pt.id,
        'title', pt.title,
        'description', to_jsonb(pt)->>'description',
        'status', COALESCE(pt.status::text, 'pending'),
        'priority', COALESCE(pt.priority::text, 'medium'),
        'due_date', NULLIF(to_jsonb(pt)->>'due_date', ''),
        'deliverable', to_jsonb(pt)->>'deliverable',
        'required_materials', to_jsonb(pt)->>'required_materials',
        'required_tools', to_jsonb(pt)->>'required_tools',
        'required_ppe', to_jsonb(pt)->>'required_ppe',
        'technical_specifications', to_jsonb(pt)->>'technical_specifications',
        'safety_instructions', to_jsonb(pt)->>'safety_instructions',
        'created_at', pt.created_at
      ) AS task_row
      FROM public.project_tasks pt
      WHERE pt.project_id = p_project_id
      LIMIT 50
    ) tk;
  ELSE
    v_tasks := '[]'::jsonb;
  END IF;

  -- Assigned project materials
  IF to_regclass('public.project_material_requirements') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(mat_row), '[]'::jsonb)
    INTO v_materials
    FROM (
      SELECT jsonb_build_object(
        'id', pmr.id,
        'material_id', pmr.material_id,
        'material_name', COALESCE(to_jsonb(m)->>'name', 'Material Item'),
        'unit_of_measure', COALESCE(to_jsonb(m)->>'unit_of_measure', 'units'),
        'required_quantity', pmr.required_quantity,
        'approved_quantity', pmr.approved_quantity,
        'purpose', to_jsonb(pmr)->>'purpose',
        'status', COALESCE(to_jsonb(pmr)->>'status', 'assigned')
      ) AS mat_row
      FROM public.project_material_requirements pmr
      LEFT JOIN public.materials m ON m.id = pmr.material_id
      WHERE pmr.project_id = p_project_id
      LIMIT 50
    ) mt;
  ELSE
    v_materials := '[]'::jsonb;
  END IF;

  -- Project notes / daily reports
  IF to_regclass('public.project_notes') IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(note_row ORDER BY note_row->>'created_at' DESC), '[]'::jsonb)
    INTO v_notes
    FROM (
      SELECT jsonb_build_object(
        'id', pn.id,
        'title', to_jsonb(pn)->>'title',
        'content', to_jsonb(pn)->>'content',
        'note_type', COALESCE(to_jsonb(pn)->>'note_type', 'general'),
        'created_at', pn.created_at
      ) AS note_row
      FROM public.project_notes pn
      WHERE pn.project_id = p_project_id
      ORDER BY pn.created_at DESC
      LIMIT 15
    ) nt;
  ELSE
    v_notes := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'project', v_project,
    'team', v_team,
    'tasks', v_tasks,
    'materials', v_materials,
    'notes', v_notes,
    'server_date_lagos', v_today
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_project_full_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_project_full_details(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. RPC: clock_in_to_project(p_project_id uuid, p_latitude float8, p_longitude float8)
-- Allows any active assigned staff member (across all roles) to clock in on or
-- after the project/assignment start date, preventing duplicate shifts and
-- rejecting early clock-ins for future-dated projects.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.clock_in_to_project(uuid, double precision, double precision);
CREATE OR REPLACE FUNCTION public.clock_in_to_project(
  p_project_id uuid DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_wf_id uuid;
  v_today date;
  v_target_project_id uuid;
  v_project_name text;
  v_project_status text;
  v_effective_start date;
  v_next_start date;
  v_existing_id uuid;
  v_inserted_id uuid;
  v_created_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL OR NOT public.auth_is_active(v_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: active user account required to clock in.' USING ERRCODE = '42501';
  END IF;

  v_today := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_wf_id := public.ensure_user_workforce_member(v_user_id);

  IF v_wf_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve your workforce attendance identity. Contact Administration.' USING ERRCODE = 'P0002';
  END IF;

  -- Prevent duplicate clock-in for today across all matching workforce_members IDs for this user
  SELECT ar.id INTO v_existing_id
  FROM public.attendance_records ar
  WHERE ar.attendance_date = v_today
    AND (
      ar.recorded_by = v_user_id
      OR ar.workforce_member_id IN (
        SELECT wm.id FROM public.workforce_members wm WHERE wm.profile_id = v_user_id
      )
    )
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'You have already clocked in for today (%). Duplicate shifts are prevented.', v_today USING ERRCODE = '23505';
  END IF;

  IF p_project_id IS NOT NULL THEN
    IF NOT public.auth_is_assigned_to_project(p_project_id, v_user_id) THEN
      RAISE EXCEPTION 'Access Denied: You are not assigned to the selected project.' USING ERRCODE = '42501';
    END IF;

    SELECT
      pr.id,
      pr.name,
      lower(COALESCE(pr.status::text, 'in_progress')),
      COALESCE(
        (
          SELECT MIN(pwa.start_date)
          FROM public.project_workforce_assignments pwa
          JOIN public.workforce_members wm ON wm.id = pwa.workforce_member_id
          WHERE pwa.project_id = pr.id
            AND COALESCE(pwa.is_active, true) = true
            AND wm.profile_id = v_user_id
        ),
        pr.start_date::date
      )
    INTO v_target_project_id, v_project_name, v_project_status, v_effective_start
    FROM public.projects pr
    WHERE pr.id = p_project_id;

    IF v_target_project_id IS NULL THEN
      RAISE EXCEPTION 'Selected project was not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_project_status IN ('cancelled', 'closed') THEN
      RAISE EXCEPTION 'Project "%" is %. Clock-in is not permitted.', v_project_name, upper(v_project_status) USING ERRCODE = 'P0001';
    END IF;

    IF v_effective_start IS NOT NULL AND v_effective_start > v_today THEN
      RAISE EXCEPTION 'Project "%" is scheduled to start on %. You can clock in starting on %.', v_project_name, v_effective_start, v_effective_start USING ERRCODE = 'P0001';
    END IF;
  ELSE
    -- Auto-select eligible assigned project (prioritising one starting today or already started)
    SELECT
      gap.project_id,
      gap.name,
      gap.effective_start_date
    INTO v_target_project_id, v_project_name, v_effective_start
    FROM public.get_my_assigned_projects() gap
    WHERE gap.can_clock_in_today = true
    ORDER BY gap.is_starting_today DESC, gap.assigned_at DESC NULLS LAST
    LIMIT 1;

    -- If user has assigned projects but ALL start in the future, give exact date message
    IF v_target_project_id IS NULL THEN
      SELECT MIN(gap.effective_start_date)
      INTO v_next_start
      FROM public.get_my_assigned_projects() gap
      WHERE gap.is_upcoming = true;

      IF v_next_start IS NOT NULL THEN
        RAISE EXCEPTION 'Your assigned project starts on %. Clock-in opens on that day.', v_next_start USING ERRCODE = 'P0001';
      END IF;

      -- Fallback for organizational / head-office staff without a site assignment
      SELECT pr.id, pr.name
      INTO v_target_project_id, v_project_name
      FROM public.projects pr
      WHERE (pr.start_date IS NULL OR pr.start_date::date <= v_today)
        AND lower(COALESCE(pr.status::text, 'in_progress')) NOT IN ('cancelled', 'closed', 'completed')
      ORDER BY pr.created_at ASC
      LIMIT 1;
    END IF;
  END IF;

  IF v_target_project_id IS NULL THEN
    RAISE EXCEPTION 'No active project starting today or earlier is available to record attendance.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.attendance_records (
    project_id,
    workforce_member_id,
    attendance_date,
    status,
    expected_hours,
    recorded_by,
    evidence_type,
    evidence_reference,
    latitude,
    longitude
  ) VALUES (
    v_target_project_id,
    v_wf_id,
    v_today,
    'present',
    8,
    v_user_id,
    CASE WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN 'gps' ELSE 'manual' END,
    'staff_self_clock_in',
    p_latitude,
    p_longitude
  )
  RETURNING id, created_at INTO v_inserted_id, v_created_at;

  RETURN jsonb_build_object(
    'id', v_inserted_id,
    'project_id', v_target_project_id,
    'project_name', v_project_name,
    'attendance_date', v_today,
    'status', 'present',
    'created_at', v_created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.clock_in_to_project(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clock_in_to_project(uuid, double precision, double precision) TO authenticated;

COMMIT;
