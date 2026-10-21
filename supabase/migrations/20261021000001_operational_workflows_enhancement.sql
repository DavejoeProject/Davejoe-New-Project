-- Migration: 20261021000001_operational_workflows_enhancement.sql
-- Description: Comprehensive database schema enhancement for:
-- 1. Project Material Remnants & Reconciliation
-- 2. Company Tools & Equipment Register, Custody, Assignment & Return Inspections
-- 3. Robust Daily Attendance tracking for all non-leadership roles
-- 4. Mandatory Task Instructions, Handovers & Review Accountability

-- ============================================================================
-- 1. PROJECT MATERIAL REMNANTS & RECONCILIATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_material_remnants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name text NOT NULL,
  category text,
  unit_of_measure text NOT NULL DEFAULT 'units',
  quantity_delivered numeric NOT NULL DEFAULT 0,
  quantity_consumed numeric NOT NULL DEFAULT 0,
  quantity_remaining numeric NOT NULL DEFAULT 0,
  quantity_returned_to_stock numeric NOT NULL DEFAULT 0,
  quantity_retained_on_site numeric NOT NULL DEFAULT 0,
  quantity_transferred numeric NOT NULL DEFAULT 0,
  quantity_damaged numeric NOT NULL DEFAULT 0,
  condition text NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'fair', 'spoiled', 'damaged', 'contaminated', 'scrap')),
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handover_timestamp timestamptz DEFAULT now(),
  destination_location text,
  destination_custodian_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_status text NOT NULL DEFAULT 'pending_verification' CHECK (verification_status IN ('draft', 'pending_verification', 'verified', 'disputed', 'closed')),
  notes text,
  photo_urls text[] DEFAULT '{}',
  reviewer_comments text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_material_remnants_project_id ON public.project_material_remnants (project_id);
CREATE INDEX IF NOT EXISTS idx_project_material_remnants_status ON public.project_material_remnants (verification_status);
CREATE INDEX IF NOT EXISTS idx_project_material_remnants_created ON public.project_material_remnants (created_at DESC);

ALTER TABLE public.project_material_remnants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "remnants_select_policy" ON public.project_material_remnants;
CREATE POLICY "remnants_select_policy" ON public.project_material_remnants
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "remnants_insert_policy" ON public.project_material_remnants;
CREATE POLICY "remnants_insert_policy" ON public.project_material_remnants
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "remnants_update_policy" ON public.project_material_remnants;
CREATE POLICY "remnants_update_policy" ON public.project_material_remnants
FOR UPDATE TO authenticated USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('supervisor')
  OR recorded_by = auth.uid()
  OR received_by = auth.uid()
);

-- ============================================================================
-- 2. COMPANY TOOLS AND EQUIPMENT REGISTER & CUSTODY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.company_tools_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General Tools',
  make_model text,
  serial_number text,
  is_bulk boolean NOT NULL DEFAULT false,
  total_quantity integer NOT NULL DEFAULT 1,
  available_quantity integer NOT NULL DEFAULT 1,
  ownership text NOT NULL DEFAULT 'company_owned' CHECK (ownership IN ('company_owned', 'rented', 'leased')),
  current_location text NOT NULL DEFAULT 'Central Store',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'in_transit', 'under_maintenance', 'missing', 'damaged', 'decommissioned')),
  current_custodian_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  physical_condition text NOT NULL DEFAULT 'good' CHECK (physical_condition IN ('good', 'fair', 'damaged', 'faulty', 'incomplete', 'missing_accessories', 'awaiting_inspection')),
  purchase_date date,
  purchase_cost numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tools_status ON public.company_tools_equipment (status);
CREATE INDEX IF NOT EXISTS idx_tools_custodian ON public.company_tools_equipment (current_custodian_id);
CREATE INDEX IF NOT EXISTS idx_tools_project ON public.company_tools_equipment (current_project_id);

ALTER TABLE public.company_tools_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tools_select_policy" ON public.company_tools_equipment;
CREATE POLICY "tools_select_policy" ON public.company_tools_equipment
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tools_insert_policy" ON public.company_tools_equipment;
CREATE POLICY "tools_insert_policy" ON public.company_tools_equipment
FOR INSERT TO authenticated WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
  OR public.auth_has_role('supervisor')
);

DROP POLICY IF EXISTS "tools_update_policy" ON public.company_tools_equipment;
CREATE POLICY "tools_update_policy" ON public.company_tools_equipment
FOR UPDATE TO authenticated USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
  OR public.auth_has_role('supervisor')
  OR current_custodian_id = auth.uid()
);

-- Tool Assignments
CREATE TABLE IF NOT EXISTS public.tool_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.company_tools_equipment(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  issued_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quantity_issued integer NOT NULL DEFAULT 1,
  issue_date timestamptz NOT NULL DEFAULT now(),
  expected_return_date date,
  condition_at_issue text NOT NULL DEFAULT 'good',
  accessories_included text,
  recipient_acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'overdue', 'lost_reported', 'damaged_reported')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_assignments_tool_id ON public.tool_assignments (tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_user_id ON public.tool_assignments (issued_to_user_id);
CREATE INDEX IF NOT EXISTS idx_tool_assignments_status ON public.tool_assignments (status);

ALTER TABLE public.tool_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_assignments_select_policy" ON public.tool_assignments;
CREATE POLICY "tool_assignments_select_policy" ON public.tool_assignments
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tool_assignments_mutate_policy" ON public.tool_assignments;
CREATE POLICY "tool_assignments_mutate_policy" ON public.tool_assignments
FOR ALL TO authenticated USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
  OR public.auth_has_role('supervisor')
  OR issued_to_user_id = auth.uid()
);

-- Tool Return Inspections
CREATE TABLE IF NOT EXISTS public.tool_return_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.tool_assignments(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.company_tools_equipment(id) ON DELETE CASCADE,
  quantity_returned integer NOT NULL DEFAULT 1,
  returned_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  return_date timestamptz NOT NULL DEFAULT now(),
  return_condition text NOT NULL DEFAULT 'good' CHECK (return_condition IN ('good', 'fair', 'damaged', 'faulty', 'incomplete', 'missing', 'awaiting_inspection')),
  missing_parts text,
  damage_notes text,
  photo_urls text[] DEFAULT '{}',
  inspection_result text NOT NULL DEFAULT 'passed' CHECK (inspection_result IN ('passed', 'flagged_for_repair', 'charge_custodian', 'quarantined', 'write_off')),
  follow_up_action text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tool_return_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_returns_select_policy" ON public.tool_return_inspections;
CREATE POLICY "tool_returns_select_policy" ON public.tool_return_inspections
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tool_returns_insert_policy" ON public.tool_return_inspections;
CREATE POLICY "tool_returns_insert_policy" ON public.tool_return_inspections
FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 3. TASK INSTRUCTIONS & HANDOVER ACCOUNTABILITY ENHANCEMENT
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'deliverable') THEN
    ALTER TABLE public.project_tasks ADD COLUMN deliverable text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'required_materials') THEN
    ALTER TABLE public.project_tasks ADD COLUMN required_materials text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'required_tools') THEN
    ALTER TABLE public.project_tasks ADD COLUMN required_tools text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'required_ppe') THEN
    ALTER TABLE public.project_tasks ADD COLUMN required_ppe text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'technical_specifications') THEN
    ALTER TABLE public.project_tasks ADD COLUMN technical_specifications text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'quality_standards') THEN
    ALTER TABLE public.project_tasks ADD COLUMN quality_standards text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'safety_instructions') THEN
    ALTER TABLE public.project_tasks ADD COLUMN safety_instructions text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'completion_evidence_required') THEN
    ALTER TABLE public.project_tasks ADD COLUMN completion_evidence_required text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'acknowledgement_status') THEN
    ALTER TABLE public.project_tasks ADD COLUMN acknowledgement_status text DEFAULT 'unacknowledged';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'acknowledged_at') THEN
    ALTER TABLE public.project_tasks ADD COLUMN acknowledged_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'clarification_notes') THEN
    ALTER TABLE public.project_tasks ADD COLUMN clarification_notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'verification_status') THEN
    ALTER TABLE public.project_tasks ADD COLUMN verification_status text DEFAULT 'pending_review';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'reviewer_id') THEN
    ALTER TABLE public.project_tasks ADD COLUMN reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'review_notes') THEN
    ALTER TABLE public.project_tasks ADD COLUMN review_notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'reviewed_at') THEN
    ALTER TABLE public.project_tasks ADD COLUMN reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_tasks' AND column_name = 'parent_task_id') THEN
    ALTER TABLE public.project_tasks ADD COLUMN parent_task_id uuid REFERENCES public.project_tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. NON-LEADERSHIP WORKFORCE LINKAGE & SECURE ATTENDANCE FUNCTIONS
-- ============================================================================

-- Function to auto-ensure a workforce_members record for an authenticated user
CREATE OR REPLACE FUNCTION public.ensure_user_workforce_member(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wf_id uuid;
  v_trade text := 'Operations Staff';
  v_code text;
  v_profile RECORD;
BEGIN
  -- Check if already exists
  SELECT id INTO v_wf_id FROM public.workforce_members WHERE profile_id = p_user_id LIMIT 1;
  IF v_wf_id IS NOT NULL THEN
    RETURN v_wf_id;
  END IF;

  -- Read profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

  -- Generate workforce code
  v_code := 'EMP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- Insert workforce member
  INSERT INTO public.workforce_members (
    workforce_code,
    trade,
    status,
    profile_id,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_code,
    coalesce(v_profile.job_title, 'Corporate Staff'),
    'active',
    p_user_id,
    'Auto-linked workforce profile for non-leadership daily attendance',
    now(),
    now()
  ) RETURNING id INTO v_wf_id;

  RETURN v_wf_id;
END;
$$;
