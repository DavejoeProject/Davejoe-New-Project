import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { MaterialRecord, formatNigerianDate } from './materialsService';

export interface MaterialReconciliationRecord {
  id: string;
  project_id: string;
  material_id: string;
  reconciliation_date: string;
  opening_quantity: number;
  delivered_quantity: number;
  returned_quantity: number;
  consumed_quantity: number;
  damaged_quantity: number;
  wasted_quantity: number;
  closing_quantity: number;
  expected_closing_quantity: number;
  variance_quantity: number;
  reconciled_by: string | null;
  notes: string | null;
  created_at: string;
  material?: MaterialRecord | null;
  projects?: {
    id: string;
    project_code: string;
    name: string;
  } | null;
  reconciler?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
}

export interface ReconciliationSummary {
  totalReconciliations: number;
  balancedCount: number;
  varianceCount: number;
  totalVarianceQuantity: number;
}

export interface CreateReconciliationInput {
  project_id: string;
  material_id: string;
  reconciliation_date?: string;
  opening_quantity: number;
  delivered_quantity: number;
  returned_quantity: number;
  consumed_quantity: number;
  damaged_quantity: number;
  wasted_quantity: number;
  closing_quantity: number;
  notes?: string | null;
}

/**
 * Calculates summary metrics directly from public.material_reconciliations
 */
export async function getReconciliationSummary(): Promise<{
  data: ReconciliationSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const { data, error } = await supabase
      .from('material_reconciliations')
      .select('variance_quantity');

    if (error) {
      return { data: null, error: error.message };
    }

    const records = data || [];
    const totalReconciliations = records.length;
    let balancedCount = 0;
    let varianceCount = 0;
    let totalVarianceQuantity = 0;

    records.forEach((r) => {
      const v = Number(r.variance_quantity) || 0;
      totalVarianceQuantity += v;
      if (Math.abs(v) < 0.0001) {
        balancedCount++;
      } else {
        varianceCount++;
      }
    });

    return {
      data: {
        totalReconciliations,
        balancedCount,
        varianceCount,
        totalVarianceQuantity,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve reconciliation summary.',
    };
  }
}

/**
 * Retrieves material reconciliations with relations
 */
export async function getMaterialReconciliations(params?: {
  projectId?: string;
  materialId?: string;
  hasVariance?: boolean | 'all';
  search?: string;
}): Promise<{
  data: MaterialReconciliationRecord[];
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
      reconciler:profiles!reconciled_by(id, first_name, last_name, display_name)
    `;

    let { data, count, error } = await supabase
      .from('material_reconciliations')
      .select(selectQuery, { count: 'exact' })
      .order('reconciliation_date', { ascending: false });

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('material_reconciliations')
          .select(selectQuery, { count: 'exact' })
          .order('reconciliation_date', { ascending: false });
        data = retry.data;
        count = retry.count;
        error = retry.error;
      }
    }

    if (error) {
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records = (data || []) as MaterialReconciliationRecord[];
    const totalUnfilteredCount = count ?? records.length;

    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((r) => r.project_id === params.projectId);
    }
    if (params?.materialId && params.materialId !== 'all') {
      records = records.filter((r) => r.material_id === params.materialId);
    }
    if (params?.hasVariance !== undefined && params.hasVariance !== 'all') {
      if (params.hasVariance === true) {
        records = records.filter((r) => Math.abs(Number(r.variance_quantity) || 0) > 0.0001);
      } else if (params.hasVariance === false) {
        records = records.filter((r) => Math.abs(Number(r.variance_quantity) || 0) <= 0.0001);
      }
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((r) => {
        const mat = (r.material?.name || '').toLowerCase();
        const prj = (r.projects?.name || '').toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        return mat.includes(term) || prj.includes(term) || notes.includes(term);
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
      error: err instanceof Error ? err.message : 'Unable to query reconciliations.',
    };
  }
}

/**
 * Fetches a single reconciliation by ID
 */
export async function getReconciliationById(id: string): Promise<{
  data: MaterialReconciliationRecord | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const selectQuery = `
      *,
      material:materials(id, material_code, name, unit_of_measure, category, standard_unit_cost, brand, specification),
      projects:project_id(id, project_code, name),
      reconciler:profiles!reconciled_by(id, first_name, last_name, display_name)
    `;

    const { data, error } = await supabase
      .from('material_reconciliations')
      .select(selectQuery)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }
    if (!data) {
      return { data: null, error: 'Reconciliation record not found.' };
    }

    return { data: data as MaterialReconciliationRecord, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve reconciliation.',
    };
  }
}

/**
 * Creates a material reconciliation record.
 * Formula strictly enforced:
 * Expected Closing = Opening + Delivered + Returned - Consumed - Damaged - Wasted
 * Variance = Closing (Physical Count) - Expected Closing
 */
export async function createMaterialReconciliation(
  input: CreateReconciliationInput
): Promise<{ data: MaterialReconciliationRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const userId = user?.id || session?.user?.id || null;

    if (!input.project_id) {
      return { data: null, error: 'Please select an associated project.' };
    }
    if (!input.material_id) {
      return { data: null, error: 'Please select a material.' };
    }

    const open = Number(input.opening_quantity) || 0;
    const deliv = Number(input.delivered_quantity) || 0;
    const ret = Number(input.returned_quantity) || 0;
    const cons = Number(input.consumed_quantity) || 0;
    const dam = Number(input.damaged_quantity) || 0;
    const wast = Number(input.wasted_quantity) || 0;
    const clos = Number(input.closing_quantity) || 0;

    const expected = open + deliv + ret - cons - dam - wast;
    const variance = clos - expected;

    const payload = {
      project_id: input.project_id,
      material_id: input.material_id,
      reconciliation_date: input.reconciliation_date || new Date().toISOString(),
      opening_quantity: open,
      delivered_quantity: deliv,
      returned_quantity: ret,
      consumed_quantity: cons,
      damaged_quantity: dam,
      wasted_quantity: wast,
      closing_quantity: clos,
      expected_closing_quantity: expected,
      variance_quantity: variance,
      reconciled_by: userId,
      notes: input.notes?.trim() || null,
    };

    const { data: created, error } = await supabase
      .from('material_reconciliations')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return await getReconciliationById(created.id);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to record reconciliation.',
    };
  }
}

export class MaterialReconciliationService {
  static getReconciliationSummary = getReconciliationSummary;
  static getMaterialReconciliations = getMaterialReconciliations;
  static getReconciliationById = getReconciliationById;
  static createMaterialReconciliation = createMaterialReconciliation;
}

export default MaterialReconciliationService;
