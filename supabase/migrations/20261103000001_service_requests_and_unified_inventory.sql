-- ==============================================================================
-- DAVEJOE MANAGEMENT TOOL — SERVICE REQUESTS & UNIFIED COMMERCIAL INVENTORY
-- ==============================================================================
-- 1. Walk-in Customer Service Requests with Audit History & Project Conversion
-- 2. Multi-Category Inventory (Paints, Tools, Screeding, Diffusers, Vases, Partner Items)
-- 3. Stock Transactions Ledger, Issuance Accountability Register, and Sales Checkout
-- 4. Customer Enquiries & Partner Consignment Tracking
-- 5. Rehab Global Paint Internal Transfers to Davejoe Interiors
-- ==============================================================================

-- ==============================================================================
-- 1. WALK-IN SERVICE REQUESTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  project_address text NOT NULL,
  service_type text NOT NULL,
  requirements_description text NOT NULL,
  enquiry_date date NOT NULL DEFAULT CURRENT_DATE,
  estimated_budget numeric(14,2),
  attachments jsonb DEFAULT '[]'::jsonb,
  internal_notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'under_review',
    'awaiting_customer_info',
    'inspection_required',
    'quotation_in_progress',
    'quotation_sent',
    'approved',
    'rejected',
    'converted_to_project',
    'closed'
  )),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_role text,
  inspection_notes text,
  management_comments text,
  converted_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  notes text,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 2. UNIFIED COMMERCIAL INVENTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  unit_of_measure text NOT NULL DEFAULT 'pcs',
  cost_price numeric(14,2) NOT NULL DEFAULT 0,
  selling_price numeric(14,2) NOT NULL DEFAULT 0,
  current_stock numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 5,
  business_unit text NOT NULL DEFAULT 'davejoe' CHECK (business_unit IN ('davejoe', 'rehab_global', 'partner')),
  ownership text NOT NULL DEFAULT 'davejoe_owned' CHECK (ownership IN ('davejoe_owned', 'rehab_owned', 'partner_owned', 'consignment')),
  partner_name text,
  partner_commission_pct numeric(5,2) DEFAULT 0,
  supplier text,
  storage_location text,
  image_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'stock_in',
    'sale',
    'issue_project',
    'issue_workforce',
    'return',
    'internal_transfer',
    'adjustment',
    'damaged'
  )),
  quantity numeric(12,2) NOT NULL,
  previous_stock numeric(12,2) NOT NULL,
  new_stock numeric(12,2) NOT NULL,
  unit_price numeric(14,2) DEFAULT 0,
  total_price numeric(14,2) DEFAULT 0,
  business_unit text NOT NULL DEFAULT 'davejoe',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  recipient_workforce_id uuid REFERENCES public.workforce_members(id) ON DELETE SET NULL,
  recipient_name text,
  authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  payment_status text DEFAULT 'paid',
  payment_method text DEFAULT 'transfer',
  reference_code text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_code text UNIQUE NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_issued numeric(12,2) NOT NULL,
  quantity_returned numeric(12,2) NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  workforce_member_id uuid REFERENCES public.workforce_members(id) ON DELETE SET NULL,
  recipient_name text NOT NULL,
  authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  returned_at timestamptz,
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'partially_returned', 'fully_returned', 'consumed')),
  notes text
);

CREATE TABLE IF NOT EXISTS public.inventory_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  total_price numeric(14,2) NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partially_paid')),
  payment_method text NOT NULL DEFAULT 'transfer' CHECK (payment_method IN ('transfer', 'cash', 'pos', 'cheque')),
  business_unit text NOT NULL DEFAULT 'davejoe' CHECK (business_unit IN ('davejoe', 'rehab_global', 'partner')),
  salesperson_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inventory_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity_required numeric(12,2) NOT NULL DEFAULT 1,
  quoted_price numeric(14,2),
  enquiry_date date NOT NULL DEFAULT CURRENT_DATE,
  availability_status text NOT NULL DEFAULT 'in_stock' CHECK (availability_status IN ('in_stock', 'low_stock', 'out_of_stock', 'requires_order')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN (
    'new',
    'awaiting_stock_confirmation',
    'quotation_sent',
    'awaiting_payment',
    'converted_to_sale',
    'not_converted',
    'closed'
  )),
  follow_up_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_enquiries ENABLE ROW LEVEL SECURITY;

-- Service Requests: Authenticated access
CREATE POLICY "service_requests_select" ON public.service_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_requests_all" ON public.service_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "service_request_history_select" ON public.service_request_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_request_history_insert" ON public.service_request_history FOR INSERT TO authenticated WITH CHECK (true);

-- Inventory Items: Authenticated access
CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_items_mutate" ON public.inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory Transactions: Authenticated access
CREATE POLICY "inventory_transactions_select" ON public.inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_transactions_insert" ON public.inventory_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- Inventory Issuances: Authenticated access
CREATE POLICY "inventory_issuances_select" ON public.inventory_issuances FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_issuances_mutate" ON public.inventory_issuances FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory Sales: Authenticated access
CREATE POLICY "inventory_sales_select" ON public.inventory_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_sales_mutate" ON public.inventory_sales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory Enquiries: Authenticated access
CREATE POLICY "inventory_enquiries_select" ON public.inventory_enquiries FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_enquiries_mutate" ON public.inventory_enquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 4. ATOMIC DATABASE RPCs FOR TRANSACTIONS (ROW-LOCKED)
-- ==============================================================================

-- 4.1 Atomic Sales Checkout with row locks
CREATE OR REPLACE FUNCTION public.record_inventory_sale(
  p_item_id uuid,
  p_quantity numeric,
  p_unit_price numeric,
  p_customer_name text,
  p_customer_phone text DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_payment_method text DEFAULT 'transfer',
  p_payment_status text DEFAULT 'paid',
  p_notes text DEFAULT NULL,
  p_salesperson_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_new_stock numeric;
  v_sale_number text;
  v_sale_id uuid;
  v_total_price numeric;
BEGIN
  -- 1. Lock item row
  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % not found', p_item_id;
  END IF;

  IF v_item.current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for "%". Required: %, Available: %',
      v_item.name, p_quantity, v_item.current_stock;
  END IF;

  v_new_stock := v_item.current_stock - p_quantity;
  v_total_price := p_quantity * p_unit_price;
  v_sale_number := 'SL-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(random() * 9000 + 1000)::text, 4, '0');

  -- 2. Update stock
  UPDATE public.inventory_items
  SET current_stock = v_new_stock,
      updated_at = now()
  WHERE id = p_item_id;

  -- 3. Record Sale
  INSERT INTO public.inventory_sales (
    sale_number,
    item_id,
    quantity,
    unit_price,
    total_price,
    customer_name,
    customer_phone,
    customer_email,
    payment_status,
    payment_method,
    business_unit,
    salesperson_id,
    notes
  ) VALUES (
    v_sale_number,
    p_item_id,
    p_quantity,
    p_unit_price,
    v_total_price,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_payment_status,
    p_payment_method,
    v_item.business_unit,
    p_salesperson_id,
    p_notes
  ) RETURNING id INTO v_sale_id;

  -- 4. Record Stock Transaction Movement
  INSERT INTO public.inventory_transactions (
    item_id,
    transaction_type,
    quantity,
    previous_stock,
    new_stock,
    unit_price,
    total_price,
    business_unit,
    customer_name,
    customer_phone,
    payment_status,
    payment_method,
    reference_code,
    notes,
    created_by
  ) VALUES (
    p_item_id,
    'sale',
    p_quantity,
    v_item.current_stock,
    v_new_stock,
    p_unit_price,
    v_total_price,
    v_item.business_unit,
    p_customer_name,
    p_customer_phone,
    p_payment_status,
    p_payment_method,
    v_sale_number,
    p_notes,
    p_salesperson_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'new_stock', v_new_stock
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_inventory_sale FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inventory_sale TO authenticated;

-- 4.2 Atomic Material / Inventory Issuance
CREATE OR REPLACE FUNCTION public.record_inventory_issuance(
  p_item_id uuid,
  p_quantity numeric,
  p_recipient_name text,
  p_project_id uuid DEFAULT NULL,
  p_workforce_member_id uuid DEFAULT NULL,
  p_authorized_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item record;
  v_new_stock numeric;
  v_issuance_code text;
  v_issuance_id uuid;
BEGIN
  SELECT * INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % not found', p_item_id;
  END IF;

  IF v_item.current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock to issue "%". Required: %, Available: %',
      v_item.name, p_quantity, v_item.current_stock;
  END IF;

  v_new_stock := v_item.current_stock - p_quantity;
  v_issuance_code := 'ISS-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(random() * 9000 + 1000)::text, 4, '0');

  UPDATE public.inventory_items
  SET current_stock = v_new_stock, updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.inventory_issuances (
    issuance_code,
    item_id,
    quantity_issued,
    project_id,
    workforce_member_id,
    recipient_name,
    authorized_by,
    notes
  ) VALUES (
    v_issuance_code,
    p_item_id,
    p_quantity,
    p_project_id,
    p_workforce_member_id,
    p_recipient_name,
    p_authorized_by,
    p_notes
  ) RETURNING id INTO v_issuance_id;

  INSERT INTO public.inventory_transactions (
    item_id,
    transaction_type,
    quantity,
    previous_stock,
    new_stock,
    business_unit,
    project_id,
    recipient_workforce_id,
    recipient_name,
    authorized_by,
    reference_code,
    notes,
    created_by
  ) VALUES (
    p_item_id,
    CASE WHEN p_project_id IS NOT NULL THEN 'issue_project' ELSE 'issue_workforce' END,
    p_quantity,
    v_item.current_stock,
    v_new_stock,
    v_item.business_unit,
    p_project_id,
    p_workforce_member_id,
    p_recipient_name,
    p_authorized_by,
    v_issuance_code,
    p_notes,
    p_authorized_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'issuance_id', v_issuance_id,
    'issuance_code', v_issuance_code,
    'new_stock', v_new_stock
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_inventory_issuance FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_inventory_issuance TO authenticated;

-- 4.3 Atomic Rehab Global to Davejoe Internal Paint Transfer
CREATE OR REPLACE FUNCTION public.transfer_rehab_paint_to_davejoe(
  p_rehab_product_id uuid,
  p_quantity numeric,
  p_destination_project_id uuid DEFAULT NULL,
  p_authorized_by uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rehab_item record;
  v_new_rehab_stock numeric;
  v_ref_code text;
BEGIN
  SELECT * INTO v_rehab_item
  FROM public.rehab_paint_products
  WHERE id = p_rehab_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rehab Paint Product % not found', p_rehab_product_id;
  END IF;

  IF v_rehab_item.current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient Rehab Global paint stock for "%". Required: %, Available: %',
      v_rehab_item.name, p_quantity, v_rehab_item.current_stock;
  END IF;

  v_new_rehab_stock := v_rehab_item.current_stock - p_quantity;
  v_ref_code := 'TRF-RHB-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(random() * 9000 + 1000)::text, 4, '0');

  -- Deduct from Rehab
  UPDATE public.rehab_paint_products
  SET current_stock = v_new_rehab_stock, updated_at = now()
  WHERE id = p_rehab_product_id;

  -- Record Rehab stock movement
  INSERT INTO public.rehab_stock_movements (
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reference_id,
    destination_project_id,
    notes,
    recorded_by
  ) VALUES (
    p_rehab_product_id,
    'internal_transfer_davejoe',
    p_quantity,
    v_rehab_item.current_stock,
    v_new_rehab_stock,
    v_ref_code,
    p_destination_project_id,
    COALESCE(p_notes, 'Internal Transfer from Rehab Global to Davejoe Interiors'),
    p_authorized_by
  );

  RETURN jsonb_build_object(
    'success', true,
    'transfer_code', v_ref_code,
    'new_rehab_stock', v_new_rehab_stock
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_rehab_paint_to_davejoe FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_rehab_paint_to_davejoe TO authenticated;
