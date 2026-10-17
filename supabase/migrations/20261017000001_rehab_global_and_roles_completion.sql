-- ==============================================================================
-- DAVEJOE MANAGEMENT TOOL — PHASE 9.8 REHAB GLOBAL & FULL ROLE ARCHITECTURE
-- ==============================================================================
-- 1. Complete nine-role directory and granular permissions
-- 2. Equal administrative authority for Management / CEO and Executive Director
-- 3. Production, inventory, internal transfers & 3rd-party sales for Rehab Global
-- 4. Server-enforced transactional user creation RPC with audit logging
-- ==============================================================================

-- 1. ENSURE ALL NINE ROLES EXIST IN public.roles
INSERT INTO public.roles (slug, name, description)
VALUES
  ('management', 'Management / CEO', 'Executive leadership with comprehensive oversight'),
  ('executive_director', 'Executive Director — Business Operations & Strategy', 'Executive oversight of operations, strategy, finance, and enterprise governance'),
  ('admin', 'Admin / Client & Workforce Coordinator', 'Administrative coordinator for clients and workforce'),
  ('technical', 'Technical Inspection & QC Officer', 'Technical compliance, quality control, core testing, and structural certification'),
  ('supervisor', 'Site Supervisor', 'On-site operations, daily work oversight, clock-in/clock-out, and attendance'),
  ('procurement', 'Procurement & Logistics', 'Supply chain, material requisitions, purchase orders, and delivery logistics'),
  ('accounts', 'Accounts / Finance', 'Financial ledgers, payments, invoicing, budget vs actual, and project costing'),
  ('artisan', 'Artisan / Workforce', 'Direct project execution, site work, and task participation'),
  ('social_media_manager', 'Social Media Manager', 'Content planning, media assets, publishing, and digital communications')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 2. SEED PERMISSIONS FOR ALL DOMAINS
INSERT INTO public.permissions (name, module, description)
VALUES
  ('qc.view', 'inspections', 'View technical inspections and snagging logs'),
  ('qc.inspect', 'inspections', 'Record inspection findings and test results'),
  ('qc.certify', 'inspections', 'Certify site milestone technical sign-offs'),
  ('procurement.view', 'procurement', 'View material requests, purchase orders, and suppliers'),
  ('procurement.order', 'procurement', 'Create and manage purchase orders and commitments'),
  ('procurement.approve', 'procurement', 'Authorize procurement commitments and order signoffs'),
  ('accounts.view', 'finance', 'View project financial summaries, ledgers, and costs'),
  ('accounts.transact', 'finance', 'Record payments, expenditures, and invoices'),
  ('accounts.approve', 'finance', 'Authorize financial disbursements and invoice approvals'),
  ('social.view', 'marketing', 'View content calendars, campaign plans, and assets'),
  ('social.manage', 'marketing', 'Create and manage social media content and media assets'),
  ('social.publish', 'marketing', 'Mark content as published and manage publishing logs'),
  ('rehab.view', 'rehab_global', 'View Rehab Global paint inventory, production, and sales'),
  ('rehab.manage', 'rehab_global', 'Manage paint products, prices, and stock levels'),
  ('rehab.production', 'rehab_global', 'Record paint batch production runs and raw materials'),
  ('rehab.sales', 'rehab_global', 'Record internal transfers to Davejoe and third-party sales')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to Management and Executive Director
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('management', 'executive_director')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign QC permissions to Technical Inspection & QC Officer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'technical'
  AND p.name IN ('qc.view', 'qc.inspect', 'qc.certify', 'projects.view', 'audit.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign Procurement permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'procurement'
  AND p.name IN ('procurement.view', 'procurement.order', 'materials.view', 'projects.view', 'rehab.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign Accounts permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'accounts'
  AND p.name IN ('accounts.view', 'accounts.transact', 'finance.view', 'procurement.view', 'projects.view', 'rehab.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign Social Media permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'social_media_manager'
  AND p.name IN ('social.view', 'social.manage', 'social.publish', 'projects.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. EQUAL LEADERSHIP RLS POLICIES (MANAGEMENT & EXECUTIVE DIRECTOR)
-- Profiles Update RLS
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.manage')
)
WITH CHECK (
  (id = auth.uid() AND (status = (SELECT status FROM public.profiles WHERE id = auth.uid())))
  OR public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('users.manage')
);

-- User Roles RLS (Insert, Update, Delete)
DROP POLICY IF EXISTS "user_roles_insert_policy" ON public.user_roles;
CREATE POLICY "user_roles_insert_policy" ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);

DROP POLICY IF EXISTS "user_roles_update_policy" ON public.user_roles;
CREATE POLICY "user_roles_update_policy" ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);

DROP POLICY IF EXISTS "user_roles_delete_policy" ON public.user_roles;
CREATE POLICY "user_roles_delete_policy" ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);

-- Role Permissions Mutation RLS
DROP POLICY IF EXISTS "role_permissions_mutate_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_mutate_policy" ON public.role_permissions
FOR ALL
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('roles.manage')
);

-- Audit Logs Select RLS
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_permission('audit.view')
);

-- 4. REHAB GLOBAL RESOURCES SCHEMA
CREATE TABLE IF NOT EXISTS public.rehab_paint_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Emulsion',
  color text,
  pack_size text NOT NULL DEFAULT '20 Litres',
  current_stock numeric NOT NULL DEFAULT 0,
  reorder_level numeric NOT NULL DEFAULT 20,
  unit_cost_price numeric NOT NULL DEFAULT 0,
  unit_selling_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rehab_production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text UNIQUE NOT NULL,
  product_id uuid REFERENCES public.rehab_paint_products(id) ON DELETE SET NULL,
  quantity_produced numeric NOT NULL,
  raw_materials_consumed jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  supervisor_id uuid REFERENCES public.profiles(id),
  start_date date DEFAULT current_date,
  completed_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rehab_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.rehab_paint_products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('production_in', 'internal_transfer_davejoe', 'third_party_sale', 'stock_adjustment', 'damaged_loss')),
  quantity numeric NOT NULL,
  previous_stock numeric NOT NULL DEFAULT 0,
  new_stock numeric NOT NULL DEFAULT 0,
  reference_id text,
  destination_project_id uuid REFERENCES public.projects(id),
  customer_name text,
  unit_price numeric DEFAULT 0,
  total_price numeric DEFAULT 0,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on Rehab tables
ALTER TABLE public.rehab_paint_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rehab_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rehab_products_select_policy" ON public.rehab_paint_products
FOR SELECT TO authenticated USING (true);

CREATE POLICY "rehab_products_mutate_policy" ON public.rehab_paint_products
FOR ALL TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
);

CREATE POLICY "rehab_runs_select_policy" ON public.rehab_production_runs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "rehab_runs_mutate_policy" ON public.rehab_production_runs
FOR ALL TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
);

CREATE POLICY "rehab_movements_select_policy" ON public.rehab_stock_movements
FOR SELECT TO authenticated USING (true);

CREATE POLICY "rehab_movements_mutate_policy" ON public.rehab_stock_movements
FOR ALL TO authenticated
USING (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
  OR public.auth_has_role('accounts')
)
WITH CHECK (
  public.auth_has_role('management')
  OR public.auth_has_role('executive_director')
  OR public.auth_has_role('admin')
  OR public.auth_has_role('procurement')
  OR public.auth_has_role('accounts')
);

-- 5. SERVER-SIDE TRANSACTIONAL USER CREATION FUNCTION
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_first_name text,
  p_last_name text,
  p_phone text DEFAULT NULL,
  p_roles text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_is_management boolean;
  v_is_executive boolean;
  v_new_user_id uuid;
  v_display_name text;
  v_role_slug text;
  v_role_id uuid;
  v_assigned_roles text[] := ARRAY[]::text[];
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: No active session';
  END IF;

  -- 1. Check Caller Authority: Must be Management / CEO or Executive Director
  SELECT public.auth_has_role('management') INTO v_is_management;
  SELECT public.auth_has_role('executive_director') INTO v_is_executive;

  IF NOT (v_is_management OR v_is_executive) THEN
    RAISE EXCEPTION 'Access Denied: Only Management / CEO and Executive Director can create users and assign roles';
  END IF;

  -- 2. Validate Parameters
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email address is required';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Check if user already exists in auth.users
  SELECT id INTO v_new_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email));

  IF v_new_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'User with email % already exists', p_email;
  END IF;

  v_new_user_id := gen_random_uuid();
  v_display_name := trim(COALESCE(p_first_name, '') || ' ' || COALESCE(p_last_name, ''));
  IF v_display_name = '' THEN
    v_display_name := split_part(p_email, '@', 1);
  END IF;

  -- 3. Insert into auth.users with encrypted password
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) VALUES (
    v_new_user_id,
    '00000000-0000-0000-0000-000000000000'::uuid,
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'display_name', v_display_name,
      'phone', p_phone
    ),
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  -- 4. Upsert Profile
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    display_name,
    phone,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_new_user_id,
    lower(trim(p_email)),
    p_first_name,
    p_last_name,
    v_display_name,
    p_phone,
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    status = 'active',
    updated_at = now();

  -- 5. Assign Roles
  FOREACH v_role_slug IN ARRAY p_roles LOOP
    SELECT id INTO v_role_id
    FROM public.roles
    WHERE lower(slug) = lower(v_role_slug)
       OR lower(name) = lower(v_role_slug)
    LIMIT 1;

    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, assigned_by)
      VALUES (v_new_user_id, v_role_id, v_caller_id)
      ON CONFLICT (user_id, role_id) DO NOTHING;

      v_assigned_roles := array_append(v_assigned_roles, v_role_slug);
    END IF;
  END LOOP;

  -- 6. Record in immutable audit log
  INSERT INTO public.audit_logs (
    actor_id,
    action,
    module,
    table_name,
    record_id,
    new_values
  ) VALUES (
    v_caller_id,
    'admin.user_created',
    'administration',
    'profiles',
    v_new_user_id::text,
    jsonb_build_object(
      'user_id', v_new_user_id,
      'email', lower(trim(p_email)),
      'display_name', v_display_name,
      'roles', v_assigned_roles,
      'created_by', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'email', lower(trim(p_email)),
    'display_name', v_display_name,
    'assigned_roles', v_assigned_roles
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text, text, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, text, text, text[]) TO authenticated;
