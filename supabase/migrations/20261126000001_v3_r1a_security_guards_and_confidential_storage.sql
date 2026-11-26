-- ==============================================================================
-- DAVEJOE INTERIORS — DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261126000001_v3_r1a_security_guards_and_confidential_storage.sql
--
-- VERSION 3.0 — RELEASE 1A ONLY:
--   Security Hardening, Client Column Guards, Confidential Storage, and
--   Confidential Worker Conduct Disclosures.
--
-- Strictly Scoped to Release 1A:
--   1. Multi-party confidential complaint isolation, independent reviewer support,
--      and server-derived insert identity on public.client_requests_complaints.
--   2. Dedicated private Storage bucket 'confidential-case-evidence' with strict
--      per-uploader / Leadership / assigned-reviewer RLS (blocking accused
--      personnel, site teams, Admin, and unrelated project parties).
--   3. Server-derived client identity helper + 7 BEFORE UPDATE column-guard
--      triggers (trg_01_guard_client_*) + B2B quote INSERT guard so clients can
--      never spoof identity or tamper with commercial/QC/cost fields before
--      approval-limit enforcement.
--   4. Database/API-boundary subcontractor pricing protection on
--      client_weekly_summaries, get_corporate_portfolio_summary(), and new
--      get_client_authorized_projects() / get_client_weekly_summaries() RPCs.
--   5. Single new table public.worker_conduct_disclosures with strict RLS,
--      immutability/conflict-of-interest triggers, and Leadership-only alerts.
--
-- Out of Scope (NOT included in Release 1A):
--   No payment/invoice, handover, aftercare, communication, review, referral,
--   RFI, site instruction, or analytics tables are created in this migration.
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. SHARED CLIENT ACTOR IDENTITY RESOLVER (SERVER-DERIVED FROM auth.uid())
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_resolve_client_actor_identity(
  p_project_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  contact_id uuid,
  full_name text,
  client_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_contact_id uuid;
  v_full_name text;
  v_client_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Prefer active project-scoped client contact binding
  IF p_project_id IS NOT NULL THEN
    SELECT
      cc.id,
      NULLIF(trim(cc.full_name), ''),
      cpa.client_id
    INTO v_contact_id, v_full_name, v_client_id
    FROM public.client_project_access cpa
    JOIN public.client_contacts cc ON cc.id = cpa.client_contact_id
    WHERE cpa.project_id = p_project_id
      AND (cpa.user_id = p_user_id OR cc.user_id = p_user_id)
      AND cpa.is_active = true
      AND cpa.revoked_at IS NULL
      AND cc.is_active = true
    ORDER BY cpa.granted_at DESC
    LIMIT 1;
  END IF;

  -- Fallback to active client_contacts row (e.g. delegated signatory)
  IF v_contact_id IS NULL THEN
    SELECT
      cc.id,
      NULLIF(trim(cc.full_name), ''),
      cc.client_id
    INTO v_contact_id, v_full_name, v_client_id
    FROM public.client_contacts cc
    WHERE cc.user_id = p_user_id
      AND cc.is_active = true
    ORDER BY cc.is_primary_contact DESC, cc.created_at ASC
    LIMIT 1;
  END IF;

  -- Fallback display name from public.profiles
  IF v_full_name IS NULL THEN
    SELECT COALESCE(
      NULLIF(trim(p.display_name), ''),
      NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
      'Authorized Client Contact'
    )
    INTO v_full_name
    FROM public.profiles p
    WHERE p.id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_contact_id, COALESCE(v_full_name, 'Authorized Client Contact'), v_client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_resolve_client_actor_identity(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_resolve_client_actor_identity(uuid, uuid) TO authenticated;

-- Helper: resolve staff profile display name from auth.uid()
CREATE OR REPLACE FUNCTION public.auth_resolve_profile_display_name(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(
        NULLIF(trim(p.display_name), ''),
        NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
        'Authenticated User'
      )
      FROM public.profiles p
      WHERE p.id = p_user_id
      LIMIT 1
    ),
    'Authenticated User'
  );
$$;

REVOKE ALL ON FUNCTION public.auth_resolve_profile_display_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_resolve_profile_display_name(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. MULTI-PARTY CONFIDENTIAL COMPLAINT ISOLATION & INDEPENDENT REVIEWER
-- ------------------------------------------------------------------------------
ALTER TABLE public.client_requests_complaints
  ADD COLUMN IF NOT EXISTS independent_reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_req_cmp_reviewer
  ON public.client_requests_complaints (independent_reviewer_id)
  WHERE independent_reviewer_id IS NOT NULL;

-- Replace SELECT policy:
--   * Confidential complaints are visible ONLY to Leadership (excluding named subject),
--     assigned independent_reviewer_id (excluding named subject), or the submitting user.
--     Other parties on the same project (e.g., Main Contractor / Consultant) can NEVER see
--     another party's confidential complaint.
--   * Named subject_user_id can NEVER view a complaint concerning themselves.
DROP POLICY IF EXISTS "requests_complaints_select" ON public.client_requests_complaints;
CREATE POLICY "requests_complaints_select" ON public.client_requests_complaints
  FOR SELECT TO authenticated
  USING (
    -- Submitter always sees their own submission if active on the project (or staff)
    (
      submitted_by_user_id = auth.uid()
      AND (
        public.auth_client_has_project_access(project_id, NULL, auth.uid())
        OR public.auth_is_internal_staff(auth.uid())
      )
    )
    OR (
      -- Conflict-of-interest hard wall: named subject can NEVER see the complaint
      (subject_user_id IS NULL OR subject_user_id <> auth.uid())
      AND (
        -- Leadership sees all requests and confidential complaints (except if named subject)
        public.auth_is_leadership(auth.uid())
        -- Assigned independent reviewer sees assigned case
        OR (
          independent_reviewer_id = auth.uid()
          AND public.auth_is_active(auth.uid())
        )
        -- Non-confidential items visible to project-authorized clients, portal managers, and assigned staff
        OR (
          is_confidential_management = false
          AND (
            public.auth_client_has_project_access(project_id, NULL, auth.uid())
            OR public.auth_is_portal_manager(auth.uid())
            OR public.auth_is_assigned_to_project(project_id, auth.uid())
          )
        )
      )
    )
  );

-- Replace UPDATE policy:
--   * Named subject_user_id can NEVER update a complaint concerning themselves.
--   * Confidential complaints can ONLY be updated by Leadership or assigned independent reviewer.
--   * Non-confidential items can be updated by Leadership, assigned reviewer, or Portal Managers.
DROP POLICY IF EXISTS "requests_complaints_update" ON public.client_requests_complaints;
CREATE POLICY "requests_complaints_update" ON public.client_requests_complaints
  FOR UPDATE TO authenticated
  USING (
    (subject_user_id IS NULL OR subject_user_id <> auth.uid())
    AND (
      public.auth_is_leadership(auth.uid())
      OR (
        independent_reviewer_id = auth.uid()
        AND public.auth_is_active(auth.uid())
      )
      OR (
        is_confidential_management = false
        AND public.auth_is_portal_manager(auth.uid())
      )
    )
  )
  WITH CHECK (
    (subject_user_id IS NULL OR subject_user_id <> auth.uid())
    AND (
      public.auth_is_leadership(auth.uid())
      OR (
        independent_reviewer_id = auth.uid()
        AND public.auth_is_active(auth.uid())
      )
      OR (
        is_confidential_management = false
        AND public.auth_is_portal_manager(auth.uid())
      )
    )
  );

-- BEFORE INSERT identity & state guard on client_requests_complaints
CREATE OR REPLACE FUNCTION public.trg_guard_complaint_insert_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
  v_item jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Enforce confidential bucket for confidential complaint attachments
  IF NEW.record_kind = 'complaint' AND COALESCE(NEW.is_confidential_management, false) = true THEN
    IF jsonb_typeof(COALESCE(NEW.attachments, '[]'::jsonb)) = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.attachments, '[]'::jsonb))
      LOOP
        IF COALESCE(v_item->>'bucket_id', '') <> 'confidential-case-evidence' THEN
          RAISE EXCEPTION 'Confidential complaint attachments must be stored in the private confidential-case-evidence vault.'
            USING ERRCODE = '42501';
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Non-staff (client/partner) inserts: derive all identity fields from auth.uid() and lock internal triage fields
  IF NOT public.auth_is_internal_staff(v_uid) THEN
    SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(NEW.project_id, v_uid);

    NEW.submitted_by_user_id := v_uid;
    NEW.submitted_by_contact_id := v_actor.contact_id;
    NEW.submitted_by_name := v_actor.full_name;
    IF v_actor.client_id IS NOT NULL THEN
      NEW.client_id := v_actor.client_id;
    END IF;

    NEW.is_confidential_management := (NEW.record_kind = 'complaint' AND COALESCE(NEW.is_confidential_management, false));
    NEW.status := 'open';
    NEW.assigned_to_user_id := NULL;
    NEW.assigned_to_name := NULL;
    NEW.independent_reviewer_id := NULL;
    NEW.internal_notes := NULL;
    NEW.resolution_summary := NULL;
    NEW.resolved_by := NULL;
    NEW.resolved_by_name := NULL;
    NEW.resolved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_complaint_insert_identity ON public.client_requests_complaints;
CREATE TRIGGER trg_01_guard_complaint_insert_identity
  BEFORE INSERT ON public.client_requests_complaints
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_complaint_insert_identity();

-- Upgrade existing conflict-of-interest trigger to also honor independent_reviewer_id
-- and enforce server-derived resolution actor fields.
CREATE OR REPLACE FUNCTION public.trg_guard_complaint_conflict_of_interest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    -- Named subject can NEVER modify or close a complaint concerning themselves
    IF OLD.subject_user_id IS NOT NULL AND v_uid = OLD.subject_user_id THEN
      RAISE EXCEPTION 'Conflict of interest: You cannot modify or close a complaint concerning yourself.'
        USING ERRCODE = '42501';
    END IF;

    -- Prevent non-staff from mutating internal complaint handling fields
    IF NOT public.auth_is_internal_staff(v_uid) THEN
      RAISE EXCEPTION 'Clients cannot directly modify ticket triage or resolution records.'
        USING ERRCODE = '42501';
    END IF;

    -- Confidential Management complaints can only be controlled by Leadership or assigned independent reviewer
    IF OLD.is_confidential_management = true
       AND NOT public.auth_is_leadership(v_uid)
       AND v_uid IS DISTINCT FROM OLD.independent_reviewer_id
    THEN
      RAISE EXCEPTION 'Confidential Management complaints can only be controlled by Management, Executive Director, or the assigned independent reviewer.'
        USING ERRCODE = '42501';
    END IF;

    -- Prevent downgrading confidentiality or tampering with original submitter identity
    IF NEW.is_confidential_management IS DISTINCT FROM OLD.is_confidential_management
       AND OLD.is_confidential_management = true
       AND NOT public.auth_is_leadership(v_uid)
    THEN
      RAISE EXCEPTION 'Only Management or Executive Director may change confidentiality flags.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.submitted_by_user_id IS DISTINCT FROM OLD.submitted_by_user_id
       OR NEW.submitted_by_contact_id IS DISTINCT FROM OLD.submitted_by_contact_id
       OR NEW.reference_no IS DISTINCT FROM OLD.reference_no
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
    THEN
      RAISE EXCEPTION 'Original complaint reference, project, and submitter identity are immutable.'
        USING ERRCODE = '42501';
    END IF;

    -- Server-derive resolution actor metadata when resolving/closing
    IF NEW.status IN ('resolved', 'closed') AND OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.resolved_by := v_uid;
      NEW.resolved_by_name := public.auth_resolve_profile_display_name(v_uid);
      NEW.resolved_at := COALESCE(NEW.resolved_at, now());
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. DEDICATED PRIVATE STORAGE BUCKET FOR CONFIDENTIAL EVIDENCE
--    Bucket: 'confidential-case-evidence'
--    Path convention: <project_id_or_general>/<uploader_user_id>/<category>/<filename>
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'confidential-case-evidence',
  'confidential-case-evidence',
  false,
  26214400, -- 25MB max per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'application/pdf',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/x-m4a'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ------------------------------------------------------------------------------
-- 4. CLIENT COLUMN-GUARD TRIGGERS (7 BEFORE UPDATE + 1 B2B INSERT GUARD)
--    Named trg_01_guard_client_* so PostgreSQL executes them ALPHABETICALLY
--    BEFORE trg_enforce_quotation_approval_limit, trg_enforce_variation_approval_limit,
--    trg_client_quotes_immutable, trg_project_specs_immutable,
--    trg_damage_incidents_charge_guard, and trg_project_variations_governance.
-- ------------------------------------------------------------------------------

-- 4A. project_specifications column guard
CREATE OR REPLACE FUNCTION public.trg_guard_client_spec_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  -- Reject any attempt by a client/partner to modify non-decision columns
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.work_package_id IS DISTINCT FROM OLD.work_package_id
     OR NEW.spec_code IS DISTINCT FROM OLD.spec_code
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.area_label IS DISTINCT FROM OLD.area_label
     OR NEW.floor_zone IS DISTINCT FROM OLD.floor_zone
     OR NEW.work_category IS DISTINCT FROM OLD.work_category
     OR NEW.material_product IS DISTINCT FROM OLD.material_product
     OR NEW.manufacturer IS DISTINCT FROM OLD.manufacturer
     OR NEW.colour_name IS DISTINCT FROM OLD.colour_name
     OR NEW.colour_code IS DISTINCT FROM OLD.colour_code
     OR NEW.preview_hex IS DISTINCT FROM OLD.preview_hex
     OR NEW.finish_type IS DISTINCT FROM OLD.finish_type
     OR NEW.surface_preparation IS DISTINCT FROM OLD.surface_preparation
     OR NEW.number_of_coats IS DISTINCT FROM OLD.number_of_coats
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.unit_of_measure IS DISTINCT FROM OLD.unit_of_measure
     OR NEW.approved_sample_ref IS DISTINCT FROM OLD.approved_sample_ref
     OR NEW.exclusions IS DISTINCT FROM OLD.exclusions
     OR NEW.technical_notes IS DISTINCT FROM OLD.technical_notes
     OR NEW.attachments IS DISTINCT FROM OLD.attachments
     OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by
     OR NEW.prepared_by_name IS DISTINCT FROM OLD.prepared_by_name
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Unauthorized column modification: Clients may only record specification approval status and comments.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status NOT IN ('approved', 'rejected', 'awaiting_approval') THEN
    RAISE EXCEPTION 'Invalid specification status transition for client actor.'
      USING ERRCODE = '42501';
  END IF;

  -- Server-derive approval actor identity from auth.uid()
  SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(OLD.project_id, v_uid);
  NEW.approved_by_user_id := v_uid;
  NEW.approved_by_contact_id := v_actor.contact_id;
  NEW.approved_by_name := v_actor.full_name;
  NEW.approved_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_spec_update ON public.project_specifications;
CREATE TRIGGER trg_01_guard_client_spec_update
  BEFORE UPDATE ON public.project_specifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_spec_update();

-- 4B. client_quotations_contracts column guard (runs BEFORE trg_enforce_quotation_approval_limit!)
CREATE OR REPLACE FUNCTION public.trg_guard_client_quotation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
  v_is_status_decision boolean;
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  -- Block any tampering with commercial values, scope, currency, or document metadata
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.document_type IS DISTINCT FROM OLD.document_type
     OR NEW.reference_no IS DISTINCT FROM OLD.reference_no
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.scope_summary IS DISTINCT FROM OLD.scope_summary
     OR NEW.specifications_summary IS DISTINCT FROM OLD.specifications_summary
     OR NEW.exclusions IS DISTINCT FROM OLD.exclusions
     OR NEW.terms_and_conditions IS DISTINCT FROM OLD.terms_and_conditions
     OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
     OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.is_subcontract_confidential IS DISTINCT FROM OLD.is_subcontract_confidential
     OR NEW.is_b2b_client_issued IS DISTINCT FROM OLD.is_b2b_client_issued
     OR NEW.document_storage_path IS DISTINCT FROM OLD.document_storage_path
     OR NEW.document_file_name IS DISTINCT FROM OLD.document_file_name
     OR NEW.prepared_by IS DISTINCT FROM OLD.prepared_by
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Unauthorized column modification: Clients cannot modify quotation amounts, scope, or commercial metadata.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(OLD.project_id, v_uid);

  -- Server-derive view tracking without allowing acceptance bypass
  IF NEW.viewed_at IS DISTINCT FROM OLD.viewed_at OR NEW.viewed_by IS DISTINCT FROM OLD.viewed_by THEN
    NEW.viewed_by := COALESCE(OLD.viewed_by, v_uid);
    NEW.viewed_at := COALESCE(OLD.viewed_at, now());
  END IF;

  v_is_status_decision := (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.decision_comments IS DISTINCT FROM OLD.decision_comments
    OR NEW.acceptance_evidence IS DISTINCT FROM OLD.acceptance_evidence
  );

  IF v_is_status_decision THEN
    IF NEW.status NOT IN ('issued', 'clarification_requested', 'revision_requested', 'accepted', 'declined') THEN
      RAISE EXCEPTION 'Invalid quotation status transition for client actor.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status IN ('accepted', 'declined', 'clarification_requested', 'revision_requested') THEN
      NEW.decided_by_user_id := v_uid;
      NEW.decided_by_contact_id := v_actor.contact_id;
      NEW.decided_by_name := v_actor.full_name;
      NEW.decided_at := now();
      NEW.acceptance_evidence := COALESCE(NEW.acceptance_evidence, '{}'::jsonb) || jsonb_build_object(
        'server_verified_user_id', v_uid,
        'server_verified_contact_id', v_actor.contact_id,
        'server_verified_name', v_actor.full_name,
        'server_verified_at', now()
      );
    ELSE
      -- Keep prior decision fields untouched if only recording view
      NEW.decided_by_user_id := OLD.decided_by_user_id;
      NEW.decided_by_contact_id := OLD.decided_by_contact_id;
      NEW.decided_by_name := OLD.decided_by_name;
      NEW.decided_at := OLD.decided_at;
    END IF;
  ELSE
    NEW.decided_by_user_id := OLD.decided_by_user_id;
    NEW.decided_by_contact_id := OLD.decided_by_contact_id;
    NEW.decided_by_name := OLD.decided_by_name;
    NEW.decided_at := OLD.decided_at;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_quotation_update ON public.client_quotations_contracts;
CREATE TRIGGER trg_01_guard_client_quotation_update
  BEFORE UPDATE ON public.client_quotations_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_quotation_update();

-- 4B-ii. client_quotations_contracts B2B client PO/Contract INSERT guard
CREATE OR REPLACE FUNCTION public.trg_guard_client_b2b_quote_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(NEW.project_id, v_uid);

  IF v_actor.client_id IS NOT NULL THEN
    NEW.client_id := v_actor.client_id;
  END IF;
  NEW.is_b2b_client_issued := true;
  NEW.prepared_by := v_uid;
  NEW.status := 'issued';
  NEW.issued_at := now();
  NEW.viewed_at := NULL;
  NEW.viewed_by := NULL;
  NEW.decided_by_user_id := NULL;
  NEW.decided_by_contact_id := NULL;
  NEW.decided_by_name := NULL;
  NEW.decided_at := NULL;
  NEW.decision_comments := NULL;
  NEW.acceptance_evidence := '{}'::jsonb;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_b2b_quote_insert ON public.client_quotations_contracts;
CREATE TRIGGER trg_01_guard_client_b2b_quote_insert
  BEFORE INSERT ON public.client_quotations_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_b2b_quote_insert();

-- 4C. prework_surface_inspections column guard
CREATE OR REPLACE FUNCTION public.trg_guard_client_prework_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.work_package_id IS DISTINCT FROM OLD.work_package_id
     OR NEW.technical_inspection_id IS DISTINCT FROM OLD.technical_inspection_id
     OR NEW.inspection_ref IS DISTINCT FROM OLD.inspection_ref
     OR NEW.area_label IS DISTINCT FROM OLD.area_label
     OR NEW.inspection_date IS DISTINCT FROM OLD.inspection_date
     OR NEW.inspector_id IS DISTINCT FROM OLD.inspector_id
     OR NEW.inspector_name IS DISTINCT FROM OLD.inspector_name
     OR NEW.substrate_type IS DISTINCT FROM OLD.substrate_type
     OR NEW.substrate_condition IS DISTINCT FROM OLD.substrate_condition
     OR NEW.screeding_plastering_quality IS DISTINCT FROM OLD.screeding_plastering_quality
     OR NEW.has_cracks IS DISTINCT FROM OLD.has_cracks
     OR NEW.has_dampness IS DISTINCT FROM OLD.has_dampness
     OR NEW.has_unevenness IS DISTINCT FROM OLD.has_unevenness
     OR NEW.has_damage IS DISTINCT FROM OLD.has_damage
     OR NEW.defect_details IS DISTINCT FROM OLD.defect_details
     OR NEW.other_contractor_observation IS DISTINCT FROM OLD.other_contractor_observation
     OR NEW.recommended_correction IS DISTINCT FROM OLD.recommended_correction
     OR NEW.scope_responsibility IS DISTINCT FROM OLD.scope_responsibility
     OR NEW.estimated_cost_impact IS DISTINCT FROM OLD.estimated_cost_impact
     OR NEW.estimated_time_impact_days IS DISTINCT FROM OLD.estimated_time_impact_days
     OR NEW.evidence_media IS DISTINCT FROM OLD.evidence_media
     OR NEW.clearance_to_proceed IS DISTINCT FROM OLD.clearance_to_proceed
     OR NEW.clearance_notes IS DISTINCT FROM OLD.clearance_notes
     OR NEW.client_visible IS DISTINCT FROM OLD.client_visible
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Unauthorized column modification: Clients may only record their pre-work surface decision and notes.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(OLD.project_id, v_uid);
  NEW.client_decided_by := v_uid;
  NEW.client_decided_by_name := v_actor.full_name;
  NEW.client_decided_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_prework_update ON public.prework_surface_inspections;
CREATE TRIGGER trg_01_guard_client_prework_update
  BEFORE UPDATE ON public.prework_surface_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_prework_update();

-- 4D. project_progress_updates column guard
CREATE OR REPLACE FUNCTION public.trg_guard_client_progress_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.work_package_id IS DISTINCT FROM OLD.work_package_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.stage_name IS DISTINCT FROM OLD.stage_name
     OR NEW.activity_type IS DISTINCT FROM OLD.activity_type
     OR NEW.planned_date IS DISTINCT FROM OLD.planned_date
     OR NEW.actual_date IS DISTINCT FROM OLD.actual_date
     OR NEW.progress_percent IS DISTINCT FROM OLD.progress_percent
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.delay_reason IS DISTINCT FROM OLD.delay_reason
     OR NEW.technical_concern IS DISTINCT FROM OLD.technical_concern
     OR NEW.media_items IS DISTINCT FROM OLD.media_items
     OR NEW.reported_by IS DISTINCT FROM OLD.reported_by
     OR NEW.reported_by_name IS DISTINCT FROM OLD.reported_by_name
     OR NEW.reported_at IS DISTINCT FROM OLD.reported_at
     OR NEW.inspected_by IS DISTINCT FROM OLD.inspected_by
     OR NEW.inspected_by_name IS DISTINCT FROM OLD.inspected_by_name
     OR NEW.inspected_at IS DISTINCT FROM OLD.inspected_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_by_name IS DISTINCT FROM OLD.verified_by_name
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.handed_over_at IS DISTINCT FROM OLD.handed_over_at
     OR NEW.client_visible IS DISTINCT FROM OLD.client_visible
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Unauthorized column modification: Clients may only acknowledge verified progress milestones.'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.verification_stage <> 'verified_completed' OR NEW.verification_stage <> 'acknowledged_by_client' THEN
    RAISE EXCEPTION 'Progress updates can only transition from verified_completed to acknowledged_by_client by clients.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(OLD.project_id, v_uid);
  NEW.acknowledged_by := v_uid;
  NEW.acknowledged_by_name := v_actor.full_name;
  NEW.acknowledged_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_progress_update ON public.project_progress_updates;
CREATE TRIGGER trg_01_guard_client_progress_update
  BEFORE UPDATE ON public.project_progress_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_progress_update();

-- 4E. project_area_completions column guard
CREATE OR REPLACE FUNCTION public.trg_guard_client_area_completion_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.work_package_id IS DISTINCT FROM OLD.work_package_id
     OR NEW.specification_id IS DISTINCT FROM OLD.specification_id
     OR NEW.specification_version IS DISTINCT FROM OLD.specification_version
     OR NEW.technical_inspection_id IS DISTINCT FROM OLD.technical_inspection_id
     OR NEW.completion_ref IS DISTINCT FROM OLD.completion_ref
     OR NEW.area_location IS DISTINCT FROM OLD.area_location
     OR NEW.work_performed IS DISTINCT FROM OLD.work_performed
     OR NEW.quantity_completed IS DISTINCT FROM OLD.quantity_completed
     OR NEW.unit_of_measure IS DISTINCT FROM OLD.unit_of_measure
     OR NEW.completion_date IS DISTINCT FROM OLD.completion_date
     OR NEW.site_supervisor_id IS DISTINCT FROM OLD.site_supervisor_id
     OR NEW.site_supervisor_name IS DISTINCT FROM OLD.site_supervisor_name
     OR NEW.assigned_team_summary IS DISTINCT FROM OLD.assigned_team_summary
     OR NEW.completion_photos IS DISTINCT FROM OLD.completion_photos
     OR NEW.completion_videos IS DISTINCT FROM OLD.completion_videos
     OR NEW.qc_inspector_id IS DISTINCT FROM OLD.qc_inspector_id
     OR NEW.qc_inspector_name IS DISTINCT FROM OLD.qc_inspector_name
     OR NEW.qc_outcome IS DISTINCT FROM OLD.qc_outcome
     OR NEW.qc_snag_status IS DISTINCT FROM OLD.qc_snag_status
     OR NEW.qc_notes IS DISTINCT FROM OLD.qc_notes
     OR NEW.qc_verified_at IS DISTINCT FROM OLD.qc_verified_at
     OR NEW.linked_snag_task_id IS DISTINCT FROM OLD.linked_snag_task_id
     OR NEW.area_released IS DISTINCT FROM OLD.area_released
     OR NEW.release_label IS DISTINCT FROM OLD.release_label
     OR NEW.condition_at_release IS DISTINCT FROM OLD.condition_at_release
     OR NEW.outstanding_snags_at_release IS DISTINCT FROM OLD.outstanding_snags_at_release
     OR NEW.released_at IS DISTINCT FROM OLD.released_at
     OR NEW.released_by IS DISTINCT FROM OLD.released_by
     OR NEW.released_by_name IS DISTINCT FROM OLD.released_by_name
     OR NEW.receiving_representative IS DISTINCT FROM OLD.receiving_representative
     OR NEW.protection_measures IS DISTINCT FROM OLD.protection_measures
     OR NEW.coordination_notes IS DISTINCT FROM OLD.coordination_notes
     OR NEW.formal_handover_occurred IS DISTINCT FROM OLD.formal_handover_occurred
     OR NEW.formal_handover_at IS DISTINCT FROM OLD.formal_handover_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Unauthorized column modification: Clients may only acknowledge or reject verified area completions.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.workflow_status NOT IN ('client_acknowledged', 'client_rejected') THEN
    RAISE EXCEPTION 'Invalid area completion workflow transition for client actor.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(OLD.project_id, v_uid);
  NEW.client_acknowledgement_status := CASE
    WHEN NEW.workflow_status = 'client_acknowledged' THEN 'acknowledged'
    ELSE 'rejected'
  END;
  NEW.client_acknowledged_by := v_uid;
  NEW.client_acknowledged_by_name := v_actor.full_name;
  NEW.client_acknowledged_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_area_completion_update ON public.project_area_completions;
CREATE TRIGGER trg_01_guard_client_area_completion_update
  BEFORE UPDATE ON public.project_area_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_area_completion_update();

-- 4F. subsequent_damage_incidents column guard
CREATE OR REPLACE FUNCTION public.trg_guard_client_damage_response_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.incident_ref IS DISTINCT FROM OLD.incident_ref
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.area_completion_id IS DISTINCT FROM OLD.area_completion_id
     OR NEW.discovered_date IS DISTINCT FROM OLD.discovered_date
     OR NEW.area_location IS DISTINCT FROM OLD.area_location
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.known_or_suspected_cause IS DISTINCT FROM OLD.known_or_suspected_cause
     OR NEW.relevant_contractors_activities IS DISTINCT FROM OLD.relevant_contractors_activities
     OR NEW.damage_media IS DISTINCT FROM OLD.damage_media
     OR NEW.reported_by IS DISTINCT FROM OLD.reported_by
     OR NEW.reported_by_name IS DISTINCT FROM OLD.reported_by_name
     OR NEW.technical_assessment IS DISTINCT FROM OLD.technical_assessment
     OR NEW.assessed_by IS DISTINCT FROM OLD.assessed_by
     OR NEW.assessed_by_name IS DISTINCT FROM OLD.assessed_by_name
     OR NEW.assessed_at IS DISTINCT FROM OLD.assessed_at
     OR NEW.proposed_correction IS DISTINCT FROM OLD.proposed_correction
     OR NEW.rework_classification IS DISTINCT FROM OLD.rework_classification
     OR NEW.liability_status IS DISTINCT FROM OLD.liability_status
     OR NEW.is_chargeable IS DISTINCT FROM OLD.is_chargeable
     OR NEW.estimated_cost_impact IS DISTINCT FROM OLD.estimated_cost_impact
     OR NEW.estimated_time_impact_days IS DISTINCT FROM OLD.estimated_time_impact_days
     OR NEW.notified_party IS DISTINCT FROM OLD.notified_party
     OR NEW.notified_at IS DISTINCT FROM OLD.notified_at
     OR NEW.linked_variation_id IS DISTINCT FROM OLD.linked_variation_id
     OR NEW.resolution_status IS DISTINCT FROM OLD.resolution_status
     OR NEW.resolution_notes IS DISTINCT FROM OLD.resolution_notes
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
     OR NEW.client_visible IS DISTINCT FROM OLD.client_visible
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Unauthorized column modification: Clients may only record their external response on damage incidents.'
      USING ERRCODE = '42501';
  END IF;

  NEW.external_responded_by := v_uid;
  NEW.external_responded_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_damage_response_update ON public.subsequent_damage_incidents;
CREATE TRIGGER trg_01_guard_client_damage_response_update
  BEFORE UPDATE ON public.subsequent_damage_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_damage_response_update();

-- 4G. project_variations column guard (runs BEFORE trg_enforce_variation_approval_limit!)
CREATE OR REPLACE FUNCTION public.trg_guard_client_variation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
BEGIN
  IF v_uid IS NULL OR public.auth_is_internal_staff(v_uid) THEN
    RETURN NEW;
  END IF;

  -- Block any client attempt to alter estimated_cost, is_chargeable, scope, or internal approvals
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.variation_ref IS DISTINCT FROM OLD.variation_ref
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.work_package_id IS DISTINCT FROM OLD.work_package_id
     OR NEW.source_damage_incident_id IS DISTINCT FROM OLD.source_damage_incident_id
     OR NEW.source_request_id IS DISTINCT FROM OLD.source_request_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.rework_classification IS DISTINCT FROM OLD.rework_classification
     OR NEW.original_spec_summary IS DISTINCT FROM OLD.original_spec_summary
     OR NEW.revised_spec_summary IS DISTINCT FROM OLD.revised_spec_summary
     OR NEW.scope_and_quantity_notes IS DISTINCT FROM OLD.scope_and_quantity_notes
     OR NEW.is_chargeable IS DISTINCT FROM OLD.is_chargeable
     OR NEW.estimated_cost IS DISTINCT FROM OLD.estimated_cost
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.time_impact_days IS DISTINCT FROM OLD.time_impact_days
     OR NEW.contract_variation_type IS DISTINCT FROM OLD.contract_variation_type
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
     OR NEW.requested_by_name IS DISTINCT FROM OLD.requested_by_name
     OR NEW.technical_assessor_id IS DISTINCT FROM OLD.technical_assessor_id
     OR NEW.technical_assessment_notes IS DISTINCT FROM OLD.technical_assessment_notes
     OR NEW.internal_approved_by IS DISTINCT FROM OLD.internal_approved_by
     OR NEW.internal_approved_by_name IS DISTINCT FROM OLD.internal_approved_by_name
     OR NEW.internal_approved_at IS DISTINCT FROM OLD.internal_approved_at
     OR NEW.revised_instruction_notes IS DISTINCT FROM OLD.revised_instruction_notes
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.reconciled_amount IS DISTINCT FROM OLD.reconciled_amount
     OR NEW.reconciled_at IS DISTINCT FROM OLD.reconciled_at
     OR NEW.is_subcontract_confidential IS DISTINCT FROM OLD.is_subcontract_confidential
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Unauthorized column modification: Clients cannot modify variation cost, chargeability, or scope fields.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.workflow_stage NOT IN ('client_approved', 'client_rejected', 'disputed') THEN
    RAISE EXCEPTION 'Invalid variation workflow transition for client actor.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_actor FROM public.auth_resolve_client_actor_identity(OLD.project_id, v_uid);
  NEW.client_decided_by := v_uid;
  NEW.client_decided_by_name := v_actor.full_name;
  NEW.client_decided_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_guard_client_variation_update ON public.project_variations;
CREATE TRIGGER trg_01_guard_client_variation_update
  BEFORE UPDATE ON public.project_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_guard_client_variation_update();

-- ------------------------------------------------------------------------------
-- 5. SUBCONTRACTOR PRICING PROTECTION AT THE DATABASE / API BOUNDARY
-- ------------------------------------------------------------------------------

-- 5A. Weekly summaries subcontract-financial flag & RLS hardening
ALTER TABLE public.client_weekly_summaries
  ADD COLUMN IF NOT EXISTS contains_subcontract_financials boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "weekly_summaries_select" ON public.client_weekly_summaries;
CREATE POLICY "weekly_summaries_select" ON public.client_weekly_summaries
  FOR SELECT TO authenticated
  USING (
    public.auth_is_assigned_to_project(project_id, auth.uid())
    OR (
      status = 'released'
      AND public.auth_client_has_project_access(project_id, NULL, auth.uid())
      AND (
        contains_subcontract_financials = false
        OR EXISTS (
          SELECT 1
          FROM public.client_project_access cpa
          JOIN public.client_contacts cc ON cc.id = cpa.client_contact_id
          WHERE cpa.project_id = client_weekly_summaries.project_id
            AND (cpa.user_id = auth.uid() OR cc.user_id = auth.uid())
            AND cpa.is_active = true
            AND cpa.revoked_at IS NULL
            AND cc.is_active = true
            AND cpa.can_view_financials = true
            AND cpa.hide_subcontract_pricing = false
        )
      )
    )
  );

-- RPC returning weekly summaries with DB-level financial key stripping for unauthorized/subcontract-masked clients
CREATE OR REPLACE FUNCTION public.get_client_weekly_summaries(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_can_view_financials boolean := false;
  v_hide_subcontract boolean := true;
  v_delivery_model text;
  v_strip_financials boolean := true;
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.auth_is_active(v_uid) THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_is_staff := public.auth_is_assigned_to_project(p_project_id, v_uid);

  IF NOT v_is_staff AND NOT public.auth_client_has_project_access(p_project_id, NULL, v_uid) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT p.project_delivery_model INTO v_delivery_model
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF v_is_staff THEN
    v_strip_financials := false;
    v_hide_subcontract := false;
  ELSE
    SELECT
      COALESCE(bool_or(cpa.can_view_financials), false),
      COALESCE(bool_and(cpa.hide_subcontract_pricing), true)
    INTO v_can_view_financials, v_hide_subcontract
    FROM public.client_project_access cpa
    JOIN public.client_contacts cc ON cc.id = cpa.client_contact_id
    WHERE cpa.project_id = p_project_id
      AND (cpa.user_id = v_uid OR cc.user_id = v_uid)
      AND cpa.is_active = true
      AND cpa.revoked_at IS NULL
      AND cc.is_active = true;

    v_strip_financials := (
      NOT v_can_view_financials
      OR (
        v_delivery_model IN ('main_contractor_subcontract', 'multi_party_commercial')
        AND v_hide_subcontract = true
      )
    );
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ws.id,
        'project_id', ws.project_id,
        'week_start_date', ws.week_start_date,
        'week_end_date', ws.week_end_date,
        'summary_title', ws.summary_title,
        'snapshot_data', CASE
          WHEN v_strip_financials THEN
            COALESCE(ws.snapshot_data, '{}'::jsonb)
              - 'approved_variations_total'
              - 'accepted_contracts_total'
              - 'contract_value'
              - 'subcontract_value'
          ELSE COALESCE(ws.snapshot_data, '{}'::jsonb)
        END,
        'executive_notes', ws.executive_notes,
        'upcoming_activities', ws.upcoming_activities,
        'pending_client_decisions', ws.pending_client_decisions,
        'status', ws.status,
        'contains_subcontract_financials', ws.contains_subcontract_financials,
        'prepared_by', ws.prepared_by,
        'prepared_by_name', ws.prepared_by_name,
        'reviewed_by', ws.reviewed_by,
        'reviewed_by_name', ws.reviewed_by_name,
        'reviewed_at', ws.reviewed_at,
        'released_by', ws.released_by,
        'released_by_name', ws.released_by_name,
        'released_at', ws.released_at,
        'created_at', ws.created_at
      )
      ORDER BY ws.week_end_date DESC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.client_weekly_summaries ws
  WHERE ws.project_id = p_project_id
    AND (v_is_staff OR ws.status = 'released')
    AND (
      v_is_staff
      OR ws.contains_subcontract_financials = false
      OR (v_can_view_financials = true AND v_hide_subcontract = false)
    );

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_weekly_summaries(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_weekly_summaries(uuid) TO authenticated;

-- 5B. Database/API-boundary masked project reader for authorized client portal views
CREATE OR REPLACE FUNCTION public.get_client_authorized_projects(
  p_project_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.auth_is_active(v_uid) THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  v_is_staff := public.auth_is_internal_staff(v_uid);

  WITH scoped AS (
    SELECT
      p.*,
      CASE
        WHEN v_is_staff THEN true
        ELSE (
          COALESCE(cpa.can_view_financials, false) = true
          AND NOT (
            p.project_delivery_model IN ('main_contractor_subcontract', 'multi_party_commercial')
            AND COALESCE(cpa.hide_subcontract_pricing, true) = true
          )
        )
      END AS allow_contract_value
    FROM public.projects p
    LEFT JOIN public.client_project_access cpa
      ON cpa.project_id = p.id
     AND cpa.is_active = true
     AND cpa.revoked_at IS NULL
     AND (
       cpa.user_id = v_uid
       OR EXISTS (
         SELECT 1
         FROM public.client_contacts cc
         WHERE cc.id = cpa.client_contact_id
           AND cc.user_id = v_uid
           AND cc.is_active = true
       )
     )
    WHERE (p_project_id IS NULL OR p.id = p_project_id)
      AND (
        (v_is_staff AND public.auth_is_assigned_to_project(p.id, v_uid))
        OR (NOT v_is_staff AND cpa.id IS NOT NULL)
      )
  ),
  dedup AS (
    SELECT DISTINCT ON (id) *
    FROM scoped
    ORDER BY id, allow_contract_value DESC
  )
  SELECT COALESCE(
    jsonb_agg(
      (
        to_jsonb(d)
        - 'allow_contract_value'
        || CASE
             WHEN d.allow_contract_value THEN '{}'::jsonb
             ELSE jsonb_build_object('contract_value', NULL, 'budget_amount', NULL)
           END
      )
      ORDER BY d.project_code ASC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM dedup d;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_authorized_projects(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_authorized_projects(uuid) TO authenticated;

-- 5C. Harden get_corporate_portfolio_summary() to enforce hide_subcontract_pricing
--     and multi-party confidential complaint isolation at the database boundary.
CREATE OR REPLACE FUNCTION public.get_corporate_portfolio_summary(
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_staff boolean;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.auth_is_active(v_uid) THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_is_staff := public.auth_is_portal_manager(v_uid)
    OR public.auth_is_leadership(v_uid)
    OR public.auth_has_permission('corporate_portfolios.view');

  WITH authorized_projects AS (
    SELECT
      p.id,
      p.project_code,
      p.name,
      p.client_id,
      p.status::text AS status,
      p.city,
      p.state,
      p.country,
      p.currency,
      COALESCE(p.contract_value, 0) AS contract_value,
      p.start_date,
      p.expected_completion_date,
      p.project_delivery_model,
      p.client_visible_stage,
      COALESCE(p.verified_progress_pct, 0) AS verified_progress_pct,
      c.name AS client_name,
      c.company_name AS client_company_name,
      c.account_type AS client_account_type,
      CASE WHEN v_is_staff THEN false ELSE COALESCE(cpa.hide_subcontract_pricing, true) END AS hide_subcontract_pricing,
      CASE
        WHEN v_is_staff THEN true
        ELSE (
          COALESCE(cpa.can_view_financials, false) = true
          AND NOT (
            p.project_delivery_model IN ('main_contractor_subcontract', 'multi_party_commercial')
            AND COALESCE(cpa.hide_subcontract_pricing, true) = true
          )
        )
      END AS can_view_financials
    FROM public.projects p
    LEFT JOIN public.clients c ON c.id = p.client_id
    LEFT JOIN public.client_project_access cpa
      ON cpa.project_id = p.id
     AND cpa.is_active = true
     AND cpa.revoked_at IS NULL
     AND (
       cpa.user_id = v_uid
       OR EXISTS (
         SELECT 1 FROM public.client_contacts cc
         WHERE cc.id = cpa.client_contact_id
           AND cc.user_id = v_uid
           AND cc.is_active = true
       )
     )
    WHERE (p_client_id IS NULL OR p.client_id = p_client_id)
      AND (
        v_is_staff
        OR cpa.id IS NOT NULL
      )
  ),
  dedup_projects AS (
    SELECT DISTINCT ON (id) *
    FROM authorized_projects
    ORDER BY id, can_view_financials DESC, hide_subcontract_pricing ASC
  ),
  enriched AS (
    SELECT
      dp.*,
      (SELECT count(*)::int FROM public.project_work_packages wp WHERE wp.project_id = dp.id) AS total_work_packages,
      (SELECT count(*)::int FROM public.project_work_packages wp WHERE wp.project_id = dp.id AND wp.status IN ('verified', 'released', 'handed_over')) AS completed_work_packages,
      (SELECT count(*)::int FROM public.work_package_blockers wb WHERE wb.project_id = dp.id AND wb.status IN ('open', 'escalated') AND (v_is_staff OR wb.client_visible = true)) AS active_blockers,
      (
        SELECT count(*)::int
        FROM public.client_quotations_contracts q
        WHERE q.project_id = dp.id
          AND q.status = 'issued'
          AND (v_is_staff OR dp.hide_subcontract_pricing = false OR q.is_subcontract_confidential = false)
      ) AS pending_quotations,
      (SELECT count(*)::int FROM public.project_specifications s WHERE s.project_id = dp.id AND s.status IN ('submitted', 'awaiting_approval')) AS pending_specs,
      (
        SELECT count(*)::int
        FROM public.project_variations v
        WHERE v.project_id = dp.id
          AND v.workflow_stage = 'awaiting_client_approval'
          AND (v_is_staff OR dp.hide_subcontract_pricing = false OR v.is_subcontract_confidential = false)
      ) AS pending_variations,
      (SELECT count(*)::int FROM public.project_area_completions a WHERE a.project_id = dp.id AND a.client_acknowledgement_status = 'pending') AS pending_completions,
      (
        SELECT count(*)::int
        FROM public.client_requests_complaints rc
        WHERE rc.project_id = dp.id
          AND rc.status NOT IN ('resolved', 'closed')
          AND (
            (v_is_staff AND (rc.subject_user_id IS NULL OR rc.subject_user_id <> v_uid) AND (rc.is_confidential_management = false OR public.auth_is_leadership(v_uid) OR rc.independent_reviewer_id = v_uid))
            OR (NOT v_is_staff AND (rc.is_confidential_management = false OR rc.submitted_by_user_id = v_uid))
          )
      ) AS open_tickets
    FROM dedup_projects dp
  )
  SELECT jsonb_build_object(
    'project_count', COALESCE((SELECT count(*)::int FROM enriched), 0),
    'average_verified_progress', COALESCE((SELECT round(avg(verified_progress_pct)::numeric, 1) FROM enriched), 0),
    'total_contract_value', COALESCE((SELECT sum(CASE WHEN can_view_financials THEN contract_value ELSE 0 END) FROM enriched), 0),
    'total_work_packages', COALESCE((SELECT sum(total_work_packages)::int FROM enriched), 0),
    'completed_work_packages', COALESCE((SELECT sum(completed_work_packages)::int FROM enriched), 0),
    'active_blockers', COALESCE((SELECT sum(active_blockers)::int FROM enriched), 0),
    'total_pending_approvals', COALESCE((SELECT sum(pending_quotations + pending_specs + pending_variations + pending_completions)::int FROM enriched), 0),
    'open_tickets', COALESCE((SELECT sum(open_tickets)::int FROM enriched), 0),
    'projects', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'project_code', e.project_code,
          'name', e.name,
          'client_id', e.client_id,
          'client_name', COALESCE(e.client_company_name, e.client_name),
          'client_account_type', e.client_account_type,
          'status', e.status,
          'location', NULLIF(concat_ws(', ', e.city, e.state, e.country), ''),
          'currency', COALESCE(e.currency, 'NGN'),
          'contract_value', CASE WHEN e.can_view_financials THEN e.contract_value ELSE NULL END,
          'can_view_financials', e.can_view_financials,
          'start_date', e.start_date,
          'expected_completion_date', e.expected_completion_date,
          'project_delivery_model', e.project_delivery_model,
          'client_visible_stage', e.client_visible_stage,
          'verified_progress_pct', e.verified_progress_pct,
          'total_work_packages', e.total_work_packages,
          'completed_work_packages', e.completed_work_packages,
          'active_blockers', e.active_blockers,
          'pending_quotations', e.pending_quotations,
          'pending_specs', e.pending_specs,
          'pending_variations', e.pending_variations,
          'pending_completions', e.pending_completions,
          'open_tickets', e.open_tickets
        ) ORDER BY e.project_code ASC
      )
      FROM enriched e
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_corporate_portfolio_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_corporate_portfolio_summary(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. CONFIDENTIAL WORKER CONDUCT DISCLOSURES (MINIMUM NEW TABLE FOR RELEASE 1A)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worker_conduct_disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disclosure_ref text NOT NULL UNIQUE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  reported_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reported_by_name text,
  reporter_role text,
  disclosure_category text NOT NULL
    CHECK (disclosure_category IN (
      'unauthorised_payment_request',
      'side_job_solicitation',
      'material_diversion',
      'spec_bypass_pressure',
      'complaint_concealment',
      'workmanship_coverup',
      'unsafe_instruction',
      'other_conduct'
    )),
  subject_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_description text,
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  evidence_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_anonymous_to_site_team boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_investigation', 'action_taken', 'closed', 'unsubstantiated')),
  assigned_investigator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  investigation_notes text,
  resolution_summary text,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by_name text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_disclosures_status
  ON public.worker_conduct_disclosures (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_disclosures_reporter
  ON public.worker_conduct_disclosures (reported_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_disclosures_project
  ON public.worker_conduct_disclosures (project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worker_disclosures_investigator
  ON public.worker_conduct_disclosures (assigned_investigator_id)
  WHERE assigned_investigator_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON TABLE public.worker_conduct_disclosures TO authenticated;
ALTER TABLE public.worker_conduct_disclosures ENABLE ROW LEVEL SECURITY;

-- RLS: Leadership (excluding subject), assigned investigator (excluding subject), or reporter (own rows only)
DROP POLICY IF EXISTS "worker_disclosures_select" ON public.worker_conduct_disclosures;
CREATE POLICY "worker_disclosures_select" ON public.worker_conduct_disclosures
  FOR SELECT TO authenticated
  USING (
    public.auth_is_internal_staff(auth.uid())
    AND (
      reported_by = auth.uid()
      OR (
        (subject_user_id IS NULL OR subject_user_id <> auth.uid())
        AND (
          public.auth_is_leadership(auth.uid())
          OR (assigned_investigator_id = auth.uid() AND public.auth_is_active(auth.uid()))
        )
      )
    )
  );

DROP POLICY IF EXISTS "worker_disclosures_insert" ON public.worker_conduct_disclosures;
CREATE POLICY "worker_disclosures_insert" ON public.worker_conduct_disclosures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_internal_staff(auth.uid())
    AND reported_by = auth.uid()
  );

DROP POLICY IF EXISTS "worker_disclosures_update" ON public.worker_conduct_disclosures;
CREATE POLICY "worker_disclosures_update" ON public.worker_conduct_disclosures
  FOR UPDATE TO authenticated
  USING (
    (subject_user_id IS NULL OR subject_user_id <> auth.uid())
    AND (
      public.auth_is_leadership(auth.uid())
      OR (assigned_investigator_id = auth.uid() AND public.auth_is_active(auth.uid()))
    )
  )
  WITH CHECK (
    (subject_user_id IS NULL OR subject_user_id <> auth.uid())
    AND (
      public.auth_is_leadership(auth.uid())
      OR (assigned_investigator_id = auth.uid() AND public.auth_is_active(auth.uid()))
    )
  );

-- BEFORE INSERT trigger: derive reporter identity & role from auth.uid(), enforce confidential storage vault
CREATE OR REPLACE FUNCTION public.trg_worker_disclosure_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_item jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.auth_is_internal_staff(v_uid) THEN
    RAISE EXCEPTION 'Only authenticated internal Davejoe staff may submit confidential conduct disclosures.'
      USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(COALESCE(NEW.evidence_media, '[]'::jsonb)) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.evidence_media, '[]'::jsonb))
    LOOP
      IF COALESCE(v_item->>'bucket_id', '') <> 'confidential-case-evidence' THEN
        RAISE EXCEPTION 'Worker disclosure evidence must be uploaded to the private confidential-case-evidence vault.'
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END IF;

  SELECT r.slug INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_uid
  LIMIT 1;

  NEW.reported_by := v_uid;
  NEW.reported_by_name := public.auth_resolve_profile_display_name(v_uid);
  NEW.reporter_role := COALESCE(v_role, 'staff');

  IF NEW.disclosure_ref IS NULL OR trim(NEW.disclosure_ref) = '' THEN
    NEW.disclosure_ref := 'WCD-' || to_char(now(), 'YYYY') || '-' || upper(substring(encode(gen_random_bytes(3), 'hex') FROM 1 FOR 6));
  END IF;

  -- Lock initial triage state server-side
  NEW.status := 'submitted';
  NEW.assigned_investigator_id := NULL;
  NEW.investigation_notes := NULL;
  NEW.resolution_summary := NULL;
  NEW.resolved_by := NULL;
  NEW.resolved_by_name := NULL;
  NEW.resolved_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_worker_disclosure_insert_guard ON public.worker_conduct_disclosures;
CREATE TRIGGER trg_01_worker_disclosure_insert_guard
  BEFORE INSERT ON public.worker_conduct_disclosures
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_worker_disclosure_insert_guard();

-- BEFORE UPDATE trigger: conflict-of-interest guard + immutability of original allegation
CREATE OR REPLACE FUNCTION public.trg_worker_disclosure_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    IF OLD.subject_user_id IS NOT NULL AND v_uid = OLD.subject_user_id THEN
      RAISE EXCEPTION 'Conflict of interest: You cannot review or update a disclosure concerning yourself.'
        USING ERRCODE = '42501';
    END IF;

    IF NOT public.auth_is_leadership(v_uid) AND v_uid IS DISTINCT FROM OLD.assigned_investigator_id THEN
      RAISE EXCEPTION 'Only Management, Executive Director, or the assigned investigator may update conduct disclosures.'
        USING ERRCODE = '42501';
    END IF;

    -- Original allegation, reporter identity, and uploaded evidence are immutable
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.disclosure_ref IS DISTINCT FROM OLD.disclosure_ref
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.reported_by IS DISTINCT FROM OLD.reported_by
       OR NEW.reported_by_name IS DISTINCT FROM OLD.reported_by_name
       OR NEW.reporter_role IS DISTINCT FROM OLD.reporter_role
       OR NEW.disclosure_category IS DISTINCT FROM OLD.disclosure_category
       OR NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id
       OR NEW.subject_description IS DISTINCT FROM OLD.subject_description
       OR NEW.incident_date IS DISTINCT FROM OLD.incident_date
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.evidence_media IS DISTINCT FROM OLD.evidence_media
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Original worker conduct disclosure details and evidence are immutable.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status IN ('action_taken', 'closed', 'unsubstantiated') AND OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.resolved_by := v_uid;
      NEW.resolved_by_name := public.auth_resolve_profile_display_name(v_uid);
      NEW.resolved_at := now();
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_01_worker_disclosure_update_guard ON public.worker_conduct_disclosures;
CREATE TRIGGER trg_01_worker_disclosure_update_guard
  BEFORE UPDATE ON public.worker_conduct_disclosures
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_worker_disclosure_update_guard();

-- AFTER INSERT trigger: notify Management & Executive Director ONLY (excluding any named subject)
CREATE OR REPLACE FUNCTION public.trg_notify_worker_conduct_disclosures()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF to_regprocedure('public.internal_notify_roles(text[],uuid,text,text,text,text,text,text,uuid,uuid,text,text,jsonb,uuid)') IS NOT NULL THEN
    PERFORM public.internal_notify_roles(
      ARRAY['management', 'executive_director'],
      NEW.reported_by,
      'Confidential Worker Conduct Disclosure: ' || NEW.disclosure_ref,
      'A confidential ' || replace(NEW.disclosure_category, '_', ' ') || ' disclosure has been submitted for Leadership review.',
      'escalation',
      'workforce',
      'critical',
      'worker_conduct_disclosures',
      NEW.id,
      NEW.project_id,
      '/ceo/workforce/conduct',
      'worker_disclosure_created:' || NEW.id::text,
      jsonb_build_object(
        'disclosure_ref', NEW.disclosure_ref,
        'category', NEW.disclosure_category,
        'confidential', true
      ),
      NEW.subject_user_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_worker_conduct_disclosures ON public.worker_conduct_disclosures;
CREATE TRIGGER trg_notify_worker_conduct_disclosures
  AFTER INSERT ON public.worker_conduct_disclosures
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_worker_conduct_disclosures();

-- ------------------------------------------------------------------------------
-- 7. CONFIDENTIAL STORAGE AUTHORIZATION HELPER & RLS POLICIES
--    Defined AFTER worker_conduct_disclosures exists so the helper can verify
--    assigned investigators and subject conflict-of-interest across both tables.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_can_read_confidential_evidence(
  p_object_name text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_parts text[];
  v_uploader_segment text;
  v_is_subject boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_object_name IS NULL OR trim(p_object_name) = '' THEN
    RETURN false;
  END IF;

  IF NOT public.auth_is_active(p_user_id) THEN
    RETURN false;
  END IF;

  -- Hard conflict-of-interest wall: named subject can NEVER read confidential evidence
  SELECT EXISTS (
    SELECT 1
    FROM public.client_requests_complaints crc
    WHERE crc.subject_user_id = p_user_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(crc.attachments, '[]'::jsonb)) elem
        WHERE elem->>'storage_path' = p_object_name
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.worker_conduct_disclosures wcd
    WHERE wcd.subject_user_id = p_user_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(wcd.evidence_media, '[]'::jsonb)) elem
        WHERE elem->>'storage_path' = p_object_name
      )
  )
  INTO v_is_subject;

  IF v_is_subject THEN
    RETURN false;
  END IF;

  -- Path format: <project_id_or_general>/<uploader_user_id>/<category>/<filename>
  v_parts := string_to_array(p_object_name, '/');
  v_uploader_segment := v_parts[2];

  -- 1. Original uploader
  IF v_uploader_segment IS NOT NULL AND v_uploader_segment = p_user_id::text THEN
    RETURN true;
  END IF;

  -- 2. Leadership (Management / Executive Director) — conflict check already passed above
  IF public.auth_is_leadership(p_user_id) THEN
    RETURN true;
  END IF;

  -- 3. Explicitly assigned independent reviewer on client complaint
  IF EXISTS (
    SELECT 1
    FROM public.client_requests_complaints crc
    WHERE crc.independent_reviewer_id = p_user_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(crc.attachments, '[]'::jsonb)) elem
        WHERE elem->>'storage_path' = p_object_name
      )
  ) THEN
    RETURN true;
  END IF;

  -- 4. Explicitly assigned investigator on worker conduct disclosure
  IF EXISTS (
    SELECT 1
    FROM public.worker_conduct_disclosures wcd
    WHERE wcd.assigned_investigator_id = p_user_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(wcd.evidence_media, '[]'::jsonb)) elem
        WHERE elem->>'storage_path' = p_object_name
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_can_read_confidential_evidence(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_can_read_confidential_evidence(text, uuid) TO authenticated;

-- Storage RLS policies for 'confidential-case-evidence'
DROP POLICY IF EXISTS "confidential_case_storage_select" ON storage.objects;
CREATE POLICY "confidential_case_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'confidential-case-evidence'
    AND public.auth_can_read_confidential_evidence(name, auth.uid())
  );

DROP POLICY IF EXISTS "confidential_case_storage_insert" ON storage.objects;
CREATE POLICY "confidential_case_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'confidential-case-evidence'
    AND public.auth_is_active(auth.uid())
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND (
      (
        (storage.foldername(name))[1] = 'general'
        AND public.auth_is_internal_staff(auth.uid())
      )
      OR (
        (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
        AND (
          public.auth_is_internal_staff(auth.uid())
          OR public.auth_client_has_project_access(((storage.foldername(name))[1])::uuid, 'submit_requests_complaints', auth.uid())
        )
      )
    )
  );

DROP POLICY IF EXISTS "confidential_case_storage_delete" ON storage.objects;
CREATE POLICY "confidential_case_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'confidential-case-evidence'
    AND public.auth_is_leadership(auth.uid())
    AND public.auth_can_read_confidential_evidence(name, auth.uid())
  );

COMMIT;
