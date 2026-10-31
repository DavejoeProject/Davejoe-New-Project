-- Migration: 20261031000001_project_projections_and_planning.sql
-- Description: Modules D, E, F, G: Project Projection, Cost Estimation,
-- Multi-Role Planning Contributions, Client Proposal Generation, and Idempotent Project Conversion.

-- ============================================================================
-- 1. PROJECT PROJECTIONS (Master Estimates & Scoping)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_number text UNIQUE NOT NULL,
  title text NOT NULL,
  proposed_project_name text NOT NULL,
  client_name text NOT NULL,
  client_email text,
  client_phone text,
  client_address text,
  site_location text,
  scope_of_work text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'client_review', 'approved', 'converted', 'rejected', 'archived')),
  total_material_cost numeric NOT NULL DEFAULT 0,
  total_labour_cost numeric NOT NULL DEFAULT 0,
  total_logistics_cost numeric NOT NULL DEFAULT 0,
  contingency_percentage numeric NOT NULL DEFAULT 5,
  contingency_amount numeric NOT NULL DEFAULT 0,
  estimated_grand_total numeric NOT NULL DEFAULT 0,
  target_duration_weeks integer DEFAULT 4,
  target_start_date date,
  target_completion_date date,
  converted_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  converted_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projections_status ON public.project_projections (status);
CREATE INDEX IF NOT EXISTS idx_projections_converted ON public.project_projections (converted_project_id);
CREATE INDEX IF NOT EXISTS idx_projections_created_at ON public.project_projections (created_at DESC);

-- ============================================================================
-- 2. PROJECTION LINE ITEMS (Detailed Bill of Quantities / Cost breakdown)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projection_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id uuid NOT NULL REFERENCES public.project_projections(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('materials', 'labour', 'equipment_hire', 'logistics', 'preliminaries', 'subcontractor', 'contingency', 'other')),
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  item_description text NOT NULL,
  specification text,
  unit_of_measure text NOT NULL DEFAULT 'units',
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_items_projection_id ON public.projection_line_items (projection_id);
CREATE INDEX IF NOT EXISTS idx_line_items_category ON public.projection_line_items (category);
CREATE INDEX IF NOT EXISTS idx_line_items_material_id ON public.projection_line_items (material_id);

-- ============================================================================
-- 3. PROJECTION CONTRIBUTIONS (Multi-Role Expert Input without Master Override)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projection_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id uuid NOT NULL REFERENCES public.project_projections(id) ON DELETE CASCADE,
  invited_role text NOT NULL CHECK (invited_role IN ('supervisor', 'technical', 'procurement', 'accounts', 'artisan')),
  invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  instructions text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'submitted', 'incorporated', 'rejected')),
  findings text,
  suggested_line_items jsonb DEFAULT '[]'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributions_projection ON public.projection_contributions (projection_id);
CREATE INDEX IF NOT EXISTS idx_contributions_invited_user ON public.projection_contributions (invited_user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_role ON public.projection_contributions (invited_role);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.project_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projection_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projection_contributions ENABLE ROW LEVEL SECURITY;

-- Projections RLS
DROP POLICY IF EXISTS "projections_read_policy" ON public.project_projections;
CREATE POLICY "projections_read_policy" ON public.project_projections
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projections_insert_policy" ON public.project_projections;
CREATE POLICY "projections_insert_policy" ON public.project_projections
FOR INSERT TO authenticated WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('technical')
);

DROP POLICY IF EXISTS "projections_update_policy" ON public.project_projections;
CREATE POLICY "projections_update_policy" ON public.project_projections
FOR UPDATE TO authenticated USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR created_by = auth.uid()
);

-- Line Items RLS
DROP POLICY IF EXISTS "line_items_read_policy" ON public.projection_line_items;
CREATE POLICY "line_items_read_policy" ON public.projection_line_items
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "line_items_manage_policy" ON public.projection_line_items;
CREATE POLICY "line_items_manage_policy" ON public.projection_line_items
FOR ALL TO authenticated USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('technical')
);

-- Contributions RLS
DROP POLICY IF EXISTS "contributions_read_policy" ON public.projection_contributions;
CREATE POLICY "contributions_read_policy" ON public.projection_contributions
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "contributions_insert_policy" ON public.projection_contributions;
CREATE POLICY "contributions_insert_policy" ON public.projection_contributions
FOR INSERT TO authenticated WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('technical')
);

DROP POLICY IF EXISTS "contributions_update_policy" ON public.projection_contributions;
CREATE POLICY "contributions_update_policy" ON public.projection_contributions
FOR UPDATE TO authenticated USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR invited_user_id = auth.uid()
  OR created_by = auth.uid()
);

-- ============================================================================
-- 5. AUDIT TRAIL INTEGRATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_projection_changes()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (
    entity_name,
    entity_id,
    action,
    performed_by,
    details,
    created_at
  ) VALUES (
    'project_projections',
    NEW.id,
    TG_OP,
    auth.uid(),
    jsonb_build_object(
      'projection_number', NEW.projection_number,
      'status', NEW.status,
      'estimated_grand_total', NEW.estimated_grand_total,
      'title', NEW.title
    ),
    now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_projections ON public.project_projections;
CREATE TRIGGER trg_audit_projections
AFTER INSERT OR UPDATE ON public.project_projections
FOR EACH ROW EXECUTE FUNCTION public.audit_projection_changes();
