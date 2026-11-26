-- ==============================================================================
-- DAVEJOE INTERIORS DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261125000006_fix_client_partners_directory_and_projects_rpc.sql
--
-- Purpose:
--   1. Fix `public.get_client_partners_directory()` which previously referenced
--      non-existent `pr.location` on `public.projects` (actual schema uses
--      `address`, `city`, `state`, `country`). Replaces it with schema-resilient
--      `to_jsonb(pr)` location composition so the RPC executes cleanly with zero
--      42703 column errors.
--   2. Add `public.get_assignable_projects_for_client_partners()` SECURITY DEFINER
--      RPC authorized strictly for Management, Executive Director, and Admin
--      (`public.auth_is_portal_manager(auth.uid())`) so authorized managers can
--      always load all existing projects for client assignment without weakening
--      `public.projects` RLS for staff or clients.
--   3. Refine `public.admin_assign_client_partner_project()` to match an existing
--      unlinked `client_contacts` record by email before creating a new `clients`
--      row, preserving existing corporate authority & approval limits.
--
-- Safety:
--   - 100% additive & idempotent (safe to re-run).
--   - Preserves all existing tables, foreign keys, RLS policies, and permissions.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. FIX get_client_partners_directory() — REMOVE NON-EXISTENT pr.location
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_partners_directory()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  first_name text,
  last_name text,
  phone text,
  designation text,
  account_status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  client_id uuid,
  client_name text,
  company_name text,
  account_type text,
  client_contact_id uuid,
  party_role text,
  contact_is_active boolean,
  active_project_count integer,
  assigned_projects jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_portal_manager(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only Management, Executive Director, or Admin may view Client/Project Partners.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH partner_users AS (
    SELECT DISTINCT ur.user_id AS uid
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE lower(COALESCE(r.slug, '')) = 'client_partner'
    UNION
    SELECT DISTINCT cc.user_id AS uid
    FROM public.client_contacts cc
    WHERE cc.user_id IS NOT NULL
  ),
  pure_partners AS (
    SELECT pu.uid
    FROM partner_users pu
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur_int
      JOIN public.roles r_int ON r_int.id = ur_int.role_id
      WHERE ur_int.user_id = pu.uid
        AND lower(COALESCE(r_int.slug, '')) IN (
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
    )
  )
  SELECT
    pp.uid::uuid AS user_id,
    COALESCE(NULLIF(trim(p.email::text), ''), NULLIF(trim(cc.email::text), ''), au.email::text)::text AS email,
    COALESCE(
      NULLIF(trim(cc.full_name::text), ''),
      NULLIF(trim(p.display_name::text), ''),
      NULLIF(trim(COALESCE(p.first_name::text, '') || ' ' || COALESCE(p.last_name::text, '')), ''),
      split_part(COALESCE(NULLIF(trim(p.email::text), ''), au.email::text, ''), '@', 1)
    )::text AS full_name,
    p.first_name::text AS first_name,
    p.last_name::text AS last_name,
    COALESCE(NULLIF(trim(cc.phone::text), ''), NULLIF(trim(p.phone::text), ''), c.phone::text)::text AS phone,
    COALESCE(NULLIF(trim(cc.designation::text), ''), NULLIF(trim(p.job_title::text), ''))::text AS designation,
    COALESCE(NULLIF(trim(p.status::text), ''), 'active')::text AS account_status,
    COALESCE(p.created_at, cc.created_at, au.created_at, now())::timestamptz AS created_at,
    au.last_sign_in_at::timestamptz AS last_sign_in_at,
    c.id::uuid AS client_id,
    c.name::text AS client_name,
    COALESCE(NULLIF(trim(c.company_name::text), ''), NULLIF(trim(cc.organization_name::text), ''), c.name::text)::text AS company_name,
    COALESCE(c.account_type::text, 'individual')::text AS account_type,
    cc.id::uuid AS client_contact_id,
    COALESCE(cc.party_role::text, 'owner')::text AS party_role,
    COALESCE(cc.is_active, true)::boolean AS contact_is_active,
    COALESCE(
      (
        SELECT COUNT(*)::integer
        FROM public.client_project_access cpa_cnt
        WHERE (cpa_cnt.user_id = pp.uid OR (cc.id IS NOT NULL AND cpa_cnt.client_contact_id = cc.id))
          AND cpa_cnt.is_active = true
          AND cpa_cnt.revoked_at IS NULL
      ),
      0
    ) AS active_project_count,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'access_id', cpa.id,
            'project_id', cpa.project_id,
            'project_name', pr.name,
            'project_code', pr.project_code,
            'project_status', pr.status,
            'project_location', NULLIF(
              trim(
                COALESCE(
                  NULLIF(trim(COALESCE(to_jsonb(pr)->>'location', '')), ''),
                  concat_ws(
                    ', ',
                    NULLIF(trim(COALESCE(to_jsonb(pr)->>'address', '')), ''),
                    NULLIF(trim(COALESCE(to_jsonb(pr)->>'city', '')), ''),
                    NULLIF(trim(COALESCE(to_jsonb(pr)->>'state', '')), ''),
                    NULLIF(trim(COALESCE(to_jsonb(pr)->>'country', '')), '')
                  )
                )
              ),
              ''
            ),
            'party_role', cpa.party_role,
            'is_active', cpa.is_active,
            'granted_at', cpa.granted_at,
            'revoked_at', cpa.revoked_at,
            'revoke_reason', cpa.revoke_reason,
            'can_view_commercial', cpa.can_view_commercial,
            'can_approve_quotations', cpa.can_approve_quotations,
            'can_approve_specifications', cpa.can_approve_specifications,
            'can_approve_variations', cpa.can_approve_variations,
            'can_acknowledge_completions', cpa.can_acknowledge_completions,
            'can_approve_payments', cpa.can_approve_payments,
            'can_view_financials', cpa.can_view_financials,
            'hide_subcontract_pricing', cpa.hide_subcontract_pricing,
            'can_submit_requests_complaints', cpa.can_submit_requests_complaints
          )
          ORDER BY cpa.is_active DESC, cpa.granted_at DESC
        )
        FROM public.client_project_access cpa
        JOIN public.projects pr ON pr.id = cpa.project_id
        WHERE cpa.user_id = pp.uid OR (cc.id IS NOT NULL AND cpa.client_contact_id = cc.id)
      ),
      '[]'::jsonb
    ) AS assigned_projects
  FROM pure_partners pp
  LEFT JOIN public.profiles p ON p.id = pp.uid
  LEFT JOIN auth.users au ON au.id = pp.uid
  LEFT JOIN LATERAL (
    SELECT cc_inner.*
    FROM public.client_contacts cc_inner
    WHERE cc_inner.user_id = pp.uid
    ORDER BY cc_inner.is_active DESC, cc_inner.is_primary_contact DESC, cc_inner.created_at ASC
    LIMIT 1
  ) cc ON true
  LEFT JOIN public.clients c ON c.id = cc.client_id
  ORDER BY COALESCE(p.created_at, cc.created_at, au.created_at) DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION public.get_client_partners_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_partners_directory() TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. AUTHORIZED ASSIGNABLE PROJECTS RPC FOR MANAGEMENT / EXEC / ADMIN
--    Returns all existing projects with schema-resilient location composition.
--    Strictly restricted to `public.auth_is_portal_manager(auth.uid())`.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_assignable_projects_for_client_partners()
RETURNS TABLE (
  id uuid,
  name text,
  project_code text,
  status text,
  location text,
  client_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_portal_manager(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only Management, Executive Director, or Admin may list assignable projects.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pr.id::uuid AS id,
    COALESCE(NULLIF(trim(pr.name::text), ''), 'Untitled Project')::text AS name,
    COALESCE(
      NULLIF(trim(COALESCE(to_jsonb(pr)->>'project_code', '')), ''),
      NULLIF(trim(COALESCE(to_jsonb(pr)->>'code', '')), '')
    )::text AS project_code,
    COALESCE(NULLIF(trim(pr.status::text), ''), 'active')::text AS status,
    NULLIF(
      trim(
        COALESCE(
          NULLIF(trim(COALESCE(to_jsonb(pr)->>'location', '')), ''),
          concat_ws(
            ', ',
            NULLIF(trim(COALESCE(to_jsonb(pr)->>'address', '')), ''),
            NULLIF(trim(COALESCE(to_jsonb(pr)->>'city', '')), ''),
            NULLIF(trim(COALESCE(to_jsonb(pr)->>'state', '')), ''),
            NULLIF(trim(COALESCE(to_jsonb(pr)->>'country', '')), '')
          )
        )
      ),
      ''
    )::text AS location,
    pr.client_id::uuid AS client_id,
    pr.created_at::timestamptz AS created_at
  FROM public.projects pr
  ORDER BY pr.created_at DESC NULLS LAST, pr.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_assignable_projects_for_client_partners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_assignable_projects_for_client_partners() TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. REFINE admin_assign_client_partner_project() CONTACT MATCHING
--    Matches an existing unlinked client_contacts row by email before creating
--    a new clients record, and preserves existing corporate authority columns.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_assign_client_partner_project(
  p_user_id uuid,
  p_project_id uuid,
  p_party_role text DEFAULT 'owner',
  p_authorities jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_client_id uuid;
  v_contact_id uuid;
  v_email text;
  v_name text;
  v_phone text;
  v_party_role text;
  v_access_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_portal_manager(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only Management, Executive Director, or Admin may assign projects to Client/Project Partners.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'Project not found.';
  END IF;

  v_party_role := COALESCE(NULLIF(lower(trim(p_party_role)), ''), 'owner');
  IF v_party_role NOT IN (
    'owner', 'diaspora_owner', 'corporate_client', 'main_contractor',
    'subcontractor', 'consultant', 'designer', 'quantity_surveyor',
    'project_manager', 'local_representative'
  ) THEN
    v_party_role := 'owner';
  END IF;

  -- 1. Locate existing linked client_contact by user_id
  SELECT id, client_id INTO v_contact_id, v_client_id
  FROM public.client_contacts
  WHERE user_id = p_user_id
  ORDER BY is_active DESC, is_primary_contact DESC, created_at ASC
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    -- Resolve profile / auth email
    SELECT
      COALESCE(NULLIF(trim(p.email), ''), au.email),
      COALESCE(NULLIF(trim(p.display_name), ''), trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), 'Client Partner'),
      p.phone
    INTO v_email, v_name, v_phone
    FROM public.profiles p
    LEFT JOIN auth.users au ON au.id = p.id
    WHERE p.id = p_user_id;

    IF v_email IS NULL THEN
      RAISE EXCEPTION 'Client/Project Partner user record not found.';
    END IF;

    -- 2. Check if an unlinked client_contacts row already exists for this email
    SELECT id, client_id INTO v_contact_id, v_client_id
    FROM public.client_contacts
    WHERE lower(email) = lower(v_email)
      AND (user_id IS NULL OR user_id = p_user_id)
    ORDER BY is_active DESC, is_primary_contact DESC, created_at ASC
    LIMIT 1;

    IF v_contact_id IS NOT NULL THEN
      UPDATE public.client_contacts
      SET user_id = p_user_id,
          is_active = true,
          updated_at = now()
      WHERE id = v_contact_id;
    ELSE
      -- 3. Reuse matching client account (by project.client_id or email) or create one
      SELECT id INTO v_client_id
      FROM public.clients
      WHERE lower(COALESCE(email, '')) = lower(v_email)
      ORDER BY created_at ASC
      LIMIT 1;

      IF v_client_id IS NULL THEN
        INSERT INTO public.clients (name, contact_person, email, phone, account_type, portal_enabled)
        VALUES (v_name, v_name, lower(v_email), v_phone, 'individual', true)
        RETURNING id INTO v_client_id;
      END IF;

      INSERT INTO public.client_contacts (
        client_id, user_id, full_name, email, phone, party_role, is_primary_contact, is_active, created_by
      ) VALUES (
        v_client_id, p_user_id, v_name, lower(v_email), v_phone, v_party_role, true, true, v_caller_id
      )
      ON CONFLICT (client_id, email) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        is_active = true,
        updated_at = now()
      RETURNING id INTO v_contact_id;
    END IF;
  END IF;

  -- Upsert client_project_access (preserving delegated_from_contact_id, approval limits & authority metadata)
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
    granted_by,
    granted_at,
    revoked_by,
    revoked_at,
    revoke_reason,
    created_at,
    updated_at
  ) VALUES (
    v_client_id,
    v_contact_id,
    p_project_id,
    p_user_id,
    v_party_role,
    COALESCE((p_authorities->>'can_view_commercial')::boolean, true),
    COALESCE((p_authorities->>'can_approve_quotations')::boolean, true),
    COALESCE((p_authorities->>'can_approve_specifications')::boolean, true),
    COALESCE((p_authorities->>'can_approve_variations')::boolean, true),
    COALESCE((p_authorities->>'can_acknowledge_completions')::boolean, true),
    COALESCE((p_authorities->>'can_approve_payments')::boolean, false),
    COALESCE((p_authorities->>'can_view_financials')::boolean, false),
    COALESCE((p_authorities->>'hide_subcontract_pricing')::boolean, true),
    COALESCE((p_authorities->>'can_submit_requests_complaints')::boolean, true),
    true,
    v_caller_id,
    now(),
    NULL,
    NULL,
    NULL,
    now(),
    now()
  )
  ON CONFLICT (client_contact_id, project_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
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
    granted_by = v_caller_id,
    granted_at = now(),
    revoked_by = NULL,
    revoked_at = NULL,
    revoke_reason = NULL,
    updated_at = now()
  RETURNING id INTO v_access_id;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      module,
      table_name,
      record_id,
      new_values
    ) VALUES (
      v_caller_id,
      'client_project_access_granted',
      'client_partners',
      'client_project_access',
      v_access_id::text,
      jsonb_build_object(
        'user_id', p_user_id,
        'client_contact_id', v_contact_id,
        'project_id', p_project_id,
        'party_role', v_party_role
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'access_id', v_access_id,
    'client_id', v_client_id,
    'client_contact_id', v_contact_id,
    'project_id', p_project_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assign_client_partner_project(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_client_partner_project(uuid, uuid, text, jsonb) TO authenticated;

COMMIT;
