import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ProjectRecord } from './projectService';
import { formatNaira, formatDateNigerian } from './dashboardService';

export interface ProjectWorkforceItem {
  id: string;
  project_id: string;
  workforce_member_id: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  workforce_members?: {
    id: string;
    workforce_code: string;
    trade: string;
    status: string;
    workforce_type: string | null;
    phone: string | null;
    profiles?: {
      id: string;
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
}

export interface WorkerDetailRecords {
  attendance: Array<{
    id: string;
    attendance_date: string;
    status: string;
    recorded_by?: string | null;
    created_at: string;
  }>;
  productivity: Array<{
    id: string;
    work_date?: string | null;
    unit_of_measure?: string | null;
    count?: number | null;
    notes?: string | null;
    created_at: string;
  }>;
  overtime: Array<{
    id: string;
    requested_hours: number;
    reason: string | null;
    status: string;
    approved_by?: string | null;
    approved_at?: string | null;
    created_at: string;
  }>;
  conduct: Array<{
    id: string;
    severity: string;
    action_taken: string | null;
    recorded_by?: string | null;
    created_at: string;
  }>;
}

export interface ProjectMaterialRequirementItem {
  id: string;
  project_id: string;
  material_id: string;
  required_quantity: number;
  approved_quantity: number | null;
  estimated_unit_cost: number | null;
  estimated_total_cost: number | null;
  purpose: string | null;
  materials?: {
    id: string;
    name: string;
    unit_of_measure: string | null;
  } | null;
}

export interface ProjectMaterialRequestItem {
  id: string;
  project_id: string;
  status: string;
  request_code: string | null;
  priority: string | null;
  requested_by: string | null;
  requested_date: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  material_request_items?: Array<{
    id: string;
    material_id: string;
    requested_quantity: number | null;
    approved_quantity: number | null;
    unit_cost: number | null;
    notes: string | null;
    materials?: {
      id: string;
      name: string;
      unit_of_measure: string | null;
    } | null;
  }>;
}

export interface ProjectMaterialDeliveryItem {
  id: string;
  project_id: string;
  delivery_code: string | null;
  delivery_date: string | null;
  destination: string | null;
  delivered_by: string | null;
  received_by: string | null;
  acknowledgement_reference: string | null;
  notes: string | null;
  created_at: string;
  material_delivery_items?: Array<{
    id: string;
    material_id: string;
    quantity: number | null;
    unit_cost: number | null;
    notes: string | null;
    materials?: {
      id: string;
      name: string;
      unit_of_measure: string | null;
    } | null;
  }>;
}

export interface ProjectMaterialUsageItem {
  id: string;
  project_id: string;
  material_id: string;
  workforce_member_id: string | null;
  quantity_used: number;
  unit_cost: number | null;
  usage_date: string | null;
  work_area: string | null;
  purpose: string | null;
  recorded_by: string | null;
  created_at: string;
  materials?: {
    id: string;
    name: string;
    unit_of_measure: string | null;
  } | null;
}

export interface ProjectMaterialReturnItem {
  id: string;
  project_id: string;
  material_id: string;
  destination: string | null;
  received_by: string | null;
  condition: string | null;
  quantity_returned: number | null;
  notes: string | null;
  created_at: string;
  materials?: {
    id: string;
    name: string;
    unit_of_measure: string | null;
  } | null;
}

export interface ProjectMaterialLossItem {
  id: string;
  project_id: string;
  material_id: string;
  quantity: number | null;
  reason: string | null;
  approved_by: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
  materials?: {
    id: string;
    name: string;
    unit_of_measure: string | null;
  } | null;
}

export interface ProjectMaterialReconciliationItem {
  id: string;
  project_id: string;
  material_id: string;
  reconciliation_date: string | null;
  opening_quantity: number | null;
  returned_quantity: number | null;
  consumed_quantity: number | null;
  damaged_quantity: number | null;
  wasted_quantity: number | null;
  closing_quantity: number | null;
  expected_closing_quantity: number | null;
  variance_quantity: number | null;
  reconciled_by: string | null;
  notes: string | null;
  created_at: string;
  materials?: {
    id: string;
    name: string;
    unit_of_measure: string | null;
  } | null;
}

export interface ProjectPurchaseOrderItem {
  id: string;
  project_id: string;
  status: string;
  purchase_date: string | null;
  subtotal: number | null;
  delivery_cost: number | null;
  other_cost: number | null;
  total_cost: number | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  suppliers?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    contact_person: string | null;
  } | null;
  purchase_order_items?: Array<{
    id: string;
    ordered_quantity: number | null;
    unit_cost: number | null;
    total_cost: number | null;
    notes: string | null;
    materials?: {
      id: string;
      name: string;
      unit_of_measure: string | null;
    } | null;
  }>;
}

export interface ProjectMetricsData {
  assignedWorkforce: number;
  materialRequests: number;
  purchaseOrders: number;
  materialDeliveries: number;
  attendanceRecords: number;
  productivityRecords: number;
  overtimeRequests: number;
}

export interface ProjectActivityEntry {
  id: string;
  date: string;
  rawDate: string;
  title: string;
  subtitle: string;
  reference?: string | null;
  type:
    | 'project'
    | 'workforce'
    | 'material_request'
    | 'purchase_order'
    | 'delivery'
    | 'usage'
    | 'return'
    | 'loss'
    | 'reconciliation'
    | 'attendance'
    | 'overtime'
    | 'conduct';
}

export class ProjectControlService {
  /**
   * Fetches real counts for the Overview project metrics panel
   */
  static async getProjectMetrics(
    projectId: string
  ): Promise<{ data: ProjectMetricsData; error: string | null }> {
    const defaultMetrics: ProjectMetricsData = {
      assignedWorkforce: 0,
      materialRequests: 0,
      purchaseOrders: 0,
      materialDeliveries: 0,
      attendanceRecords: 0,
      productivityRecords: 0,
      overtimeRequests: 0,
    };

    if (!isSupabaseConfigured) {
      return { data: defaultMetrics, error: 'Database is not configured.' };
    }

    try {
      const [wf, mr, po, del, att, prod, ot] = await Promise.all([
        supabase
          .from('project_workforce_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId),
        supabase
          .from('material_requests')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId),
        supabase
          .from('purchase_orders')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId),
        supabase
          .from('material_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId),
        supabase
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId),
        supabase
          .from('productivity_records')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId),
        supabase
          .from('overtime_requests')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', projectId),
      ]);

      const anyError =
        wf.error || mr.error || po.error || del.error || att.error || prod.error || ot.error;
      if (anyError) {
        return { data: defaultMetrics, error: anyError.message };
      }

      return {
        data: {
          assignedWorkforce: wf.count || 0,
          materialRequests: mr.count || 0,
          purchaseOrders: po.count || 0,
          materialDeliveries: del.count || 0,
          attendanceRecords: att.count || 0,
          productivityRecords: prod.count || 0,
          overtimeRequests: ot.count || 0,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: defaultMetrics, error: err?.message || 'Failed to fetch project metrics.' };
    }
  }

  /**
   * Fetches real assigned workforce members for this project
   */
  static async getProjectWorkforce(
    projectId: string
  ): Promise<{ data: ProjectWorkforceItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('project_workforce_assignments')
        .select(`
          id,
          project_id,
          workforce_member_id,
          start_date,
          end_date,
          notes,
          created_at,
          workforce_members (
            id,
            workforce_code,
            trade,
            status,
            workforce_type,
            phone,
            profiles:profiles!workforce_members_profile_id_fkey (
              id,
              display_name,
              first_name,
              last_name
            )
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as unknown as ProjectWorkforceItem[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch assigned workforce.' };
    }
  }

  /**
   * Fetches real linked activity for a specific worker on this project
   */
  static async getWorkerDetailForProject(
    projectId: string,
    workforceMemberId: string
  ): Promise<{ data: WorkerDetailRecords | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const [attRes, prodRes, otRes, condRes] = await Promise.all([
        supabase
          .from('attendance_records')
          .select('id, attendance_date, status, recorded_by, created_at')
          .eq('project_id', projectId)
          .eq('workforce_member_id', workforceMemberId)
          .order('attendance_date', { ascending: false }),
        supabase
          .from('productivity_records')
          .select('id, work_date, unit_of_measure, count, notes, created_at')
          .eq('project_id', projectId)
          .eq('workforce_member_id', workforceMemberId)
          .order('created_at', { ascending: false }),
        supabase
          .from('overtime_requests')
          .select('id, requested_hours, reason, status, approved_by, approved_at, created_at')
          .eq('project_id', projectId)
          .eq('workforce_member_id', workforceMemberId)
          .order('created_at', { ascending: false }),
        supabase
          .from('workforce_conduct_records')
          .select('id, severity, action_taken, recorded_by, created_at')
          .eq('project_id', projectId)
          .eq('workforce_member_id', workforceMemberId)
          .order('created_at', { ascending: false }),
      ]);

      const anyError = attRes.error || prodRes.error || otRes.error || condRes.error;
      if (anyError) {
        return { data: null, error: anyError.message };
      }

      return {
        data: {
          attendance: (attRes.data as any[]) || [],
          productivity: (prodRes.data as any[]) || [],
          overtime: (otRes.data as any[]) || [],
          conduct: (condRes.data as any[]) || [],
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch worker details.' };
    }
  }

  /**
   * Retrieves all available workforce members in the system for assignment
   */
  static async getAvailableWorkforceMembers(): Promise<{
    data: Array<{
      id: string;
      workforce_code: string;
      trade: string;
      status: string;
      displayName: string;
    }>;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('workforce_members')
        .select(`
          id,
          workforce_code,
          trade,
          status,
          profiles:profiles!workforce_members_profile_id_fkey (
            id,
            display_name,
            first_name,
            last_name
          )
        `)
        .order('workforce_code');

      if (error) {
        return { data: [], error: error.message };
      }

      const formatted = (data || []).map((w: any) => {
        const prof = w.profiles;
        const name =
          prof?.display_name ||
          (prof?.first_name || prof?.last_name
            ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
            : `Worker ${w.workforce_code}`);
        return {
          id: w.id,
          workforce_code: w.workforce_code,
          trade: w.trade,
          status: w.status,
          displayName: name,
        };
      });

      return { data: formatted, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch workforce members.' };
    }
  }

  /**
   * Assigns a real workforce member to a project
   */
  static async assignWorkforce(payload: {
    projectId: string;
    workforceMemberId: string;
    startDate?: string | null;
    endDate?: string | null;
    notes?: string | null;
  }): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: 'Database is not configured.' };
    }

    try {
      const { error } = await supabase.from('project_workforce_assignments').insert({
        project_id: payload.projectId,
        workforce_member_id: payload.workforceMemberId,
        start_date: payload.startDate || null,
        end_date: payload.endDate || null,
        notes: payload.notes?.trim() || null,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to assign workforce member.' };
    }
  }

  /**
   * Fetches all materials-related real data for this project
   */
  static async getProjectMaterialsData(projectId: string): Promise<{
    requirements: ProjectMaterialRequirementItem[];
    requests: ProjectMaterialRequestItem[];
    deliveries: ProjectMaterialDeliveryItem[];
    usage: ProjectMaterialUsageItem[];
    returns: ProjectMaterialReturnItem[];
    losses: ProjectMaterialLossItem[];
    reconciliations: ProjectMaterialReconciliationItem[];
    error: string | null;
  }> {
    const emptyResult = {
      requirements: [],
      requests: [],
      deliveries: [],
      usage: [],
      returns: [],
      losses: [],
      reconciliations: [],
    };

    if (!isSupabaseConfigured) {
      return { ...emptyResult, error: 'Database is not configured.' };
    }

    try {
      const [reqs, requests, dels, usages, rets, losses, recons] = await Promise.all([
        supabase
          .from('project_material_requirements')
          .select('id, project_id, required_quantity, approved_quantity, estimated_unit_cost, estimated_total_cost, purpose, materials(id, name, unit_of_measure)')
          .eq('project_id', projectId),
        supabase
          .from('material_requests')
          .select('id, project_id, status, request_code, priority, requested_by, requested_date, approved_at, notes, created_at, material_request_items(id, requested_quantity, approved_quantity, unit_cost, notes, materials(id, name, unit_of_measure))')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_deliveries')
          .select('id, project_id, delivery_code, delivery_date, destination, delivered_by, received_by, acknowledgement_reference, notes, created_at, material_delivery_items(id, quantity, unit_cost, notes, materials(id, name, unit_of_measure))')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_usage_records')
          .select('id, project_id, workforce_member_id, quantity_used, unit_cost, usage_date, work_area, purpose, recorded_by, created_at, materials(id, name, unit_of_measure)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_returns')
          .select('id, project_id, destination, received_by, condition, quantity_returned, notes, created_at, materials(id, name, unit_of_measure)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_losses')
          .select('id, project_id, quantity, reason, approved_by, recorded_by, notes, created_at, materials(id, name, unit_of_measure)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_reconciliations')
          .select('id, project_id, reconciliation_date, opening_quantity, returned_quantity, consumed_quantity, damaged_quantity, wasted_quantity, closing_quantity, expected_closing_quantity, variance_quantity, reconciled_by, notes, created_at, materials(id, name, unit_of_measure)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false }),
      ]);

      const anyError =
        reqs.error ||
        requests.error ||
        dels.error ||
        usages.error ||
        rets.error ||
        losses.error ||
        recons.error;

      if (anyError) {
        return { ...emptyResult, error: anyError.message };
      }

      return {
        requirements: (reqs.data as unknown as ProjectMaterialRequirementItem[]) || [],
        requests: (requests.data as unknown as ProjectMaterialRequestItem[]) || [],
        deliveries: (dels.data as unknown as ProjectMaterialDeliveryItem[]) || [],
        usage: (usages.data as unknown as ProjectMaterialUsageItem[]) || [],
        returns: (rets.data as unknown as ProjectMaterialReturnItem[]) || [],
        losses: (losses.data as unknown as ProjectMaterialLossItem[]) || [],
        reconciliations: (recons.data as unknown as ProjectMaterialReconciliationItem[]) || [],
        error: null,
      };
    } catch (err: any) {
      return { ...emptyResult, error: err?.message || 'Failed to fetch project materials data.' };
    }
  }

  /**
   * Fetches real purchase orders with supplier and items for this project
   */
  static async getProjectProcurementData(
    projectId: string
  ): Promise<{ data: ProjectPurchaseOrderItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          project_id,
          status,
          purchase_date,
          subtotal,
          delivery_cost,
          other_cost,
          total_cost,
          approved_by,
          approved_at,
          notes,
          created_at,
          suppliers (
            id,
            name,
            email,
            phone,
            contact_person
          ),
          purchase_order_items (
            id,
            ordered_quantity,
            unit_cost,
            total_cost,
            notes,
            materials (
              id,
              name,
              unit_of_measure
            )
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as unknown as ProjectPurchaseOrderItem[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch purchase orders.' };
    }
  }

  /**
   * Calculates actual financial metrics derived exclusively from verified existing tables
   */
  static async getProjectFinancials(
    projectId: string,
    contractValue: number | null
  ): Promise<{
    data: {
      contractValue: number | null;
      procurementCommitted: number;
      requirementsEstimate: number;
      usageExpenditure: number;
      hasAnyFinancialRecord: boolean;
    };
    error: string | null;
  }> {
    const defaultData = {
      contractValue,
      procurementCommitted: 0,
      requirementsEstimate: 0,
      usageExpenditure: 0,
      hasAnyFinancialRecord: contractValue != null,
    };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database is not configured.' };
    }

    try {
      const [poRes, reqRes, useRes] = await Promise.all([
        supabase.from('purchase_orders').select('total_cost, subtotal').eq('project_id', projectId),
        supabase.from('project_material_requirements').select('estimated_total_cost').eq('project_id', projectId),
        supabase.from('material_usage_records').select('quantity_used, unit_cost').eq('project_id', projectId),
      ]);

      let procurementCommitted = 0;
      if (poRes.data) {
        for (const po of poRes.data as any[]) {
          const cost = po.total_cost ?? po.subtotal;
          if (cost != null && !isNaN(Number(cost))) {
            procurementCommitted += Number(cost);
          }
        }
      }

      let requirementsEstimate = 0;
      if (reqRes.data) {
        for (const r of reqRes.data as any[]) {
          if (r.estimated_total_cost != null && !isNaN(Number(r.estimated_total_cost))) {
            requirementsEstimate += Number(r.estimated_total_cost);
          }
        }
      }

      let usageExpenditure = 0;
      if (useRes.data) {
        for (const u of useRes.data as any[]) {
          const q = Number(u.quantity_used) || 0;
          const c = Number(u.unit_cost) || 0;
          usageExpenditure += q * c;
        }
      }

      const hasAnyFinancialRecord = Boolean(
        contractValue != null ||
        (poRes.data && poRes.data.length > 0) ||
        (reqRes.data && reqRes.data.length > 0) ||
        (useRes.data && useRes.data.length > 0)
      );

      return {
        data: {
          contractValue,
          procurementCommitted,
          requirementsEstimate,
          usageExpenditure,
          hasAnyFinancialRecord,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: defaultData, error: err?.message || 'Failed to calculate financial control values.' };
    }
  }

  /**
   * Compiles chronological activity feed from real database entries for this project
   */
  static async getProjectActivities(
    project: ProjectRecord
  ): Promise<{ data: ProjectActivityEntry[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const [mrRes, poRes, delRes, useRes, retRes, lossRes, recRes, wfRes, attRes, otRes, condRes] =
        await Promise.all([
          supabase.from('material_requests').select('id, request_code, status, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('purchase_orders').select('id, total_cost, status, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('material_deliveries').select('id, delivery_code, delivery_date, destination, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('material_usage_records').select('id, work_area, purpose, quantity_used, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('material_returns').select('id, condition, destination, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('material_losses').select('id, reason, quantity, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('material_reconciliations').select('id, reconciliation_date, variance_quantity, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('project_workforce_assignments').select('id, start_date, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('attendance_records').select('id, attendance_date, status, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('overtime_requests').select('id, requested_hours, status, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('workforce_conduct_records').select('id, severity, action_taken, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
        ]);

      const activities: ProjectActivityEntry[] = [];

      // 1. Project Registration
      if (project.created_at) {
        activities.push({
          id: `proj-${project.id}`,
          date: formatDateNigerian(project.created_at, true),
          rawDate: project.created_at,
          title: `Project registered in system: ${project.name}`,
          subtitle: `Code: ${project.project_code} • Status: ${project.status}`,
          reference: project.project_code,
          type: 'project',
        });
      }

      // 2. Material Requests
      if (mrRes.data) {
        for (const r of mrRes.data as any[]) {
          activities.push({
            id: `mr-${r.id}`,
            date: formatDateNigerian(r.created_at, true),
            rawDate: r.created_at,
            title: `Material Request logged (${r.request_code || 'Requisition'})`,
            subtitle: `Status: ${r.status}`,
            reference: r.request_code,
            type: 'material_request',
          });
        }
      }

      // 3. Purchase Orders
      if (poRes.data) {
        for (const po of poRes.data as any[]) {
          activities.push({
            id: `po-${po.id}`,
            date: formatDateNigerian(po.created_at, true),
            rawDate: po.created_at,
            title: `Purchase Order created: ${po.id.slice(0, 8)}`,
            subtitle: po.total_cost ? `Total: ${formatNaira(po.total_cost)} • Status: ${po.status}` : `Status: ${po.status}`,
            reference: po.id.slice(0, 8),
            type: 'purchase_order',
          });
        }
      }

      // 4. Material Deliveries
      if (delRes.data) {
        for (const del of delRes.data as any[]) {
          activities.push({
            id: `del-${del.id}`,
            date: formatDateNigerian(del.created_at || del.delivery_date, true),
            rawDate: del.created_at || del.delivery_date,
            title: `Material Delivery received (${del.delivery_code || 'Waybill'})`,
            subtitle: del.destination ? `Destination: ${del.destination}` : 'Site logistics',
            reference: del.delivery_code,
            type: 'delivery',
          });
        }
      }

      // 5. Material Usage
      if (useRes.data) {
        for (const u of useRes.data as any[]) {
          activities.push({
            id: `use-${u.id}`,
            date: formatDateNigerian(u.created_at, true),
            rawDate: u.created_at,
            title: `Material consumed on site (${u.quantity_used} units)`,
            subtitle: u.work_area ? `Work Area: ${u.work_area}` : u.purpose ? `Purpose: ${u.purpose}` : 'Site progress',
            type: 'usage',
          });
        }
      }

      // 6. Material Returns
      if (retRes.data) {
        for (const ret of retRes.data as any[]) {
          activities.push({
            id: `ret-${ret.id}`,
            date: formatDateNigerian(ret.created_at, true),
            rawDate: ret.created_at,
            title: `Material Return logged`,
            subtitle: ret.condition ? `Condition: ${ret.condition}` : 'Warehouse return',
            type: 'return',
          });
        }
      }

      // 7. Material Losses
      if (lossRes.data) {
        for (const l of lossRes.data as any[]) {
          activities.push({
            id: `loss-${l.id}`,
            date: formatDateNigerian(l.created_at, true),
            rawDate: l.created_at,
            title: `Material Loss / Wastage reported (${l.quantity || 0} units)`,
            subtitle: l.reason ? `Reason: ${l.reason}` : 'Loss record',
            type: 'loss',
          });
        }
      }

      // 8. Material Reconciliation
      if (recRes.data) {
        for (const rec of recRes.data as any[]) {
          activities.push({
            id: `rec-${rec.id}`,
            date: formatDateNigerian(rec.created_at || rec.reconciliation_date, true),
            rawDate: rec.created_at || rec.reconciliation_date,
            title: `Stock Reconciliation conducted`,
            subtitle: rec.variance_quantity != null ? `Variance: ${rec.variance_quantity} units` : 'Reconciliation audit',
            type: 'reconciliation',
          });
        }
      }

      // 9. Workforce Assignments
      if (wfRes.data) {
        for (const w of wfRes.data as any[]) {
          activities.push({
            id: `wf-${w.id}`,
            date: formatDateNigerian(w.created_at, true),
            rawDate: w.created_at,
            title: `Worker assigned to project`,
            subtitle: w.start_date ? `Start Date: ${formatDateNigerian(w.start_date)}` : 'Roster deployment',
            type: 'workforce',
          });
        }
      }

      // 10. Attendance
      if (attRes.data) {
        for (const a of attRes.data as any[]) {
          activities.push({
            id: `att-${a.id}`,
            date: formatDateNigerian(a.created_at || a.attendance_date, true),
            rawDate: a.created_at || a.attendance_date,
            title: `Workforce muster roll logged (${a.status})`,
            subtitle: a.attendance_date ? `Date: ${formatDateNigerian(a.attendance_date)}` : 'Attendance',
            type: 'attendance',
          });
        }
      }

      // 11. Overtime
      if (otRes.data) {
        for (const ot of otRes.data as any[]) {
          activities.push({
            id: `ot-${ot.id}`,
            date: formatDateNigerian(ot.created_at, true),
            rawDate: ot.created_at,
            title: `Overtime requested (${ot.requested_hours} hrs)`,
            subtitle: `Status: ${ot.status}`,
            type: 'overtime',
          });
        }
      }

      // 12. Conduct
      if (condRes.data) {
        for (const c of condRes.data as any[]) {
          activities.push({
            id: `cond-${c.id}`,
            date: formatDateNigerian(c.created_at, true),
            rawDate: c.created_at,
            title: `Workforce conduct notice: ${c.severity}`,
            subtitle: c.action_taken ? `Action: ${c.action_taken}` : 'Conduct report',
            type: 'conduct',
          });
        }
      }

      // Sort chronological newest first
      activities.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());

      return { data: activities, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to aggregate project activity.' };
    }
  }
}
