-- ==============================================================================
-- DAVEJOE DIGITAL OPERATING SYSTEM
-- PHASE 2 — MILESTONE 1 (WORKSTREAM B)
-- MIGRATION: 20261125000003_phase2_m1_corporate_authority_portfolios.sql
--
-- Scope:
--   1. Additively extend public.clients with corporate/institutional profile fields.
--   2. Additively extend public.client_contacts and public.client_project_access
--      with authority hierarchy levels (1-5), authorized signatory flags, corporate
--      portfolio access, delegation permission, and monetary approval limits.
--   3. Create public.client_authority_delegations (time-bounded approval delegation
--      with active window, revocation, and ceiling enforcement).
--   4. Create public.client_authority_audit_logs (append-only immutable audit trail)
--      with automatic AFTER triggers on client_contacts, client_project_access,
--      and client_authority_delegations.
--   5. Create hardened SECURITY DEFINER functions:
--        - public.auth_client_effective_authority(project_id, user_id)
--        - public.auth_client_can_approve_amount(project_id, authority, amount, user_id)
--        - public.get_corporate_portfolio_summary(client_id)
--      and attach server-side monetary approval limit enforcement triggers on
--      public.client_quotations_contracts and public.project_variations.
--   6. Granular permissions (with non-null action column), RLS, and explicit GRANTs.
--
-- Safety:
--   - 100% additive and idempotent.
--   - Never assumes every corporate contact can approve quotations, variations,
--     or payments.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. GRANULAR PERMISSIONS (CORPORATE AUTHORITY & MULTI-PROJECT PORTFOLIOS)
-- ------------------------------------------------------------------------------
INSERT INTO public.permissions (name, code, module, action, description)
VALUES
  ('Manage Corporate Clients', 'corporate_clients.manage', 'corporate_clients', 'manage', 'Create and update corporate/institutional client governance profiles'),
  ('Manage Corporate Authority Matrix', 'corporate_authority.manage', 'corporate_clients', 'manage', 'Configure signatory levels, approval limits, and delegation rules'),
  ('View Corporate Portfolios', 'corporate_portfolios.view', 'corporate_clients', 'view', 'Inspect multi-project corporate portfolio dashboards and KPIs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'corporate_clients.manage',
  'corporate_authority.manage',
  'corporate_portfolios.view'
)
WHERE r.slug IN ('management', 'executive_director', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN ('corporate_portfolios.view')
WHERE r.slug IN ('accounts', 'technical')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. EXTEND public.clients WITH CORPORATE / INSTITUTIONAL PROFILE FIELDS
-- ------------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS industry_sector text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS parent_organization text,
  ADD COLUMN IF NOT EXISTS corporate_tier text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS headquarters_address text,
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS portfolio_notes text,
  ADD COLUMN IF NOT EXISTS governance_policy_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_corporate_tier_chk'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_corporate_tier_chk
      CHECK (corporate_tier IS NULL OR corporate_tier IN (
        'standard',
        'enterprise',
        'institutional',
        'government',
        'developer_group',
        'main_contractor_partner'
      ));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. EXTEND public.client_contacts WITH CORPORATE AUTHORITY HIERARCHY & LIMITS
-- ------------------------------------------------------------------------------
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS authority_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_authorized_signatory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS corporate_portfolio_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delegate_authority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quotation_approval_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS variation_approval_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS payment_approval_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS approval_currency text NOT NULL DEFAULT 'NGN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_contacts_authority_level_chk'
  ) THEN
    ALTER TABLE public.client_contacts
      ADD CONSTRAINT client_contacts_authority_level_chk
      CHECK (authority_level BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_contacts_limits_nonneg_chk'
  ) THEN
    ALTER TABLE public.client_contacts
      ADD CONSTRAINT client_contacts_limits_nonneg_chk
      CHECK (
        (quotation_approval_limit IS NULL OR quotation_approval_limit >= 0)
        AND (variation_approval_limit IS NULL OR variation_approval_limit >= 0)
        AND (payment_approval_limit IS NULL OR payment_approval_limit >= 0)
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. EXTEND public.client_project_access WITH PROJECT OVERRIDES & SCOPE
-- ------------------------------------------------------------------------------
ALTER TABLE public.client_project_access
  ADD COLUMN IF NOT EXISTS access_scope text NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS authority_level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_authorized_signatory boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quotation_approval_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS variation_approval_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS payment_approval_limit numeric(14,2),
  ADD COLUMN IF NOT EXISTS approval_currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS delegated_from_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cpa_access_scope_chk'
  ) THEN
    ALTER TABLE public.client_project_access
      ADD CONSTRAINT cpa_access_scope_chk
      CHECK (access_scope IN ('project', 'corporate_portfolio'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cpa_authority_level_chk'
  ) THEN
    ALTER TABLE public.client_project_access
      ADD CONSTRAINT cpa_authority_level_chk
      CHECK (authority_level BETWEEN 1 AND 5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cpa_limits_nonneg_chk'
  ) THEN
    ALTER TABLE public.client_project_access
      ADD CONSTRAINT cpa_limits_nonneg_chk
      CHECK (
        (quotation_approval_limit IS NULL OR quotation_approval_limit >= 0)
        AND (variation_approval_limit IS NULL OR variation_approval_limit >= 0)
        AND (payment_approval_limit IS NULL OR payment_approval_limit >= 0)
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. APPROVAL DELEGATIONS (TIME-BOUNDED, CLIENT-SCOPED, REVOCABLE)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_authority_delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  delegator_contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  delegate_contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  delegated_authorities jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_approval_limit numeric(14,2) CHECK (max_approval_limit IS NULL OR max_approval_limit >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_delegation_not_self_chk CHECK (delegator_contact_id <> delegate_contact_id),
  CONSTRAINT client_delegation_window_chk CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_client_delegations_client ON public.client_authority_delegations(client_id, status);
CREATE INDEX IF NOT EXISTS idx_client_delegations_delegate ON public.client_authority_delegations(delegate_contact_id, status);
CREATE INDEX IF NOT EXISTS idx_client_delegations_project ON public.client_authority_delegations(project_id);

-- Enforce same-client integrity & delegator capability at database level
CREATE OR REPLACE FUNCTION public.enforce_client_delegation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delegator record;
  v_delegate record;
BEGIN
  SELECT id, client_id, is_active, can_delegate_authority
    INTO v_delegator
  FROM public.client_contacts
  WHERE id = NEW.delegator_contact_id;

  SELECT id, client_id, is_active
    INTO v_delegate
  FROM public.client_contacts
  WHERE id = NEW.delegate_contact_id;

  IF v_delegator.id IS NULL OR v_delegate.id IS NULL THEN
    RAISE EXCEPTION 'Both delegator and delegate contacts must exist.';
  END IF;

  IF v_delegator.client_id <> NEW.client_id OR v_delegate.client_id <> NEW.client_id THEN
    RAISE EXCEPTION 'Approval delegation is restricted to contacts belonging to the same client organization.';
  END IF;

  IF NOT v_delegator.is_active OR NOT v_delegate.is_active THEN
    RAISE EXCEPTION 'Both delegator and delegate contacts must be active.';
  END IF;

  IF TG_OP = 'INSERT' AND NOT v_delegator.can_delegate_authority THEN
    RAISE EXCEPTION 'The selected delegator does not hold approval delegation authority.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_client_delegation_integrity ON public.client_authority_delegations;
CREATE TRIGGER trg_enforce_client_delegation_integrity
  BEFORE INSERT OR UPDATE ON public.client_authority_delegations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_delegation_integrity();

ALTER TABLE public.client_authority_delegations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_delegations_select_policy" ON public.client_authority_delegations;
CREATE POLICY "client_delegations_select_policy" ON public.client_authority_delegations
  FOR SELECT TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_is_leadership(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.client_contacts cc
      WHERE cc.client_id = client_authority_delegations.client_id
        AND cc.user_id = auth.uid()
        AND cc.is_active = true
    )
  );

DROP POLICY IF EXISTS "client_delegations_manage_policy" ON public.client_authority_delegations;
CREATE POLICY "client_delegations_manage_policy" ON public.client_authority_delegations
  FOR ALL TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.client_contacts cc
      WHERE cc.id = client_authority_delegations.delegator_contact_id
        AND cc.user_id = auth.uid()
        AND cc.is_active = true
        AND cc.can_delegate_authority = true
    )
  )
  WITH CHECK (
    public.auth_is_portal_manager(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.client_contacts cc
      WHERE cc.id = client_authority_delegations.delegator_contact_id
        AND cc.user_id = auth.uid()
        AND cc.is_active = true
        AND cc.can_delegate_authority = true
    )
  );

-- ------------------------------------------------------------------------------
-- 6. IMMUTABLE AUTHORITY CHANGE AUDIT TRAIL
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_authority_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  delegation_id uuid REFERENCES public.client_authority_delegations(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_auth_audit_client ON public.client_authority_audit_logs(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_auth_audit_contact ON public.client_authority_audit_logs(client_contact_id);
CREATE INDEX IF NOT EXISTS idx_client_auth_audit_project ON public.client_authority_audit_logs(project_id);

-- Immutability guard: authority audit logs cannot be updated or deleted
CREATE OR REPLACE FUNCTION public.prevent_authority_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'client_authority_audit_logs is an append-only immutable audit trail.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_authority_audit_mutation ON public.client_authority_audit_logs;
CREATE TRIGGER trg_prevent_authority_audit_mutation
  BEFORE UPDATE OR DELETE ON public.client_authority_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_authority_audit_mutation();

-- Automatic audit capture trigger function (SECURITY DEFINER so audit writes succeed regardless of caller)
CREATE OR REPLACE FUNCTION public.capture_client_authority_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_event text;
  v_client_id uuid;
  v_project_id uuid;
  v_contact_id uuid;
  v_delegation_id uuid;
  v_reason text;
BEGIN
  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(trim(display_name), ''),
      NULLIF(trim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), ''),
      'Authenticated User'
    )
    INTO v_actor_name
    FROM public.profiles
    WHERE id = v_actor_id;
  END IF;
  v_actor_name := COALESCE(v_actor_name, 'System');

  IF TG_TABLE_NAME = 'client_contacts' THEN
    v_client_id := NEW.client_id;
    v_contact_id := NEW.id;
    v_event := CASE WHEN TG_OP = 'INSERT' THEN 'contact_created' ELSE 'contact_authority_updated' END;

    IF TG_OP = 'UPDATE' AND (
      OLD.authority_level IS NOT DISTINCT FROM NEW.authority_level
      AND OLD.is_authorized_signatory IS NOT DISTINCT FROM NEW.is_authorized_signatory
      AND OLD.corporate_portfolio_access IS NOT DISTINCT FROM NEW.corporate_portfolio_access
      AND OLD.can_delegate_authority IS NOT DISTINCT FROM NEW.can_delegate_authority
      AND OLD.quotation_approval_limit IS NOT DISTINCT FROM NEW.quotation_approval_limit
      AND OLD.variation_approval_limit IS NOT DISTINCT FROM NEW.variation_approval_limit
      AND OLD.payment_approval_limit IS NOT DISTINCT FROM NEW.payment_approval_limit
      AND OLD.party_role IS NOT DISTINCT FROM NEW.party_role
      AND OLD.is_active IS NOT DISTINCT FROM NEW.is_active
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.client_authority_audit_logs (
      client_id, client_contact_id, event_type, actor_user_id, actor_name,
      previous_state, new_state, reason
    ) VALUES (
      v_client_id,
      v_contact_id,
      v_event,
      v_actor_id,
      v_actor_name,
      CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'party_role', OLD.party_role,
        'authority_level', OLD.authority_level,
        'is_authorized_signatory', OLD.is_authorized_signatory,
        'corporate_portfolio_access', OLD.corporate_portfolio_access,
        'can_delegate_authority', OLD.can_delegate_authority,
        'quotation_approval_limit', OLD.quotation_approval_limit,
        'variation_approval_limit', OLD.variation_approval_limit,
        'payment_approval_limit', OLD.payment_approval_limit,
        'is_active', OLD.is_active
      ) ELSE NULL END,
      jsonb_build_object(
        'full_name', NEW.full_name,
        'party_role', NEW.party_role,
        'authority_level', NEW.authority_level,
        'is_authorized_signatory', NEW.is_authorized_signatory,
        'corporate_portfolio_access', NEW.corporate_portfolio_access,
        'can_delegate_authority', NEW.can_delegate_authority,
        'quotation_approval_limit', NEW.quotation_approval_limit,
        'variation_approval_limit', NEW.variation_approval_limit,
        'payment_approval_limit', NEW.payment_approval_limit,
        'is_active', NEW.is_active
      ),
      NULL
    );

  ELSIF TG_TABLE_NAME = 'client_project_access' THEN
    v_client_id := NEW.client_id;
    v_project_id := NEW.project_id;
    v_contact_id := NEW.client_contact_id;
    v_reason := NEW.revoke_reason;
    v_event := CASE
      WHEN TG_OP = 'INSERT' THEN 'project_access_granted'
      WHEN NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN 'project_access_revoked'
      ELSE 'project_authority_updated'
    END;

    INSERT INTO public.client_authority_audit_logs (
      client_id, project_id, client_contact_id, event_type, actor_user_id, actor_name,
      previous_state, new_state, reason
    ) VALUES (
      v_client_id,
      v_project_id,
      v_contact_id,
      v_event,
      v_actor_id,
      v_actor_name,
      CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'party_role', OLD.party_role,
        'access_scope', OLD.access_scope,
        'authority_level', OLD.authority_level,
        'is_authorized_signatory', OLD.is_authorized_signatory,
        'can_view_commercial', OLD.can_view_commercial,
        'can_approve_quotations', OLD.can_approve_quotations,
        'can_approve_specifications', OLD.can_approve_specifications,
        'can_approve_variations', OLD.can_approve_variations,
        'can_acknowledge_completions', OLD.can_acknowledge_completions,
        'can_approve_payments', OLD.can_approve_payments,
        'can_view_financials', OLD.can_view_financials,
        'hide_subcontract_pricing', OLD.hide_subcontract_pricing,
        'quotation_approval_limit', OLD.quotation_approval_limit,
        'variation_approval_limit', OLD.variation_approval_limit,
        'payment_approval_limit', OLD.payment_approval_limit,
        'is_active', OLD.is_active
      ) ELSE NULL END,
      jsonb_build_object(
        'party_role', NEW.party_role,
        'access_scope', NEW.access_scope,
        'authority_level', NEW.authority_level,
        'is_authorized_signatory', NEW.is_authorized_signatory,
        'can_view_commercial', NEW.can_view_commercial,
        'can_approve_quotations', NEW.can_approve_quotations,
        'can_approve_specifications', NEW.can_approve_specifications,
        'can_approve_variations', NEW.can_approve_variations,
        'can_acknowledge_completions', NEW.can_acknowledge_completions,
        'can_approve_payments', NEW.can_approve_payments,
        'can_view_financials', NEW.can_view_financials,
        'hide_subcontract_pricing', NEW.hide_subcontract_pricing,
        'quotation_approval_limit', NEW.quotation_approval_limit,
        'variation_approval_limit', NEW.variation_approval_limit,
        'payment_approval_limit', NEW.payment_approval_limit,
        'is_active', NEW.is_active
      ),
      v_reason
    );

  ELSIF TG_TABLE_NAME = 'client_authority_delegations' THEN
    v_client_id := NEW.client_id;
    v_project_id := NEW.project_id;
    v_contact_id := NEW.delegate_contact_id;
    v_delegation_id := NEW.id;
    v_reason := COALESCE(NEW.revoke_reason, NEW.reason);
    v_event := CASE
      WHEN TG_OP = 'INSERT' THEN 'delegation_created'
      WHEN NEW.status = 'revoked' AND OLD.status <> 'revoked' THEN 'delegation_revoked'
      ELSE 'delegation_updated'
    END;

    INSERT INTO public.client_authority_audit_logs (
      client_id, project_id, client_contact_id, delegation_id, event_type,
      actor_user_id, actor_name, previous_state, new_state, reason
    ) VALUES (
      v_client_id,
      v_project_id,
      v_contact_id,
      v_delegation_id,
      v_event,
      v_actor_id,
      v_actor_name,
      CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
        'status', OLD.status,
        'delegated_authorities', OLD.delegated_authorities,
        'max_approval_limit', OLD.max_approval_limit,
        'starts_at', OLD.starts_at,
        'ends_at', OLD.ends_at
      ) ELSE NULL END,
      jsonb_build_object(
        'delegator_contact_id', NEW.delegator_contact_id,
        'delegate_contact_id', NEW.delegate_contact_id,
        'status', NEW.status,
        'delegated_authorities', NEW.delegated_authorities,
        'max_approval_limit', NEW.max_approval_limit,
        'starts_at', NEW.starts_at,
        'ends_at', NEW.ends_at
      ),
      v_reason
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_client_contacts_authority ON public.client_contacts;
CREATE TRIGGER trg_audit_client_contacts_authority
  AFTER INSERT OR UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.capture_client_authority_audit();

DROP TRIGGER IF EXISTS trg_audit_client_project_access_authority ON public.client_project_access;
CREATE TRIGGER trg_audit_client_project_access_authority
  AFTER INSERT OR UPDATE ON public.client_project_access
  FOR EACH ROW EXECUTE FUNCTION public.capture_client_authority_audit();

DROP TRIGGER IF EXISTS trg_audit_client_delegations_authority ON public.client_authority_delegations;
CREATE TRIGGER trg_audit_client_delegations_authority
  AFTER INSERT OR UPDATE ON public.client_authority_delegations
  FOR EACH ROW EXECUTE FUNCTION public.capture_client_authority_audit();

ALTER TABLE public.client_authority_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_auth_audit_select_policy" ON public.client_authority_audit_logs;
CREATE POLICY "client_auth_audit_select_policy" ON public.client_authority_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.auth_is_portal_manager(auth.uid())
    OR public.auth_is_leadership(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.client_contacts cc
      WHERE cc.client_id = client_authority_audit_logs.client_id
        AND cc.user_id = auth.uid()
        AND cc.is_active = true
        AND (cc.is_authorized_signatory = true OR cc.corporate_portfolio_access = true)
    )
  );

-- ------------------------------------------------------------------------------
-- 7. SERVER-SIDE EFFECTIVE AUTHORITY & MONETARY CAP ENFORCEMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_client_can_approve_amount(
  p_project_id uuid,
  p_authority text,
  p_amount numeric,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount numeric := COALESCE(p_amount, 0);
  v_direct_ok boolean := false;
  v_delegated_ok boolean := false;
BEGIN
  IF p_user_id IS NULL OR NOT public.auth_is_active(p_user_id) THEN
    RETURN false;
  END IF;

  -- 1. Check direct project access + effective monetary limit (project override -> contact default -> NULL unlimited)
  SELECT EXISTS (
    SELECT 1
    FROM public.client_project_access cpa
    JOIN public.client_contacts cc ON cc.id = cpa.client_contact_id
    WHERE cpa.project_id = p_project_id
      AND cpa.is_active = true
      AND cpa.revoked_at IS NULL
      AND cc.is_active = true
      AND (cpa.user_id = p_user_id OR cc.user_id = p_user_id)
      AND (
        (
          p_authority = 'approve_quotations'
          AND cpa.can_approve_quotations = true
          AND (
            COALESCE(cpa.quotation_approval_limit, cc.quotation_approval_limit) IS NULL
            OR v_amount <= COALESCE(cpa.quotation_approval_limit, cc.quotation_approval_limit)
          )
        )
        OR (
          p_authority = 'approve_variations'
          AND cpa.can_approve_variations = true
          AND (
            COALESCE(cpa.variation_approval_limit, cc.variation_approval_limit) IS NULL
            OR v_amount <= COALESCE(cpa.variation_approval_limit, cc.variation_approval_limit)
          )
        )
        OR (
          p_authority = 'approve_payments'
          AND cpa.can_approve_payments = true
          AND (
            COALESCE(cpa.payment_approval_limit, cc.payment_approval_limit) IS NULL
            OR v_amount <= COALESCE(cpa.payment_approval_limit, cc.payment_approval_limit)
          )
        )
      )
  ) INTO v_direct_ok;

  IF v_direct_ok THEN
    RETURN true;
  END IF;

  -- 2. Check active, time-bounded delegation from a delegator who holds authority for this project/client
  SELECT EXISTS (
    SELECT 1
    FROM public.client_authority_delegations d
    JOIN public.client_contacts delegate_cc ON delegate_cc.id = d.delegate_contact_id
    JOIN public.client_contacts delegator_cc ON delegator_cc.id = d.delegator_contact_id
    JOIN public.client_project_access delegator_cpa
      ON delegator_cpa.client_contact_id = delegator_cc.id
     AND delegator_cpa.project_id = p_project_id
     AND delegator_cpa.is_active = true
     AND delegator_cpa.revoked_at IS NULL
    WHERE d.status = 'active'
      AND d.revoked_at IS NULL
      AND now() BETWEEN d.starts_at AND d.ends_at
      AND (d.project_id IS NULL OR d.project_id = p_project_id)
      AND delegate_cc.user_id = p_user_id
      AND delegate_cc.is_active = true
      AND delegator_cc.is_active = true
      AND delegator_cc.can_delegate_authority = true
      AND (d.max_approval_limit IS NULL OR v_amount <= d.max_approval_limit)
      AND (
        (
          p_authority = 'approve_quotations'
          AND COALESCE((d.delegated_authorities->>'can_approve_quotations')::boolean, false) = true
          AND delegator_cpa.can_approve_quotations = true
          AND (
            COALESCE(delegator_cpa.quotation_approval_limit, delegator_cc.quotation_approval_limit) IS NULL
            OR v_amount <= COALESCE(delegator_cpa.quotation_approval_limit, delegator_cc.quotation_approval_limit)
          )
        )
        OR (
          p_authority = 'approve_variations'
          AND COALESCE((d.delegated_authorities->>'can_approve_variations')::boolean, false) = true
          AND delegator_cpa.can_approve_variations = true
          AND (
            COALESCE(delegator_cpa.variation_approval_limit, delegator_cc.variation_approval_limit) IS NULL
            OR v_amount <= COALESCE(delegator_cpa.variation_approval_limit, delegator_cc.variation_approval_limit)
          )
        )
        OR (
          p_authority = 'approve_payments'
          AND COALESCE((d.delegated_authorities->>'can_approve_payments')::boolean, false) = true
          AND delegator_cpa.can_approve_payments = true
          AND (
            COALESCE(delegator_cpa.payment_approval_limit, delegator_cc.payment_approval_limit) IS NULL
            OR v_amount <= COALESCE(delegator_cpa.payment_approval_limit, delegator_cc.payment_approval_limit)
          )
        )
      )
  ) INTO v_delegated_ok;

  RETURN v_delegated_ok;
END;
$$;

-- Server-side trigger enforcing quotation monetary approval cap for external clients
CREATE OR REPLACE FUNCTION public.enforce_quotation_approval_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    IF NOT public.auth_is_portal_manager(auth.uid()) THEN
      IF NOT public.auth_client_can_approve_amount(NEW.project_id, 'approve_quotations', NEW.total_amount, auth.uid()) THEN
        RAISE EXCEPTION 'Approval denied: this quotation amount exceeds your authorized quotation approval limit or requires an authorized signatory.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_quotation_approval_limit ON public.client_quotations_contracts;
CREATE TRIGGER trg_enforce_quotation_approval_limit
  BEFORE UPDATE ON public.client_quotations_contracts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_quotation_approval_limit();

-- Server-side trigger enforcing variation monetary approval cap for external clients
CREATE OR REPLACE FUNCTION public.enforce_variation_approval_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.workflow_stage = 'client_approved' AND OLD.workflow_stage IS DISTINCT FROM 'client_approved' THEN
    IF NOT public.auth_is_portal_manager(auth.uid()) THEN
      IF NOT public.auth_client_can_approve_amount(
        NEW.project_id,
        'approve_variations',
        CASE WHEN NEW.is_chargeable THEN COALESCE(NEW.estimated_cost, 0) ELSE 0 END,
        auth.uid()
      ) THEN
        RAISE EXCEPTION 'Approval denied: this variation amount exceeds your authorized variation approval limit or requires an authorized signatory.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_variation_approval_limit ON public.project_variations;
CREATE TRIGGER trg_enforce_variation_approval_limit
  BEFORE UPDATE ON public.project_variations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_variation_approval_limit();

-- ------------------------------------------------------------------------------
-- 8. MULTI-PROJECT CORPORATE PORTFOLIO SUMMARY RPC (ROLE & ACCESS SCOPED)
-- ------------------------------------------------------------------------------
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
      CASE WHEN v_is_staff THEN true ELSE COALESCE(cpa.can_view_financials, false) END AS can_view_financials
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
    ORDER BY id, can_view_financials DESC
  ),
  enriched AS (
    SELECT
      dp.*,
      (SELECT count(*)::int FROM public.project_work_packages wp WHERE wp.project_id = dp.id) AS total_work_packages,
      (SELECT count(*)::int FROM public.project_work_packages wp WHERE wp.project_id = dp.id AND wp.status IN ('verified', 'released', 'handed_over')) AS completed_work_packages,
      (SELECT count(*)::int FROM public.work_package_blockers wb WHERE wb.project_id = dp.id AND wb.status IN ('open', 'escalated') AND (v_is_staff OR wb.client_visible = true)) AS active_blockers,
      (SELECT count(*)::int FROM public.client_quotations_contracts q WHERE q.project_id = dp.id AND q.status = 'issued') AS pending_quotations,
      (SELECT count(*)::int FROM public.project_specifications s WHERE s.project_id = dp.id AND s.status IN ('submitted', 'awaiting_approval')) AS pending_specs,
      (SELECT count(*)::int FROM public.project_variations v WHERE v.project_id = dp.id AND v.workflow_stage = 'awaiting_client_approval') AS pending_variations,
      (SELECT count(*)::int FROM public.project_area_completions a WHERE a.project_id = dp.id AND a.client_acknowledgement_status = 'pending') AS pending_completions,
      (SELECT count(*)::int FROM public.client_requests_complaints rc WHERE rc.project_id = dp.id AND rc.status NOT IN ('resolved', 'closed')) AS open_tickets
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

-- Upgrade auth_client_has_project_access so existing RLS policies honor active time-bounded delegations
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
  v_auth text := lower(trim(COALESCE(p_required_authority, '')));
  v_direct_ok boolean := false;
  v_delegated_ok boolean := false;
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

  IF FOUND THEN
    IF v_auth = '' THEN
      RETURN true;
    END IF;

    CASE v_auth
      WHEN 'view_commercial' THEN v_direct_ok := COALESCE(v_access.can_view_commercial, false);
      WHEN 'approve_quotations' THEN v_direct_ok := COALESCE(v_access.can_approve_quotations, false);
      WHEN 'approve_specifications' THEN v_direct_ok := COALESCE(v_access.can_approve_specifications, false);
      WHEN 'approve_variations' THEN v_direct_ok := COALESCE(v_access.can_approve_variations, false);
      WHEN 'acknowledge_completions' THEN v_direct_ok := COALESCE(v_access.can_acknowledge_completions, false);
      WHEN 'approve_payments' THEN v_direct_ok := COALESCE(v_access.can_approve_payments, false);
      WHEN 'view_financials' THEN v_direct_ok := COALESCE(v_access.can_view_financials, false);
      WHEN 'submit_requests_complaints' THEN v_direct_ok := COALESCE(v_access.can_submit_requests_complaints, true);
      ELSE v_direct_ok := false;
    END CASE;

    IF v_direct_ok THEN
      RETURN true;
    END IF;
  END IF;

  -- Check active time-bounded delegation for approval/acknowledgement authorities
  IF v_auth IN ('approve_quotations', 'approve_specifications', 'approve_variations', 'acknowledge_completions', 'approve_payments') THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.client_authority_delegations d
      JOIN public.client_contacts delegate_cc ON delegate_cc.id = d.delegate_contact_id
      JOIN public.client_contacts delegator_cc ON delegator_cc.id = d.delegator_contact_id
      JOIN public.clients c ON c.id = d.client_id
      JOIN public.client_project_access delegator_cpa
        ON delegator_cpa.client_contact_id = delegator_cc.id
       AND delegator_cpa.project_id = p_project_id
       AND delegator_cpa.is_active = true
       AND delegator_cpa.revoked_at IS NULL
      WHERE d.status = 'active'
        AND d.revoked_at IS NULL
        AND now() BETWEEN d.starts_at AND d.ends_at
        AND (d.project_id IS NULL OR d.project_id = p_project_id)
        AND delegate_cc.user_id = p_user_id
        AND delegate_cc.is_active = true
        AND delegator_cc.is_active = true
        AND delegator_cc.can_delegate_authority = true
        AND COALESCE(c.portal_enabled, true) = true
        AND (
          (v_auth = 'approve_quotations' AND COALESCE((d.delegated_authorities->>'can_approve_quotations')::boolean, false) AND delegator_cpa.can_approve_quotations)
          OR (v_auth = 'approve_specifications' AND COALESCE((d.delegated_authorities->>'can_approve_specifications')::boolean, false) AND delegator_cpa.can_approve_specifications)
          OR (v_auth = 'approve_variations' AND COALESCE((d.delegated_authorities->>'can_approve_variations')::boolean, false) AND delegator_cpa.can_approve_variations)
          OR (v_auth = 'acknowledge_completions' AND COALESCE((d.delegated_authorities->>'can_acknowledge_completions')::boolean, false) AND delegator_cpa.can_acknowledge_completions)
          OR (v_auth = 'approve_payments' AND COALESCE((d.delegated_authorities->>'can_approve_payments')::boolean, false) AND delegator_cpa.can_approve_payments)
        )
    ) INTO v_delegated_ok;

    RETURN v_delegated_ok;
  END IF;

  RETURN false;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. EXPLICIT GRANTS & PUBLIC REVOKE FOR SECURITY DEFINER FUNCTIONS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.auth_client_has_project_access(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_client_can_approve_amount(uuid, text, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_corporate_portfolio_summary(uuid) FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_authority_delegations TO authenticated;
GRANT SELECT ON public.client_authority_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_client_has_project_access(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_client_can_approve_amount(uuid, text, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_corporate_portfolio_summary(uuid) TO authenticated;

COMMIT;
