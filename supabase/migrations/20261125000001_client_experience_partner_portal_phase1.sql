-- ==============================================================================
-- DAVEJOE INTERIORS — DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261125000001_client_experience_partner_portal_phase1.sql
--
-- PHASE 1: UNIFIED CLIENT EXPERIENCE & PROJECT PARTNER PORTAL
--
-- Design Guarantees:
--   1. Additive-only migration — preserves all existing tables, all 9 existing
--      staff roles, and all existing permissions/RLS policies.
--   2. Reuses Supabase Auth (auth.users), public.profiles, public.roles,
--      public.user_roles, public.clients, public.projects,
--      public.technical_inspections, public.job_completion_photos, and
--      public.audit_logs.
--   3. Enforces strict project-level and contact-authority-level RLS so no
--      client can ever access another client's data or act outside granted
--      authority, and subcontract pricing is never exposed to unauthorized owners.
--   4. Protects confidential Management complaints so a Site Supervisor named
--      in a complaint cannot view, control, or close that complaint.
--   5. Locks approved quotations and approved specifications from silent edits
--      (requiring new versioned records).
--   6. Architected cleanly for Phase 2 (work packages, RFIs, payment apps,
--      document registers, aftercare, notifications, executive analytics).
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. ROLE & GRANULAR PERMISSIONS (ADDITIVE, PRESERVING ALL 9 EXISTING ROLES)
-- ------------------------------------------------------------------------------
INSERT INTO public.roles (name, slug, description)
SELECT
  'Client / Project Partner',
  'client_partner',
  'Authorized residential, diaspora, corporate client, main contractor, or project partner portal user'
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE lower(slug) = 'client_partner'
);

DO $$
DECLARE
  v_perm RECORD;
BEGIN
  FOR v_perm IN
    SELECT * FROM (VALUES
      ('View Client Portal', 'client_portal.view', 'client_portal', 'view', 'View client portal accounts, project protection records, and client interactions'),
      ('Manage Client Accounts', 'client_portal.manage', 'client_portal', 'manage', 'Create and edit client accounts, contacts, quotations, briefs, and weekly summaries'),
      ('Invite Client Contacts', 'client_portal.invite', 'client_portal', 'invite', 'Issue, monitor, and revoke secure client portal invitations and project access'),
      ('Verify Area Completions & Surface QC', 'client_portal.qc_verify', 'client_portal', 'qc_verify', 'Record pre-work surface inspections, verify area completions, and assess subsequent damage'),
      ('Approve Internal Variations', 'client_portal.variations_approve', 'client_portal', 'variations_approve', 'Grant internal commercial approval for chargeable project variations'),
      ('Manage Confidential Complaints', 'client_portal.complaints_confidential', 'client_portal', 'complaints_confidential', 'View and resolve confidential Management-escalated client complaints')
    ) AS t(name, code, module, action, description)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.permissions
      WHERE code = v_perm.code
         OR lower(name) = lower(v_perm.name)
         OR (module = v_perm.module AND action = v_perm.action)
    ) THEN
      INSERT INTO public.permissions (name, code, module, action, description)
      VALUES (v_perm.name, v_perm.code, v_perm.module, v_perm.action, v_perm.description);
    END IF;
  END LOOP;
END $$;

-- Management & Executive Director get all client portal governance permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.slug) IN ('management', 'executive_director')
  AND p.code IN (
    'client_portal.view',
    'client_portal.manage',
    'client_portal.invite',
    'client_portal.qc_verify',
    'client_portal.variations_approve',
    'client_portal.complaints_confidential'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  )
ON CONFLICT DO NOTHING;

-- Admin gets client account, contact, invitation, and operational coordination permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.slug) = 'admin'
  AND p.code IN (
    'client_portal.view',
    'client_portal.manage',
    'client_portal.invite'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  )
ON CONFLICT DO NOTHING;

-- Technical / QC gets view + QC verification permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.slug) = 'technical'
  AND p.code IN (
    'client_portal.view',
    'client_portal.qc_verify'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  )
ON CONFLICT DO NOTHING;

-- Site Supervisor & Accounts get operational view access scoped to assigned projects
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.slug) IN ('supervisor', 'accounts')
  AND p.code IN ('client_portal.view')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  )
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. ADDITIVE EXTENSIONS TO EXISTING TABLES (clients, projects)
--    NOTE: job_completion_photos is extended in Section 9B AFTER
--    public.project_area_completions is created so its area_completion_id FK
--    validates cleanly against public.project_area_completions(id).
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS contact_person text,
      ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'individual'
        CHECK (account_type IN ('individual', 'corporate', 'main_contractor', 'subcontract_partner', 'diaspora_remote')),
      ADD COLUMN IF NOT EXISTS company_name text,
      ADD COLUMN IF NOT EXISTS rc_number text,
      ADD COLUMN IF NOT EXISTS billing_address text,
      ADD COLUMN IF NOT EXISTS country text DEFAULT 'Nigeria',
      ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Lagos',
      ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'portal',
      ADD COLUMN IF NOT EXISTS official_account_manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS notes text,
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects
      ADD COLUMN IF NOT EXISTS project_delivery_model text DEFAULT 'direct_residential'
        CHECK (project_delivery_model IN ('direct_residential', 'diaspora_remote', 'direct_corporate', 'main_contractor_subcontract', 'multi_party_commercial')),
      ADD COLUMN IF NOT EXISTS client_visible_stage text,
      ADD COLUMN IF NOT EXISTS verified_progress_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (verified_progress_pct >= 0 AND verified_progress_pct <= 100),
      ADD COLUMN IF NOT EXISTS official_contact_name text,
      ADD COLUMN IF NOT EXISTS official_contact_phone text,
      ADD COLUMN IF NOT EXISTS official_contact_email text,
      ADD COLUMN IF NOT EXISTS contract_reference text;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. CORE CLIENT ACCOUNTS, CONTACTS, PROJECT ACCESS & SECURE INVITATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  designation text, -- e.g. Homeowner, Interior Designer, Quantity Surveyor, Corporate Rep, Project Manager
  organization_name text,
  party_role text NOT NULL DEFAULT 'owner'
    CHECK (party_role IN ('owner', 'diaspora_owner', 'corporate_client', 'main_contractor', 'subcontractor', 'consultant', 'designer', 'quantity_surveyor', 'project_manager', 'local_representative')),
  timezone text DEFAULT 'Africa/Lagos',
  is_primary_contact boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, email)
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client_id ON public.client_contacts (client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_user_id ON public.client_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON public.client_contacts (lower(email));

CREATE TABLE IF NOT EXISTS public.client_project_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  party_role text NOT NULL DEFAULT 'owner'
    CHECK (party_role IN ('owner', 'diaspora_owner', 'corporate_client', 'main_contractor', 'subcontractor', 'consultant', 'designer', 'quantity_surveyor', 'project_manager', 'local_representative')),
  -- Granular Authority Matrix (Never assume every contact has every authority)
  can_view_commercial boolean NOT NULL DEFAULT false,
  can_approve_quotations boolean NOT NULL DEFAULT false,
  can_approve_specifications boolean NOT NULL DEFAULT false,
  can_approve_variations boolean NOT NULL DEFAULT false,
  can_acknowledge_completions boolean NOT NULL DEFAULT false,
  can_approve_payments boolean NOT NULL DEFAULT false,
  can_view_financials boolean NOT NULL DEFAULT false,
  hide_subcontract_pricing boolean NOT NULL DEFAULT true,
  can_submit_requests_complaints boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoke_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_contact_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_client_project_access_project ON public.client_project_access (project_id);
CREATE INDEX IF NOT EXISTS idx_client_project_access_user ON public.client_project_access (user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_client_project_access_client ON public.client_project_access (client_id);

CREATE TABLE IF NOT EXISTS public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  project_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  email text NOT NULL,
  full_name text NOT NULL,
  party_role text NOT NULL DEFAULT 'owner',
  authorities jsonb NOT NULL DEFAULT '{}'::jsonb,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_invitations_client ON public.client_invitations (client_id);
CREATE INDEX IF NOT EXISTS idx_client_invitations_status ON public.client_invitations (status);
CREATE INDEX IF NOT EXISTS idx_client_invitations_email ON public.client_invitations (lower(email));

-- ------------------------------------------------------------------------------
-- 4. AUTHORITATIVE SECURITY HELPER FUNCTIONS (NO RECURSION, PROJECT-SCOPED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_is_internal_staff(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    p_user_id IS NOT NULL
    AND public.auth_is_active(p_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
        AND lower(r.slug) IN (
          'management',
          'executive_director',
          'admin',
          'technical',
          'supervisor',
          'procurement',
          'accounts',
          'artisan',
          'social_media_manager'
        )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_portal_manager(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    p_user_id IS NOT NULL
    AND public.auth_is_active(p_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
        AND lower(r.slug) IN ('management', 'executive_director', 'admin')
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_leadership(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    p_user_id IS NOT NULL
    AND public.auth_is_active(p_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = p_user_id
        AND lower(r.slug) IN ('management', 'executive_director')
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_client_has_account_access(
  p_client_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_contacts cc
    JOIN public.clients c ON c.id = cc.client_id
    WHERE cc.client_id = p_client_id
      AND cc.user_id = p_user_id
      AND cc.is_active = true
      AND COALESCE(c.portal_enabled, true) = true
      AND public.auth_is_active(p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_client_has_project_access(
  p_project_id uuid,
  p_required_authority text DEFAULT NULL,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_access public.client_project_access%ROWTYPE;
BEGIN
  IF p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.auth_is_active(p_user_id) THEN
    RETURN false;
  END IF;

  SELECT cpa.*
  INTO v_access
  FROM public.client_project_access cpa
  JOIN public.client_contacts cc ON cc.id = cpa.client_contact_id
  JOIN public.clients c ON c.id = cpa.client_id
  WHERE cpa.project_id = p_project_id
    AND (cpa.user_id = p_user_id OR cc.user_id = p_user_id)
    AND cpa.is_active = true
    AND cpa.revoked_at IS NULL
    AND cc.is_active = true
    AND COALESCE(c.portal_enabled, true) = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_required_authority IS NULL OR trim(p_required_authority) = '' THEN
    RETURN true;
  END IF;

  CASE lower(trim(p_required_authority))
    WHEN 'view_commercial' THEN RETURN COALESCE(v_access.can_view_commercial, false);
    WHEN 'approve_quotations' THEN RETURN COALESCE(v_access.can_approve_quotations, false);
    WHEN 'approve_specifications' THEN RETURN COALESCE(v_access.can_approve_specifications, false);
    WHEN 'approve_variations' THEN RETURN COALESCE(v_access.can_approve_variations, false);
    WHEN 'acknowledge_completions' THEN RETURN COALESCE(v_access.can_acknowledge_completions, false);
    WHEN 'approve_payments' THEN RETURN COALESCE(v_access.can_approve_payments, false);
    WHEN 'view_financials' THEN RETURN COALESCE(v_access.can_view_financials, false);
    WHEN 'submit_requests_complaints' THEN RETURN COALESCE(v_access.can_submit_requests_complaints, true);
    ELSE RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_is_internal_staff(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_portal_manager(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_leadership(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_client_has_account_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_client_has_project_access(uuid, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auth_is_internal_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_portal_manager(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_leadership(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_client_has_account_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_client_has_project_access(uuid, text, uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. PROJECT WORK PACKAGES & STRUCTURED BRIEF / VERSIONED SPECIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_work_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_code text NOT NULL,
  title text NOT NULL,
  scope_type text NOT NULL DEFAULT 'residential_room'
    CHECK (scope_type IN ('residential_room', 'commercial_floor', 'commercial_zone', 'elevation', 'work_package')),
  floor_level text,
  zone_name text,
  room_name text,
  description text,
  exclusions text,
  planned_start_date date,
  planned_end_date date,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'ready_for_inspection', 'verified', 'released', 'handed_over', 'on_hold')),
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, package_code)
);

CREATE INDEX IF NOT EXISTS idx_work_packages_project ON public.project_work_packages (project_id, sort_order);

CREATE TABLE IF NOT EXISTS public.project_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL,
  spec_code text NOT NULL,
  version_number integer NOT NULL DEFAULT 1 CHECK (version_number >= 1),
  parent_id uuid REFERENCES public.project_specifications(id) ON DELETE SET NULL,
  area_label text NOT NULL, -- Room / Floor / Zone / Elevation
  floor_zone text,
  work_category text NOT NULL DEFAULT 'Painting & Interior Finishes',
  material_product text NOT NULL,
  manufacturer text,
  colour_name text,
  colour_code text,
  preview_hex text, -- Visual reference only; never substitute for physical sample
  finish_type text, -- e.g. Silk, Matt, Satin, Textured, Stucco
  surface_preparation text,
  number_of_coats integer,
  quantity numeric(12,2),
  unit_of_measure text,
  approved_sample_ref text,
  exclusions text,
  technical_notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'awaiting_approval', 'approved', 'superseded', 'rejected')),
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prepared_by_name text,
  submitted_at timestamptz,
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  approved_by_name text,
  approved_at timestamptz,
  approval_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, spec_code, version_number)
);

CREATE INDEX IF NOT EXISTS idx_project_specs_project ON public.project_specifications (project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_specs_pkg ON public.project_specifications (work_package_id);

-- Guard: Approved specifications cannot be silently edited (only status transition to 'superseded' allowed)
CREATE OR REPLACE FUNCTION public.trg_guard_approved_specification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    IF NEW.status = 'superseded'
       AND NEW.area_label = OLD.area_label
       AND NEW.material_product = OLD.material_product
       AND COALESCE(NEW.colour_name, '') = COALESCE(OLD.colour_name, '')
       AND COALESCE(NEW.colour_code, '') = COALESCE(OLD.colour_code, '')
       AND COALESCE(NEW.finish_type, '') = COALESCE(OLD.finish_type, '')
       AND COALESCE(NEW.surface_preparation, '') = COALESCE(OLD.surface_preparation, '')
       AND COALESCE(NEW.number_of_coats, -1) = COALESCE(OLD.number_of_coats, -1)
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Approved specifications are immutable. Create a new revision version instead of editing an approved specification.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_specs_immutable ON public.project_specifications;
CREATE TRIGGER trg_project_specs_immutable
  BEFORE UPDATE ON public.project_specifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_approved_specification();

-- ------------------------------------------------------------------------------
-- 6. QUOTATIONS, CONTRACTS & B2B CLIENT PURCHASE ORDERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_quotations_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  document_type text NOT NULL DEFAULT 'quotation'
    CHECK (document_type IN ('quotation', 'revised_quotation', 'contract', 'client_purchase_order')),
  reference_no text NOT NULL,
  version_number integer NOT NULL DEFAULT 1 CHECK (version_number >= 1),
  parent_id uuid REFERENCES public.client_quotations_contracts(id) ON DELETE SET NULL,
  title text NOT NULL,
  scope_summary text NOT NULL,
  specifications_summary text,
  exclusions text,
  terms_and_conditions text,
  payment_terms text,
  currency text NOT NULL DEFAULT 'NGN',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  is_subcontract_confidential boolean NOT NULL DEFAULT false,
  is_b2b_client_issued boolean NOT NULL DEFAULT false,
  document_storage_path text,
  document_file_name text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'clarification_requested', 'revision_requested', 'accepted', 'declined', 'superseded')),
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at timestamptz,
  valid_until date,
  viewed_at timestamptz,
  viewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  decided_by_name text,
  decided_at timestamptz,
  decision_comments text,
  acceptance_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, reference_no, version_number)
);

CREATE INDEX IF NOT EXISTS idx_client_quotes_project ON public.client_quotations_contracts (project_id, status);
CREATE INDEX IF NOT EXISTS idx_client_quotes_client ON public.client_quotations_contracts (client_id);

-- Guard: Accepted commercial documents cannot be silently altered (only status -> 'superseded')
CREATE OR REPLACE FUNCTION public.trg_guard_accepted_quotation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'accepted' THEN
    IF NEW.status = 'superseded'
       AND NEW.total_amount = OLD.total_amount
       AND NEW.scope_summary = OLD.scope_summary
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Accepted quotations/contracts cannot be modified. Issue a revised version or formal variation requiring fresh approval.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_quotes_immutable ON public.client_quotations_contracts;
CREATE TRIGGER trg_client_quotes_immutable
  BEFORE UPDATE ON public.client_quotations_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_accepted_quotation();

-- ------------------------------------------------------------------------------
-- 7. PRE-WORK SURFACE INSPECTION (INTEGRATED WITH TECHNICAL/QC)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prework_surface_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL,
  technical_inspection_id uuid REFERENCES public.technical_inspections(id) ON DELETE SET NULL,
  inspection_ref text NOT NULL,
  area_label text NOT NULL,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inspector_name text,
  substrate_type text, -- e.g. Sand-cement plaster, Gypsum board, Concrete soffit, Timber
  substrate_condition text NOT NULL,
  screeding_plastering_quality text,
  has_cracks boolean NOT NULL DEFAULT false,
  has_dampness boolean NOT NULL DEFAULT false,
  has_unevenness boolean NOT NULL DEFAULT false,
  has_damage boolean NOT NULL DEFAULT false,
  defect_details text,
  other_contractor_observation text, -- Factual observation only; never automatic liability claim
  recommended_correction text,
  scope_responsibility text NOT NULL DEFAULT 'under_review'
    CHECK (scope_responsibility IN ('davejoe', 'client', 'main_contractor', 'other_trade', 'shared', 'under_review')),
  estimated_cost_impact numeric(14,2) DEFAULT 0,
  estimated_time_impact_days integer DEFAULT 0,
  evidence_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  client_decision text NOT NULL DEFAULT 'pending'
    CHECK (client_decision IN ('pending', 'proceed_after_correction', 'proceed_with_noted_limitations', 'hold_work', 'variation_requested')),
  client_decision_notes text,
  client_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_decided_by_name text,
  client_decided_at timestamptz,
  clearance_to_proceed boolean NOT NULL DEFAULT false,
  clearance_notes text,
  client_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, inspection_ref)
);

CREATE INDEX IF NOT EXISTS idx_prework_inspections_project ON public.prework_surface_inspections (project_id, inspection_date DESC);

-- ------------------------------------------------------------------------------
-- 8. 5-STAGE VERIFIED PROJECT PROGRESS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_progress_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage_name text,
  activity_type text NOT NULL DEFAULT 'work_in_progress'
    CHECK (activity_type IN ('milestone', 'completed_activity', 'work_in_progress', 'upcoming_activity', 'pending_client_decision', 'delay', 'technical_concern')),
  -- Strict 5-level separation (never collapsed into one generic completed status)
  verification_stage text NOT NULL DEFAULT 'reported_by_supervisor'
    CHECK (verification_stage IN ('reported_by_supervisor', 'inspected_by_qc', 'verified_completed', 'acknowledged_by_client', 'formally_handed_over')),
  planned_date date,
  actual_date date,
  progress_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  summary text NOT NULL,
  delay_reason text,
  technical_concern text,
  media_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by_name text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  inspected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  inspected_by_name text,
  inspected_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_by_name text,
  verified_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_by_name text,
  acknowledged_at timestamptz,
  acknowledgement_comments text,
  handed_over_at timestamptz,
  client_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_updates_project ON public.project_progress_updates (project_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 9. AREA COMPLETION, CONDITION EVIDENCE & AREA RELEASE (MANDATORY CORE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_area_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL,
  specification_id uuid REFERENCES public.project_specifications(id) ON DELETE SET NULL,
  specification_version integer,
  technical_inspection_id uuid REFERENCES public.technical_inspections(id) ON DELETE SET NULL,
  completion_ref text NOT NULL,
  area_location text NOT NULL,
  work_performed text NOT NULL,
  quantity_completed numeric(12,2),
  unit_of_measure text,
  completion_date date NOT NULL DEFAULT CURRENT_DATE,
  site_supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  site_supervisor_name text,
  assigned_team_summary text,
  completion_photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_videos jsonb NOT NULL DEFAULT '[]'::jsonb,
  workflow_status text NOT NULL DEFAULT 'ready_for_qc'
    CHECK (workflow_status IN (
      'draft',
      'ready_for_qc',
      'qc_failed_snag',
      'qc_conditional_pass',
      'qc_verified',
      'submitted_for_acknowledgement',
      'client_acknowledged',
      'client_rejected',
      'released_for_subsequent_trades',
      'formally_handed_over'
    )),
  -- Internal Technical/QC Verification (strictly separate from external acknowledgement)
  qc_inspector_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  qc_inspector_name text,
  qc_outcome text NOT NULL DEFAULT 'pending'
    CHECK (qc_outcome IN ('pending', 'pass', 'conditional_pass', 'fail')),
  qc_snag_status text NOT NULL DEFAULT 'none'
    CHECK (qc_snag_status IN ('none', 'open_snags', 'snags_cleared')),
  qc_notes text,
  qc_verified_at timestamptz,
  linked_snag_task_id uuid,
  -- External Client / Main-Contractor Acknowledgement
  client_acknowledgement_status text NOT NULL DEFAULT 'not_submitted'
    CHECK (client_acknowledgement_status IN ('not_submitted', 'pending', 'acknowledged', 'rejected')),
  client_acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_acknowledged_by_name text,
  client_acknowledged_at timestamptz,
  client_comments text,
  -- Area Release for Subsequent Trades
  area_released boolean NOT NULL DEFAULT false,
  release_label text, -- e.g. 'Davejoe Work Verified — Area Released for Subsequent Trades'
  condition_at_release text,
  outstanding_snags_at_release text,
  released_at timestamptz,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_by_name text,
  receiving_representative text,
  protection_measures text,
  coordination_notes text,
  formal_handover_occurred boolean NOT NULL DEFAULT false,
  formal_handover_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, completion_ref)
);

CREATE INDEX IF NOT EXISTS idx_area_completions_project ON public.project_area_completions (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_area_completions_status ON public.project_area_completions (workflow_status);

-- ------------------------------------------------------------------------------
-- 9B. LINK EXISTING public.job_completion_photos TO public.project_area_completions
--     Actual existing columns on public.job_completion_photos:
--       id, project_name, description, storage_path, file_name, mime_type,
--       file_size_bytes, uploaded_by, created_at
--     Does NOT assume project_id or review_status; never uses project_name for
--     authorization. Adds area_completion_id FK -> project_area_completions(id)
--     and client_visible boolean DEFAULT false safely & idempotently.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.job_completion_photos') IS NOT NULL
     AND to_regclass('public.project_area_completions') IS NOT NULL
  THEN
    ALTER TABLE public.job_completion_photos
      ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS area_completion_id uuid;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      WHERE c.conrelid = 'public.job_completion_photos'::regclass
        AND c.confrelid = 'public.project_area_completions'::regclass
        AND c.contype = 'f'
    ) THEN
      ALTER TABLE public.job_completion_photos
        ADD CONSTRAINT job_completion_photos_area_completion_id_fkey
        FOREIGN KEY (area_completion_id)
        REFERENCES public.project_area_completions(id)
        ON DELETE SET NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_job_completion_photos_area_completion_id
      ON public.job_completion_photos (area_completion_id)
      WHERE area_completion_id IS NOT NULL;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 10. SUBSEQUENT DAMAGE / REWORK INCIDENTS (LINKED TO COMPLETION EVIDENCE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subsequent_damage_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_ref text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  area_completion_id uuid NOT NULL REFERENCES public.project_area_completions(id) ON DELETE RESTRICT,
  discovered_date date NOT NULL DEFAULT CURRENT_DATE,
  area_location text NOT NULL,
  description text NOT NULL,
  known_or_suspected_cause text,
  relevant_contractors_activities text,
  damage_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by_name text,
  technical_assessment text,
  assessed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assessed_by_name text,
  assessed_at timestamptz,
  proposed_correction text,
  rework_classification text NOT NULL DEFAULT 'cause_under_investigation'
    CHECK (rework_classification IN (
      'davejoe_workmanship_defect',
      'client_requested_change',
      'main_contractor_instruction',
      'damage_by_another_trade',
      'pre_existing_substrate_issue',
      'material_issue',
      'accidental_damage',
      'cause_under_investigation',
      'other'
    )),
  liability_status text NOT NULL DEFAULT 'under_assessment'
    CHECK (liability_status IN ('under_assessment', 'evidence_shared', 'agreed_non_davejoe', 'davejoe_rectification', 'disputed')),
  is_chargeable boolean NOT NULL DEFAULT false,
  estimated_cost_impact numeric(14,2) DEFAULT 0,
  estimated_time_impact_days integer DEFAULT 0,
  notified_party text,
  notified_at timestamptz,
  external_response text,
  external_responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  external_responded_at timestamptz,
  linked_variation_id uuid,
  resolution_status text NOT NULL DEFAULT 'open'
    CHECK (resolution_status IN ('open', 'assessed', 'notified', 'in_remediation', 'resolved', 'closed')),
  resolution_notes text,
  resolved_at timestamptz,
  client_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_damage_incidents_project ON public.subsequent_damage_incidents (project_id, discovered_date DESC);
CREATE INDEX IF NOT EXISTS idx_damage_incidents_completion ON public.subsequent_damage_incidents (area_completion_id);

-- Enforce rule: Davejoe workmanship defects cannot be auto-marked chargeable
CREATE OR REPLACE FUNCTION public.trg_guard_damage_chargeability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.rework_classification = 'davejoe_workmanship_defect' AND NEW.is_chargeable = true THEN
    RAISE EXCEPTION 'Davejoe workmanship defects cannot be automatically marked chargeable to the client.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_damage_incidents_charge_guard ON public.subsequent_damage_incidents;
CREATE TRIGGER trg_damage_incidents_charge_guard
  BEFORE INSERT OR UPDATE ON public.subsequent_damage_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_damage_chargeability();

-- ------------------------------------------------------------------------------
-- 11. CLIENT REQUEST CENTRE & COMPLAINT CENTRE (CONFIDENTIAL ESCALATION)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_requests_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no text NOT NULL UNIQUE,
  record_kind text NOT NULL CHECK (record_kind IN ('request', 'complaint')),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (category IN (
      -- Requests
      'general_question',
      'additional_work',
      'colour_material_change',
      'report_concern',
      'request_inspection',
      'request_callback',
      'request_aftercare',
      -- Complaints
      'poor_workmanship',
      'wrong_colour',
      'delay',
      'damage',
      'unprofessional_behaviour',
      'unauthorised_payment_request',
      'missing_materials',
      'unsafe_conduct',
      'poor_coordination'
    )),
  subject text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  submitted_by_name text,
  -- Confidential Management Escalation & Supervisor Conflict-of-Interest Protection
  is_confidential_management boolean NOT NULL DEFAULT false,
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- e.g. Supervisor named in complaint
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_review', 'action_in_progress', 'awaiting_client', 'resolved', 'closed')),
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name text,
  internal_notes text,
  resolution_summary text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_req_cmp_project ON public.client_requests_complaints (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_req_cmp_kind ON public.client_requests_complaints (record_kind, status);
CREATE INDEX IF NOT EXISTS idx_client_req_cmp_conf ON public.client_requests_complaints (is_confidential_management);

-- Guard: A Site Supervisor (or subject of complaint) can NEVER close/control a complaint about themselves
CREATE OR REPLACE FUNCTION public.trg_guard_complaint_conflict_of_interest()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.record_kind = 'complaint' THEN
    IF OLD.subject_user_id IS NOT NULL AND auth.uid() = OLD.subject_user_id THEN
      RAISE EXCEPTION 'Conflict of interest: You cannot modify or close a complaint concerning yourself.';
    END IF;
    IF OLD.is_confidential_management = true
       AND NOT public.auth_is_leadership(auth.uid())
       AND auth.uid() IS DISTINCT FROM OLD.submitted_by_user_id
    THEN
      RAISE EXCEPTION 'Confidential Management complaints can only be controlled by Management or Executive Director.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaint_conflict_guard ON public.client_requests_complaints;
CREATE TRIGGER trg_complaint_conflict_guard
  BEFORE UPDATE ON public.client_requests_complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_complaint_conflict_of_interest();

-- ------------------------------------------------------------------------------
-- 12. 10-STAGE VARIATION & REWORK APPROVAL PIPELINE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variation_ref text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_package_id uuid REFERENCES public.project_work_packages(id) ON DELETE SET NULL,
  source_damage_incident_id uuid REFERENCES public.subsequent_damage_incidents(id) ON DELETE SET NULL,
  source_request_id uuid REFERENCES public.client_requests_complaints(id) ON DELETE SET NULL,
  title text NOT NULL,
  rework_classification text NOT NULL DEFAULT 'client_requested_change'
    CHECK (rework_classification IN (
      'davejoe_workmanship_defect',
      'client_requested_change',
      'main_contractor_instruction',
      'damage_by_another_trade',
      'pre_existing_substrate_issue',
      'material_issue',
      'accidental_damage',
      'cause_under_investigation',
      'other'
    )),
  original_spec_summary text NOT NULL,
  revised_spec_summary text NOT NULL,
  scope_and_quantity_notes text,
  is_chargeable boolean NOT NULL DEFAULT true,
  estimated_cost numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  time_impact_days integer NOT NULL DEFAULT 0,
  contract_variation_type text NOT NULL DEFAULT 'standard'
    CHECK (contract_variation_type IN ('standard', 'pending_valuation', 'disputed', 'instructed_unpriced')),
  workflow_stage text NOT NULL DEFAULT 'request_received'
    CHECK (workflow_stage IN (
      'request_received',
      'technical_assessment',
      'scope_quantity_verified',
      'cost_time_assessed',
      'internal_commercial_approved',
      'awaiting_client_approval',
      'client_approved',
      'client_rejected',
      'disputed',
      'work_instruction_issued',
      'in_execution',
      'technically_verified',
      'financially_reconciled'
    )),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name text,
  technical_assessor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  technical_assessment_notes text,
  internal_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_approved_by_name text,
  internal_approved_at timestamptz,
  client_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_decided_by_name text,
  client_decided_at timestamptz,
  client_decision_notes text,
  revised_instruction_notes text,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  reconciled_amount numeric(14,2),
  reconciled_at timestamptz,
  is_subcontract_confidential boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_variations_project ON public.project_variations (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_variations_stage ON public.project_variations (workflow_stage);

-- Enforce variation commercial governance:
-- 1) Davejoe workmanship defects cannot be auto-charged
-- 2) Only Management/Executive Director can grant internal_commercial_approved
-- 3) Chargeable variations cannot enter awaiting_client_approval without internal_approved_by
CREATE OR REPLACE FUNCTION public.trg_guard_variation_governance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.rework_classification = 'davejoe_workmanship_defect' AND NEW.is_chargeable = true THEN
    RAISE EXCEPTION 'Davejoe workmanship defects cannot be automatically charged to the client.';
  END IF;

  IF NEW.workflow_stage IN ('internal_commercial_approved', 'awaiting_client_approval')
     AND NEW.is_chargeable = true
     AND NEW.internal_approved_by IS NULL
  THEN
    IF NOT public.auth_is_leadership(auth.uid()) THEN
      RAISE EXCEPTION 'Only Management or Executive Director may grant internal commercial approval for chargeable variations.';
    END IF;
    NEW.internal_approved_by := auth.uid();
    NEW.internal_approved_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_variations_governance ON public.project_variations;
CREATE TRIGGER trg_project_variations_governance
  BEFORE INSERT OR UPDATE ON public.project_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_variation_governance();

-- ------------------------------------------------------------------------------
-- 13. WEEKLY REMOTE CLIENT PROJECT SUMMARIES (REVIEWED BEFORE RELEASE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_weekly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  summary_title text NOT NULL,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- Real recorded metrics snapshot
  executive_notes text,
  upcoming_activities text,
  pending_client_decisions text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'released')),
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prepared_by_name text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name text,
  reviewed_at timestamptz,
  released_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  released_by_name text,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_project ON public.client_weekly_summaries (project_id, week_end_date DESC);

-- ------------------------------------------------------------------------------
-- 14. SECURE CLIENT INVITATION & ACCESS RPCs (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_client_invitation(
  p_client_id uuid,
  p_email text,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_designation text DEFAULT NULL,
  p_party_role text DEFAULT 'owner',
  p_project_ids uuid[] DEFAULT '{}'::uuid[],
  p_authorities jsonb DEFAULT '{}'::jsonb,
  p_expires_in_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_clean_email text := lower(trim(COALESCE(p_email, '')));
  v_clean_name text := trim(COALESCE(p_full_name, ''));
  v_contact_id uuid;
  v_raw_token text;
  v_token_hash text;
  v_invite_id uuid;
  v_expires_at timestamptz := now() + make_interval(days => GREATEST(1, LEAST(COALESCE(p_expires_in_days, 7), 30)));
BEGIN
  IF v_caller IS NULL OR NOT public.auth_is_portal_manager(v_caller) THEN
    RAISE EXCEPTION 'Unauthorized: Only Management, Executive Director, or Admin can issue client portal invitations.';
  END IF;

  IF p_client_id IS NULL OR v_clean_email = '' OR v_clean_name = '' THEN
    RAISE EXCEPTION 'Client account, contact full name, and email address are required.';
  END IF;

  IF array_length(p_project_ids, 1) IS NULL OR array_length(p_project_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Select at least one project to grant project-scoped access.';
  END IF;

  -- Upsert client_contacts record
  INSERT INTO public.client_contacts (
    client_id, full_name, email, phone, designation, party_role, is_active, created_by
  )
  VALUES (
    p_client_id,
    v_clean_name,
    v_clean_email,
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(trim(COALESCE(p_designation, '')), ''),
    COALESCE(NULLIF(trim(p_party_role), ''), 'owner'),
    true,
    v_caller
  )
  ON CONFLICT (client_id, email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.client_contacts.phone),
    designation = COALESCE(EXCLUDED.designation, public.client_contacts.designation),
    party_role = EXCLUDED.party_role,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_contact_id;

  -- Revoke any previous pending invitations for the same contact/email
  UPDATE public.client_invitations
  SET status = 'revoked', revoked_by = v_caller, revoked_at = now(), revoke_reason = 'Superseded by new invitation'
  WHERE client_contact_id = v_contact_id AND status = 'pending';

  -- Generate cryptographically secure 32-byte hex token, store only SHA-256 hash
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  INSERT INTO public.client_invitations (
    client_id,
    client_contact_id,
    project_ids,
    email,
    full_name,
    party_role,
    authorities,
    token_hash,
    status,
    expires_at,
    invited_by
  )
  VALUES (
    p_client_id,
    v_contact_id,
    p_project_ids,
    v_clean_email,
    v_clean_name,
    COALESCE(NULLIF(trim(p_party_role), ''), 'owner'),
    COALESCE(p_authorities, '{}'::jsonb),
    v_token_hash,
    'pending',
    v_expires_at,
    v_caller
  )
  RETURNING id INTO v_invite_id;

  -- Record audit trail (never storing raw token)
  PERFORM public.log_audit_event(
    'client_portal.invitation_created',
    'client_portal',
    'client_invitations',
    v_invite_id::text,
    NULL,
    jsonb_build_object(
      'client_id', p_client_id,
      'email', v_clean_email,
      'party_role', p_party_role,
      'project_count', array_length(p_project_ids, 1),
      'expires_at', v_expires_at
    )
  );

  RETURN jsonb_build_object(
    'invitation_id', v_invite_id,
    'client_contact_id', v_contact_id,
    'token', v_raw_token,
    'expires_at', v_expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_client_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hash text;
  v_inv RECORD;
  v_projects jsonb := '[]'::jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Invalid invitation link.');
  END IF;

  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT
    ci.*,
    c.name AS client_name,
    c.company_name,
    c.account_type
  INTO v_inv
  FROM public.client_invitations ci
  JOIN public.clients c ON c.id = ci.client_id
  WHERE ci.token_hash = v_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'Invitation link was not found.');
  END IF;

  IF v_inv.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This invitation has been revoked by Davejoe Interiors.');
  END IF;

  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'This invitation has already been accepted. Please sign in normally.');
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.client_invitations SET status = 'expired' WHERE id = v_inv.id AND status = 'pending';
    RETURN jsonb_build_object('valid', false, 'reason', 'This invitation link has expired. Please request a fresh invitation from Davejoe Interiors.');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'project_code', COALESCE(to_jsonb(p)->>'project_code', to_jsonb(p)->>'code', 'PRJ'),
        'name', p.name
      )
    ),
    '[]'::jsonb
  )
  INTO v_projects
  FROM public.projects p
  WHERE p.id = ANY(v_inv.project_ids);

  RETURN jsonb_build_object(
    'valid', true,
    'invitation_id', v_inv.id,
    'client_name', COALESCE(v_inv.company_name, v_inv.client_name),
    'account_type', v_inv.account_type,
    'full_name', v_inv.full_name,
    'email', v_inv.email,
    'party_role', v_inv.party_role,
    'expires_at', v_inv.expires_at,
    'projects', v_projects
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_client_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_hash text;
  v_inv public.client_invitations%ROWTYPE;
  v_role_id uuid;
  v_pid uuid;
  v_auth jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Please sign in or create an account with your invited email address first.';
  END IF;

  SELECT lower(trim(email)) INTO v_user_email FROM auth.users WHERE id = v_user_id;
  v_hash := encode(digest(trim(COALESCE(p_token, '')), 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.client_invitations
  WHERE token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation token is invalid.';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation is no longer active (status: %).', v_inv.status;
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.client_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'This invitation has expired. Please request a fresh link.';
  END IF;

  -- Identity verification: authenticated email must strictly match invited email
  IF lower(trim(v_inv.email)) <> v_user_email THEN
    RAISE EXCEPTION 'Identity verification failed: Signed-in email (%) does not match invited email (%).', v_user_email, v_inv.email;
  END IF;

  -- Ensure active profile exists for this authenticated client user
  INSERT INTO public.profiles (id, display_name, status)
  VALUES (v_user_id, v_inv.full_name, 'active')
  ON CONFLICT (id) DO UPDATE SET
    display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
    status = 'active';

  -- Assign client_partner role in public.user_roles
  SELECT id INTO v_role_id FROM public.roles WHERE lower(slug) = 'client_partner' LIMIT 1;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (v_user_id, v_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Link auth user to client_contact
  UPDATE public.client_contacts
  SET user_id = v_user_id, is_active = true, updated_at = now()
  WHERE id = v_inv.client_contact_id;

  -- Provision project-level access rows with exact authorities
  v_auth := COALESCE(v_inv.authorities, '{}'::jsonb);
  FOREACH v_pid IN ARRAY v_inv.project_ids
  LOOP
    INSERT INTO public.client_project_access (
      client_id,
      client_contact_id,
      project_id,
      user_id,
      party_role,
      can_view_commercial,
      can_approve_quotations,
      can_approve_specifications,
      can_approve_variations,
      can_acknowledge_completions,
      can_approve_payments,
      can_view_financials,
      hide_subcontract_pricing,
      can_submit_requests_complaints,
      is_active,
      granted_by
    )
    VALUES (
      v_inv.client_id,
      v_inv.client_contact_id,
      v_pid,
      v_user_id,
      v_inv.party_role,
      COALESCE((v_auth->>'can_view_commercial')::boolean, false),
      COALESCE((v_auth->>'can_approve_quotations')::boolean, false),
      COALESCE((v_auth->>'can_approve_specifications')::boolean, false),
      COALESCE((v_auth->>'can_approve_variations')::boolean, false),
      COALESCE((v_auth->>'can_acknowledge_completions')::boolean, false),
      COALESCE((v_auth->>'can_approve_payments')::boolean, false),
      COALESCE((v_auth->>'can_view_financials')::boolean, false),
      COALESCE((v_auth->>'hide_subcontract_pricing')::boolean, true),
      COALESCE((v_auth->>'can_submit_requests_complaints')::boolean, true),
      true,
      v_inv.invited_by
    )
    ON CONFLICT (client_contact_id, project_id) DO UPDATE SET
      user_id = v_user_id,
      party_role = EXCLUDED.party_role,
      can_view_commercial = EXCLUDED.can_view_commercial,
      can_approve_quotations = EXCLUDED.can_approve_quotations,
      can_approve_specifications = EXCLUDED.can_approve_specifications,
      can_approve_variations = EXCLUDED.can_approve_variations,
      can_acknowledge_completions = EXCLUDED.can_acknowledge_completions,
      can_approve_payments = EXCLUDED.can_approve_payments,
      can_view_financials = EXCLUDED.can_view_financials,
      hide_subcontract_pricing = EXCLUDED.hide_subcontract_pricing,
      can_submit_requests_complaints = EXCLUDED.can_submit_requests_complaints,
      is_active = true,
      revoked_at = NULL,
      revoked_by = NULL,
      updated_at = now();
  END LOOP;

  UPDATE public.client_invitations
  SET status = 'accepted', accepted_by = v_user_id, accepted_at = now()
  WHERE id = v_inv.id;

  PERFORM public.log_audit_event(
    'client_portal.invitation_accepted',
    'client_portal',
    'client_invitations',
    v_inv.id::text,
    NULL,
    jsonb_build_object(
      'client_id', v_inv.client_id,
      'user_id', v_user_id,
      'email', v_user_email,
      'project_count', array_length(v_inv.project_ids, 1)
    )
  );

  RETURN jsonb_build_object(
    'accepted', true,
    'client_id', v_inv.client_id,
    'project_ids', v_inv.project_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_invitation(uuid, text, text, text, text, text, uuid[], jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_invitation(uuid, text, text, text, text, text, uuid[], jsonb, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.preview_client_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_client_invitation(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.accept_client_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_client_invitation(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY POLICIES (CROSS-CLIENT ISOLATION & AUTHORITY GATES)
-- ------------------------------------------------------------------------------

-- Ensure authenticated role has baseline table privileges (strictly gated by RLS below)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.client_contacts,
  public.client_project_access,
  public.client_invitations,
  public.project_work_packages,
  public.project_specifications,
  public.client_quotations_contracts,
  public.prework_surface_inspections,
  public.project_progress_updates,
  public.project_area_completions,
  public.subsequent_damage_incidents,
  public.client_requests_complaints,
  public.project_variations,
  public.client_weekly_summaries
TO authenticated;

-- Enable RLS on all new tables
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_project_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_work_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_quotations_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prework_surface_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_progress_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_area_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subsequent_damage_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_requests_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_weekly_summaries ENABLE ROW LEVEL SECURITY;

-- Allow authorized client users to SELECT their own client account & authorized projects
DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL THEN
    ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "clients_authorized_client_select" ON public.clients;
    CREATE POLICY "clients_authorized_client_select" ON public.clients
      FOR SELECT TO authenticated
      USING (public.auth_client_has_account_access(id, auth.uid()));
  END IF;

  IF to_regclass('public.projects') IS NOT NULL THEN
    ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "projects_authorized_client_select" ON public.projects;
    CREATE POLICY "projects_authorized_client_select" ON public.projects
      FOR SELECT TO authenticated
      USING (public.auth_client_has_project_access(id, NULL, auth.uid()));
  END IF;
END $$;

-- Secure job_completion_photos client SELECT access:
--   - Preserves existing internal staff policies untouched (including
--     "Approved roles can view job completion photos" for management,
--     executive_director, admin, and social_media_manager) without widening
--     access to other internal roles.
--   - Clients may only view photos where client_visible = true AND
--     area_completion_id links to a valid project_area_completions row whose
--     project_id passes public.auth_client_has_project_access().
--   - Never references non-existent project_id or review_status columns, and
--     never authorizes by project_name. Unlinked photos stay hidden from clients.
DO $$
BEGIN
  IF to_regclass('public.job_completion_photos') IS NOT NULL
     AND to_regclass('public.project_area_completions') IS NOT NULL
  THEN
    ALTER TABLE public.job_completion_photos ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "job_photos_select_policy" ON public.job_completion_photos;
    CREATE POLICY "job_photos_select_policy" ON public.job_completion_photos
      FOR SELECT TO authenticated
      USING (
        client_visible = true
        AND area_completion_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.project_area_completions pac
          WHERE pac.id = job_completion_photos.area_completion_id
            AND pac.project_id IS NOT NULL
            AND public.auth_client_has_project_access(pac.project_id, NULL, auth.uid())
        )
      );
  END IF;
END $$;

-- 15A. client_contacts
DROP POLICY IF EXISTS "client_contacts_select" ON public.client_contacts;
CREATE POLICY "client_contacts_select" ON public.client_contacts
  FOR SELECT TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_is_internal_staff(auth.uid())
    OR public.auth_client_has_account_access(client_id, auth.uid())
  );

DROP POLICY IF EXISTS "client_contacts_manage" ON public.client_contacts;
CREATE POLICY "client_contacts_manage" ON public.client_contacts
  FOR ALL TO authenticated
  USING (public.auth_is_portal_manager(auth.uid()))
  WITH CHECK (public.auth_is_portal_manager(auth.uid()));

-- 15B. client_project_access
DROP POLICY IF EXISTS "client_project_access_select" ON public.client_project_access;
CREATE POLICY "client_project_access_select" ON public.client_project_access
  FOR SELECT TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (user_id = auth.uid() AND is_active = true AND revoked_at IS NULL)
  );

DROP POLICY IF EXISTS "client_project_access_manage" ON public.client_project_access;
CREATE POLICY "client_project_access_manage" ON public.client_project_access
  FOR ALL TO authenticated
  USING (public.auth_is_portal_manager(auth.uid()))
  WITH CHECK (public.auth_is_portal_manager(auth.uid()));

-- 15C. client_invitations
DROP POLICY IF EXISTS "client_invitations_manage" ON public.client_invitations;
CREATE POLICY "client_invitations_manage" ON public.client_invitations
  FOR ALL TO authenticated
  USING (public.auth_is_portal_manager(auth.uid()))
  WITH CHECK (public.auth_is_portal_manager(auth.uid()));

-- 15D. project_work_packages
DROP POLICY IF EXISTS "work_packages_select" ON public.project_work_packages;
CREATE POLICY "work_packages_select" ON public.project_work_packages
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR public.auth_client_has_project_access(project_id, NULL, auth.uid())
  );

DROP POLICY IF EXISTS "work_packages_write" ON public.project_work_packages;
CREATE POLICY "work_packages_write" ON public.project_work_packages
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  );

-- 15E. project_specifications
DROP POLICY IF EXISTS "project_specs_select" ON public.project_specifications;
CREATE POLICY "project_specs_select" ON public.project_specifications
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (status <> 'draft' AND public.auth_client_has_project_access(project_id, NULL, auth.uid()))
  );

DROP POLICY IF EXISTS "project_specs_internal_write" ON public.project_specifications;
CREATE POLICY "project_specs_internal_write" ON public.project_specifications
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  );

DROP POLICY IF EXISTS "project_specs_client_approve" ON public.project_specifications;
CREATE POLICY "project_specs_client_approve" ON public.project_specifications
  FOR UPDATE TO authenticated
  USING (
    status IN ('submitted', 'awaiting_approval')
    AND public.auth_client_has_project_access(project_id, 'approve_specifications', auth.uid())
  )
  WITH CHECK (
    status IN ('approved', 'rejected', 'awaiting_approval')
    AND public.auth_client_has_project_access(project_id, 'approve_specifications', auth.uid())
  );

-- 15F. client_quotations_contracts
DROP POLICY IF EXISTS "client_quotes_select" ON public.client_quotations_contracts;
CREATE POLICY "client_quotes_select" ON public.client_quotations_contracts
  FOR SELECT TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_has_role('accounts')
    OR (
      status <> 'draft'
      AND public.auth_client_has_project_access(project_id, 'view_commercial', auth.uid())
      AND (
        is_subcontract_confidential = false
        OR EXISTS (
          SELECT 1 FROM public.client_project_access cpa
          WHERE cpa.project_id = client_quotations_contracts.project_id
            AND cpa.user_id = auth.uid()
            AND cpa.is_active = true
            AND cpa.revoked_at IS NULL
            AND cpa.hide_subcontract_pricing = false
        )
      )
    )
  );

DROP POLICY IF EXISTS "client_quotes_internal_write" ON public.client_quotations_contracts;
CREATE POLICY "client_quotes_internal_write" ON public.client_quotations_contracts
  FOR ALL TO authenticated
  USING (public.auth_is_portal_manager(auth.uid()) OR public.auth_has_role('accounts'))
  WITH CHECK (public.auth_is_portal_manager(auth.uid()) OR public.auth_has_role('accounts'));

DROP POLICY IF EXISTS "client_quotes_client_action" ON public.client_quotations_contracts;
CREATE POLICY "client_quotes_client_action" ON public.client_quotations_contracts
  FOR UPDATE TO authenticated
  USING (
    status IN ('issued', 'clarification_requested', 'revision_requested')
    AND (
      public.auth_client_has_project_access(project_id, 'approve_quotations', auth.uid())
      OR public.auth_client_has_project_access(project_id, 'view_commercial', auth.uid())
    )
  )
  WITH CHECK (
    (
      status IN ('accepted', 'declined')
      AND public.auth_client_has_project_access(project_id, 'approve_quotations', auth.uid())
    )
    OR (
      status IN ('issued', 'clarification_requested', 'revision_requested')
      AND public.auth_client_has_project_access(project_id, 'view_commercial', auth.uid())
    )
  );

DROP POLICY IF EXISTS "client_quotes_b2b_insert" ON public.client_quotations_contracts;
CREATE POLICY "client_quotes_b2b_insert" ON public.client_quotations_contracts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_b2b_client_issued = true
    AND document_type IN ('contract', 'client_purchase_order')
    AND public.auth_client_has_project_access(project_id, 'approve_quotations', auth.uid())
  );

-- 15G. prework_surface_inspections
DROP POLICY IF EXISTS "prework_inspections_select" ON public.prework_surface_inspections;
CREATE POLICY "prework_inspections_select" ON public.prework_surface_inspections
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (client_visible = true AND public.auth_client_has_project_access(project_id, NULL, auth.uid()))
  );

DROP POLICY IF EXISTS "prework_inspections_internal_write" ON public.prework_surface_inspections;
CREATE POLICY "prework_inspections_internal_write" ON public.prework_surface_inspections
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  );

DROP POLICY IF EXISTS "prework_inspections_client_decide" ON public.prework_surface_inspections;
CREATE POLICY "prework_inspections_client_decide" ON public.prework_surface_inspections
  FOR UPDATE TO authenticated
  USING (
    client_visible = true
    AND (
      public.auth_client_has_project_access(project_id, 'acknowledge_completions', auth.uid())
      OR public.auth_client_has_project_access(project_id, 'approve_specifications', auth.uid())
    )
  )
  WITH CHECK (
    client_visible = true
    AND (
      public.auth_client_has_project_access(project_id, 'acknowledge_completions', auth.uid())
      OR public.auth_client_has_project_access(project_id, 'approve_specifications', auth.uid())
    )
  );

-- 15H. project_progress_updates
DROP POLICY IF EXISTS "progress_updates_select" ON public.project_progress_updates;
CREATE POLICY "progress_updates_select" ON public.project_progress_updates
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (client_visible = true AND public.auth_client_has_project_access(project_id, NULL, auth.uid()))
  );

DROP POLICY IF EXISTS "progress_updates_internal_write" ON public.project_progress_updates;
CREATE POLICY "progress_updates_internal_write" ON public.project_progress_updates
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('supervisor') OR public.auth_has_role('technical')))
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('supervisor') OR public.auth_has_role('technical')))
  );

DROP POLICY IF EXISTS "progress_updates_client_ack" ON public.project_progress_updates;
CREATE POLICY "progress_updates_client_ack" ON public.project_progress_updates
  FOR UPDATE TO authenticated
  USING (
    client_visible = true
    AND verification_stage = 'verified_completed'
    AND public.auth_client_has_project_access(project_id, 'acknowledge_completions', auth.uid())
  )
  WITH CHECK (
    verification_stage = 'acknowledged_by_client'
    AND public.auth_client_has_project_access(project_id, 'acknowledge_completions', auth.uid())
  );

-- 15I. project_area_completions
DROP POLICY IF EXISTS "area_completions_select" ON public.project_area_completions;
CREATE POLICY "area_completions_select" ON public.project_area_completions
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (
      workflow_status IN (
        'qc_verified',
        'submitted_for_acknowledgement',
        'client_acknowledged',
        'client_rejected',
        'released_for_subsequent_trades',
        'formally_handed_over'
      )
      AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
    )
  );

DROP POLICY IF EXISTS "area_completions_internal_write" ON public.project_area_completions;
CREATE POLICY "area_completions_internal_write" ON public.project_area_completions
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('supervisor') OR public.auth_has_role('technical')))
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('supervisor') OR public.auth_has_role('technical')))
  );

DROP POLICY IF EXISTS "area_completions_client_ack" ON public.project_area_completions;
CREATE POLICY "area_completions_client_ack" ON public.project_area_completions
  FOR UPDATE TO authenticated
  USING (
    workflow_status IN ('submitted_for_acknowledgement', 'qc_verified')
    AND public.auth_client_has_project_access(project_id, 'acknowledge_completions', auth.uid())
  )
  WITH CHECK (
    workflow_status IN ('client_acknowledged', 'client_rejected')
    AND public.auth_client_has_project_access(project_id, 'acknowledge_completions', auth.uid())
  );

-- 15J. subsequent_damage_incidents
DROP POLICY IF EXISTS "damage_incidents_select" ON public.subsequent_damage_incidents;
CREATE POLICY "damage_incidents_select" ON public.subsequent_damage_incidents
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (client_visible = true AND public.auth_client_has_project_access(project_id, NULL, auth.uid()))
  );

DROP POLICY IF EXISTS "damage_incidents_internal_write" ON public.subsequent_damage_incidents;
CREATE POLICY "damage_incidents_internal_write" ON public.subsequent_damage_incidents
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('supervisor') OR public.auth_has_role('technical')))
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('supervisor') OR public.auth_has_role('technical')))
  );

DROP POLICY IF EXISTS "damage_incidents_client_respond" ON public.subsequent_damage_incidents;
CREATE POLICY "damage_incidents_client_respond" ON public.subsequent_damage_incidents
  FOR UPDATE TO authenticated
  USING (
    client_visible = true
    AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
  )
  WITH CHECK (
    client_visible = true
    AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
  );

-- 15K. client_requests_complaints (Confidential Management Escalation & Supervisor Conflict Guard)
DROP POLICY IF EXISTS "requests_complaints_select" ON public.client_requests_complaints;
CREATE POLICY "requests_complaints_select" ON public.client_requests_complaints
  FOR SELECT TO authenticated
  USING (
    -- Leadership always sees all requests and confidential complaints
    public.auth_is_leadership(auth.uid())
    -- Submitting client contact sees their own project requests/complaints
    OR public.auth_client_has_project_access(project_id, NULL, auth.uid())
    -- Non-confidential items visible to Admin & assigned staff EXCEPT anyone named in subject_user_id
    OR (
      is_confidential_management = false
      AND (subject_user_id IS NULL OR subject_user_id <> auth.uid())
      AND (
        public.auth_is_portal_manager(auth.uid())
        OR public.auth_is_assigned_to_project(project_id, auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "requests_complaints_insert" ON public.client_requests_complaints;
CREATE POLICY "requests_complaints_insert" ON public.client_requests_complaints
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_client_has_project_access(project_id, 'submit_requests_complaints', auth.uid())
  );

DROP POLICY IF EXISTS "requests_complaints_update" ON public.client_requests_complaints;
CREATE POLICY "requests_complaints_update" ON public.client_requests_complaints
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_leadership(auth.uid())
    OR (
      is_confidential_management = false
      AND (subject_user_id IS NULL OR subject_user_id <> auth.uid())
      AND public.auth_is_portal_manager(auth.uid())
    )
  )
  WITH CHECK (
    public.auth_is_leadership(auth.uid())
    OR (
      is_confidential_management = false
      AND (subject_user_id IS NULL OR subject_user_id <> auth.uid())
      AND public.auth_is_portal_manager(auth.uid())
    )
  );

-- 15L. project_variations
DROP POLICY IF EXISTS "variations_select" ON public.project_variations;
CREATE POLICY "variations_select" ON public.project_variations
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR public.auth_has_role('accounts')
    OR (
      workflow_stage IN (
        'awaiting_client_approval',
        'client_approved',
        'client_rejected',
        'disputed',
        'work_instruction_issued',
        'in_execution',
        'technically_verified',
        'financially_reconciled'
      )
      AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
      AND (
        is_subcontract_confidential = false
        OR EXISTS (
          SELECT 1 FROM public.client_project_access cpa
          WHERE cpa.project_id = project_variations.project_id
            AND cpa.user_id = auth.uid()
            AND cpa.is_active = true
            AND cpa.revoked_at IS NULL
            AND cpa.hide_subcontract_pricing = false
        )
      )
    )
  );

DROP POLICY IF EXISTS "variations_internal_write" ON public.project_variations;
CREATE POLICY "variations_internal_write" ON public.project_variations
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_has_role('accounts')
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_has_role('accounts')
    OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND (public.auth_has_role('technical') OR public.auth_has_role('supervisor')))
  );

DROP POLICY IF EXISTS "variations_client_decide" ON public.project_variations;
CREATE POLICY "variations_client_decide" ON public.project_variations
  FOR UPDATE TO authenticated
  USING (
    workflow_stage IN ('awaiting_client_approval', 'disputed')
    AND public.auth_client_has_project_access(project_id, 'approve_variations', auth.uid())
  )
  WITH CHECK (
    workflow_stage IN ('client_approved', 'client_rejected', 'disputed')
    AND public.auth_client_has_project_access(project_id, 'approve_variations', auth.uid())
  );

-- 15M. client_weekly_summaries
DROP POLICY IF EXISTS "weekly_summaries_select" ON public.client_weekly_summaries;
CREATE POLICY "weekly_summaries_select" ON public.client_weekly_summaries
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (status = 'released' AND public.auth_client_has_project_access(project_id, NULL, auth.uid()))
  );

DROP POLICY IF EXISTS "weekly_summaries_internal_write" ON public.client_weekly_summaries;
CREATE POLICY "weekly_summaries_internal_write" ON public.client_weekly_summaries
  FOR ALL TO authenticated
  USING (public.auth_is_portal_manager(auth.uid()) OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND public.auth_has_role('supervisor')))
  WITH CHECK (public.auth_is_portal_manager(auth.uid()) OR (public.auth_is_assigned_to_project(project_id, auth.uid()) AND public.auth_has_role('supervisor')));

-- ------------------------------------------------------------------------------
-- 16. PRIVATE SUPABASE STORAGE BUCKET FOR PORTAL EVIDENCE & DOCUMENTS
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-portal-evidence',
  'client-portal-evidence',
  false,
  26214400, -- 25MB max per file (supports photos, short inspection videos, PDF contracts)
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Path format convention: <project_id>/<category>/<filename>
DROP POLICY IF EXISTS "client_portal_storage_select" ON storage.objects;
CREATE POLICY "client_portal_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-portal-evidence'
    AND (
      public.auth_is_portal_manager(auth.uid())
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
        AND (
          public.auth_is_assigned_to_project(((storage.foldername(name))[1])::uuid, auth.uid())
          OR public.auth_client_has_project_access(((storage.foldername(name))[1])::uuid, NULL, auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "client_portal_storage_insert" ON storage.objects;
CREATE POLICY "client_portal_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-portal-evidence'
    AND (
      public.auth_is_portal_manager(auth.uid())
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
        AND (
          public.auth_is_assigned_to_project(((storage.foldername(name))[1])::uuid, auth.uid())
          OR public.auth_client_has_project_access(((storage.foldername(name))[1])::uuid, 'submit_requests_complaints', auth.uid())
          OR public.auth_client_has_project_access(((storage.foldername(name))[1])::uuid, 'approve_quotations', auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "client_portal_storage_delete" ON storage.objects;
CREATE POLICY "client_portal_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-portal-evidence'
    AND public.auth_is_leadership(auth.uid())
  );

COMMIT;
