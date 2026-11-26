-- ==============================================================================
-- DAVEJOE INTERIORS DIGITAL OPERATING SYSTEM
-- MIGRATION: 20261125000005_client_partners_separation_and_management.sql
--
-- Purpose:
--   1. Strictly separate external Client/Project Partner accounts from the
--      internal Staff directory (`public.get_staff_directory`).
--   2. Backfill `client_project_access.user_id` from linked `client_contacts`
--      so RLS and portal queries stay 100% consistent.
--   3. Harden `client_project_access` SELECT policy to enforce active account
--      status (`public.auth_is_active(auth.uid())`) so suspended/inactive
--      clients are blocked immediately at the database layer.
--   4. Provide authorized Management / Executive Director / Admin RPCs:
--      - `public.get_client_partners_directory()`
--      - `public.admin_create_client_partner(...)`
--      - `public.admin_update_client_partner_profile(...)`
--      - `public.admin_manage_client_partner_status(...)`
--      - `public.admin_assign_client_partner_project(...)`
--      - `public.admin_revoke_client_partner_project(...)`
--   5. Emit real-time notifications via the existing centralized
--      `public.notifications` system when a client is assigned to or removed
--      from a project (non-confidential messaging only).
--
-- Safety:
--   - 100% additive & idempotent (safe to re-run).
--   - Preserves all 9 internal staff roles and the `client_partner` role.
--   - Preserves all existing foreign keys including
--     `client_project_access_client_contact_id_fkey` and
--     `client_project_access_delegated_from_contact_id_fkey`.
--   - Never weakens any existing RLS policy.
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. BACKFILL CONSISTENCY: SYNC client_project_access.user_id FROM client_contacts
-- ------------------------------------------------------------------------------
UPDATE public.client_project_access cpa
SET user_id = cc.user_id
FROM public.client_contacts cc
WHERE cpa.client_contact_id = cc.id
  AND cc.user_id IS NOT NULL
  AND cpa.user_id IS DISTINCT FROM cc.user_id;

-- ------------------------------------------------------------------------------
-- 2. HARDEN client_project_access SELECT RLS (ENFORCE ACTIVE PROFILE STATUS)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_project_access_select" ON public.client_project_access;
CREATE POLICY "client_project_access_select"
  ON public.client_project_access
  FOR SELECT
  TO authenticated
  USING (
    public.auth_is_internal_staff(auth.uid())
    OR (
      public.auth_is_active(auth.uid())
      AND user_id = auth.uid()
      AND is_active = true
      AND revoked_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.client_contacts cc
        WHERE cc.id = client_project_access.client_contact_id
          AND cc.user_id = auth.uid()
          AND cc.is_active = true
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 3. FIX INTERNAL STAFF DIRECTORY RPC: EXCLUDE EXTERNAL CLIENT/PROJECT PARTNERS
--    External-only `client_partner` accounts MUST NEVER appear in Staff lists.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_directory(
  p_exclude_leadership boolean DEFAULT false
)
RETURNS TABLE (
  profile_id uuid,
  email text,
  first_name text,
  last_name text,
  display_name text,
  phone text,
  job_title text,
  profile_status text,
  profile_created_at timestamptz,
  assigned_roles jsonb,
  workforce_id uuid,
  workforce_code text,
  workforce_trade text,
  workforce_status text,
  workforce_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_authorized boolean := false;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_active(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: active authenticated session required.' USING ERRCODE = '42501';
  END IF;

  -- Verify caller holds Management, Executive Director, Admin, Supervisor, or directory view permissions
  SELECT (
    public.auth_has_role('management')
    OR public.auth_has_role('executive_director')
    OR public.auth_has_role('admin')
    OR public.auth_has_role('supervisor')
    OR public.auth_is_admin_or_leadership()
    OR public.auth_has_permission('users.view')
    OR public.auth_has_permission('workforce.view')
    OR public.auth_has_permission('View Workforce')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Insufficient permissions to view staff directory.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id::uuid AS profile_id,
    COALESCE(NULLIF(trim(p.email::text), ''), au.email::text)::text AS email,
    p.first_name::text AS first_name,
    p.last_name::text AS last_name,
    COALESCE(
      NULLIF(trim(p.display_name::text), ''),
      NULLIF(trim(COALESCE(p.first_name::text, '') || ' ' || COALESCE(p.last_name::text, '')), ''),
      split_part(COALESCE(NULLIF(trim(p.email::text), ''), au.email::text, ''), '@', 1)
    )::text AS display_name,
    p.phone::text AS phone,
    p.job_title::text AS job_title,
    COALESCE(NULLIF(trim(p.status::text), ''), 'active')::text AS profile_status,
    p.created_at::timestamptz AS profile_created_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'slug', r.slug
          )
          ORDER BY r.name
        )
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p.id
      ),
      '[]'::jsonb
    ) AS assigned_roles,
    wm.id::uuid AS workforce_id,
    wm.workforce_code::text AS workforce_code,
    wm.trade::text AS workforce_trade,
    wm.status::text AS workforce_status,
    wm.phone::text AS workforce_phone
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN LATERAL (
    SELECT w.id, w.workforce_code, w.trade, w.status, w.phone
    FROM public.workforce_members w
    WHERE w.profile_id = p.id
    ORDER BY w.created_at DESC
    LIMIT 1
  ) wm ON true
  WHERE
    -- Exclude external-only Client / Project Partner accounts from Staff directory
    NOT (
      (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur_cp
          JOIN public.roles r_cp ON r_cp.id = ur_cp.role_id
          WHERE ur_cp.user_id = p.id
            AND lower(COALESCE(r_cp.slug, '')) = 'client_partner'
        )
        OR EXISTS (
          SELECT 1
          FROM public.client_contacts cc_ext
          WHERE cc_ext.user_id = p.id
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur_int
        JOIN public.roles r_int ON r_int.id = ur_int.role_id
        WHERE ur_int.user_id = p.id
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
    AND (
      NOT p_exclude_leadership
      OR NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p.id
          AND (
            lower(COALESCE(r.slug, '')) IN (
              'management',
              'ceo',
              'managing_director',
              'executive_director',
              'executive_director_business_operations_strategy'
            )
            OR lower(COALESCE(r.name, '')) LIKE '%executive director%'
            OR lower(COALESCE(r.name, '')) LIKE '%management / ceo%'
            OR lower(COALESCE(r.name, '')) = 'management'
            OR lower(COALESCE(r.name, '')) = 'ceo'
          )
      )
    )
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_directory(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_directory(boolean) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. DEDICATED CLIENT / PROJECT PARTNERS DIRECTORY RPC
--    Returns all registered Client / Project Partner accounts with Auth login
--    timestamps, linked client account/contact metadata, and assigned projects.
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
    -- Keep external client partners; exclude internal staff who merely have test links unless they hold client_partner exclusively
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
-- 5. TRANSACTIONAL CLIENT / PROJECT PARTNER ACCOUNT PROVISIONING RPC
--    Creates Auth user + identity, profile, client_partner role, clients row,
--    client_contacts row, and optional initial project assignments atomically.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_client_partner(
  p_email text,
  p_password text,
  p_full_name text,
  p_company_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_designation text DEFAULT NULL,
  p_account_type text DEFAULT 'individual',
  p_party_role text DEFAULT 'owner',
  p_status text DEFAULT 'active',
  p_existing_client_id uuid DEFAULT NULL,
  p_project_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_authorities jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_clean_email text;
  v_clean_name text;
  v_first_name text;
  v_last_name text;
  v_clean_company text;
  v_clean_phone text;
  v_clean_designation text;
  v_account_type text;
  v_party_role text;
  v_status text;
  v_client_role_id uuid;
  v_existing_user_id uuid;
  v_user_id uuid;
  v_has_internal_role boolean := false;
  v_existing_contact_id uuid;
  v_client_id uuid;
  v_contact_id uuid;
  v_instance_id uuid;
  v_encrypted_pw text;
  v_proj_id uuid;
  v_assigned_count integer := 0;
  v_already_existed boolean := false;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_portal_manager(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only Management, Executive Director, or Admin may create Client/Project Partner accounts.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_email := lower(trim(COALESCE(p_email, '')));
  IF v_clean_email = '' OR v_clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'A valid email address is required.';
  END IF;

  v_clean_name := trim(COALESCE(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Client / Partner full name is required.';
  END IF;

  v_first_name := split_part(v_clean_name, ' ', 1);
  v_last_name := trim(substring(v_clean_name FROM length(v_first_name) + 1));
  IF v_last_name = '' THEN
    v_last_name := '-';
  END IF;

  v_clean_company := NULLIF(trim(COALESCE(p_company_name, '')), '');
  v_clean_phone := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_clean_designation := NULLIF(trim(COALESCE(p_designation, '')), '');

  v_account_type := COALESCE(NULLIF(lower(trim(p_account_type)), ''), 'individual');
  IF v_account_type NOT IN ('individual', 'corporate', 'main_contractor', 'subcontract_partner', 'diaspora_remote') THEN
    v_account_type := 'individual';
  END IF;

  v_party_role := COALESCE(NULLIF(lower(trim(p_party_role)), ''), 'owner');
  IF v_party_role NOT IN (
    'owner', 'diaspora_owner', 'corporate_client', 'main_contractor',
    'subcontractor', 'consultant', 'designer', 'quantity_surveyor',
    'project_manager', 'local_representative'
  ) THEN
    v_party_role := 'owner';
  END IF;

  v_status := COALESCE(NULLIF(lower(trim(p_status)), ''), 'active');
  IF v_status NOT IN ('active', 'pending', 'inactive', 'suspended') THEN
    v_status := 'active';
  END IF;

  -- Locate authoritative client_partner role
  SELECT id INTO v_client_role_id
  FROM public.roles
  WHERE lower(slug) = 'client_partner'
  LIMIT 1;

  IF v_client_role_id IS NULL THEN
    RAISE EXCEPTION 'System role "client_partner" is not configured in public.roles.';
  END IF;

  -- Check if an Auth user already exists with this email
  SELECT id INTO v_existing_user_id
  FROM auth.users
  WHERE lower(email) = v_clean_email
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    -- Prevent cross-classifying an internal staff member as an external client
    SELECT EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_existing_user_id
        AND lower(COALESCE(r.slug, '')) IN (
          'management', 'executive_director', 'admin', 'technical',
          'supervisor', 'procurement', 'accounts', 'artisan', 'social_media_manager'
        )
    ) INTO v_has_internal_role;

    IF v_has_internal_role THEN
      RAISE EXCEPTION 'This email belongs to an internal Davejoe staff account and cannot be registered as an external Client/Project Partner.';
    END IF;

    -- Check if already registered as a Client/Project Partner contact
    SELECT id INTO v_existing_contact_id
    FROM public.client_contacts
    WHERE user_id = v_existing_user_id
    LIMIT 1;

    IF v_existing_contact_id IS NOT NULL THEN
      RAISE EXCEPTION 'A Client/Project Partner account with email "%" already exists. Open their profile from the Client/Project Partners list to manage projects or status.', v_clean_email;
    END IF;

    -- Graceful link for an orphaned Auth/profile user (e.g., previously created via legacy Staff modal without client_contacts)
    v_user_id := v_existing_user_id;
    v_already_existed := true;

    -- Update password if caller supplied a new password
    IF p_password IS NOT NULL AND length(trim(p_password)) >= 8 THEN
      v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
      UPDATE auth.users
      SET encrypted_password = v_encrypted_pw,
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = v_user_id;
    END IF;
  ELSE
    -- New Supabase Auth user requires password >= 8 chars
    IF p_password IS NULL OR length(p_password) < 8 THEN
      RAISE EXCEPTION 'Initial password must be at least 8 characters long.';
    END IF;

    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
    IF v_instance_id IS NULL THEN
      v_instance_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;

    v_user_id := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      v_clean_email,
      v_encrypted_pw,
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object(
        'first_name', v_first_name,
        'last_name', v_last_name,
        'full_name', v_clean_name,
        'company_name', COALESCE(v_clean_company, ''),
        'account_category', 'client_partner'
      ),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Ensure GoTrue email identity exists for full sign-in / password-recovery compatibility
    BEGIN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', true),
        'email',
        v_user_id::text,
        NULL,
        now(),
        now()
      )
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Older Supabase schemas without provider_id column: ignore cleanly
      NULL;
    END;
  END IF;

  -- Upsert public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    display_name,
    phone,
    job_title,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_clean_email,
    v_first_name,
    v_last_name,
    v_clean_name,
    v_clean_phone,
    COALESCE(v_clean_designation, v_clean_company, 'Client / Project Partner'),
    v_status::public.user_status,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    display_name = EXCLUDED.display_name,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    job_title = COALESCE(EXCLUDED.job_title, public.profiles.job_title),
    status = EXCLUDED.status,
    updated_at = now();

  -- Assign ONLY client_partner role
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (v_user_id, v_client_role_id)
  ON CONFLICT DO NOTHING;

  -- Resolve or create public.clients organization/account record
  IF p_existing_client_id IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE id = p_existing_client_id;

    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Selected client account does not exist.';
    END IF;

    UPDATE public.clients
    SET portal_enabled = true,
        updated_at = now()
    WHERE id = v_client_id;
  ELSE
    -- Reuse existing client record if same company/email already exists
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE lower(COALESCE(email, '')) = v_clean_email
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (
        name,
        contact_person,
        email,
        phone,
        account_type,
        company_name,
        portal_enabled,
        created_at,
        updated_at
      ) VALUES (
        COALESCE(v_clean_company, v_clean_name),
        v_clean_name,
        v_clean_email,
        v_clean_phone,
        v_account_type,
        v_clean_company,
        true,
        now(),
        now()
      )
      RETURNING id INTO v_client_id;
    ELSE
      UPDATE public.clients
      SET portal_enabled = true,
          company_name = COALESCE(v_clean_company, company_name),
          phone = COALESCE(v_clean_phone, phone),
          account_type = COALESCE(v_account_type, account_type),
          updated_at = now()
      WHERE id = v_client_id;
    END IF;
  END IF;

  -- Upsert public.client_contacts linked to user_id
  INSERT INTO public.client_contacts (
    client_id,
    user_id,
    full_name,
    email,
    phone,
    designation,
    organization_name,
    party_role,
    is_primary_contact,
    is_active,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    v_client_id,
    v_user_id,
    v_clean_name,
    v_clean_email,
    v_clean_phone,
    v_clean_designation,
    v_clean_company,
    v_party_role,
    true,
    (v_status = 'active'),
    v_caller_id,
    now(),
    now()
  )
  ON CONFLICT (client_id, email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    full_name = EXCLUDED.full_name,
    phone = COALESCE(EXCLUDED.phone, public.client_contacts.phone),
    designation = COALESCE(EXCLUDED.designation, public.client_contacts.designation),
    organization_name = COALESCE(EXCLUDED.organization_name, public.client_contacts.organization_name),
    party_role = EXCLUDED.party_role,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO v_contact_id;

  -- Assign initial projects (if any provided) via client_project_access
  IF p_project_ids IS NOT NULL AND array_length(p_project_ids, 1) > 0 THEN
    FOREACH v_proj_id IN ARRAY p_project_ids LOOP
      IF v_proj_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.projects WHERE id = v_proj_id) THEN
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
          v_proj_id,
          v_user_id,
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
          updated_at = now();

        v_assigned_count := v_assigned_count + 1;
      END IF;
    END LOOP;
  END IF;

  -- Immutable audit trail
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
      CASE WHEN v_already_existed THEN 'client_partner_linked' ELSE 'client_partner_created' END,
      'client_partners',
      'client_contacts',
      v_contact_id::text,
      jsonb_build_object(
        'user_id', v_user_id,
        'client_id', v_client_id,
        'client_contact_id', v_contact_id,
        'email', v_clean_email,
        'full_name', v_clean_name,
        'company_name', v_clean_company,
        'party_role', v_party_role,
        'status', v_status,
        'assigned_project_count', v_assigned_count
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'client_id', v_client_id,
    'client_contact_id', v_contact_id,
    'assigned_project_count', v_assigned_count,
    'already_existed', v_already_existed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_client_partner(text, text, text, text, text, text, text, text, text, uuid, uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_client_partner(text, text, text, text, text, text, text, text, text, uuid, uuid[], jsonb) TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. MANAGE CLIENT / PROJECT PARTNER ACCOUNT STATUS (ACTIVATE / SUSPEND)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_manage_client_partner_status(
  p_user_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_clean_status text;
  v_is_internal boolean := false;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_portal_manager(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only Management, Executive Director, or Admin may manage Client/Project Partner status.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_status := lower(trim(COALESCE(p_status, '')));
  IF v_clean_status NOT IN ('active', 'pending', 'suspended', 'inactive') THEN
    RAISE EXCEPTION 'Invalid account status "%". Allowed: active, pending, suspended, inactive.', p_status;
  END IF;

  -- Guard: never allow this RPC to modify internal staff accounts
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND lower(COALESCE(r.slug, '')) IN (
        'management', 'executive_director', 'admin', 'technical',
        'supervisor', 'procurement', 'accounts', 'artisan', 'social_media_manager'
      )
  ) INTO v_is_internal;

  IF v_is_internal THEN
    RAISE EXCEPTION 'Target account belongs to internal staff. Use Staff / Users Management instead.';
  END IF;

  UPDATE public.profiles
  SET status = v_clean_status::public.user_status,
      updated_at = now()
  WHERE id = p_user_id;

  UPDATE public.client_contacts
  SET is_active = (v_clean_status = 'active'),
      updated_at = now()
  WHERE user_id = p_user_id;

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
      'client_partner_status_updated',
      'client_partners',
      'profiles',
      p_user_id::text,
      jsonb_build_object('user_id', p_user_id, 'status', v_clean_status)
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'status', v_clean_status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_client_partner_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_manage_client_partner_status(uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. UPDATE CLIENT / PROJECT PARTNER PROFILE METADATA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_client_partner_profile(
  p_user_id uuid,
  p_full_name text,
  p_company_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_designation text DEFAULT NULL,
  p_account_type text DEFAULT NULL,
  p_party_role text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_clean_name text;
  v_first_name text;
  v_last_name text;
  v_clean_company text;
  v_clean_phone text;
  v_clean_designation text;
  v_contact_id uuid;
  v_client_id uuid;
  v_email text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_portal_manager(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only Management, Executive Director, or Admin may update Client/Project Partners.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_name := trim(COALESCE(p_full_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Full name cannot be empty.';
  END IF;

  v_first_name := split_part(v_clean_name, ' ', 1);
  v_last_name := trim(substring(v_clean_name FROM length(v_first_name) + 1));
  IF v_last_name = '' THEN
    v_last_name := '-';
  END IF;

  v_clean_company := NULLIF(trim(COALESCE(p_company_name, '')), '');
  v_clean_phone := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_clean_designation := NULLIF(trim(COALESCE(p_designation, '')), '');

  SELECT email INTO v_email FROM public.profiles WHERE id = p_user_id;

  UPDATE public.profiles
  SET first_name = v_first_name,
      last_name = v_last_name,
      display_name = v_clean_name,
      phone = v_clean_phone,
      job_title = COALESCE(v_clean_designation, v_clean_company, job_title),
      updated_at = now()
  WHERE id = p_user_id;

  SELECT id, client_id INTO v_contact_id, v_client_id
  FROM public.client_contacts
  WHERE user_id = p_user_id
  ORDER BY is_active DESC, created_at ASC
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    -- Ensure legacy client_partner profile gets linked cleanly to clients + client_contacts
    INSERT INTO public.clients (
      name, contact_person, email, phone, account_type, company_name, portal_enabled
    ) VALUES (
      COALESCE(v_clean_company, v_clean_name),
      v_clean_name,
      v_email,
      v_clean_phone,
      COALESCE(NULLIF(lower(trim(p_account_type)), ''), 'individual'),
      v_clean_company,
      true
    )
    RETURNING id INTO v_client_id;

    INSERT INTO public.client_contacts (
      client_id, user_id, full_name, email, phone, designation, organization_name, party_role, is_primary_contact, is_active, created_by
    ) VALUES (
      v_client_id,
      p_user_id,
      v_clean_name,
      COALESCE(v_email, p_user_id::text || '@client.local'),
      v_clean_phone,
      v_clean_designation,
      v_clean_company,
      COALESCE(NULLIF(lower(trim(p_party_role)), ''), 'owner'),
      true,
      true,
      v_caller_id
    )
    RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.client_contacts
    SET full_name = v_clean_name,
        phone = v_clean_phone,
        designation = v_clean_designation,
        organization_name = COALESCE(v_clean_company, organization_name),
        party_role = COALESCE(NULLIF(lower(trim(p_party_role)), ''), party_role),
        updated_at = now()
    WHERE id = v_contact_id;

    IF v_client_id IS NOT NULL THEN
      UPDATE public.clients
      SET company_name = COALESCE(v_clean_company, company_name),
          name = COALESCE(v_clean_company, name),
          contact_person = v_clean_name,
          phone = COALESCE(v_clean_phone, phone),
          account_type = COALESCE(NULLIF(lower(trim(p_account_type)), ''), account_type),
          portal_enabled = true,
          updated_at = now()
      WHERE id = v_client_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'client_id', v_client_id,
    'client_contact_id', v_contact_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_client_partner_profile(uuid, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_client_partner_profile(uuid, text, text, text, text, text, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. ASSIGN PROJECT TO CLIENT / PROJECT PARTNER RPC
--    Ensures linked client_contacts row exists, upserts client_project_access
--    (preserving delegated_from_contact_id), and records immutable audit entry.
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

  -- Locate existing linked client_contact
  SELECT id, client_id INTO v_contact_id, v_client_id
  FROM public.client_contacts
  WHERE user_id = p_user_id
  ORDER BY is_active DESC, is_primary_contact DESC, created_at ASC
  LIMIT 1;

  IF v_contact_id IS NULL THEN
    -- Auto-link legacy client_partner profile created before dedicated workspace existed
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

    SELECT id INTO v_client_id
    FROM public.clients
    WHERE lower(COALESCE(email, '')) = lower(v_email)
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

  -- Upsert client_project_access (explicitly preserving delegated_from_contact_id)
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

-- ------------------------------------------------------------------------------
-- 9. REVOKE PROJECT ACCESS FROM CLIENT / PROJECT PARTNER RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revoke_client_partner_project(
  p_access_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_project_id uuid;
  v_user_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR NOT public.auth_is_portal_manager(v_caller_id) THEN
    RAISE EXCEPTION 'Unauthorized: only Management, Executive Director, or Admin may revoke project access.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.client_project_access
  SET is_active = false,
      revoked_by = v_caller_id,
      revoked_at = now(),
      revoke_reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
      updated_at = now()
  WHERE id = p_access_id
  RETURNING project_id, user_id INTO v_project_id, v_user_id;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Project access record not found.';
  END IF;

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
      'client_project_access_revoked',
      'client_partners',
      'client_project_access',
      p_access_id::text,
      jsonb_build_object(
        'user_id', v_user_id,
        'project_id', v_project_id,
        'revoke_reason', NULLIF(trim(COALESCE(p_reason, '')), '')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'access_id', p_access_id,
    'project_id', v_project_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_client_partner_project(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_client_partner_project(uuid, text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 10. CENTRALIZED REAL-TIME NOTIFICATION TRIGGER ON client_project_access
--     Notifies the Client/Project Partner cleanly on grant/reactivation or
--     revocation using existing `public.internal_create_notification`.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_client_project_access_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient_id uuid;
  v_project_name text;
  v_project_code text;
  v_was_active boolean := false;
  v_is_now_active boolean := false;
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN NEW;
  END IF;

  v_recipient_id := NEW.user_id;
  IF v_recipient_id IS NULL AND NEW.client_contact_id IS NOT NULL THEN
    SELECT cc.user_id INTO v_recipient_id
    FROM public.client_contacts cc
    WHERE cc.id = NEW.client_contact_id;
  END IF;

  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_now_active := (NEW.is_active = true AND NEW.revoked_at IS NULL);
  IF TG_OP = 'UPDATE' THEN
    v_was_active := (OLD.is_active = true AND OLD.revoked_at IS NULL);
  END IF;

  SELECT pr.name, pr.project_code
    INTO v_project_name, v_project_code
  FROM public.projects pr
  WHERE pr.id = NEW.project_id;

  IF (TG_OP = 'INSERT' AND v_is_now_active)
     OR (TG_OP = 'UPDATE' AND NOT v_was_active AND v_is_now_active)
  THEN
    PERFORM public.internal_create_notification(
      p_recipient_user_id := v_recipient_id,
      p_actor_user_id := COALESCE(NEW.granted_by, auth.uid()),
      p_title := 'New Project Access Granted',
      p_message := format(
        'You have been granted Client Portal access to %s%s.',
        COALESCE(v_project_name, 'a project'),
        CASE WHEN NULLIF(trim(COALESCE(v_project_code, '')), '') IS NOT NULL THEN ' (' || v_project_code || ')' ELSE '' END
      ),
      p_notification_type := 'assignment',
      p_source_module := 'client_portal',
      p_severity := 'normal',
      p_related_table := 'client_project_access',
      p_related_record_id := NEW.id,
      p_project_id := NEW.project_id,
      p_action_route := '/client/projects/' || NEW.project_id::text,
      p_event_key := 'client_project_access:grant:' || NEW.id::text || ':' || extract(epoch FROM COALESCE(NEW.granted_at, now()))::bigint::text,
      p_metadata := jsonb_build_object(
        'party_role', NEW.party_role,
        'project_code', COALESCE(v_project_code, '')
      )
    );
  ELSIF TG_OP = 'UPDATE' AND v_was_active AND NOT v_is_now_active THEN
    PERFORM public.internal_create_notification(
      p_recipient_user_id := v_recipient_id,
      p_actor_user_id := COALESCE(NEW.revoked_by, auth.uid()),
      p_title := 'Project Portal Access Updated',
      p_message := 'Your portal access to a project has been updated by Davejoe Interiors Management.',
      p_notification_type := 'status_update',
      p_source_module := 'client_portal',
      p_severity := 'normal',
      p_related_table := 'client_project_access',
      p_related_record_id := NEW.id,
      p_project_id := NULL,
      p_action_route := '/client',
      p_event_key := 'client_project_access:revoke:' || NEW.id::text || ':' || extract(epoch FROM COALESCE(NEW.revoked_at, now()))::bigint::text,
      p_metadata := jsonb_build_object('status', 'revoked')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_client_project_access ON public.client_project_access;
CREATE TRIGGER trg_notify_client_project_access
  AFTER INSERT OR UPDATE ON public.client_project_access
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_client_project_access_change();

COMMIT;
