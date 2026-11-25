-- ==============================================================================
-- DAVEJOE DIGITAL OPERATING SYSTEM
-- PHASE 2 — MILESTONE 1 (WORKSTREAM A)
-- MIGRATION: 20261125000002_phase2_m1_work_packages_controls.sql
--
-- Scope:
--   1. Additively extend public.project_work_packages with deliverables,
--      responsible supervisor/team, actual dates, completion %, inspection &
--      approval status, evidence documents, delay status, and client visibility.
--   2. Add public.work_package_dependencies (predecessor/successor links).
--   3. Add public.work_package_milestones (5-stage verified milestone tracking).
--   4. Add public.work_package_blockers (delays, blockers, risks & corrective actions).
--   5. Additively link existing operational tables (project_tasks, project_notes,
--      project_material_requirements, purchase_orders, technical_inspections,
--      project_area_completions) via nullable work_package_id FK so existing
--      modules connect directly without duplicating task/procurement/QC systems.
--   6. Granular permissions (with non-null action column), RLS, and explicit GRANTs.
--
-- Safety:
--   - 100% additive and idempotent.
--   - No DROP TABLE or destructive operations.
--   - Preserves all 9 staff roles and client_partner role.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. GRANULAR PERMISSIONS (WORK PACKAGES & PROJECT CONTROLS)
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (name, code, module, action, description)
VALUES
  ('Manage Work Packages', 'work_packages.manage', 'project_controls', 'manage', 'Create and update project work packages, dependencies, milestones, and blockers'),
  ('Inspect Work Packages', 'work_packages.inspect', 'project_controls', 'inspect', 'Record technical/QC inspection status and evidence on work packages'),
  ('Approve Work Packages', 'work_packages.approve', 'project_controls', 'approve', 'Approve work package completion and handover readiness')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'work_packages.manage',
  'work_packages.inspect',
  'work_packages.approve'
)
WHERE r.slug IN ('management', 'executive_director', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'work_packages.manage',
  'work_packages.inspect'
)
WHERE r.slug IN ('technical', 'supervisor')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. EXTEND EXISTING public.project_work_packages
-- ------------------------------------------------------------------------------
ALTER TABLE public.project_work_packages
  ADD COLUMN IF NOT EXISTS deliverables text,
  ADD COLUMN IF NOT EXISTS responsible_supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_supervisor_name text,
  ADD COLUMN IF NOT EXISTS responsible_team_summary text,
  ADD COLUMN IF NOT EXISTS actual_start_date date,
  ADD COLUMN IF NOT EXISTS actual_end_date date,
  ADD COLUMN IF NOT EXISTS completion_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inspection_status text NOT NULL DEFAULT 'not_inspected',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_name text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delay_status text NOT NULL DEFAULT 'on_track',
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_work_packages_completion_pct_chk'
  ) THEN
    ALTER TABLE public.project_work_packages
      ADD CONSTRAINT project_work_packages_completion_pct_chk
      CHECK (completion_percent >= 0 AND completion_percent <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_work_packages_inspection_status_chk'
  ) THEN
    ALTER TABLE public.project_work_packages
      ADD CONSTRAINT project_work_packages_inspection_status_chk
      CHECK (inspection_status IN (
        'not_inspected',
        'scheduled',
        'in_review',
        'snag_identified',
        'conditional_pass',
        'passed'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_work_packages_approval_status_chk'
  ) THEN
    ALTER TABLE public.project_work_packages
      ADD CONSTRAINT project_work_packages_approval_status_chk
      CHECK (approval_status IN (
        'pending',
        'submitted_for_approval',
        'approved',
        'revision_requested',
        'rejected'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_work_packages_delay_status_chk'
  ) THEN
    ALTER TABLE public.project_work_packages
      ADD CONSTRAINT project_work_packages_delay_status_chk
      CHECK (delay_status IN ('on_track', 'at_risk', 'delayed', 'blocked', 'completed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_work_packages_supervisor
  ON public.project_work_packages(responsible_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_project_work_packages_delay_status
  ON public.project_work_packages(project_id, delay_status);

-- Ensure updated_at trigger exists on project_work_packages
CREATE OR REPLACE FUNCTION public.phase2_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_packages_updated_at ON public.project_work_packages;
CREATE TRIGGER trg_work_packages_updated_at
  BEFORE UPDATE ON public.project_work_packages
  FOR EACH ROW EXECUTE FUNCTION public.phase2_set_updated_at();

-- Tighten client SELECT policy on project_work_packages to respect client_visible
DROP POLICY IF EXISTS "work_packages_select_policy" ON public.project_work_packages;
CREATE POLICY "work_packages_select_policy" ON public.project_work_packages
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_staff(auth.uid())
    OR (
      client_visible = true
      AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
    )
  );

-- Allow portal managers AND assigned technical/supervisors to manage work packages
DROP POLICY IF EXISTS "work_packages_manage_policy" ON public.project_work_packages;
CREATE POLICY "work_packages_manage_policy" ON public.project_work_packages
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- 3. WORK PACKAGE DEPENDENCIES (PREDECESSOR / SUCCESSOR LINKS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_package_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  depends_on_package_id uuid NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start' CHECK (dependency_type IN (
    'finish_to_start',
    'start_to_start',
    'finish_to_finish',
    'blocks'
  )),
  lag_days integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_package_dep_not_self_chk CHECK (work_package_id <> depends_on_package_id),
  CONSTRAINT work_package_dep_unique UNIQUE (work_package_id, depends_on_package_id)
);

CREATE INDEX IF NOT EXISTS idx_wp_deps_project ON public.work_package_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_wp_deps_package ON public.work_package_dependencies(work_package_id);
CREATE INDEX IF NOT EXISTS idx_wp_deps_predecessor ON public.work_package_dependencies(depends_on_package_id);

ALTER TABLE public.work_package_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wp_deps_select_policy" ON public.work_package_dependencies;
CREATE POLICY "wp_deps_select_policy" ON public.work_package_dependencies
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_staff(auth.uid())
    OR public.auth_client_has_project_access(project_id, NULL, auth.uid())
  );

DROP POLICY IF EXISTS "wp_deps_manage_policy" ON public.work_package_dependencies;
CREATE POLICY "wp_deps_manage_policy" ON public.work_package_dependencies
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- 4. WORK PACKAGE MILESTONES (5-STAGE VERIFICATION COMPATIBLE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_package_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  milestone_code text NOT NULL,
  title text NOT NULL,
  description text,
  planned_date date,
  actual_date date,
  weight_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight_pct >= 0 AND weight_pct <= 100),
  completion_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  verification_stage text NOT NULL DEFAULT 'reported_by_supervisor' CHECK (verification_stage IN (
    'reported_by_supervisor',
    'inspected_by_qc',
    'verified_completed',
    'acknowledged_by_client',
    'formally_handed_over'
  )),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'in_progress',
    'at_risk',
    'completed',
    'verified'
  )),
  evidence_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_milestones_project ON public.work_package_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_wp_milestones_package ON public.work_package_milestones(work_package_id);

DROP TRIGGER IF EXISTS trg_wp_milestones_updated_at ON public.work_package_milestones;
CREATE TRIGGER trg_wp_milestones_updated_at
  BEFORE UPDATE ON public.work_package_milestones
  FOR EACH ROW EXECUTE FUNCTION public.phase2_set_updated_at();

ALTER TABLE public.work_package_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wp_milestones_select_policy" ON public.work_package_milestones;
CREATE POLICY "wp_milestones_select_policy" ON public.work_package_milestones
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_staff(auth.uid())
    OR (
      client_visible = true
      AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
    )
  );

DROP POLICY IF EXISTS "wp_milestones_manage_policy" ON public.work_package_milestones;
CREATE POLICY "wp_milestones_manage_policy" ON public.work_package_milestones
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- 5. WORK PACKAGE DELAYS, BLOCKERS & CORRECTIVE ACTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_package_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid NOT NULL REFERENCES public.project_work_packages(id) ON DELETE CASCADE,
  blocker_type text NOT NULL DEFAULT 'blocker' CHECK (blocker_type IN (
    'delay',
    'blocker',
    'risk',
    'corrective_action'
  )),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title text NOT NULL,
  description text NOT NULL,
  impact_days integer NOT NULL DEFAULT 0 CHECK (impact_days >= 0),
  corrective_action text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name text,
  target_resolution_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigating', 'escalated', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  client_visible boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_blockers_project ON public.work_package_blockers(project_id, status);
CREATE INDEX IF NOT EXISTS idx_wp_blockers_package ON public.work_package_blockers(work_package_id);

DROP TRIGGER IF EXISTS trg_wp_blockers_updated_at ON public.work_package_blockers;
CREATE TRIGGER trg_wp_blockers_updated_at
  BEFORE UPDATE ON public.work_package_blockers
  FOR EACH ROW EXECUTE FUNCTION public.phase2_set_updated_at();

ALTER TABLE public.work_package_blockers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wp_blockers_select_policy" ON public.work_package_blockers;
CREATE POLICY "wp_blockers_select_policy" ON public.work_package_blockers
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_staff(auth.uid())
    OR (
      client_visible = true
      AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
    )
  );

DROP POLICY IF EXISTS "wp_blockers_manage_policy" ON public.work_package_blockers;
CREATE POLICY "wp_blockers_manage_policy" ON public.work_package_blockers
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor'))
      AND public.auth_is_assigned_to_project(project_id, auth.uid())
    )
  );

-- ------------------------------------------------------------------------------
-- 6. ADDITIVE LINKING TO EXISTING OPERATIONAL TABLES (NO DUPLICATION)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.project_tasks') IS NOT NULL THEN
    ALTER TABLE public.project_tasks
      ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_project_tasks_work_package ON public.project_tasks(work_package_id);
  END IF;

  IF to_regclass('public.project_notes') IS NOT NULL THEN
    ALTER TABLE public.project_notes
      ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_project_notes_work_package ON public.project_notes(work_package_id);
  END IF;

  IF to_regclass('public.project_material_requirements') IS NOT NULL THEN
    ALTER TABLE public.project_material_requirements
      ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_proj_mat_req_work_package ON public.project_material_requirements(work_package_id);
  END IF;

  IF to_regclass('public.purchase_orders') IS NOT NULL THEN
    ALTER TABLE public.purchase_orders
      ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_work_package ON public.purchase_orders(work_package_id);
  END IF;

  IF to_regclass('public.technical_inspections') IS NOT NULL THEN
    ALTER TABLE public.technical_inspections
      ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_tech_inspections_work_package ON public.technical_inspections(work_package_id);
  END IF;

  IF to_regclass('public.project_area_completions') IS NOT NULL THEN
    ALTER TABLE public.project_area_completions
      ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_area_completions_work_package ON public.project_area_completions(work_package_id);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. EXPLICIT GRANTS TO AUTHENTICATED ROLE (RLS ENFORCES ACCESS)
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.work_package_dependencies,
  public.work_package_milestones,
  public.work_package_blockers
TO authenticated;

COMMIT;
