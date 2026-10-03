import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { MaterialRecord, formatNaira, formatNigerianDate } from './materialsService';

export type MaterialRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'cancelled';

export type MaterialRequestPriority = 'low' | 'normal' | 'high' | 'critical';

export const ALL_REQUEST_STATUSES: MaterialRequestStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'partially_fulfilled',
  'fulfilled',
  'cancelled',
];

export const ALL_REQUEST_PRIORITIES: MaterialRequestPriority[] = [
  'low',
  'normal',
  'high',
  'critical',
];

export const REQUEST_STATUS_CONFIG: Record<
  MaterialRequestStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  draft: {
    label: 'Draft',
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  },
  submitted: {
    label: 'Submitted',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClasses: 'bg-blue-500',
  },
  under_review: {
    label: 'Under Review',
    badgeClasses: 'bg-purple-50 text-purple-700 border-purple-200',
    dotClasses: 'bg-purple-500',
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
  partially_fulfilled: {
    label: 'Partially Fulfilled',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClasses: 'bg-amber-500',
  },
  fulfilled: {
    label: 'Fulfilled',
    badgeClasses: 'bg-teal-50 text-teal-700 border-teal-200',
    dotClasses: 'bg-teal-600',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClasses: 'bg-slate-100 text-slate-500 border-slate-200',
    dotClasses: 'bg-slate-400',
  },
};

export const REQUEST_PRIORITY_CONFIG: Record<
  MaterialRequestPriority,
  { label: string; badgeClasses: string }
> = {
  low: {
    label: 'Low',
    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  normal: {
    label: 'Normal',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  high: {
    label: 'High',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  critical: {
    label: 'Critical',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export interface MaterialRequestItemRecord {
  id: string;
  material_request_id: string;
  material_id: string;
  requested_quantity: number;
  approved_quantity: number | null;
  fulfilled_quantity: number | null;
  unit_cost: number | null;
  estimated_total: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  material?: MaterialRecord | null;
}

export interface MaterialRequestRecord {
  id: string;
  request_code: string;
  project_id: string;
  requested_by: string;
  status: MaterialRequestStatus;
  priority: MaterialRequestPriority;
  requested_date: string;
  required_by_date: string | null;
  justification: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  fulfilled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  projects?: {
    id: string;
    project_code: string;
    name: string;
    status?: string;
  } | null;
  requester?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  reviewer?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    display_name?: string | null;
  } | null;
  items?: MaterialRequestItemRecord[];
  totalEstimatedValue?: number;
  itemCount?: number;
}

export interface MaterialRequestSummary {
  totalRequests: number;
  pendingReview: number;
  approved: number;
  fulfilled: number;
}

export interface CreateMaterialRequestItemInput {
  material_id: string;
  requested_quantity: number;
  unit_cost: number;
  estimated_total: number;
  notes?: string | null;
}

export interface CreateMaterialRequestInput {
  project_id: string;
  request_code?: string;
  priority: MaterialRequestPriority;
  required_by_date: string;
  justification: string;
  notes?: string | null;
  status?: MaterialRequestStatus;
  items: CreateMaterialRequestItemInput[];
}

export interface UpdateMaterialRequestInput {
  project_id?: string;
  priority?: MaterialRequestPriority;
  required_by_date?: string;
  justification?: string;
  notes?: string | null;
  status?: MaterialRequestStatus;
}

export interface ProjectDropdownOption {
  id: string;
  project_code: string;
  name: string;
  status: string;
}

/**
 * Retrieves summary metrics strictly from real Supabase table `public.material_requests`:
 * - TOTAL REQUESTS: count of all records
 * - PENDING REVIEW: status IN ('submitted', 'under_review', 'draft')
 * - APPROVED: status IN ('approved', 'partially_fulfilled')
 * - FULFILLED: status === 'fulfilled'
 */
export async function getMaterialRequestSummary(): Promise<{
  data: MaterialRequestSummary | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    let { data, error } = await supabase
      .from('material_requests')
      .select('id, status');

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase.from('material_requests').select('id, status');
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[materialRequestsService] Summary error:', error);
      return { data: null, error: error.message || 'Unable to load summary.' };
    }

    const records = data || [];
    const totalRequests = records.length;
    const pendingReview = records.filter((r) =>
      ['submitted', 'under_review', 'draft'].includes(r.status)
    ).length;
    const approved = records.filter((r) =>
      ['approved', 'partially_fulfilled'].includes(r.status)
    ).length;
    const fulfilled = records.filter((r) => r.status === 'fulfilled').length;

    return {
      data: {
        totalRequests,
        pendingReview,
        approved,
        fulfilled,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve summary.',
    };
  }
}

/**
 * Retrieves material requests with relations, multi-field search and filters
 */
export async function getMaterialRequests(params?: {
  search?: string;
  status?: string;
  priority?: string;
  projectId?: string;
}): Promise<{
  data: MaterialRequestRecord[];
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

    // Select requests with joined projects, requester, reviewer, and request items with material details
    const selectQuery = `
      *,
      projects:project_id(id, project_code, name, status),
      requester:requested_by(id, first_name, last_name, display_name),
      reviewer:reviewed_by(id, first_name, last_name, display_name),
      items:material_request_items(
        id,
        material_request_id,
        material_id,
        requested_quantity,
        approved_quantity,
        fulfilled_quantity,
        unit_cost,
        estimated_total,
        notes,
        created_at,
        updated_at,
        material:materials(id, material_code, name, category, unit_of_measure, standard_unit_cost, current_stock)
      )
    `;

    let { data, count, error } = await supabase
      .from('material_requests')
      .select(selectQuery, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('material_requests')
          .select(selectQuery, { count: 'exact' })
          .order('created_at', { ascending: false });
        data = retry.data;
        count = retry.count;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[materialRequestsService] Fetch error:', error);
      return {
        data: [],
        count: 0,
        totalUnfilteredCount: 0,
        error: error.message || 'Unable to load material requests.',
      };
    }

    let records = (data || []).map((req: any) => {
      const items = (req.items || []) as MaterialRequestItemRecord[];
      const totalEstimatedValue = items.reduce(
        (sum, item) => sum + (Number(item.estimated_total) || 0),
        0
      );
      return {
        ...req,
        items,
        totalEstimatedValue,
        itemCount: items.length,
      } as MaterialRequestRecord;
    });

    const totalUnfilteredCount = count ?? records.length;

    // Apply filters
    if (params?.status && params.status !== 'all') {
      records = records.filter((r) => r.status === params.status);
    }

    if (params?.priority && params.priority !== 'all') {
      records = records.filter((r) => r.priority === params.priority);
    }

    if (params?.projectId && params.projectId !== 'all') {
      records = records.filter((r) => r.project_id === params.projectId);
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();
      records = records.filter((r) => {
        const code = (r.request_code || '').toLowerCase();
        const prjCode = (r.projects?.project_code || '').toLowerCase();
        const prjName = (r.projects?.name || '').toLowerCase();
        const reqFirst = (r.requester?.first_name || '').toLowerCase();
        const reqLast = (r.requester?.last_name || '').toLowerCase();
        const reqDisplay = (r.requester?.display_name || '').toLowerCase();
        const just = (r.justification || '').toLowerCase();

        return (
          code.includes(term) ||
          prjCode.includes(term) ||
          prjName.includes(term) ||
          reqFirst.includes(term) ||
          reqLast.includes(term) ||
          reqDisplay.includes(term) ||
          just.includes(term)
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
    console.error('[materialRequestsService] Query exception:', err);
    return {
      data: [],
      count: 0,
      totalUnfilteredCount: 0,
      error: err instanceof Error ? err.message : 'Unable to query database.',
    };
  }
}

/**
 * Fetches a single material request by ID with all item lines and relational references
 */
export async function getMaterialRequestById(id: string): Promise<{
  data: MaterialRequestRecord | null;
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
      requester:requested_by(id, first_name, last_name, display_name),
      reviewer:reviewed_by(id, first_name, last_name, display_name),
      items:material_request_items(
        id,
        material_request_id,
        material_id,
        requested_quantity,
        approved_quantity,
        fulfilled_quantity,
        unit_cost,
        estimated_total,
        notes,
        created_at,
        updated_at,
        material:materials(id, material_code, name, category, brand, specification, unit_of_measure, standard_unit_cost, current_stock, reorder_level)
      )
    `;

    let { data, error } = await supabase
      .from('material_requests')
      .select(selectQuery)
      .eq('id', id)
      .maybeSingle();

    if (error && isJwtExpiredError(error)) {
      const { session } = await ensureValidSession();
      if (session) {
        const retry = await supabase
          .from('material_requests')
          .select(selectQuery)
          .eq('id', id)
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      console.error('[materialRequestsService] Fetch detail error:', error);
      return { data: null, error: error.message || 'Unable to load request details.' };
    }

    if (!data) {
      return { data: null, error: 'Material request record not found.' };
    }

    const items = (data.items || []) as MaterialRequestItemRecord[];
    const totalEstimatedValue = items.reduce(
      (sum, item) => sum + (Number(item.estimated_total) || 0),
      0
    );

    const record: MaterialRequestRecord = {
      ...data,
      items,
      totalEstimatedValue,
      itemCount: items.length,
    };

    return { data: record, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to retrieve material request.',
    };
  }
}

/**
 * Checks if a request code is unique
 */
export async function checkRequestCodeUnique(
  code: string,
  excludeId?: string
): Promise<{ isUnique: boolean; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { isUnique: true, error: null };
  }

  try {
    await ensureValidSession();

    let query = supabase
      .from('material_requests')
      .select('id')
      .ilike('request_code', code.trim().toUpperCase());

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
 * Generates an automatic next request code conforming to convention:
 * REQ-YYYY-XXXX (e.g. REQ-2026-0001)
 */
export async function generateNextRequestCode(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `REQ-${currentYear}-`;

  try {
    const { data } = await supabase
      .from('material_requests')
      .select('request_code')
      .ilike('request_code', `${prefix}%`)
      .order('request_code', { ascending: false })
      .limit(1);

    if (data && data.length > 0 && data[0].request_code) {
      const match = data[0].request_code.match(/(\d+)$/);
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
 * Creates a new Material Request and its child items
 */
export async function createMaterialRequest(
  input: CreateMaterialRequestInput
): Promise<{ data: MaterialRequestRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();

    if (!user && !session?.user) {
      return { data: null, error: 'Authentication required to create a material request.' };
    }

    const requesterId = user?.id || session?.user?.id;

    // 1. Validation
    if (!input.project_id) {
      return { data: null, error: 'Please select an associated project.' };
    }
    if (!input.items || input.items.length === 0) {
      return { data: null, error: 'At least one material item is required.' };
    }
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      if (!item.material_id) {
        return { data: null, error: `Item #${i + 1}: Please select a material.` };
      }
      if (item.requested_quantity <= 0) {
        return { data: null, error: `Item #${i + 1}: Requested quantity must be greater than zero.` };
      }
      if (item.unit_cost < 0) {
        return { data: null, error: `Item #${i + 1}: Unit cost cannot be negative.` };
      }
    }

    // 2. Resolve request code
    let requestCode = (input.request_code || '').trim().toUpperCase();
    if (!requestCode) {
      requestCode = await generateNextRequestCode();
    }

    // Ensure uniqueness
    const uniqueness = await checkRequestCodeUnique(requestCode);
    if (!uniqueness.isUnique) {
      return { data: null, error: `Request code ${requestCode} already exists.` };
    }

    // 3. Insert parent material_request
    const parentPayload = {
      request_code: requestCode,
      project_id: input.project_id,
      requested_by: requesterId,
      status: input.status || 'submitted',
      priority: input.priority || 'normal',
      requested_date: new Date().toISOString(),
      required_by_date: input.required_by_date || null,
      justification: input.justification?.trim() || null,
      notes: input.notes?.trim() || null,
    };

    const { data: createdParent, error: parentError } = await supabase
      .from('material_requests')
      .insert(parentPayload)
      .select('id')
      .single();

    if (parentError) {
      console.error('[materialRequestsService] Insert parent error:', parentError);
      return {
        data: null,
        error: parentError.message || 'Failed to create material request record.',
      };
    }

    const requestId = createdParent.id;

    // 4. Insert child material_request_items
    const childPayloads = input.items.map((item) => ({
      material_request_id: requestId,
      material_id: item.material_id,
      requested_quantity: Number(item.requested_quantity),
      approved_quantity: null,
      fulfilled_quantity: 0,
      unit_cost: Number(item.unit_cost) || 0,
      estimated_total: Number(item.requested_quantity) * (Number(item.unit_cost) || 0),
      notes: item.notes?.trim() || null,
    }));

    const { error: itemsError } = await supabase
      .from('material_request_items')
      .insert(childPayloads);

    if (itemsError) {
      console.error('[materialRequestsService] Insert items error:', itemsError);
      // Clean up orphaned parent record on failure
      await supabase.from('material_requests').delete().eq('id', requestId);
      return {
        data: null,
        error: itemsError.message || 'Failed to save material request items.',
      };
    }

    // 5. Return complete fetched record
    return await getMaterialRequestById(requestId);
  } catch (err) {
    console.error('[materialRequestsService] Exception creating request:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unable to create material request.',
    };
  }
}

/**
 * Updates a material request header
 */
export async function updateMaterialRequest(
  id: string,
  input: UpdateMaterialRequestInput
): Promise<{ data: MaterialRequestRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    await ensureValidSession();

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.project_id) payload.project_id = input.project_id;
    if (input.priority) payload.priority = input.priority;
    if (input.required_by_date) payload.required_by_date = input.required_by_date;
    if (input.justification !== undefined) payload.justification = input.justification?.trim() || null;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;
    if (input.status) payload.status = input.status;

    const { error } = await supabase
      .from('material_requests')
      .update(payload)
      .eq('id', id);

    if (error) {
      return { data: null, error: error.message };
    }

    return await getMaterialRequestById(id);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to update request.',
    };
  }
}

/**
 * Approves a Material Request:
 * - Sets status = 'approved'
 * - Sets reviewed_by, reviewed_at, approved_at
 * - Updates approved_quantity on each item
 */
export async function approveMaterialRequest(
  id: string,
  params: {
    approvedItems: Array<{ itemId: string; approvedQuantity: number }>;
    notes?: string;
  }
): Promise<{ data: MaterialRequestRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const reviewerId = user?.id || session?.user?.id || null;
    const now = new Date().toISOString();

    // 1. Update parent request
    const parentUpdate = {
      status: 'approved' as MaterialRequestStatus,
      reviewed_by: reviewerId,
      reviewed_at: now,
      approved_at: now,
      notes: params.notes?.trim() || undefined,
      updated_at: now,
    };

    const { error: parentErr } = await supabase
      .from('material_requests')
      .update(parentUpdate)
      .eq('id', id);

    if (parentErr) {
      return { data: null, error: parentErr.message || 'Failed to update approval status.' };
    }

    // 2. Update approved quantities on items
    if (params.approvedItems && params.approvedItems.length > 0) {
      for (const item of params.approvedItems) {
        const approvedQty = Math.max(0, Number(item.approvedQuantity));
        await supabase
          .from('material_request_items')
          .update({
            approved_quantity: approvedQty,
            updated_at: now,
          })
          .eq('id', item.itemId);
      }
    }

    return await getMaterialRequestById(id);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Approval workflow failed.',
    };
  }
}

/**
 * Rejects a Material Request:
 * - Requires a non-empty rejection reason
 * - Sets status = 'rejected'
 * - Sets reviewed_by, reviewed_at, rejection_reason
 */
export async function rejectMaterialRequest(
  id: string,
  params: {
    reason: string;
  }
): Promise<{ data: MaterialRequestRecord | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { data: null, error: 'Database connection is not configured.' };
  }

  const reason = params.reason.trim();
  if (!reason) {
    return { data: null, error: 'Rejection reason is required.' };
  }

  try {
    const { session, user } = await ensureValidSession();
    const reviewerId = user?.id || session?.user?.id || null;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('material_requests')
      .update({
        status: 'rejected' as MaterialRequestStatus,
        reviewed_by: reviewerId,
        reviewed_at: now,
        rejection_reason: reason,
        updated_at: now,
      })
      .eq('id', id);

    if (error) {
      return { data: null, error: error.message || 'Failed to reject material request.' };
    }

    return await getMaterialRequestById(id);
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Rejection workflow failed.',
    };
  }
}

/**
 * Fetches available projects for selection in dropdowns
 */
export async function getProjectsForDropdown(): Promise<{
  data: ProjectDropdownOption[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    await ensureValidSession();

    const { data, error } = await supabase
      .from('projects')
      .select('id, project_code, name, status')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[materialRequestsService] Could not fetch projects for dropdown:', error);
      return { data: [], error: error.message };
    }

    return { data: (data || []) as ProjectDropdownOption[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Failed to load projects.' };
  }
}

/**
 * Fetches available materials from public.materials for selection in line items
 */
export async function getMaterialsForDropdown(): Promise<{
  data: MaterialRecord[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { data: [], error: null };
  }

  try {
    await ensureValidSession();

    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[materialRequestsService] Could not fetch materials for dropdown:', error);
      return { data: [], error: error.message };
    }

    return { data: (data || []) as MaterialRecord[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Failed to load materials.' };
  }
}

export class MaterialRequestsService {
  static getMaterialRequestSummary = getMaterialRequestSummary;
  static getMaterialRequests = getMaterialRequests;
  static getMaterialRequestById = getMaterialRequestById;
  static generateNextRequestCode = generateNextRequestCode;
  static checkRequestCodeUnique = checkRequestCodeUnique;
  static createMaterialRequest = createMaterialRequest;
  static updateMaterialRequest = updateMaterialRequest;
  static approveMaterialRequest = approveMaterialRequest;
  static rejectMaterialRequest = rejectMaterialRequest;
  static getProjectsForDropdown = getProjectsForDropdown;
  static getMaterialsForDropdown = getMaterialsForDropdown;
}

export default MaterialRequestsService;
