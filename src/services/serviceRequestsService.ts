import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';

export type ServiceRequestStatus =
  | 'new'
  | 'under_review'
  | 'awaiting_customer_info'
  | 'inspection_required'
  | 'quotation_in_progress'
  | 'quotation_sent'
  | 'approved'
  | 'rejected'
  | 'converted_to_project'
  | 'closed';

export const SERVICE_REQUEST_STATUSES: Array<{
  value: ServiceRequestStatus;
  label: string;
  badgeClasses: string;
}> = [
  { value: 'new', label: 'New Enquiry', badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'under_review', label: 'Under Review', badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'awaiting_customer_info', label: 'Awaiting Info', badgeClasses: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'inspection_required', label: 'Inspection Required', badgeClasses: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'quotation_in_progress', label: 'Quotation in Progress', badgeClasses: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'quotation_sent', label: 'Quotation Sent', badgeClasses: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'approved', label: 'Approved by Management', badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'rejected', label: 'Rejected', badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'converted_to_project', label: 'Converted to Project', badgeClasses: 'bg-[#18b892]/10 text-[#18b892] border-[#18b892]/30 font-bold' },
  { value: 'closed', label: 'Closed', badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200' },
];

export interface ServiceRequestRecord {
  id: string;
  request_number: string;
  customer_name: string;
  phone: string;
  email: string | null;
  project_address: string;
  service_type: string;
  requirements_description: string;
  enquiry_date: string;
  estimated_budget: number | null;
  attachments: Array<{ name: string; url: string; size?: number }>;
  internal_notes: string | null;
  status: ServiceRequestStatus;
  assigned_to: string | null;
  assigned_role: string | null;
  inspection_notes: string | null;
  management_comments: string | null;
  converted_project_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: string; display_name: string | null; phone: string | null; job_title: string | null } | null;
  creator?: { id: string; display_name: string | null; email: string | null } | null;
  converted_project?: { id: string; name: string; project_code: string; status: string } | null;
}

export interface ServiceRequestHistoryItem {
  id: string;
  request_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
  performer?: { id: string; display_name: string | null } | null;
}

export interface CreateServiceRequestInput {
  customer_name: string;
  phone: string;
  email?: string | null;
  project_address: string;
  service_type: string;
  requirements_description: string;
  enquiry_date?: string;
  estimated_budget?: number | null;
  attachments?: Array<{ name: string; url: string; size?: number }>;
  internal_notes?: string | null;
}

export interface ServiceRequestFilter {
  search?: string;
  status?: string;
  serviceType?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Fallback in-memory store if remote DB table is pending deployment
const LOCAL_STORAGE_KEY = 'davejoe_service_requests_local';
const LOCAL_STORAGE_HISTORY_KEY = 'davejoe_service_request_history_local';

function getLocalRequests(): ServiceRequestRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalRequests(items: ServiceRequestRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export class ServiceRequestsService {
  /**
   * Generates unique request number: SR-YYYY-XXXX
   */
  static generateRequestNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SR-${year}-${random}`;
  }

  /**
   * Create a new walk-in customer service request
   */
  static async createServiceRequest(
    input: CreateServiceRequestInput,
    userId?: string
  ): Promise<{ data: ServiceRequestRecord | null; error: string | null }> {
    const requestNumber = this.generateRequestNumber();
    const now = new Date().toISOString();

    const newRecord: Partial<ServiceRequestRecord> = {
      request_number: requestNumber,
      customer_name: input.customer_name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      project_address: input.project_address.trim(),
      service_type: input.service_type.trim(),
      requirements_description: input.requirements_description.trim(),
      enquiry_date: input.enquiry_date || new Date().toISOString().split('T')[0],
      estimated_budget: input.estimated_budget ? Number(input.estimated_budget) : null,
      attachments: input.attachments || [],
      internal_notes: input.internal_notes?.trim() || null,
      status: 'new',
      created_by: userId || null,
      created_at: now,
      updated_at: now,
    };

    if (!isSupabaseConfigured) {
      const fallbackRecord: ServiceRequestRecord = {
        ...newRecord,
        id: 'sr_' + Math.random().toString(36).substring(2, 9),
      } as ServiceRequestRecord;
      const local = getLocalRequests();
      saveLocalRequests([fallbackRecord, ...local]);
      return { data: fallbackRecord, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('service_requests')
        .insert(newRecord)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('[ServiceRequestsService] Remote table pending migration. Saving to local store.');
          const fallbackRecord: ServiceRequestRecord = {
            ...newRecord,
            id: 'sr_' + Math.random().toString(36).substring(2, 9),
          } as ServiceRequestRecord;
          const local = getLocalRequests();
          saveLocalRequests([fallbackRecord, ...local]);
          return { data: fallbackRecord, error: null };
        }
        throw error;
      }

      // Record initial audit history
      try {
        await supabase.from('service_request_history').insert({
          request_id: data.id,
          action: 'created',
          to_status: 'new',
          notes: 'Walk-in service request created by Admin coordinator',
          performed_by: userId || null,
        });
      } catch {}

      return { data: data as ServiceRequestRecord, error: null };
    } catch (err: any) {
      console.error('[ServiceRequestsService] createServiceRequest error:', err);
      return { data: null, error: err?.message || 'Failed to submit service request.' };
    }
  }

  /**
   * Fetch all service requests with filters
   */
  static async getServiceRequests(
    filter?: ServiceRequestFilter
  ): Promise<{ data: ServiceRequestRecord[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: this.applyLocalFilter(getLocalRequests(), filter), error: null };
    }

    try {
      let query = supabase
        .from('service_requests')
        .select(`
          *,
          assignee:profiles!service_requests_assigned_to_fkey(id, display_name, phone, job_title),
          converted_project:projects!service_requests_converted_project_id_fkey(id, name, project_code, status)
        `)
        .order('created_at', { ascending: false });

      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }
      if (filter?.serviceType && filter.serviceType !== 'all') {
        query = query.eq('service_type', filter.serviceType);
      }
      if (filter?.assignedTo && filter.assignedTo !== 'all') {
        query = query.eq('assigned_to', filter.assignedTo);
      }
      if (filter?.dateFrom) {
        query = query.gte('enquiry_date', filter.dateFrom);
      }
      if (filter?.dateTo) {
        query = query.lte('enquiry_date', filter.dateTo);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('[ServiceRequestsService] Remote table pending migration. Reading from local store.');
          return { data: this.applyLocalFilter(getLocalRequests(), filter), error: null };
        }
        throw error;
      }

      let result = (data as ServiceRequestRecord[]) || [];

      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        result = result.filter(
          (r) =>
            r.customer_name.toLowerCase().includes(term) ||
            r.phone.toLowerCase().includes(term) ||
            r.request_number.toLowerCase().includes(term) ||
            r.project_address.toLowerCase().includes(term) ||
            r.service_type.toLowerCase().includes(term)
        );
      }

      return { data: result, error: null };
    } catch (err: any) {
      console.error('[ServiceRequestsService] getServiceRequests error:', err);
      return { data: this.applyLocalFilter(getLocalRequests(), filter), error: null };
    }
  }

  /**
   * Helper: apply filter to local fallback
   */
  private static applyLocalFilter(
    items: ServiceRequestRecord[],
    filter?: ServiceRequestFilter
  ): ServiceRequestRecord[] {
    let result = [...items];
    if (filter?.status && filter.status !== 'all') {
      result = result.filter((r) => r.status === filter.status);
    }
    if (filter?.serviceType && filter.serviceType !== 'all') {
      result = result.filter((r) => r.service_type === filter.serviceType);
    }
    if (filter?.search && filter.search.trim()) {
      const term = filter.search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.customer_name.toLowerCase().includes(term) ||
          r.phone.toLowerCase().includes(term) ||
          r.request_number.toLowerCase().includes(term) ||
          r.project_address.toLowerCase().includes(term) ||
          r.service_type.toLowerCase().includes(term)
      );
    }
    return result;
  }

  /**
   * Update service request status, internal notes, or inspection comments
   */
  static async updateServiceRequest(
    id: string,
    updates: {
      status?: ServiceRequestStatus;
      assigned_to?: string | null;
      assigned_role?: string | null;
      inspection_notes?: string | null;
      management_comments?: string | null;
      internal_notes?: string | null;
    },
    userId?: string
  ): Promise<{ success: boolean; error: string | null }> {
    const now = new Date().toISOString();
    const updatePayload = { ...updates, updated_at: now };

    if (!isSupabaseConfigured) {
      const local = getLocalRequests();
      const updated = local.map((r) => (r.id === id ? { ...r, ...updatePayload } : r));
      saveLocalRequests(updated);
      return { success: true, error: null };
    }

    try {
      const { error } = await supabase
        .from('service_requests')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          const local = getLocalRequests();
          const updated = local.map((r) => (r.id === id ? { ...r, ...updatePayload } : r));
          saveLocalRequests(updated);
          return { success: true, error: null };
        }
        throw error;
      }

      // Record audit history
      if (updates.status) {
        try {
          await supabase.from('service_request_history').insert({
            request_id: id,
            action: 'status_change',
            to_status: updates.status,
            notes: updates.management_comments || updates.inspection_notes || 'Status updated',
            performed_by: userId || null,
          });
        } catch {}
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[ServiceRequestsService] updateServiceRequest error:', err);
      return { success: false, error: err?.message || 'Failed to update request.' };
    }
  }

  /**
   * Convert an approved service request into an active project
   */
  static async convertToProject(
    requestId: string,
    userId?: string
  ): Promise<{ project_id: string | null; error: string | null }> {
    try {
      // 1. Fetch request details
      let req: ServiceRequestRecord | null = null;
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('service_requests')
          .select('*')
          .eq('id', requestId)
          .single();
        if (!error && data) req = data as ServiceRequestRecord;
      }

      if (!req) {
        const local = getLocalRequests();
        req = local.find((r) => r.id === requestId) || null;
      }

      if (!req) return { project_id: null, error: 'Service request not found.' };

      // 2. Generate Project Code
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const projectCode = `PRJ-${year}-${randomSuffix}`;
      const projectName = `${req.customer_name} — ${req.service_type}`;

      let createdProjectId = 'prj_' + Math.random().toString(36).substring(2, 9);

      if (isSupabaseConfigured) {
        const { data: projData, error: projErr } = await supabase
          .from('projects')
          .insert({
            name: projectName,
            project_code: projectCode,
            status: 'planning',
            site_location: req.project_address,
            client_name: req.customer_name,
            client_phone: req.phone,
            budget: req.estimated_budget || 0,
            description: req.requirements_description,
          })
          .select('id')
          .single();

        if (!projErr && projData?.id) {
          createdProjectId = projData.id;
        }
      }

      // 3. Mark request as converted
      await this.updateServiceRequest(
        requestId,
        {
          status: 'converted_to_project',
          management_comments: `Converted into Project [${projectCode}] by Management`,
        },
        userId
      );

      return { project_id: createdProjectId, error: null };
    } catch (err: any) {
      console.error('[ServiceRequestsService] convertToProject error:', err);
      return { project_id: null, error: err?.message || 'Failed to convert request to project.' };
    }
  }

  /**
   * Fetch audit history for a request
   */
  static async getRequestHistory(requestId: string): Promise<ServiceRequestHistoryItem[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('service_request_history')
        .select(`
          *,
          performer:profiles!service_request_history_performed_by_fkey(id, display_name)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });

      if (error) return [];
      return (data as ServiceRequestHistoryItem[]) || [];
    } catch {
      return [];
    }
  }
}
