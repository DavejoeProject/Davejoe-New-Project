import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';

export type MaterialStatus = 'active' | 'inactive' | 'discontinued';

export const ALL_MATERIAL_STATUSES: MaterialStatus[] = [
  'active',
  'inactive',
  'discontinued',
];

export const MATERIAL_STATUS_CONFIG: Record<
  MaterialStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  active: {
    label: 'Active',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClasses: 'bg-[#01875F]',
  },
  inactive: {
    label: 'Inactive',
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  },
  discontinued: {
    label: 'Discontinued',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClasses: 'bg-rose-500',
  },
};

export interface MaterialCreatorProfile {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
}

export interface MaterialRecord {
  id: string;
  material_code: string;
  name: string;
  category: string;
  description: string | null;
  brand: string | null;
  specification: string | null;
  unit_of_measure: string;
  standard_unit_cost: number | null;
  reorder_level: number | null;
  current_stock: number;
  status: MaterialStatus;
  storage_location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  profiles?: MaterialCreatorProfile | null;
}

export interface MaterialSummary {
  /** Total count of all materials registered in the master materials catalog */
  totalMaterials: number;
  /** Count of active materials at or below their reorder threshold */
  lowStockItems: number;
  lowStockCount: number;
  /** Count of site material requisitions awaiting action (draft or submitted) */
  pendingRequests: number;
  pendingRequestsCount: number;
  /** Count of purchase orders currently in progress (draft, submitted, or ordered) */
  pendingProcurements: number;
  pendingProcurementCount: number;
  /** Count of active materials */
  activeMaterialsCount: number;
  /** True if there are zero registered materials, requests, and purchase orders */
  isEmpty: boolean;
}

export interface DirectoryExecutiveSummary {
  totalMaterials: number;
  lowStockCount: number;
  activeCount: number;
  inactiveCount: number;
}

export interface MaterialCreateInput {
  material_code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  brand?: string | null;
  specification?: string | null;
  unit_of_measure: string;
  standard_unit_cost?: number | null;
  reorder_level?: number | null;
  current_stock?: number;
  status?: MaterialStatus;
  storage_location?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface MaterialUpdateInput {
  name?: string;
  category?: string | null;
  description?: string | null;
  brand?: string | null;
  specification?: string | null;
  unit_of_measure?: string;
  standard_unit_cost?: number | null;
  reorder_level?: number | null;
  status?: MaterialStatus;
  storage_location?: string | null;
  notes?: string | null;
}

export interface MaterialRelatedActivity {
  id: string;
  type: string;
  reference_number?: string;
  status: string;
  date: string;
  description?: string;
}

/**
 * Currency formatting helper for Nigerian Naira
 */
export function formatNaira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '₦0.00';
  }
  return (
    '₦' +
    Number(amount).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Professional Nigerian date presentation
 */
export function formatNigerianDate(dateString: string | null | undefined): string {
  if (!dateString) return 'Not recorded';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculates stock status from real data:
 * If current_stock <= reorder_level -> LOW STOCK
 * Otherwise -> ADEQUATE
 */
export function getStockStatus(
  currentStock: number,
  reorderLevel: number | null | undefined
): 'LOW STOCK' | 'ADEQUATE' {
  const reorder = Number(reorderLevel ?? 0);
  if (reorder > 0 && currentStock <= reorder) {
    return 'LOW STOCK';
  }
  return 'ADEQUATE';
}

/**
 * Retrieves high-level operational metrics strictly from real Supabase tables
 */
export async function getMaterialSummary(): Promise<{
  data: MaterialSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: 'Database connection is not configured.',
    };
  }

  try {
    await ensureValidSession();

    const materialsQuery = supabase
      .from('materials')
      .select('id, current_stock, reorder_level, status');

    const requestsQuery = supabase
      .from('material_requests')
      .select('id, status');

    const poQuery = supabase
      .from('purchase_orders')
      .select('id, status');

    let [materialsRes, requestsRes, poRes] = await Promise.all([
      materialsQuery,
      requestsQuery,
      poQuery,
    ]);

    const hasJwtExpired = [materialsRes.error, requestsRes.error, poRes.error].some(isJwtExpiredError);
    if (hasJwtExpired) {
      console.warn('[materialsService] Detected expired JWT in summary query. Attempting refresh...');
      const { session: refreshedSession } = await ensureValidSession();
      if (refreshedSession) {
        [materialsRes, requestsRes, poRes] = await Promise.all([
          supabase.from('materials').select('id, current_stock, reorder_level, status'),
          supabase.from('material_requests').select('id, status'),
          supabase.from('purchase_orders').select('id, status'),
        ]);
      } else {
        return {
          data: null,
          error: 'Your session has expired. Please sign in again.',
        };
      }
    }

    if (materialsRes.error) {
      console.error('[materialsService] Error querying materials table:', materialsRes.error);
      return {
        data: null,
        error: materialsRes.error.message || 'Unable to load master materials catalog.',
      };
    }

    if (requestsRes.error) {
      console.error('[materialsService] Error querying material_requests table:', requestsRes.error);
      return {
        data: null,
        error: requestsRes.error.message || 'Unable to load material requests.',
      };
    }

    if (poRes.error) {
      console.error('[materialsService] Error querying purchase_orders table:', poRes.error);
      return {
        data: null,
        error: poRes.error.message || 'Unable to load procurement summary.',
      };
    }

    const materialsList = materialsRes.data || [];
    const requestsList = requestsRes.data || [];
    const poList = poRes.data || [];

    const lowStockCount = materialsList.filter((m) => {
      if (m.status !== 'active') return false;
      const stock = Number(m.current_stock ?? 0);
      const reorder = Number(m.reorder_level ?? 0);
      return reorder > 0 && stock <= reorder;
    }).length;

    const activeMaterialsCount = materialsList.filter((m) => m.status === 'active').length;

    const pendingRequestsCount = requestsList.filter((r) =>
      ['submitted', 'draft'].includes(r.status)
    ).length;

    const pendingProcurementCount = poList.filter((p) =>
      ['submitted', 'draft', 'ordered'].includes(p.status)
    ).length;

    const isEmpty =
      materialsList.length === 0 &&
      requestsList.length === 0 &&
      poList.length === 0;

    const summary: MaterialSummary = {
      totalMaterials: materialsList.length,
      lowStockItems: lowStockCount,
      lowStockCount,
      pendingRequests: pendingRequestsCount,
      pendingRequestsCount,
      pendingProcurements: pendingProcurementCount,
      pendingProcurementCount,
      activeMaterialsCount,
      isEmpty,
    };

    return {
      data: summary,
      error: null,
    };
  } catch (err) {
    console.error('[materialsService] Unexpected error getting materials summary:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to connect to database.',
    };
  }
}

/**
 * Phase 8.1 Executive Summary for the Materials Directory
 * KPI definitions:
 * - TOTAL MATERIALS: Count all records in public.materials
 * - LOW STOCK: Count active materials where current_stock <= reorder_level
 * - ACTIVE MATERIALS: Count records where status === 'active'
 * - INACTIVE MATERIALS: Count records where status represents inactive ('inactive' or 'discontinued')
 */
export async function getDirectoryExecutiveSummary(): Promise<{
  data: DirectoryExecutiveSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: 'Database connection is not configured.',
    };
  }

  try {
    await ensureValidSession();

    let { data, error } = await supabase
      .from('materials')
      .select('id, status, current_stock, reorder_level');

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('materials')
          .select('id, status, current_stock, reorder_level');
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[materialsService] Error fetching executive summary:', error);
      return {
        data: null,
        error: error.message || 'Unable to load executive summary.',
      };
    }

    const items = data || [];
    const totalMaterials = items.length;
    const activeCount = items.filter((m) => m.status === 'active').length;
    const inactiveCount = items.filter((m) => m.status !== 'active').length;
    const lowStockCount = items.filter((m) => {
      if (m.status !== 'active') return false;
      const stock = Number(m.current_stock ?? 0);
      const reorder = Number(m.reorder_level ?? 0);
      return reorder > 0 && stock <= reorder;
    }).length;

    return {
      data: {
        totalMaterials,
        lowStockCount,
        activeCount,
        inactiveCount,
      },
      error: null,
    };
  } catch (err) {
    console.error('[materialsService] Unexpected error calculating executive summary:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to load materials summary.',
    };
  }
}

/**
 * Retrieves materials records from public.materials with robust filtering and sorting
 */
export async function getMaterials(params?: {
  search?: string;
  category?: string;
  status?: string;
  stockCondition?: 'all' | 'low' | 'adequate';
}): Promise<{
  data: MaterialRecord[];
  count: number;
  totalUnfilteredCount: number;
  uniqueCategories: string[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      data: [],
      count: 0,
      totalUnfilteredCount: 0,
      uniqueCategories: [],
      error: 'Database connection is not configured.',
    };
  }

  try {
    await ensureValidSession();

    // Query all records for category derivation and unfiltered count
    const baseQuery = supabase
      .from('materials')
      .select('*, profiles:created_by(id, first_name, last_name, display_name)', { count: 'exact' })
      .order('name', { ascending: true });

    let { data, count, error } = await baseQuery;

    if (error && isJwtExpiredError(error)) {
      console.warn('[materialsService] Detected expired JWT in getMaterials. Refreshing session...');
      const { session } = await ensureValidSession();
      if (session) {
        const retryRes = await supabase
          .from('materials')
          .select('*, profiles:created_by(id, first_name, last_name, display_name)', { count: 'exact' })
          .order('name', { ascending: true });
        data = retryRes.data;
        count = retryRes.count;
        error = retryRes.error;
      }
    }

    if (error) {
      console.error('[materialsService] Error fetching materials:', error);
      return {
        data: [],
        count: 0,
        totalUnfilteredCount: 0,
        uniqueCategories: [],
        error: error.message || 'Unable to load materials.',
      };
    }

    const allRecords = (data || []) as MaterialRecord[];
    const totalUnfilteredCount = count ?? allRecords.length;

    // Derive unique categories from real database records
    const categoriesSet = new Set<string>();
    allRecords.forEach((r) => {
      if (r.category && r.category.trim()) {
        categoriesSet.add(r.category.trim());
      }
    });
    const uniqueCategories = Array.from(categoriesSet).sort();

    // Apply in-memory or query filters
    let filtered = allRecords;

    if (params?.status && params.status !== 'all') {
      filtered = filtered.filter((m) => m.status === params.status);
    }

    if (params?.category && params.category !== 'all') {
      filtered = filtered.filter(
        (m) => (m.category || '').toLowerCase() === params.category!.toLowerCase()
      );
    }

    if (params?.stockCondition && params.stockCondition !== 'all') {
      if (params.stockCondition === 'low') {
        filtered = filtered.filter((m) => {
          const reorder = Number(m.reorder_level ?? 0);
          return reorder > 0 && Number(m.current_stock ?? 0) <= reorder;
        });
      } else if (params.stockCondition === 'adequate') {
        filtered = filtered.filter((m) => {
          const reorder = Number(m.reorder_level ?? 0);
          return reorder === 0 || Number(m.current_stock ?? 0) > reorder;
        });
      }
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      filtered = filtered.filter((m) => {
        const name = (m.name || '').toLowerCase();
        const code = (m.material_code || '').toLowerCase();
        const category = (m.category || '').toLowerCase();
        const brand = (m.brand || '').toLowerCase();
        const spec = (m.specification || '').toLowerCase();
        return (
          name.includes(term) ||
          code.includes(term) ||
          category.includes(term) ||
          brand.includes(term) ||
          spec.includes(term)
        );
      });
    }

    return {
      data: filtered,
      count: filtered.length,
      totalUnfilteredCount,
      uniqueCategories,
      error: null,
    };
  } catch (err) {
    console.error('[materialsService] Unexpected error querying materials:', err);
    return {
      data: [],
      count: 0,
      totalUnfilteredCount: 0,
      uniqueCategories: [],
      error: err instanceof Error ? err.message : 'Unable to load materials from database.',
    };
  }
}

/**
 * Fetches a single material record by ID with creator profile
 */
export async function getMaterialById(id: string): Promise<{
  data: MaterialRecord | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    let { data, error } = await supabase
      .from('materials')
      .select('*, profiles:created_by(id, first_name, last_name, display_name)')
      .eq('id', id)
      .maybeSingle();

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('materials')
          .select('*, profiles:created_by(id, first_name, last_name, display_name)')
          .eq('id', id)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as MaterialRecord, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve material details.',
    };
  }
}

/**
 * Validates whether a material code is unique
 */
export async function checkMaterialCodeUnique(
  code: string,
  excludeId?: string
): Promise<{ isUnique: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { isUnique: true, error: null };
  }

  try {
    await ensureValidSession();

    const trimmed = code.trim().toUpperCase();
    let query = supabase
      .from('materials')
      .select('id')
      .ilike('material_code', trimmed);

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
 * Creates a new material in public.materials
 */
export async function createMaterial(
  input: MaterialCreateInput
): Promise<{ data: MaterialRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();

    // 1. Validate required fields
    const code = input.material_code.trim().toUpperCase();
    const name = input.name.trim();

    if (!code) {
      return { data: null, error: 'Material code is required.' };
    }
    if (!name) {
      return { data: null, error: 'Material name is required.' };
    }
    if (!input.unit_of_measure?.trim()) {
      return { data: null, error: 'Unit of measure is required.' };
    }

    // 2. Validate uniqueness of material code
    const uniqueCheck = await checkMaterialCodeUnique(code);
    if (uniqueCheck.error) {
      return { data: null, error: uniqueCheck.error };
    }
    if (!uniqueCheck.isUnique) {
      return { data: null, error: 'Material code already exists.' };
    }

    // 3. Assemble payload adhering strictly to verified schema
    const payload = {
      material_code: code,
      name,
      category: input.category?.trim() || 'General',
      description: input.description?.trim() || null,
      brand: input.brand?.trim() || null,
      specification: input.specification?.trim() || null,
      unit_of_measure: input.unit_of_measure.trim(),
      standard_unit_cost:
        input.standard_unit_cost !== null && input.standard_unit_cost !== undefined
          ? Math.max(0, Number(input.standard_unit_cost))
          : 0,
      reorder_level:
        input.reorder_level !== null && input.reorder_level !== undefined
          ? Math.max(0, Number(input.reorder_level))
          : 0,
      current_stock:
        input.current_stock !== null && input.current_stock !== undefined
          ? Math.max(0, Number(input.current_stock))
          : 0,
      status: input.status || 'active',
      storage_location: input.storage_location?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: input.created_by || user?.id || session?.user?.id || null,
    };

    const { data, error } = await supabase
      .from('materials')
      .insert(payload)
      .select('*, profiles:created_by(id, first_name, last_name, display_name)')
      .single();

    if (error) {
      console.error('[materialsService] Error inserting material:', error);
      return { data: null, error: error.message || 'Failed to create material.' };
    }

    return { data: data as MaterialRecord, error: null };
  } catch (err) {
    console.error('[materialsService] Unexpected error inserting material:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to create material.',
    };
  }
}

/**
 * Updates an existing material in public.materials
 * Note: Does not mutate current_stock, material_code, or audit columns
 */
export async function updateMaterial(
  id: string,
  input: MaterialUpdateInput
): Promise<{ data: MaterialRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    if (!input.name?.trim()) {
      return { data: null, error: 'Material name cannot be empty.' };
    }
    if (!input.unit_of_measure?.trim()) {
      return { data: null, error: 'Unit of measure cannot be empty.' };
    }

    const payload: Record<string, any> = {
      name: input.name.trim(),
      unit_of_measure: input.unit_of_measure.trim(),
      updated_at: new Date().toISOString(),
    };

    if (input.category !== undefined) {
      payload.category = input.category?.trim() || 'General';
    }
    if (input.description !== undefined) {
      payload.description = input.description?.trim() || null;
    }
    if (input.brand !== undefined) {
      payload.brand = input.brand?.trim() || null;
    }
    if (input.specification !== undefined) {
      payload.specification = input.specification?.trim() || null;
    }
    if (input.standard_unit_cost !== undefined) {
      payload.standard_unit_cost =
        input.standard_unit_cost !== null
          ? Math.max(0, Number(input.standard_unit_cost))
          : 0;
    }
    if (input.reorder_level !== undefined) {
      payload.reorder_level =
        input.reorder_level !== null ? Math.max(0, Number(input.reorder_level)) : 0;
    }
    if (input.status !== undefined) {
      payload.status = input.status;
    }
    if (input.storage_location !== undefined) {
      payload.storage_location = input.storage_location?.trim() || null;
    }
    if (input.notes !== undefined) {
      payload.notes = input.notes?.trim() || null;
    }

    const { data, error } = await supabase
      .from('materials')
      .update(payload)
      .eq('id', id)
      .select('*, profiles:created_by(id, first_name, last_name, display_name)')
      .single();

    if (error) {
      console.error('[materialsService] Error updating material:', error);
      return { data: null, error: error.message || 'Failed to update material.' };
    }

    return { data: data as MaterialRecord, error: null };
  } catch (err) {
    console.error('[materialsService] Unexpected error updating material:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to update material.',
    };
  }
}

/**
 * Safely queries related operational records for a given material
 * Returns empty array if no records exist in the database yet
 */
export async function getRelatedActivity(
  materialId: string
): Promise<{ data: MaterialRelatedActivity[]; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    await ensureValidSession();

    // Safely check for any material_requests matching this material
    const { data, error } = await supabase
      .from('material_requests')
      .select('id, request_number, status, created_at, notes')
      .eq('material_id', materialId)
      .limit(10);

    if (error) {
      // If table doesn't have material_id column or RLS prevents, return empty list gracefully
      return { data: [], error: null };
    }

    const activities: MaterialRelatedActivity[] = (data || []).map((r: any) => ({
      id: r.id,
      type: 'Material Requisition',
      reference_number: r.request_number || r.id.slice(0, 8),
      status: r.status || 'pending',
      date: r.created_at,
      description: r.notes || 'Site supervisor material request',
    }));

    return { data: activities, error: null };
  } catch {
    return { data: [], error: null };
  }
}

import {
  getMaterialRequests,
  createMaterialRequest,
  approveMaterialRequest,
  getMaterialRequestById,
  getMaterialRequestSummary,
  rejectMaterialRequest,
} from './materialRequestsService';

export {
  getMaterialRequests,
  createMaterialRequest,
  approveMaterialRequest,
  getMaterialRequestById,
  getMaterialRequestSummary,
  rejectMaterialRequest,
};

export class MaterialsService {
  static getMaterialSummary = getMaterialSummary;
  static getDirectoryExecutiveSummary = getDirectoryExecutiveSummary;
  static getMaterials = getMaterials;
  static getMaterialById = getMaterialById;
  static checkMaterialCodeUnique = checkMaterialCodeUnique;
  static createMaterial = createMaterial;
  static updateMaterial = updateMaterial;
  static getRelatedActivity = getRelatedActivity;
  static getMaterialRequests = getMaterialRequests;
  static createMaterialRequest = createMaterialRequest;
  static approveMaterialRequest = approveMaterialRequest;
  static getMaterialRequestById = getMaterialRequestById;
  static getMaterialRequestSummary = getMaterialRequestSummary;
  static rejectMaterialRequest = rejectMaterialRequest;
}

export const materialsService = {
  getMaterialSummary,
  getDirectoryExecutiveSummary,
  getMaterials,
  getMaterialById,
  checkMaterialCodeUnique,
  createMaterial,
  updateMaterial,
  getRelatedActivity,
  getMaterialRequests,
  createMaterialRequest,
  approveMaterialRequest,
  getMaterialRequestById,
  getMaterialRequestSummary,
  rejectMaterialRequest,
};

export * from './materialRequestsService';
export * from './procurementService';

export default materialsService;
