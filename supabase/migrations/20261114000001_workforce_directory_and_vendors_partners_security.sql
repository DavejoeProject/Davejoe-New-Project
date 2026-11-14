-- ==============================================================================
-- DAVEJOE DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261114000001_workforce_directory_and_vendors_partners_security.sql
--
-- Purpose:
--   1. Reuse existing Workforce permissions (View/Create/Update/Assign Workforce)
--      without creating duplicates, and add protected Workforce Banking +
--      Vendors & Partners permissions idempotently.
--   2. Map permissions to admin, management, and executive_director roles
--      (preserving supervisor and technical restrictions).
--   3. Harden RLS + column-level protection + server-side SECURITY DEFINER RPCs
--      for banking and next-of-kin details on:
--        - public.workforce_directory
--        - public.workforce_project_assignments
--        - public.vendors_partners
--   4. Enforce trusted server-side created_by / updated_by / assigned_by triggers.
--   5. Prevent duplicate active project assignments per contract worker.
--   6. Create or reuse private Supabase Storage bucket 'vendor-documents' & RLS.
--   7. Attach immutable audit logging triggers with masked account numbers.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PERMISSIONS (REUSE EXISTING WORKFORCE PERMISSIONS; ADD MISSING SAFELY)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Helper upsert-without-duplicates for new permissions only
  -- Workforce Banking (separated from basic View Workforce so Supervisors/QC do not see bank details)
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = 'workforce.banking.view'
       OR lower(name) = 'view workforce banking'
       OR (module = 'workforce' AND action = 'banking.view')
  ) THEN
    INSERT INTO public.permissions (name, code, module, action, description)
    VALUES (
      'View Workforce Banking',
      'workforce.banking.view',
      'workforce',
      'banking.view',
      'View sensitive banking and next-of-kin details in Contract Workforce Directory'
    );
  END IF;

  -- Vendors & Partners: View
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = 'vendors.view'
       OR lower(name) IN ('view vendors', 'vendors.view')
       OR (module = 'vendors_partners' AND action = 'view')
  ) THEN
    INSERT INTO public.permissions (name, code, module, action, description)
    VALUES (
      'View Vendors',
      'vendors.view',
      'vendors_partners',
      'view',
      'View vendors and business partners directory'
    );
  END IF;

  -- Vendors & Partners: Create
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = 'vendors.create'
       OR lower(name) IN ('create vendors', 'vendors.create')
       OR (module = 'vendors_partners' AND action = 'create')
  ) THEN
    INSERT INTO public.permissions (name, code, module, action, description)
    VALUES (
      'Create Vendors',
      'vendors.create',
      'vendors_partners',
      'create',
      'Register new vendors and business partners'
    );
  END IF;

  -- Vendors & Partners: Update
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = 'vendors.update'
       OR lower(name) IN ('update vendors', 'vendors.update')
       OR (module = 'vendors_partners' AND action = 'update')
  ) THEN
    INSERT INTO public.permissions (name, code, module, action, description)
    VALUES (
      'Update Vendors',
      'vendors.update',
      'vendors_partners',
      'update',
      'Edit vendor and partner profiles and status'
    );
  END IF;

  -- Vendors & Partners: View CAC Documents
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = 'vendors.documents.view'
       OR lower(name) IN ('view vendor documents', 'vendors.documents.view')
       OR (module = 'vendors_partners' AND action = 'documents.view')
  ) THEN
    INSERT INTO public.permissions (name, code, module, action, description)
    VALUES (
      'View Vendor Documents',
      'vendors.documents.view',
      'vendors_partners',
      'documents.view',
      'View and download private vendor CAC registration certificates'
    );
  END IF;

  -- Vendors & Partners: View Banking Details
  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = 'vendors.banking.view'
       OR lower(name) IN ('view vendor banking', 'vendors.banking.view')
       OR (module = 'vendors_partners' AND action = 'banking.view')
  ) THEN
    INSERT INTO public.permissions (name, code, module, action, description)
    VALUES (
      'View Vendor Banking',
      'vendors.banking.view',
      'vendors_partners',
      'banking.view',
      'View sensitive vendor and partner settlement banking details'
    );
  END IF;
END $$;

-- Grant Workforce & Vendors permissions to Admin and Management
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.slug) IN ('admin', 'management')
  AND (
    lower(COALESCE(p.code, '')) IN (
      'workforce.view',
      'workforce.create',
      'workforce.update',
      'workforce.assign',
      'workforce.banking.view',
      'vendors.view',
      'vendors.create',
      'vendors.update',
      'vendors.documents.view',
      'vendors.banking.view'
    )
    OR lower(p.name) IN (
      'view workforce',
      'create workforce',
      'update workforce',
      'assign workforce',
      'view workforce banking',
      'view vendors',
      'create vendors',
      'update vendors',
      'view vendor documents',
      'view vendor banking'
    )
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant explicit read + banking + document oversight permissions to Executive Director
-- (Does NOT grant Create/Update/Assign automatically unless configured in Roles & Permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.slug) = 'executive_director'
  AND (
    lower(COALESCE(p.code, '')) IN (
      'workforce.view',
      'workforce.banking.view',
      'vendors.view',
      'vendors.documents.view',
      'vendors.banking.view'
    )
    OR lower(p.name) IN (
      'view workforce',
      'view workforce banking',
      'view vendors',
      'view vendor documents',
      'view vendor banking'
    )
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. INDEXES & DUPLICATE ACTIVE PROJECT ASSIGNMENT GUARD
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
-- 3. TRUSTED SERVER-SIDE IDENTITY TRIGGERS (created_by, updated_by, assigned_by)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_directory_actor_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME IN ('workforce_directory', 'vendors_partners') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
      NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.created_by := OLD.created_by;
      NEW.updated_by := COALESCE(auth.uid(), OLD.updated_by);
      NEW.updated_at := now();
    END IF;
  ELSIF TG_TABLE_NAME = 'workforce_project_assignments' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.assigned_by := COALESCE(auth.uid(), NEW.assigned_by);
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.assigned_by := OLD.assigned_by;
      NEW.updated_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_identity_workforce_directory ON public.workforce_directory;
CREATE TRIGGER trg_identity_workforce_directory
BEFORE INSERT OR UPDATE ON public.workforce_directory
FOR EACH ROW EXECUTE FUNCTION public.enforce_directory_actor_identity();

DROP TRIGGER IF EXISTS trg_identity_vendors_partners ON public.vendors_partners;
CREATE TRIGGER trg_identity_vendors_partners
BEFORE INSERT OR UPDATE ON public.vendors_partners
FOR EACH ROW EXECUTE FUNCTION public.enforce_directory_actor_identity();

DROP TRIGGER IF EXISTS trg_identity_workforce_assignments ON public.workforce_project_assignments;
CREATE TRIGGER trg_identity_workforce_assignments
BEFORE INSERT OR UPDATE ON public.workforce_project_assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_directory_actor_identity();

-- ------------------------------------------------------------------------------
-- 4. COLUMN-LEVEL PROTECTION & RLS ON public.workforce_directory
-- ------------------------------------------------------------------------------
ALTER TABLE public.workforce_directory ENABLE ROW LEVEL SECURITY;

-- Protect sensitive banking & next-of-kin columns from broad SELECT queries
REVOKE ALL PRIVILEGES ON TABLE public.workforce_directory FROM anon, authenticated;
GRANT SELECT (
  id,
  full_name,
  address,
  phone_number,
  status,
  registration_notes,
  created_by,
  updated_by,
  created_at,
  updated_at
) ON public.workforce_directory TO authenticated;

GRANT INSERT (
  full_name,
  address,
  phone_number,
  next_of_kin,
  next_of_kin_phone,
  bank_name,
  account_name,
  account_number,
  status,
  registration_notes
) ON public.workforce_directory TO authenticated;

GRANT UPDATE (
  full_name,
  address,
  phone_number,
  next_of_kin,
  next_of_kin_phone,
  bank_name,
  account_name,
  account_number,
  status,
  registration_notes,
  updated_at
) ON public.workforce_directory TO authenticated;

DROP POLICY IF EXISTS "workforce_directory_select_policy" ON public.workforce_directory;
DROP POLICY IF EXISTS "workforce_directory_insert_policy" ON public.workforce_directory;
DROP POLICY IF EXISTS "workforce_directory_update_policy" ON public.workforce_directory;
DROP POLICY IF EXISTS "workforce_directory_delete_policy" ON public.workforce_directory;

CREATE POLICY "workforce_directory_select_policy" ON public.workforce_directory
FOR SELECT
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('View Workforce')
    OR public.auth_has_permission('workforce.view')
    OR public.auth_has_permission('Create Workforce')
    OR public.auth_has_permission('workforce.create')
    OR public.auth_has_permission('Update Workforce')
    OR public.auth_has_permission('workforce.update')
    OR public.auth_has_permission('Assign Workforce')
    OR public.auth_has_permission('workforce.assign')
  )
);

CREATE POLICY "workforce_directory_insert_policy" ON public.workforce_directory
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Create Workforce')
    OR public.auth_has_permission('workforce.create')
  )
);

CREATE POLICY "workforce_directory_update_policy" ON public.workforce_directory
FOR UPDATE
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Update Workforce')
    OR public.auth_has_permission('workforce.update')
  )
)
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Update Workforce')
    OR public.auth_has_permission('workforce.update')
  )
);

-- Prohibit deletion to preserve historical accountability
CREATE POLICY "workforce_directory_delete_policy" ON public.workforce_directory
FOR DELETE
TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 5. HARDEN RLS ON public.workforce_project_assignments
-- ------------------------------------------------------------------------------
ALTER TABLE public.workforce_project_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.workforce_project_assignments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.workforce_project_assignments TO authenticated;

DROP POLICY IF EXISTS "workforce_project_assignments_select_policy" ON public.workforce_project_assignments;
DROP POLICY IF EXISTS "workforce_project_assignments_insert_policy" ON public.workforce_project_assignments;
DROP POLICY IF EXISTS "workforce_project_assignments_update_policy" ON public.workforce_project_assignments;
DROP POLICY IF EXISTS "workforce_project_assignments_delete_policy" ON public.workforce_project_assignments;

CREATE POLICY "workforce_project_assignments_select_policy" ON public.workforce_project_assignments
FOR SELECT
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('View Workforce')
    OR public.auth_has_permission('workforce.view')
    OR public.auth_has_permission('Assign Workforce')
    OR public.auth_has_permission('workforce.assign')
  )
);

CREATE POLICY "workforce_project_assignments_insert_policy" ON public.workforce_project_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Assign Workforce')
    OR public.auth_has_permission('workforce.assign')
  )
);

CREATE POLICY "workforce_project_assignments_update_policy" ON public.workforce_project_assignments
FOR UPDATE
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Assign Workforce')
    OR public.auth_has_permission('workforce.assign')
  )
)
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Assign Workforce')
    OR public.auth_has_permission('workforce.assign')
  )
);

CREATE POLICY "workforce_project_assignments_delete_policy" ON public.workforce_project_assignments
FOR DELETE
TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 6. COLUMN-LEVEL PROTECTION & RLS ON public.vendors_partners
-- ------------------------------------------------------------------------------
ALTER TABLE public.vendors_partners ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.vendors_partners FROM anon, authenticated;
GRANT SELECT (
  id,
  full_name,
  business_name,
  email_address,
  phone_number,
  record_type,
  cac_certificate_path,
  status,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
) ON public.vendors_partners TO authenticated;

GRANT INSERT (
  full_name,
  business_name,
  email_address,
  phone_number,
  next_of_kin,
  next_of_kin_phone,
  bank_name,
  account_name,
  account_number,
  record_type,
  cac_certificate_path,
  status,
  notes
) ON public.vendors_partners TO authenticated;

GRANT UPDATE (
  full_name,
  business_name,
  email_address,
  phone_number,
  next_of_kin,
  next_of_kin_phone,
  bank_name,
  account_name,
  account_number,
  record_type,
  cac_certificate_path,
  status,
  notes,
  updated_at
) ON public.vendors_partners TO authenticated;

DROP POLICY IF EXISTS "vendors_partners_select_policy" ON public.vendors_partners;
DROP POLICY IF EXISTS "vendors_partners_insert_policy" ON public.vendors_partners;
DROP POLICY IF EXISTS "vendors_partners_update_policy" ON public.vendors_partners;
DROP POLICY IF EXISTS "vendors_partners_delete_policy" ON public.vendors_partners;

CREATE POLICY "vendors_partners_select_policy" ON public.vendors_partners
FOR SELECT
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('View Vendors')
    OR public.auth_has_permission('vendors.view')
    OR public.auth_has_permission('Create Vendors')
    OR public.auth_has_permission('vendors.create')
    OR public.auth_has_permission('Update Vendors')
    OR public.auth_has_permission('vendors.update')
  )
);

CREATE POLICY "vendors_partners_insert_policy" ON public.vendors_partners
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Create Vendors')
    OR public.auth_has_permission('vendors.create')
  )
);

CREATE POLICY "vendors_partners_update_policy" ON public.vendors_partners
FOR UPDATE
TO authenticated
USING (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Update Vendors')
    OR public.auth_has_permission('vendors.update')
  )
)
WITH CHECK (
  public.auth_is_active(auth.uid()) AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Update Vendors')
    OR public.auth_has_permission('vendors.update')
  )
);

CREATE POLICY "vendors_partners_delete_policy" ON public.vendors_partners
FOR DELETE
TO authenticated
USING (false);

-- ------------------------------------------------------------------------------
-- 7. SERVER-SIDE SECURITY DEFINER RPCs FOR BANKING & NEXT-OF-KIN FIELDS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_workforce_protected_details(p_workforce_id uuid)
RETURNS TABLE (
  workforce_id uuid,
  next_of_kin text,
  next_of_kin_phone text,
  bank_name text,
  account_name text,
  account_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_is_active(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: active session required.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('View Workforce Banking')
    OR public.auth_has_permission('workforce.banking.view')
    OR public.auth_has_permission('Create Workforce')
    OR public.auth_has_permission('workforce.create')
    OR public.auth_has_permission('Update Workforce')
    OR public.auth_has_permission('workforce.update')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to access protected workforce banking and next-of-kin details.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    wd.id,
    wd.next_of_kin,
    wd.next_of_kin_phone,
    wd.bank_name,
    wd.account_name,
    wd.account_number
  FROM public.workforce_directory wd
  WHERE wd.id = p_workforce_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workforce_protected_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_workforce_protected_details(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_vendor_protected_details(p_vendor_id uuid)
RETURNS TABLE (
  vendor_id uuid,
  next_of_kin text,
  next_of_kin_phone text,
  bank_name text,
  account_name text,
  account_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.auth_is_active(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: active session required.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('View Vendor Banking')
    OR public.auth_has_permission('vendors.banking.view')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to access vendor/partner banking and next-of-kin details.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    vp.id,
    vp.next_of_kin,
    vp.next_of_kin_phone,
    vp.bank_name,
    vp.account_name,
    vp.account_number
  FROM public.vendors_partners vp
  WHERE vp.id = p_vendor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vendor_protected_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_vendor_protected_details(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. PRIVATE SUPABASE STORAGE BUCKET 'vendor-documents' & POLICIES
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-documents',
  'vendor-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "vendor_documents_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "vendor_documents_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "vendor_documents_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "vendor_documents_delete_policy" ON storage.objects;

CREATE POLICY "vendor_documents_select_policy" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vendor-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('View Vendor Documents')
    OR public.auth_has_permission('vendors.documents.view')
  )
);

CREATE POLICY "vendor_documents_insert_policy" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Create Vendors')
    OR public.auth_has_permission('Update Vendors')
    OR public.auth_has_permission('vendors.create')
    OR public.auth_has_permission('vendors.update')
  )
);

CREATE POLICY "vendor_documents_update_policy" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendor-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
    OR public.auth_has_permission('Update Vendors')
    OR public.auth_has_permission('vendors.update')
  )
);

CREATE POLICY "vendor_documents_delete_policy" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendor-documents'
  AND public.auth_is_active(auth.uid())
  AND (
    public.auth_has_role('management')
    OR public.auth_has_role('admin')
  )
);

-- ------------------------------------------------------------------------------
-- 9. IMMUTABLE DATABASE-LEVEL AUDIT TRIGGERS
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
