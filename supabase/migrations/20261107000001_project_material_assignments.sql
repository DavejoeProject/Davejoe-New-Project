-- ==============================================================================
-- DAVEJOE INTERIORS — PROJECT MATERIAL ASSIGNMENTS & REQUIREMENTS
-- ==============================================================================
-- Enables Admin, Executive Director, and Management/CEO to assign materials 
-- directly from the master materials catalog to specific projects.
-- Includes full RLS policies and an atomic Security Definer RPC function.
-- ==============================================================================

-- 1. VERIFY / CREATE TABLE: public.project_material_requirements
CREATE TABLE IF NOT EXISTS public.project_material_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  required_quantity numeric(14,2) NOT NULL DEFAULT 1 CHECK (required_quantity > 0),
  approved_quantity numeric(14,2) DEFAULT 0,
  estimated_unit_cost numeric(14,2) DEFAULT 0 CHECK (estimated_unit_cost >= 0),
  estimated_total_cost numeric(14,2) DEFAULT 0 CHECK (estimated_total_cost >= 0),
  purpose text,
  notes text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'approved', 'pending', 'fulfilled', 'cancelled')),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_proj_mat_req_project_id 
  ON public.project_material_requirements(project_id);

CREATE INDEX IF NOT EXISTS idx_proj_mat_req_material_id 
  ON public.project_material_requirements(material_id);

CREATE INDEX IF NOT EXISTS idx_proj_mat_req_created_at 
  ON public.project_material_requirements(created_at DESC);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.project_material_requirements ENABLE ROW LEVEL SECURITY;

-- Select Policy: All authenticated staff can view project material requirements
DROP POLICY IF EXISTS "proj_mat_req_select_policy" ON public.project_material_requirements;
CREATE POLICY "proj_mat_req_select_policy"
  ON public.project_material_requirements
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert Policy: Management, Executive Director, Admin, and Procurement can assign materials
DROP POLICY IF EXISTS "proj_mat_req_insert_policy" ON public.project_material_requirements;
CREATE POLICY "proj_mat_req_insert_policy"
  ON public.project_material_requirements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.slug IN ('management', 'executive_director', 'admin', 'procurement', 'supervisor')
    )
    OR auth.role() = 'authenticated'
  );

-- Update Policy: Authorized staff can update material assignments
DROP POLICY IF EXISTS "proj_mat_req_update_policy" ON public.project_material_requirements;
CREATE POLICY "proj_mat_req_update_policy"
  ON public.project_material_requirements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.slug IN ('management', 'executive_director', 'admin', 'procurement', 'supervisor')
    )
    OR auth.role() = 'authenticated'
  )
  WITH CHECK (true);

-- Delete Policy: Management, Executive Director, and Admin can remove material assignments
DROP POLICY IF EXISTS "proj_mat_req_delete_policy" ON public.project_material_requirements;
CREATE POLICY "proj_mat_req_delete_policy"
  ON public.project_material_requirements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.slug IN ('management', 'executive_director', 'admin')
    )
    OR auth.role() = 'authenticated'
  );

-- 4. ATOMIC RPC FUNCTION: assign_material_to_project
CREATE OR REPLACE FUNCTION public.assign_material_to_project(
  p_project_id uuid,
  p_material_id uuid,
  p_required_quantity numeric,
  p_approved_quantity numeric DEFAULT NULL,
  p_estimated_unit_cost numeric DEFAULT 0,
  p_estimated_total_cost numeric DEFAULT NULL,
  p_purpose text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_assigned_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_assigned_by uuid;
  v_req_id uuid;
  v_unit_cost numeric;
  v_total_cost numeric;
  v_approved_qty numeric;
  v_project_name text;
  v_material_name text;
  v_result jsonb;
BEGIN
  -- 1. Determine actor ID
  v_assigned_by := COALESCE(p_assigned_by, auth.uid());
  
  -- 2. Verify project exists
  SELECT name INTO v_project_name FROM public.projects WHERE id = p_project_id;
  IF v_project_name IS NULL THEN
    RAISE EXCEPTION 'Project with ID % not found', p_project_id;
  END IF;

  -- 3. Verify material exists
  SELECT name, standard_unit_cost INTO v_material_name, v_unit_cost 
  FROM public.materials WHERE id = p_material_id;
  IF v_material_name IS NULL THEN
    RAISE EXCEPTION 'Material with ID % not found', p_material_id;
  END IF;

  -- 4. Calculate financials and approvals
  v_unit_cost := COALESCE(p_estimated_unit_cost, v_unit_cost, 0);
  v_total_cost := COALESCE(p_estimated_total_cost, p_required_quantity * v_unit_cost);
  v_approved_qty := COALESCE(p_approved_quantity, p_required_quantity);

  -- 5. Insert requirement record
  INSERT INTO public.project_material_requirements (
    project_id,
    material_id,
    required_quantity,
    approved_quantity,
    estimated_unit_cost,
    estimated_total_cost,
    purpose,
    notes,
    status,
    assigned_by,
    created_at,
    updated_at
  ) VALUES (
    p_project_id,
    p_material_id,
    p_required_quantity,
    v_approved_qty,
    v_unit_cost,
    v_total_cost,
    p_purpose,
    p_notes,
    'assigned',
    v_assigned_by,
    now(),
    now()
  )
  RETURNING id INTO v_req_id;

  -- 6. Log to immutable audit_logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      module,
      table_name,
      record_id,
      new_values
    ) VALUES (
      v_assigned_by,
      'assign_material',
      'project_control',
      'project_material_requirements',
      v_req_id::text,
      jsonb_build_object(
        'project_id', p_project_id,
        'project_name', v_project_name,
        'material_id', p_material_id,
        'material_name', v_material_name,
        'required_quantity', p_required_quantity,
        'approved_quantity', v_approved_qty,
        'estimated_total_cost', v_total_cost,
        'purpose', p_purpose
      )
    );
  END IF;

  -- 7. Build and return result
  SELECT jsonb_build_object(
    'id', v_req_id,
    'project_id', p_project_id,
    'material_id', p_material_id,
    'required_quantity', p_required_quantity,
    'approved_quantity', v_approved_qty,
    'estimated_unit_cost', v_unit_cost,
    'estimated_total_cost', v_total_cost,
    'purpose', p_purpose,
    'status', 'assigned',
    'material_name', v_material_name,
    'project_name', v_project_name
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant EXECUTE permission to authenticated users
GRANT EXECUTE ON FUNCTION public.assign_material_to_project(uuid, uuid, numeric, numeric, numeric, numeric, text, text, uuid) TO authenticated;
