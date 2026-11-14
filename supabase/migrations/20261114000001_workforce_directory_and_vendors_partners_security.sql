-- ==============================================================================
-- DAVEJOE DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261114000001_workforce_directory_and_vendors_partners_security.sql
--
-- Purpose:
--   1. Seed granular permissions for Contract Workforce Directory and Vendors & Partners
--   2. Harden Row-Level Security (RLS) on existing tables:
--      - public.workforce_directory
--      - public.workforce_project_assignments
--      - public.vendors_partners
--   3. Prevent duplicate active project assignments per contract worker
--   4. Create private Supabase Storage bucket (vendor-cac-documents) & RLS policies
--   5. Attach immutable audit logging triggers for creation and modification
--
-- Uses existing authorization functions:
--   - public.auth_has_role(text)
--   - public.auth_has_permission(text)
--   - public.auth_is_active(uuid)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SEED GRANULAR PERMISSIONS (IDEMPOTENT)
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (name, module, description)
VALUES
  ('workforce_directory.view', 'workforce_directory', 'View contract workforce directory and project assignments'),
  ('workforce_directory.manage', 'workforce_directory', 'Register, edit, deactivate, and assign contract workforce to projects'),
  ('vendors_partners.view', 'vendors_partners', 'View vendors and business partners directory'),
  ('vendors_partners.manage', 'vendors_partners', 'Register, edit, and manage vendors and business partners'),
  ('vendors_partners.view_financials', 'vendors_partners', 'View sensitive vendor and partner banking details'),
  ('vendors_partners.view_documents', 'vendors_partners', 'View and download private vendor CAC certificate documents')
ON CONFLICT (name) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

-- Map permissions to Admin (full management + read)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin'
  AND p.name IN (
    'workforce_directory.view',
    'workforce_directory.manage',
    'vendors_partners.view',
    'vendors_partners.manage',
    'vendors_partners.view_financials',
    'vendors_partners.view_documents'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map read & oversight permissions to Management / CEO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'management'
  AND p.name IN (
    'workforce_directory.view',
    'workforce_directory.manage',
    'vendors_partners.view',
    'vendors_partners.manage',
    'vendors_partners.view_financials',
    'vendors_partners.view_documents'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map read & authorized financial/document visibility to Executive Director
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'executive_director'
  AND p.name IN (
    'workforce_directory.view',
    'vendors_partners.view',
    'vendors_partners.view_financials',
    'vendors_partners.view_documents'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. PREVENT DUPLICATE ACTIVE PROJECT ASSIGNMENTS & ADD HELPFUL INDEXES
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_workforce_directory_unique_active_assignment
ON public.workforce_project_assignments (workforce_id, project_id)
WHERE lower(COALESCE(assignment_status, 'active')) = 'active';

CREATE INDEX IF NOT EXISTS idx_workforce_directory_status
ON public.workforce_directory (status);

CREATE INDEX IF NOT EXISTS idx_workforce_project_assignments_workforce_id
ON public.workforce_project_assignments (workforce_id);

CREATE INDEX IF NOT EXISTS idx_workforce_project_assignments_project_id
ON public.workforce_project_assignments (project_id);

CREATE INDEX IF NOT EXISTS idx_vendors_partners_record_type_status
ON public.vendors_partners (record_type, status);

-- ------------------------------------------------------------------------------
-- 3. HARDEN RLS ON public.workforce_directory
-- ------------------------------------------------------------------------------
ALTER TABLE public.workforce_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workforce_directory_select_policy" ON public.workforce_directory;
DROP POLICY IF EXISTS "workforce_directory_insert_policy" ON public.workforce_directory;
DROP POLICY IF EXISTS "workforce_directory_update_policy" ON public.workforce_directory;
DROP POLICY IF EXISTS "workforce_directory_delete_policy" ON public.workforce_directory;

-- Admin, Management, Executive Director, or explicit workforce_directory.view/manage permission
CREATE POLICY "workforce_directory_select_policy" ON public.workforce_directory
FOR SELECT
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_role('executive_director')
    OR public.auth_has_permission('workforce_directory.view')
    OR public.auth_has_permission('workforce_directory.manage')
  )
);

-- Admin & Management (or workforce_directory.manage) can register new contract workforce
CREATE POLICY "workforce_directory_insert_policy" ON public.workforce_directory
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('workforce_directory.manage')
  )
);

-- Admin & Management (or workforce_directory.manage) can edit/deactivate contract workforce
CREATE POLICY "workforce_directory_update_policy" ON public.workforce_directory
FOR UPDATE
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('workforce_directory.manage')
  )
)
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('workforce_directory.manage')
  )
);

-- Prohibit deletion to preserve historical accountability records
CREATE POLICY "workforce_directory_delete_policy" ON public.workforce_directory
FOR DELETE
TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 4. HARDEN RLS ON public.workforce_project_assignments
-- ------------------------------------------------------------------------------
ALTER TABLE public.workforce_project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workforce_project_assignments_select_policy" ON public.workforce_project_assignments;
DROP POLICY IF EXISTS "workforce_project_assignments_insert_policy" ON public.workforce_project_assignments;
DROP POLICY IF EXISTS "workforce_project_assignments_update_policy" ON public.workforce_project_assignments;
DROP POLICY IF EXISTS "workforce_project_assignments_delete_policy" ON public.workforce_project_assignments;

CREATE POLICY "workforce_project_assignments_select_policy" ON public.workforce_project_assignments
FOR SELECT
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_role('executive_director')
    OR public.auth_has_permission('workforce_directory.view')
    OR public.auth_has_permission('workforce_directory.manage')
  )
);

CREATE POLICY "workforce_project_assignments_insert_policy" ON public.workforce_project_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('workforce_directory.manage')
  )
);

CREATE POLICY "workforce_project_assignments_update_policy" ON public.workforce_project_assignments
FOR UPDATE
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('workforce_directory.manage')
  )
)
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('workforce_directory.manage')
  )
);

-- Completed/cancelled assignments must never be deleted
CREATE POLICY "workforce_project_assignments_delete_policy" ON public.workforce_project_assignments
FOR DELETE
TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 5. HARDEN RLS ON public.vendors_partners
-- ------------------------------------------------------------------------------
ALTER TABLE public.vendors_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_partners_select_policy" ON public.vendors_partners;
DROP POLICY IF EXISTS "vendors_partners_insert_policy" ON public.vendors_partners;
DROP POLICY IF EXISTS "vendors_partners_update_policy" ON public.vendors_partners;
DROP POLICY IF EXISTS "vendors_partners_delete_policy" ON public.vendors_partners;

CREATE POLICY "vendors_partners_select_policy" ON public.vendors_partners
FOR SELECT
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_role('executive_director')
    OR public.auth_has_permission('vendors_partners.view')
    OR public.auth_has_permission('vendors_partners.manage')
  )
);

CREATE POLICY "vendors_partners_insert_policy" ON public.vendors_partners
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('vendors_partners.manage')
  )
);

CREATE POLICY "vendors_partners_update_policy" ON public.vendors_partners
FOR UPDATE
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('vendors_partners.manage')
  )
)
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('vendors_partners.manage')
  )
);

-- Prohibit deletion to preserve historical vendor/partner & financial evidence
CREATE POLICY "vendors_partners_delete_policy" ON public.vendors_partners
FOR DELETE
TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 6. PRIVATE SUPABASE STORAGE BUCKET FOR CAC CERTIFICATES
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-cac-documents',
  'vendor-cac-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "cac_docs_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "cac_docs_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "cac_docs_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "cac_docs_delete_policy" ON storage.objects;

-- Restricted download / signed URL access for authorized users only
CREATE POLICY "cac_docs_select_policy" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vendor-cac-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_role('executive_director')
    OR public.auth_has_permission('vendors_partners.view_documents')
  )
);

-- Upload restricted to Admin, Management, or vendors_partners.manage
CREATE POLICY "cac_docs_insert_policy" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-cac-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('vendors_partners.manage')
  )
);

CREATE POLICY "cac_docs_update_policy" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendor-cac-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
    OR public.auth_has_permission('vendors_partners.manage')
  )
);

CREATE POLICY "cac_docs_delete_policy" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendor-cac-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('admin')
    OR public.auth_has_role('management')
  )
);

-- ------------------------------------------------------------------------------
-- 7. IMMUTABLE DATABASE-LEVEL AUDIT TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_directory_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_module text;
  v_old jsonb;
  v_new jsonb;
BEGIN
  v_module := CASE TG_TABLE_NAME
    WHEN 'workforce_directory' THEN 'workforce_directory'
    WHEN 'workforce_project_assignments' THEN 'workforce_directory'
    WHEN 'vendors_partners' THEN 'vendors_partners'
    ELSE 'directory'
  END;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    -- Mask full bank account number in audit snapshots for data protection
    IF v_old ? 'account_number' AND length(COALESCE(v_old->>'account_number', '')) > 4 THEN
      v_old := jsonb_set(v_old, '{account_number}', to_jsonb('******' || right(v_old->>'account_number', 4)));
    END IF;
    IF v_new ? 'account_number' AND length(COALESCE(v_new->>'account_number', '')) > 4 THEN
      v_new := jsonb_set(v_new, '{account_number}', to_jsonb('******' || right(v_new->>'account_number', 4)));
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    IF v_new ? 'account_number' AND length(COALESCE(v_new->>'account_number', '')) > 4 THEN
      v_new := jsonb_set(v_new, '{account_number}', to_jsonb('******' || right(v_new->>'account_number', 4)));
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    module,
    table_name,
    record_id,
    old_values,
    new_values
  ) VALUES (
    auth.uid(),
    TG_OP || '_' || upper(TG_TABLE_NAME),
    v_module,
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW)->>'id'), (to_jsonb(OLD)->>'id')),
    v_old,
    v_new
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_workforce_directory ON public.workforce_directory;
CREATE TRIGGER trg_audit_workforce_directory
AFTER INSERT OR UPDATE ON public.workforce_directory
FOR EACH ROW EXECUTE FUNCTION public.audit_directory_changes();

DROP TRIGGER IF EXISTS trg_audit_workforce_project_assignments ON public.workforce_project_assignments;
CREATE TRIGGER trg_audit_workforce_project_assignments
AFTER INSERT OR UPDATE ON public.workforce_project_assignments
FOR EACH ROW EXECUTE FUNCTION public.audit_directory_changes();

DROP TRIGGER IF EXISTS trg_audit_vendors_partners ON public.vendors_partners;
CREATE TRIGGER trg_audit_vendors_partners
AFTER INSERT OR UPDATE ON public.vendors_partners
FOR EACH ROW EXECUTE FUNCTION public.audit_directory_changes();

COMMIT;
