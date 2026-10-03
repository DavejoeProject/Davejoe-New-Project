import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { MaterialRecord, formatNaira, formatNigerianDate } from './materialsService';
import { StockMovementType } from './materialStockService';

export interface MaterialLossRecord {
  id: string;
  project_id: string;
  material_id: string;
  quantity: number;
  movement_type: StockMovementType;
  reason: string;
  recorded_by: string | null;
  approved_by: string | null;
  loss_date: string;
  evidence_reference: string | null;
  notes: string | null;
  created_at: string;
  material?: MaterialRecord | null;
  projects?: {
    id: string;
    project_code: string;
    name: string;
  } | null;
  recorder?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  approver?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
}

export interface MaterialReturnRecord {
  id: string;
  project_id: string;
  material_id: string;
  quantity_returned: number;
  returned_by: string | null;
  received_by: string | null;
  return_date: string;
  condition: string | null;
  destination: string | null;
  notes: string | null;
  created_at: string;
  material?: MaterialRecord | null;
  projects?: {
    id: string;
    project_code: string;
    name: string;
  } | null;
  returner?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  receiver?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
}

export interface LossesReturnsSummary {
  totalLossRecords: number;
  totalLostQuantity: number;
  totalReturnRecords: number;
  totalReturnedQuantity: number;
}

export interface CreateLossInput {
  project_id: string;
  material_id: string;
  quantity: number;
  movement_type?: StockMovementType;
  reason: string;
  loss_date?: string;
  evidence_reference?: string | null;
  notes?: string | null;
}

export interface CreateReturnInput {
  project_id: string;
  material_id: string;
  quantity_returned: number;
  return_date?: string;
  condition?: string | null;
  destination?: string | null;
  notes?: string | null;
}

/**
 * Calculates summary metrics directly from public.material_losses and public.material_returns
 */
export async function getLossesReturnsSummary(): Promise<{
  data: LossesReturnsSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const [lossRes, retRes] = await Promise.all([
      supabase.from('material_losses').select('quantity'),
      supabase.from('material_returns').select('quantity_returned'),
    ]);

    if (lossRes.error || retRes.error) {
      const err = lossRes.error || retRes.error;
      return { data: null, error: err?.message || 'Unable to load summary.' };
    }

    const losses = lossRes.data || [];
    const returns = retRes.data || [];

    const totalLostQuantity = losses.reduce((s, l) => s + (Number(l.quantity) || 0), 0);
    const totalReturnedQuantity = returns.reduce((s, r) => s + (Number(r.quantity_returned) || 0), 0);

    return {
      data: {
        totalLossRecords: losses.length,
        totalLostQuantity,
        totalReturnRecords: returns.length,
        totalReturnedQuantity,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve losses & returns summary.',
    };
  }
}

/**
 * Retrieves material losses with relations
 */
export async function getMaterialLosses(params?: {
  projectId?: string;
  materialId?: string;
  search?: string;
}): Promise<{
  data: MaterialLossRecord[];
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
      material:materials(id, material_code, name, unit_of_measure, category, standard_unit_cost),
      projects:project_id(id, project_code, name),
      recorder:profiles!recorded_by(id, first_name, last_name, display_name),
      approver:profiles!approved_by(id, first_name, last_name, display_name)
    `;

    let { data, count, error } = await supabase
      .from('material_losses')
      .select(selectQuery, { count: 'exact' })
      .order('loss_date', { ascending: false });

    if (error) {
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records = (data || []) as MaterialLossRecord[];
    const totalUnfilteredCount = count ?? records.length;

    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((l) => l.project_id === params.projectId);
    }
    if (params?.materialId && params.materialId !== 'all') {
      records = records.filter((l) => l.material_id === params.materialId);
    }
    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((l) => {
        const mat = (l.material?.name || '').toLowerCase();
        const prj = (l.projects?.name || '').toLowerCase();
        const rsn = (l.reason || '').toLowerCase();
        const ev = (l.evidence_reference || '').toLowerCase();
        return mat.includes(term) || prj.includes(term) || rsn.includes(term) || ev.includes(term);
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
      error: err instanceof Error ? err.message : 'Unable to query material losses.',
    };
  }
}

/**
 * Records a real material loss in public.material_losses and generates auditable stock movement (type: 'damage')
 */
export async function recordMaterialLoss(
  input: CreateLossInput
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const userId = user?.id || session?.user?.id || null;

    if (!input.project_id) {
      return { success: false, error: 'Please select an associated project.' };
    }
    if (!input.material_id) {
      return { success: false, error: 'Please select a material.' };
    }
    if (!input.quantity || input.quantity <= 0) {
      return { success: false, error: 'Lost quantity must be greater than zero.' };
    }
    if (!input.reason?.trim()) {
      return { success: false, error: 'Please provide a reason for the material loss.' };
    }

    const now = new Date().toISOString();

    const lossPayload = {
      project_id: input.project_id,
      material_id: input.material_id,
      quantity: Number(input.quantity),
      movement_type: input.movement_type || 'damage',
      reason: input.reason.trim(),
      recorded_by: userId,
      approved_by: null,
      loss_date: input.loss_date || now,
      evidence_reference: input.evidence_reference?.trim() || null,
      notes: input.notes?.trim() || null,
    };

    const { data: created, error: lossErr } = await supabase
      .from('material_losses')
      .insert(lossPayload)
      .select('id')
      .single();

    if (lossErr) {
      return { success: false, error: lossErr.message };
    }

    // Record stock movement (type: 'damage')
    await supabase.from('material_stock_movements').insert({
      material_id: input.material_id,
      project_id: input.project_id,
      movement_type: 'damage',
      quantity: Number(input.quantity),
      reference_id: created.id,
      reference_code: `LOSS-${input.project_id.slice(0, 4).toUpperCase()}`,
      movement_date: input.loss_date || now,
      recorded_by: userId,
      notes: `Loss write-off: ${input.reason.trim()} (Ref: ${input.evidence_reference || 'N/A'})`,
    });

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record loss.',
    };
  }
}

/**
 * Approves a recorded material loss
 */
export async function approveMaterialLoss(
  id: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const userId = user?.id || session?.user?.id || null;

    const { error } = await supabase
      .from('material_losses')
      .update({
        approved_by: userId,
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to approve loss.',
    };
  }
}

/**
 * Retrieves material returns with relations
 */
export async function getMaterialReturns(params?: {
  projectId?: string;
  materialId?: string;
  search?: string;
}): Promise<{
  data: MaterialReturnRecord[];
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
      material:materials(id, material_code, name, unit_of_measure, category),
      projects:project_id(id, project_code, name),
      returner:profiles!returned_by(id, first_name, last_name, display_name),
      receiver:profiles!received_by(id, first_name, last_name, display_name)
    `;

    let { data, count, error } = await supabase
      .from('material_returns')
      .select(selectQuery, { count: 'exact' })
      .order('return_date', { ascending: false });

    if (error) {
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records = (data || []) as MaterialReturnRecord[];
    const totalUnfilteredCount = count ?? records.length;

    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((r) => r.project_id === params.projectId);
    }
    if (params?.materialId && params.materialId !== 'all') {
      records = records.filter((r) => r.material_id === params.materialId);
    }
    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((r) => {
        const mat = (r.material?.name || '').toLowerCase();
        const prj = (r.projects?.name || '').toLowerCase();
        const cond = (r.condition || '').toLowerCase();
        const dest = (r.destination || '').toLowerCase();
        return mat.includes(term) || prj.includes(term) || cond.includes(term) || dest.includes(term);
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
      error: err instanceof Error ? err.message : 'Unable to query material returns.',
    };
  }
}

/**
 * Records a real material return and creates auditable stock movement (type: 'return')
 */
export async function recordMaterialReturn(
  input: CreateReturnInput
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const userId = user?.id || session?.user?.id || null;

    if (!input.project_id) {
      return { success: false, error: 'Please select an associated project.' };
    }
    if (!input.material_id) {
      return { success: false, error: 'Please select a material.' };
    }
    if (!input.quantity_returned || input.quantity_returned <= 0) {
      return { success: false, error: 'Returned quantity must be greater than zero.' };
    }

    const now = new Date().toISOString();

    const returnPayload = {
      project_id: input.project_id,
      material_id: input.material_id,
      quantity_returned: Number(input.quantity_returned),
      returned_by: userId,
      received_by: userId,
      return_date: input.return_date || now,
      condition: input.condition?.trim() || 'Good',
      destination: input.destination?.trim() || 'Central Store',
      notes: input.notes?.trim() || null,
    };

    const { data: created, error: retErr } = await supabase
      .from('material_returns')
      .insert(returnPayload)
      .select('id')
      .single();

    if (retErr) {
      return { success: false, error: retErr.message };
    }

    // Record stock movement (type: 'return')
    await supabase.from('material_stock_movements').insert({
      material_id: input.material_id,
      project_id: input.project_id,
      movement_type: 'return',
      quantity: Number(input.quantity_returned),
      reference_id: created.id,
      reference_code: `RET-${input.project_id.slice(0, 4).toUpperCase()}`,
      movement_date: input.return_date || now,
      recorded_by: userId,
      notes: `Site return to store: Condition: ${input.condition || 'Good'} (${input.destination || 'Central Store'})`,
    });

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record return.',
    };
  }
}

export class MaterialLossesReturnsService {
  static getLossesReturnsSummary = getLossesReturnsSummary;
  static getMaterialLosses = getMaterialLosses;
  static recordMaterialLoss = recordMaterialLoss;
  static approveMaterialLoss = approveMaterialLoss;
  static getMaterialReturns = getMaterialReturns;
  static recordMaterialReturn = recordMaterialReturn;
}

export default MaterialLossesReturnsService;
