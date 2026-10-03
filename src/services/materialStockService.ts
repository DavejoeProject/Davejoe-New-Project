import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { MaterialRecord, formatNaira, formatNigerianDate } from './materialsService';

export type StockMovementType =
  | 'purchase'
  | 'receipt'
  | 'transfer'
  | 'return'
  | 'adjustment'
  | 'damage';

export const ALL_STOCK_MOVEMENT_TYPES: StockMovementType[] = [
  'purchase',
  'receipt',
  'transfer',
  'return',
  'adjustment',
  'damage',
];

export const MOVEMENT_TYPE_CONFIG: Record<
  StockMovementType,
  { label: string; badgeClasses: string; isPositive: boolean }
> = {
  purchase: {
    label: 'Purchase Order',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    isPositive: true,
  },
  receipt: {
    label: 'Receipt & Intake',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    isPositive: true,
  },
  transfer: {
    label: 'Project Transfer',
    badgeClasses: 'bg-purple-50 text-purple-700 border-purple-200',
    isPositive: false,
  },
  return: {
    label: 'Stock Return',
    badgeClasses: 'bg-teal-50 text-teal-700 border-teal-200',
    isPositive: true,
  },
  adjustment: {
    label: 'Stock Adjustment',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    isPositive: true,
  },
  damage: {
    label: 'Damage & Loss',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
    isPositive: false,
  },
};

export interface MaterialStockMovementRecord {
  id: string;
  material_id: string;
  project_id: string | null;
  movement_type: StockMovementType;
  quantity: number;
  unit_cost: number | null;
  reference_id: string | null;
  reference_code: string | null;
  movement_date: string;
  recorded_by: string | null;
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
}

export interface MaterialUsageRecord {
  id: string;
  project_id: string;
  material_id: string;
  workforce_member_id: string | null;
  recorded_by: string | null;
  usage_date: string;
  quantity_used: number;
  unit_cost: number | null;
  purpose: string | null;
  work_area: string | null;
  notes: string | null;
  created_at: string;
  material?: MaterialRecord | null;
  projects?: {
    id: string;
    project_code: string;
    name: string;
  } | null;
  workforce?: {
    id: string;
    trade: string;
    profiles?: {
      id: string;
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
  recorder?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
}

export interface StockPositionItem extends MaterialRecord {
  stockStatus: 'out_of_stock' | 'low_stock' | 'healthy';
}

export interface StockSummary {
  totalMaterials: number;
  totalStockPositions: number;
  lowStockItems: number;
  outOfStockItems: number;
  recentMovementsCount: number;
}

export interface CreateStockAdjustmentInput {
  material_id: string;
  project_id?: string | null;
  movement_type: StockMovementType;
  quantity: number;
  unit_cost?: number | null;
  notes: string;
}

export interface CreateMaterialUsageInput {
  project_id: string;
  material_id: string;
  workforce_member_id?: string | null;
  usage_date?: string;
  quantity_used: number;
  unit_cost?: number | null;
  purpose?: string | null;
  work_area?: string | null;
  notes?: string | null;
}

/**
 * Calculates live stock summary metrics directly from public.materials and public.material_stock_movements
 */
export async function getStockSummary(): Promise<{
  data: StockSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const [matRes, moveRes] = await Promise.all([
      supabase.from('materials').select('id, current_stock, reorder_level'),
      supabase.from('material_stock_movements').select('id', { count: 'exact' }),
    ]);

    if (matRes.error) {
      return { data: null, error: matRes.error.message };
    }

    const items = matRes.data || [];
    const totalMaterials = items.length;
    const totalStockPositions = items.reduce(
      (sum, m) => sum + (Number(m.current_stock) || 0),
      0
    );

    let lowStockItems = 0;
    let outOfStockItems = 0;

    items.forEach((m) => {
      const stock = Number(m.current_stock) || 0;
      const reorder = Number(m.reorder_level) || 0;
      if (stock <= 0) {
        outOfStockItems++;
      } else if (stock <= reorder) {
        lowStockItems++;
      }
    });

    return {
      data: {
        totalMaterials,
        totalStockPositions,
        lowStockItems,
        outOfStockItems,
        recentMovementsCount: moveRes.count || 0,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve stock summary.',
    };
  }
}

/**
 * Retrieves material catalog positions with status calculation (Out of Stock, Low Stock, Healthy)
 */
export async function getStockPositions(params?: {
  search?: string;
  status?: string;
  category?: string;
}): Promise<{
  data: StockPositionItem[];
  count: number;
  totalUnfilteredCount: number;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], count: 0, totalUnfilteredCount: 0, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    let query = supabase.from('materials').select('*').order('name', { ascending: true });

    const { data, error } = await query;
    if (error) {
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records: StockPositionItem[] = (data || []).map((m: any) => {
      const stock = Number(m.current_stock) || 0;
      const reorder = Number(m.reorder_level) || 0;
      let stockStatus: 'out_of_stock' | 'low_stock' | 'healthy' = 'healthy';
      if (stock <= 0) {
        stockStatus = 'out_of_stock';
      } else if (stock <= reorder) {
        stockStatus = 'low_stock';
      }
      return {
        ...m,
        stockStatus,
      };
    });

    const totalUnfilteredCount = records.length;

    if (params?.category && params.category !== 'all') {
      records = records.filter((r) => r.category === params.category);
    }

    if (params?.status && params.status !== 'all') {
      records = records.filter((r) => r.stockStatus === params.status);
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.material_code.toLowerCase().includes(term) ||
          (r.category || '').toLowerCase().includes(term) ||
          (r.storage_location || '').toLowerCase().includes(term)
      );
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
      error: err instanceof Error ? err.message : 'Unable to query stock positions.',
    };
  }
}

/**
 * Retrieves stock movements history
 */
export async function getStockMovements(params?: {
  materialId?: string;
  projectId?: string;
  movementType?: string;
  search?: string;
}): Promise<{
  data: MaterialStockMovementRecord[];
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
      recorder:profiles!recorded_by(id, first_name, last_name, display_name)
    `;

    let { data, count, error } = await supabase
      .from('material_stock_movements')
      .select(selectQuery, { count: 'exact' })
      .order('movement_date', { ascending: false });

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('material_stock_movements')
          .select(selectQuery, { count: 'exact' })
          .order('movement_date', { ascending: false });
        data = retry.data;
        count = retry.count;
        error = retry.error;
      }
    }

    if (error) {
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records = (data || []) as MaterialStockMovementRecord[];
    const totalUnfilteredCount = count ?? records.length;

    if (params?.materialId && params.materialId !== 'all') {
      records = records.filter((m) => m.material_id === params.materialId);
    }
    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((m) => m.project_id === params.projectId);
    }
    if (params?.movementType && params.movementType !== 'all') {
      records = records.filter((m) => m.movement_type === params.movementType);
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((m) => {
        const matName = (m.material?.name || '').toLowerCase();
        const matCode = (m.material?.material_code || '').toLowerCase();
        const prjName = (m.projects?.name || '').toLowerCase();
        const refCode = (m.reference_code || '').toLowerCase();
        const notes = (m.notes || '').toLowerCase();
        return (
          matName.includes(term) ||
          matCode.includes(term) ||
          prjName.includes(term) ||
          refCode.includes(term) ||
          notes.includes(term)
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
      error: err instanceof Error ? err.message : 'Unable to query movements.',
    };
  }
}

/**
 * Retrieves material usage records
 */
export async function getMaterialUsageRecords(params?: {
  projectId?: string;
  materialId?: string;
  search?: string;
}): Promise<{
  data: MaterialUsageRecord[];
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
      workforce:workforce_members(
        id,
        trade,
        profiles:profiles!workforce_members_profile_id_fkey(id, display_name, first_name, last_name)
      ),
      recorder:profiles!recorded_by(id, first_name, last_name, display_name)
    `;

    let { data, count, error } = await supabase
      .from('material_usage_records')
      .select(selectQuery, { count: 'exact' })
      .order('usage_date', { ascending: false });

    if (error) {
      return { data: [], count: 0, totalUnfilteredCount: 0, error: error.message };
    }

    let records = (data || []) as MaterialUsageRecord[];
    const totalUnfilteredCount = count ?? records.length;

    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((u) => u.project_id === params.projectId);
    }
    if (params?.materialId && params.materialId !== 'all') {
      records = records.filter((u) => u.material_id === params.materialId);
    }
    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((u) => {
        const mat = (u.material?.name || '').toLowerCase();
        const prj = (u.projects?.name || '').toLowerCase();
        const purp = (u.purpose || '').toLowerCase();
        const area = (u.work_area || '').toLowerCase();
        return mat.includes(term) || prj.includes(term) || purp.includes(term) || area.includes(term);
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
      error: err instanceof Error ? err.message : 'Unable to query usage.',
    };
  }
}

/**
 * Records an auditable stock adjustment in public.material_stock_movements
 * and updates materials.current_stock
 */
export async function recordStockAdjustment(
  input: CreateStockAdjustmentInput
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const userId = user?.id || session?.user?.id || null;

    if (!input.material_id) {
      return { success: false, error: 'Please select a material.' };
    }
    if (!input.quantity || input.quantity <= 0) {
      return { success: false, error: 'Quantity must be greater than zero.' };
    }
    if (!input.notes?.trim()) {
      return { success: false, error: 'A justification/reason is required for inventory adjustments.' };
    }

    const now = new Date().toISOString();

    // 1. Insert stock movement record
    const { error: moveErr } = await supabase.from('material_stock_movements').insert({
      material_id: input.material_id,
      project_id: input.project_id || null,
      movement_type: input.movement_type,
      quantity: Number(input.quantity),
      unit_cost: input.unit_cost || null,
      movement_date: now,
      recorded_by: userId,
      notes: input.notes.trim(),
    });

    if (moveErr) {
      return { success: false, error: moveErr.message };
    }

    // 2. Adjust current_stock on materials table
    const { data: mat } = await supabase
      .from('materials')
      .select('current_stock')
      .eq('id', input.material_id)
      .single();

    if (mat) {
      const isReduction = ['damage', 'transfer'].includes(input.movement_type);
      const current = Number(mat.current_stock || 0);
      const updated = isReduction
        ? Math.max(0, current - Number(input.quantity))
        : current + Number(input.quantity);

      await supabase
        .from('materials')
        .update({
          current_stock: updated,
          updated_at: now,
        })
        .eq('id', input.material_id);
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Adjustment failed.',
    };
  }
}

/**
 * Records real material usage and generates synchronized stock movement
 */
export async function recordMaterialUsage(
  input: CreateMaterialUsageInput
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
    if (!input.quantity_used || input.quantity_used <= 0) {
      return { success: false, error: 'Quantity used must be greater than zero.' };
    }

    const now = new Date().toISOString();

    // 1. Insert into material_usage_records
    const usagePayload = {
      project_id: input.project_id,
      material_id: input.material_id,
      workforce_member_id: input.workforce_member_id || null,
      recorded_by: userId,
      usage_date: input.usage_date || now,
      quantity_used: Number(input.quantity_used),
      unit_cost: input.unit_cost || null,
      purpose: input.purpose?.trim() || null,
      work_area: input.work_area?.trim() || null,
      notes: input.notes?.trim() || null,
    };

    const { error: usageErr } = await supabase
      .from('material_usage_records')
      .insert(usagePayload);

    if (usageErr) {
      return { success: false, error: usageErr.message };
    }

    // 2. Record stock movement (type: 'transfer' to project)
    await supabase.from('material_stock_movements').insert({
      material_id: input.material_id,
      project_id: input.project_id,
      movement_type: 'transfer',
      quantity: Number(input.quantity_used),
      unit_cost: input.unit_cost || null,
      movement_date: input.usage_date || now,
      recorded_by: userId,
      notes: `Site consumption: ${input.purpose || 'Work execution'} (${input.work_area || 'Site'})`,
    });

    // 3. Update current_stock on materials table
    const { data: mat } = await supabase
      .from('materials')
      .select('current_stock')
      .eq('id', input.material_id)
      .single();

    if (mat) {
      const current = Number(mat.current_stock || 0);
      const updated = Math.max(0, current - Number(input.quantity_used));
      await supabase
        .from('materials')
        .update({
          current_stock: updated,
          updated_at: now,
        })
        .eq('id', input.material_id);
    }

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to record usage.',
    };
  }
}

/**
 * Fetches workforce members for dropdown
 */
export async function getWorkforceMembersForDropdown(): Promise<{
  data: Array<{ id: string; name: string; trade: string }>;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('workforce_members')
      .select(`
        id,
        trade,
        profiles:profiles!workforce_members_profile_id_fkey(id, display_name, first_name, last_name)
      `);

    if (error) {
      return { data: [], error: error.message };
    }

    const items = (data || []).map((w: any) => {
      const p = w.profiles;
      const name = p
        ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.display_name || 'Worker'
        : 'Worker';
      return {
        id: w.id,
        name,
        trade: w.trade || 'General',
      };
    });

    return { data: items, error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Failed to load workforce.' };
  }
}

export class MaterialStockService {
  static getStockSummary = getStockSummary;
  static getStockPositions = getStockPositions;
  static getStockMovements = getStockMovements;
  static getMaterialUsageRecords = getMaterialUsageRecords;
  static recordStockAdjustment = recordStockAdjustment;
  static recordMaterialUsage = recordMaterialUsage;
  static getWorkforceMembersForDropdown = getWorkforceMembersForDropdown;
}

export default MaterialStockService;
