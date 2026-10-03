import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { MaterialRecord, formatNaira, formatNigerianDate } from './materialsService';
import { PurchaseOrderRecord, SupplierRecord } from './procurementService';

export interface MaterialDeliveryItemRecord {
  id: string;
  delivery_id: string;
  material_id: string;
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
  material?: MaterialRecord | null;
}

export interface MaterialDeliveryRecord {
  id: string;
  delivery_code: string;
  project_id: string;
  delivered_by: string | null;
  received_by: string | null;
  delivery_date: string;
  destination: string | null;
  acknowledgement_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  projects?: {
    id: string;
    project_code: string;
    name: string;
    status?: string;
  } | null;
  delivered_by_profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  received_by_profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  items?: MaterialDeliveryItemRecord[];
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
  batch_reference: string | null;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  material?: MaterialRecord | null;
}

export interface MaterialReceiptRecord {
  id: string;
  receipt_code: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  received_by: string | null;
  received_date: string;
  delivery_reference: string | null;
  condition_notes: string | null;
  discrepancy_notes: string | null;
  created_at: string;
  updated_at: string;
  purchase_orders?: {
    id: string;
    purchase_code: string;
    project_id: string;
    status: string;
    projects?: {
      id: string;
      project_code: string;
      name: string;
    } | null;
  } | null;
  suppliers?: SupplierRecord | null;
  received_by_profile?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  items?: MaterialReceiptItemRecord[];
}

export interface DeliveriesSummary {
  totalDeliveries: number;
  totalReceipts: number;
  totalItemsDelivered: number;
  totalRejectedQuantity: number;
}

export interface CreateDeliveryItemInput {
  material_id: string;
  quantity: number;
  unit_cost?: number | null;
  notes?: string | null;
}

export interface CreateDeliveryInput {
  delivery_code?: string;
  project_id: string;
  delivery_date?: string;
  destination?: string | null;
  delivered_by?: string | null;
  received_by?: string | null;
  acknowledgement_reference?: string | null;
  notes?: string | null;
  items: CreateDeliveryItemInput[];
}

export interface CreateReceiptItemInput {
  material_id: string;
  purchase_order_item_id?: string | null;
  quantity_received: number;
  accepted_quantity: number;
  rejected_quantity?: number;
  rejection_reason?: string | null;
  unit_cost?: number | null;
  batch_reference?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
}

export interface CreateReceiptInput {
  receipt_code?: string;
  purchase_order_id?: string | null;
  supplier_id?: string | null;
  received_date?: string;
  delivery_reference?: string | null;
  condition_notes?: string | null;
  discrepancy_notes?: string | null;
  items: CreateReceiptItemInput[];
}

/**
 * Retrieves summary metrics strictly from public.material_deliveries and public.material_receipts
 */
export async function getDeliveriesSummary(): Promise<{
  data: DeliveriesSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const [delivRes, receiptRes, receiptItemsRes] = await Promise.all([
      supabase.from('material_deliveries').select('id', { count: 'exact' }),
      supabase.from('material_receipts').select('id', { count: 'exact' }),
      supabase.from('material_receipt_items').select('rejected_quantity'),
    ]);

    if (delivRes.error || receiptRes.error) {
      const err = delivRes.error || receiptRes.error;
      return { data: null, error: err?.message || 'Unable to load deliveries summary.' };
    }

    const totalDeliveries = delivRes.count || 0;
    const totalReceipts = receiptRes.count || 0;

    const rejectedItems = receiptItemsRes.data || [];
    const totalRejectedQuantity = rejectedItems.reduce(
      (sum, it) => sum + (Number(it.rejected_quantity) || 0),
      0
    );

    return {
      data: {
        totalDeliveries,
        totalReceipts,
        totalItemsDelivered: totalDeliveries,
        totalRejectedQuantity,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve deliveries summary.',
    };
  }
}

/**
 * Retrieves material deliveries with joined project and items
 */
export async function getMaterialDeliveries(params?: {
  search?: string;
  projectId?: string;
}): Promise<{
  data: MaterialDeliveryRecord[];
  count: number;
  totalUnfilteredCount: number;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], count: 0, totalUnfilteredCount: 0, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const selectQuery = `
      *,
      projects:project_id(id, project_code, name, status),
      delivered_by_profile:profiles!delivered_by(id, first_name, last_name, display_name),
      received_by_profile:profiles!received_by(id, first_name, last_name, display_name),
      items:material_delivery_items(
        id,
        delivery_id,
        material_id,
        quantity,
        unit_cost,
        notes,
        created_at,
        material:materials(id, material_code, name, unit_of_measure, category)
      )
    `;

    let { data, count, error } = await supabase
      .from('material_deliveries')
      .select(selectQuery, { count: 'exact' })
      .order('delivery_date', { ascending: false });

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('material_deliveries')
          .select(selectQuery, { count: 'exact' })
          .order('delivery_date', { ascending: false });
        data = retry.data;
        count = retry.count;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[materialDeliveriesService] Query error:', error);
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records = (data || []) as MaterialDeliveryRecord[];
    const totalUnfilteredCount = count ?? records.length;

    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((d) => d.project_id === params.projectId);
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((d) => {
        const code = (d.delivery_code || '').toLowerCase();
        const prjCode = (d.projects?.project_code || '').toLowerCase();
        const prjName = (d.projects?.name || '').toLowerCase();
        const dest = (d.destination || '').toLowerCase();
        const ref = (d.acknowledgement_reference || '').toLowerCase();
        return (
          code.includes(term) ||
          prjCode.includes(term) ||
          prjName.includes(term) ||
          dest.includes(term) ||
          ref.includes(term)
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
      error: err instanceof Error ? err.message : 'Failed to query deliveries.',
    };
  }
}

/**
 * Fetches a single delivery by ID
 */
export async function getDeliveryById(id: string): Promise<{
  data: MaterialDeliveryRecord | null;
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
      delivered_by_profile:profiles!delivered_by(id, first_name, last_name, display_name),
      received_by_profile:profiles!received_by(id, first_name, last_name, display_name),
      items:material_delivery_items(
        id,
        delivery_id,
        material_id,
        quantity,
        unit_cost,
        notes,
        created_at,
        material:materials(id, material_code, name, category, brand, specification, unit_of_measure, standard_unit_cost)
      )
    `;

    const { data, error } = await supabase
      .from('material_deliveries')
      .select(selectQuery)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }
    if (!data) {
      return { data: null, error: 'Delivery record not found.' };
    }

    return { data: data as MaterialDeliveryRecord, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to load delivery details.',
    };
  }
}

/**
 * Generates an automatic next delivery code: DEL-YYYY-XXXX
 */
export async function generateNextDeliveryCode(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `DEL-${currentYear}-`;

  try {
    const { data } = await supabase
      .from('material_deliveries')
      .select('delivery_code')
      .ilike('delivery_code', `${prefix}%`)
      .order('delivery_code', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].delivery_code) {
      const match = data[0].delivery_code.match(/(\d+)$/);
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
 * Creates a material delivery and child line items
 */
export async function createMaterialDelivery(
  input: CreateDeliveryInput
): Promise<{ data: MaterialDeliveryRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const userId = user?.id || session?.user?.id || null;

    if (!input.project_id) {
      return { data: null, error: 'Please select a destination project.' };
    }
    if (!input.items || input.items.length === 0) {
      return { data: null, error: 'At least one delivery item is required.' };
    }

    let code = (input.delivery_code || '').trim().toUpperCase();
    if (!code) {
      code = await generateNextDeliveryCode();
    }

    const parentPayload = {
      delivery_code: code,
      project_id: input.project_id,
      delivery_date: input.delivery_date || new Date().toISOString(),
      destination: input.destination?.trim() || null,
      delivered_by: input.delivered_by || userId,
      received_by: input.received_by || null,
      acknowledgement_reference: input.acknowledgement_reference?.trim() || null,
      notes: input.notes?.trim() || null,
    };

    const { data: createdParent, error: parentError } = await supabase
      .from('material_deliveries')
      .insert(parentPayload)
      .select('id')
      .single();

    if (parentError) {
      return { data: null, error: parentError.message };
    }

    const delivId = createdParent.id;

    const childPayloads = input.items.map((it) => ({
      delivery_id: delivId,
      material_id: it.material_id,
      quantity: Number(it.quantity),
      unit_cost: it.unit_cost !== undefined && it.unit_cost !== null ? Number(it.unit_cost) : null,
      notes: it.notes?.trim() || null,
    }));

    const { error: itemsError } = await supabase
      .from('material_delivery_items')
      .insert(childPayloads);

    if (itemsError) {
      await supabase.from('material_deliveries').delete().eq('id', delivId);
      return { data: null, error: itemsError.message };
    }

    return await getDeliveryById(delivId);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to record delivery.',
    };
  }
}

/**
 * Retrieves material receipts with relations
 */
export async function getMaterialReceipts(params?: {
  search?: string;
  purchaseOrderId?: string;
  supplierId?: string;
}): Promise<{
  data: MaterialReceiptRecord[];
  count: number;
  totalUnfilteredCount: number;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], count: 0, totalUnfilteredCount: 0, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const selectQuery = `
      *,
      purchase_orders:purchase_order_id(
        id,
        purchase_code,
        project_id,
        status,
        projects:project_id(id, project_code, name)
      ),
      suppliers:supplier_id(id, supplier_code, name, contact_person, phone, email, address, status),
      received_by_profile:profiles!received_by(id, first_name, last_name, display_name),
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
        batch_reference,
        expiry_date,
        notes,
        created_at,
        material:materials(id, material_code, name, unit_of_measure, category)
      )
    `;

    let { data, count, error } = await supabase
      .from('material_receipts')
      .select(selectQuery, { count: 'exact' })
      .order('received_date', { ascending: false });

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('material_receipts')
          .select(selectQuery, { count: 'exact' })
          .order('received_date', { ascending: false });
        data = retry.data;
        count = retry.count;
        error = retry.error;
      }
    }

    if (error) {
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records = (data || []).map((rec: any) => ({
      ...rec,
      items: (rec.items || []).map((it: any) => ({
        ...it,
        material: Array.isArray(it.material) ? it.material[0] || null : it.material || null,
      })),
    })) as MaterialReceiptRecord[];

    const totalUnfilteredCount = count ?? records.length;

    if (params?.purchaseOrderId && params.purchaseOrderId !== 'all') {
      records = records.filter((r) => r.purchase_order_id === params.purchaseOrderId);
    }
    if (params?.supplierId && params.supplierId !== 'all') {
      records = records.filter((r) => r.supplier_id === params.supplierId);
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((r) => {
        const code = (r.receipt_code || '').toLowerCase();
        const ref = (r.delivery_reference || '').toLowerCase();
        const poCode = (r.purchase_orders?.purchase_code || '').toLowerCase();
        const supName = (r.suppliers?.name || '').toLowerCase();
        return code.includes(term) || ref.includes(term) || poCode.includes(term) || supName.includes(term);
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
      error: err instanceof Error ? err.message : 'Failed to query receipts.',
    };
  }
}

/**
 * Generates an automatic next receipt code: REC-YYYY-XXXX
 */
export async function generateNextReceiptCode(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REC-${currentYear}-`;

  try {
    const { data } = await supabase
      .from('material_receipts')
      .select('receipt_code')
      .ilike('receipt_code', `${prefix}%`)
      .order('receipt_code', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].receipt_code) {
      const match = data[0].receipt_code.match(/(\d+)$/);
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
 * Creates a material receipt against a purchase order.
 * CRITICAL ARCHITECTURE RULE (NO DOUBLE COUNTING):
 * When accepted_quantity > 0, an auditable stock movement with type 'receipt'
 * is recorded in public.material_stock_movements with reference to this receipt.
 */
export async function createMaterialReceipt(
  input: CreateReceiptInput
): Promise<{ data: MaterialReceiptRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const userId = user?.id || session?.user?.id || null;

    if (!input.items || input.items.length === 0) {
      return { data: null, error: 'At least one receipt item is required.' };
    }

    // Validate quantities
    for (let i = 0; i < input.items.length; i++) {
      const it = input.items[i];
      const rec = Number(it.quantity_received) || 0;
      const acc = Number(it.accepted_quantity) || 0;
      const rej = Number(it.rejected_quantity) || 0;

      if (rec <= 0) {
        return { data: null, error: `Item #${i + 1}: Quantity received must be greater than zero.` };
      }
      if (acc < 0 || rej < 0) {
        return { data: null, error: `Item #${i + 1}: Accepted and rejected quantities cannot be negative.` };
      }
      if (acc + rej > rec) {
        return { data: null, error: `Item #${i + 1}: Accepted (${acc}) + Rejected (${rej}) cannot exceed received (${rec}).` };
      }
      if (rej > 0 && !it.rejection_reason?.trim()) {
        return { data: null, error: `Item #${i + 1}: Please specify a rejection reason for the rejected quantity.` };
      }
    }

    let code = (input.receipt_code || '').trim().toUpperCase();
    if (!code) {
      code = await generateNextReceiptCode();
    }

    const parentPayload = {
      receipt_code: code,
      purchase_order_id: input.purchase_order_id || null,
      supplier_id: input.supplier_id || null,
      received_by: userId,
      received_date: input.received_date || new Date().toISOString(),
      delivery_reference: input.delivery_reference?.trim() || null,
      condition_notes: input.condition_notes?.trim() || null,
      discrepancy_notes: input.discrepancy_notes?.trim() || null,
    };

    const { data: createdParent, error: parentError } = await supabase
      .from('material_receipts')
      .insert(parentPayload)
      .select('id')
      .single();

    if (parentError) {
      return { data: null, error: parentError.message };
    }

    const receiptId = createdParent.id;

    // Insert items
    const childPayloads = input.items.map((it) => ({
      receipt_id: receiptId,
      material_id: it.material_id,
      purchase_order_item_id: it.purchase_order_item_id || null,
      quantity_received: Number(it.quantity_received),
      accepted_quantity: Number(it.accepted_quantity),
      rejected_quantity: Number(it.rejected_quantity) || 0,
      rejection_reason: it.rejection_reason?.trim() || null,
      unit_cost: it.unit_cost !== undefined && it.unit_cost !== null ? Number(it.unit_cost) : null,
      batch_reference: it.batch_reference?.trim() || null,
      expiry_date: it.expiry_date || null,
      notes: it.notes?.trim() || null,
    }));

    const { error: itemsError } = await supabase
      .from('material_receipt_items')
      .insert(childPayloads);

    if (itemsError) {
      await supabase.from('material_receipts').delete().eq('id', receiptId);
      return { data: null, error: itemsError.message };
    }

    // Update received_quantity on purchase_order_items if linked
    for (const it of input.items) {
      if (it.purchase_order_item_id) {
        const { data: poi } = await supabase
          .from('purchase_order_items')
          .select('received_quantity')
          .eq('id', it.purchase_order_item_id)
          .single();

        const currentRec = Number(poi?.received_quantity || 0);
        await supabase
          .from('purchase_order_items')
          .update({
            received_quantity: currentRec + Number(it.accepted_quantity),
            updated_at: new Date().toISOString(),
          })
          .eq('id', it.purchase_order_item_id);
      }
    }

    // Record auditable stock movement for accepted physical materials (type: 'receipt')
    for (const it of input.items) {
      const accepted = Number(it.accepted_quantity);
      if (accepted > 0) {
        await supabase.from('material_stock_movements').insert({
          material_id: it.material_id,
          project_id: null,
          movement_type: 'receipt',
          quantity: accepted,
          unit_cost: it.unit_cost || null,
          reference_id: receiptId,
          reference_code: code,
          movement_date: input.received_date || new Date().toISOString(),
          recorded_by: userId,
          notes: `Material receipt: ${code} (Waybill: ${input.delivery_reference || 'N/A'})`,
        });
      }
    }

    // Return complete record
    const { data: full } = await supabase
      .from('material_receipts')
      .select('*, suppliers(*), purchase_orders(*), items:material_receipt_items(*, material:materials(*))')
      .eq('id', receiptId)
      .single();

    return { data: full as MaterialReceiptRecord, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to record receipt.',
    };
  }
}

export class MaterialDeliveriesService {
  static getDeliveriesSummary = getDeliveriesSummary;
  static getMaterialDeliveries = getMaterialDeliveries;
  static getDeliveryById = getDeliveryById;
  static generateNextDeliveryCode = generateNextDeliveryCode;
  static createMaterialDelivery = createMaterialDelivery;
  static getMaterialReceipts = getMaterialReceipts;
  static generateNextReceiptCode = generateNextReceiptCode;
  static createMaterialReceipt = createMaterialReceipt;
}

export default MaterialDeliveriesService;
