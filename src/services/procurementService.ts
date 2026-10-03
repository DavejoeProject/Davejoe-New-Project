import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { MaterialRecord, formatNaira, formatNigerianDate } from './materialsService';

export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'delivered'
  | 'received'
  | 'cancelled';

export const ALL_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'ordered',
  'delivered',
  'received',
  'cancelled',
];

export const PURCHASE_ORDER_STATUS_CONFIG: Record<
  PurchaseOrderStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  draft: {
    label: 'Draft',
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  },
  submitted: {
    label: 'Awaiting Approval',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClasses: 'bg-blue-500',
  },
  approved: {
    label: 'Approved',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClasses: 'bg-[#01875F]',
  },
  rejected: {
    label: 'Rejected',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClasses: 'bg-rose-500',
  },
  ordered: {
    label: 'Issued to Supplier',
    badgeClasses: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClasses: 'bg-purple-500',
  },
  delivered: {
    label: 'Delivered',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClasses: 'bg-amber-500',
  },
  received: {
    label: 'Received & Verified',
    badgeClasses: 'bg-teal-50 text-teal-700 border-teal-200',
    dotClasses: 'bg-teal-600',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClasses: 'bg-slate-100 text-slate-500 border-slate-200',
    dotClasses: 'bg-slate-400',
  },
};

export interface SupplierRecord {
  id: string;
  supplier_code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItemRecord {
  id: string;
  purchase_order_id: string;
  material_id: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number;
  total_cost: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  material?: MaterialRecord | null;
}

export interface PurchaseOrderRecord {
  id: string;
  purchase_code: string;
  project_id: string;
  supplier_id: string;
  material_request_id: string | null;
  status: PurchaseOrderStatus;
  purchase_date: string;
  expected_delivery_date: string | null;
  approved_by: string | null;
  approved_at: string | null;
  ordered_by: string | null;
  ordered_at: string | null;
  subtotal: number;
  delivery_cost: number;
  other_cost: number;
  total_cost: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  projects?: {
    id: string;
    project_code: string;
    name: string;
    status?: string;
  } | null;
  suppliers?: SupplierRecord | null;
  material_requests?: {
    id: string;
    request_code: string;
    status: string;
    requested_date: string;
    required_by_date: string | null;
    justification: string | null;
    requester?: {
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      display_name?: string | null;
    } | null;
  } | null;
  approved_profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  ordered_profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  items?: PurchaseOrderItemRecord[];
}

export interface ProcurementSummary {
  totalPurchaseOrders: number;
  pendingApproval: number;
  procurementCommitted: number;
  expectedDeliveries: number;
}

export interface MaterialReceiptItemRecord {
  id: string;
  receipt_id: string;
  material_id: string;
  purchase_order_item_id: string | null;
  quantity_received: number;
  accepted_quantity: number;
  rejected_quantity: number;
  rejection_reason: string | null;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
  material?: {
    id: string;
    material_code: string;
    name: string;
    unit_of_measure: string;
  } | null;
}

export interface MaterialReceiptRecord {
  id: string;
  receipt_code: string;
  delivery_reference: string | null;
  purchase_order_id: string | null;
  supplier_id: string | null;
  received_date: string;
  received_by: string | null;
  created_at: string;
  updated_at: string;
  items?: MaterialReceiptItemRecord[];
}

export interface CreatePurchaseOrderItemInput {
  material_id: string;
  ordered_quantity: number;
  unit_cost: number;
  notes?: string | null;
}

export interface CreatePurchaseOrderInput {
  purchase_code?: string;
  project_id: string;
  supplier_id: string;
  material_request_id?: string | null;
  purchase_date?: string;
  expected_delivery_date?: string | null;
  delivery_cost?: number;
  other_cost?: number;
  notes?: string | null;
  status?: PurchaseOrderStatus;
  items: CreatePurchaseOrderItemInput[];
}

/**
 * Retrieves summary metrics strictly from real Supabase table `public.purchase_orders`:
 * - TOTAL PURCHASE ORDERS: count of actual purchase orders
 * - PENDING APPROVAL: status === 'submitted'
 * - PROCUREMENT COMMITTED: sum of total_cost for active orders (approved, ordered, delivered, received)
 * - EXPECTED DELIVERIES: orders where expected_delivery_date is set and status in ('approved', 'ordered')
 */
export async function getProcurementSummary(): Promise<{
  data: ProcurementSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    let { data, error } = await supabase
      .from('purchase_orders')
      .select('id, status, total_cost, expected_delivery_date');

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('purchase_orders')
          .select('id, status, total_cost, expected_delivery_date');
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[procurementService] Summary error:', error);
      return { data: null, error: error.message || 'Unable to load procurement summary.' };
    }

    const records = data || [];
    const totalPurchaseOrders = records.length;
    const pendingApproval = records.filter((po) => po.status === 'submitted').length;

    // Committed: approved, ordered, delivered, received
    const committedStatuses = ['approved', 'ordered', 'delivered', 'received'];
    const procurementCommitted = records
      .filter((po) => committedStatuses.includes(po.status))
      .reduce((sum, po) => sum + (Number(po.total_cost) || 0), 0);

    const expectedDeliveries = records.filter(
      (po) =>
        po.expected_delivery_date &&
        ['approved', 'ordered'].includes(po.status)
    ).length;

    return {
      data: {
        totalPurchaseOrders,
        pendingApproval,
        procurementCommitted,
        expectedDeliveries,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve procurement summary.',
    };
  }
}

/**
 * Retrieves purchase orders with relations, multi-field search and filters
 */
export async function getPurchaseOrders(params?: {
  search?: string;
  status?: string;
  projectId?: string;
  supplierId?: string;
}): Promise<{
  data: PurchaseOrderRecord[];
  count: number;
  totalUnfilteredCount: number;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      data: [],
      count: 0,
      totalUnfilteredCount: 0,
      error: 'Database connection is not configured.',
    };
  }

  try {
    await ensureValidSession();

    const selectQuery = `
      *,
      projects:project_id(id, project_code, name, status),
      suppliers:supplier_id(id, supplier_code, name, contact_person, phone, email, address, status),
      material_requests:material_request_id(id, request_code, status, requested_date, required_by_date),
      approved_profile:profiles!approved_by(id, first_name, last_name, display_name),
      ordered_profile:profiles!ordered_by(id, first_name, last_name, display_name),
      items:purchase_order_items(
        id,
        purchase_order_id,
        material_id,
        ordered_quantity,
        received_quantity,
        unit_cost,
        total_cost,
        notes,
        created_at,
        updated_at,
        material:materials(id, material_code, name, unit_of_measure, category)
      )
    `;

    let { data, count, error } = await supabase
      .from('purchase_orders')
      .select(selectQuery, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('purchase_orders')
          .select(selectQuery, { count: 'exact' })
          .order('created_at', { ascending: false });
        data = retry.data;
        count = retry.count;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[procurementService] Query error:', error);
      return {
        data: [],
        count: 0,
        totalUnfilteredCount: 0,
        error: error.message || 'Unable to load purchase orders.',
      };
    }

    let records = (data || []) as PurchaseOrderRecord[];
    const totalUnfilteredCount = count ?? records.length;

    // Apply filters
    if (params?.status && params.status !== 'all') {
      records = records.filter((po) => po.status === params.status);
    }

    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((po) => po.project_id === params.projectId);
    }

    if (params?.supplierId && params.supplierId !== 'all') {
      records = records.filter((po) => po.supplier_id === params.supplierId);
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((po) => {
        const code = (po.purchase_code || '').toLowerCase();
        const prjCode = (po.projects?.project_code || '').toLowerCase();
        const prjName = (po.projects?.name || '').toLowerCase();
        const supCode = (po.suppliers?.supplier_code || '').toLowerCase();
        const supName = (po.suppliers?.name || '').toLowerCase();
        const reqCode = (po.material_requests?.request_code || '').toLowerCase();

        return (
          code.includes(term) ||
          prjCode.includes(term) ||
          prjName.includes(term) ||
          supCode.includes(term) ||
          supName.includes(term) ||
          reqCode.includes(term)
        );
      });
    }

    return {
      data: records,
      count: records.length,
      totalUnfilteredCount,
      error: null,
    };
  } catch (err) {
    return {
      data: [],
      count: 0,
      totalUnfilteredCount: 0,
      error: err instanceof Error ? err.message : 'Unable to query purchase orders.',
    };
  }
}

/**
 * Fetches a single purchase order by ID with all item lines and relational references
 */
export async function getPurchaseOrderById(id: string): Promise<{
  data: PurchaseOrderRecord | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const selectQuery = `
      *,
      projects:project_id(id, project_code, name, status),
      suppliers:supplier_id(id, supplier_code, name, contact_person, phone, email, address, status, notes),
      material_requests:material_request_id(
        id,
        request_code,
        status,
        requested_date,
        required_by_date,
        justification,
        requester:requested_by(id, first_name, last_name, display_name)
      ),
      approved_profile:profiles!approved_by(id, first_name, last_name, display_name),
      ordered_profile:profiles!ordered_by(id, first_name, last_name, display_name),
      items:purchase_order_items(
        id,
        purchase_order_id,
        material_id,
        ordered_quantity,
        received_quantity,
        unit_cost,
        total_cost,
        notes,
        created_at,
        updated_at,
        material:materials(id, material_code, name, category, brand, specification, unit_of_measure, standard_unit_cost, current_stock)
      )
    `;

    let { data, error } = await supabase
      .from('purchase_orders')
      .select(selectQuery)
      .eq('id', id)
      .maybeSingle();

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('purchase_orders')
          .select(selectQuery)
          .eq('id', id)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[procurementService] Detail fetch error:', error);
      return { data: null, error: error.message || 'Unable to load purchase order.' };
    }

    if (!data) {
      return { data: null, error: 'Purchase order record not found.' };
    }

    return { data: data as PurchaseOrderRecord, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve purchase order.',
    };
  }
}

/**
 * Checks if a purchase code is unique
 */
export async function checkPurchaseCodeUnique(
  code: string,
  excludeId?: string
): Promise<{ isUnique: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { isUnique: true, error: null };
  }

  try {
    await ensureValidSession();

    let query = supabase
      .from('purchase_orders')
      .select('id')
      .ilike('purchase_code', code.trim().toUpperCase());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;
    if (error) {
      return { isUnique: false, error: error.message };
    }

    return { isUnique: (data || []).length === 0, error: null };
  } catch (err) {
    return {
      isUnique: false,
      error: err instanceof Error ? err.message : 'Validation failed.',
    };
  }
}

/**
 * Generates an automatic next purchase code:
 * PO-YYYY-XXXX (e.g. PO-2026-0001)
 */
export async function generateNextPurchaseCode(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;

  try {
    const { data } = await supabase
      .from('purchase_orders')
      .select('purchase_code')
      .ilike('purchase_code', `${prefix}%`)
      .order('purchase_code', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].purchase_code) {
      const match = data[0].purchase_code.match(/(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        return `${prefix}${String(nextNum).padStart(4, '0')}`;
      }
    }

    return `${prefix}0001`;
  } catch {
    return `${prefix}0001`;
  }
}

/**
 * Creates a new purchase order and child line items
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<{ data: PurchaseOrderRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    if (!user && !session?.user) {
      return { data: null, error: 'Authentication required to create a purchase order.' };
    }

    const creatorId = user?.id || session?.user?.id;

    // 1. Validation
    if (!input.project_id) {
      return { data: null, error: 'Please select an associated project.' };
    }
    if (!input.supplier_id) {
      return { data: null, error: 'Please select a supplier.' };
    }
    if (!input.items || input.items.length === 0) {
      return { data: null, error: 'At least one purchase order item is required.' };
    }

    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      if (!it.material_id) {
        return { data: null, error: `Item #${i + 1}: Please select a material.` };
      }
      if (it.ordered_quantity <= 0) {
        return { data: null, error: `Item #${i + 1}: Ordered quantity must be greater than zero.` };
      }
      if (it.unit_cost < 0) {
        return { data: null, error: `Item #${i + 1}: Unit cost cannot be negative.` };
      }
    }

    // 2. Resolve purchase code
    let code = (input.purchase_code || '').trim().toUpperCase();
    if (!code) {
      code = await generateNextPurchaseCode();
    }

    const uniqueness = await checkPurchaseCodeUnique(code);
    if (!uniqueness.isUnique) {
      return { data: null, error: `Purchase order code ${code} already exists.` };
    }

    // 3. Calculate financial totals
    const lineTotals = input.items.map(
      (it) => Number(it.ordered_quantity) * (Number(it.unit_cost) || 0)
    );
    const subtotal = lineTotals.reduce((a, b) => a + b, 0);
    const deliveryCost = Math.max(0, Number(input.delivery_cost) || 0);
    const otherCost = Math.max(0, Number(input.other_cost) || 0);
    const totalCost = subtotal + deliveryCost + otherCost;

    // 4. Insert parent purchase_orders record
    const parentPayload = {
      purchase_code: code,
      project_id: input.project_id,
      supplier_id: input.supplier_id,
      material_request_id: input.material_request_id || null,
      status: input.status || 'submitted',
      purchase_date: input.purchase_date || new Date().toISOString(),
      expected_delivery_date: input.expected_delivery_date || null,
      subtotal,
      delivery_cost: deliveryCost,
      other_cost: otherCost,
      total_cost: totalCost,
      notes: input.notes?.trim() || null,
      created_by: creatorId,
      ordered_by: creatorId,
      ordered_at: new Date().toISOString(),
    };

    const { data: createdParent, error: parentError } = await supabase
      .from('purchase_orders')
      .insert(parentPayload)
      .select('id')
      .single();

    if (parentError) {
      console.error('[procurementService] Insert parent error:', parentError);
      return {
        data: null,
        error: parentError.message || 'Failed to create purchase order.',
      };
    }

    const poId = createdParent.id;

    // 5. Insert child purchase_order_items records
    const childPayloads = input.items.map((it) => {
      const qty = Number(it.ordered_quantity);
      const unit = Number(it.unit_cost) || 0;
      return {
        purchase_order_id: poId,
        material_id: it.material_id,
        ordered_quantity: qty,
        received_quantity: 0,
        unit_cost: unit,
        total_cost: qty * unit,
        notes: it.notes?.trim() || null,
      };
    });

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(childPayloads);

    if (itemsError) {
      console.error('[procurementService] Insert items error:', itemsError);
      // Clean up orphaned parent record on failure
      await supabase.from('purchase_orders').delete().eq('id', poId);
      return {
        data: null,
        error: itemsError.message || 'Failed to save purchase order items.',
      };
    }

    return await getPurchaseOrderById(poId);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to create purchase order.',
    };
  }
}

/**
 * Approves a purchase order
 */
export async function approvePurchaseOrder(
  id: string,
  notes?: string
): Promise<{ data: PurchaseOrderRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const approverId = user?.id || session?.user?.id || null;
    const now = new Date().toISOString();

    const updatePayload: Record<string, any> = {
      status: 'approved' as PurchaseOrderStatus,
      approved_by: approverId,
      approved_at: now,
      updated_at: now,
    };

    if (notes?.trim()) {
      updatePayload.notes = notes.trim();
    }

    const { error } = await supabase
      .from('purchase_orders')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      return { data: null, error: error.message || 'Approval failed.' };
    }

    return await getPurchaseOrderById(id);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to approve purchase order.',
    };
  }
}

/**
 * Rejects a purchase order with mandatory rejection notes
 */
export async function rejectPurchaseOrder(
  id: string,
  reason: string
): Promise<{ data: PurchaseOrderRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    return { data: null, error: 'A rejection reason is required.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const approverId = user?.id || session?.user?.id || null;
    const now = new Date().toISOString();

    // Fetch existing notes to append rejection reasoning
    const { data: existing } = await supabase
      .from('purchase_orders')
      .select('notes')
      .eq('id', id)
      .single();

    const currentNotes = existing?.notes || '';
    const updatedNotes = currentNotes
      ? `${currentNotes}\n[Rejection Reason]: ${trimmed}`
      : `[Rejection Reason]: ${trimmed}`;

    const { error } = await supabase
      .from('purchase_orders')
      .update({
        status: 'rejected' as PurchaseOrderStatus,
        approved_by: approverId,
        approved_at: now,
        notes: updatedNotes,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      return { data: null, error: error.message || 'Rejection failed.' };
    }

    return await getPurchaseOrderById(id);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to reject purchase order.',
    };
  }
}

/**
 * Fetches suppliers for dropdown selection
 */
export async function getSuppliersForDropdown(): Promise<{
  data: SupplierRecord[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    await ensureValidSession();

    const { data, error } = await supabase
      .from('suppliers')
      .select('id, supplier_code, name, contact_person, phone, email, address, status, notes, created_at, updated_at')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[procurementService] Error fetching suppliers:', error);
      return { data: [], error: error.message };
    }

    return { data: (data || []) as SupplierRecord[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Failed to load suppliers.' };
  }
}

/**
 * Fetches delivery receipts connected to a purchase order
 */
export async function getPurchaseOrderDeliveries(
  purchaseOrderId: string
): Promise<{ data: MaterialReceiptRecord[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    await ensureValidSession();

    const selectQuery = `
      id,
      receipt_code,
      delivery_reference,
      purchase_order_id,
      supplier_id,
      received_date,
      received_by,
      created_at,
      updated_at,
      items:material_receipt_items(
        id,
        receipt_id,
        material_id,
        purchase_order_item_id,
        quantity_received,
        accepted_quantity,
        rejected_quantity,
        rejection_reason,
        unit_cost,
        notes,
        created_at,
        material:materials(id, material_code, name, unit_of_measure)
      )
    `;

    const { data, error } = await supabase
      .from('material_receipts')
      .select(selectQuery)
      .eq('purchase_order_id', purchaseOrderId)
      .order('received_date', { ascending: false });

    if (error) {
      console.warn('[procurementService] Deliveries query error:', error);
      return { data: [], error: null }; // Clean fallback
    }

    const records = (data || []).map((rec: any) => ({
      ...rec,
      items: (rec.items || []).map((it: any) => ({
        ...it,
        material: Array.isArray(it.material) ? it.material[0] || null : it.material || null,
      })),
    })) as MaterialReceiptRecord[];

    return { data: records, error: null };
  } catch {
    return { data: [], error: null };
  }
}

export class ProcurementService {
  static getProcurementSummary = getProcurementSummary;
  static getPurchaseOrders = getPurchaseOrders;
  static getPurchaseOrderById = getPurchaseOrderById;
  static checkPurchaseCodeUnique = checkPurchaseCodeUnique;
  static generateNextPurchaseCode = generateNextPurchaseCode;
  static createPurchaseOrder = createPurchaseOrder;
  static approvePurchaseOrder = approvePurchaseOrder;
  static rejectPurchaseOrder = rejectPurchaseOrder;
  static getSuppliersForDropdown = getSuppliersForDropdown;
  static getPurchaseOrderDeliveries = getPurchaseOrderDeliveries;
}

export default ProcurementService;
