import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { ProjectRecord } from './projectService';
import { PurchaseOrderRecord, SupplierRecord } from './procurementService';
import { formatNaira, formatNigerianDate } from './materialsService';

export interface ProjectFinancialSummaryItem {
  projectId: string;
  projectCode: string;
  projectName: string;
  status: string;
  startDate: string | null;
  contractValue: number | null;
  currency: string;
  procurementCommitted: number;
  purchaseOrdersCount: number;
  requirementsEstimate: number;
  usageRecordedValue: number;
  hasFinancialActivity: boolean;
}

export interface FinancialControlExecutiveSummary {
  totalContractValue: number;
  totalProcurementCommitted: number;
  totalRequirementsEstimate: number;
  totalUsageExpenditure: number;
  activeProjectsCount: number;
  financiallyActiveProjectsCount: number;
  totalPurchaseOrdersCount: number;
}

export interface SupplierFinancialCommitment {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  ordersCount: number;
  totalCommitted: number;
}

export interface FinancialRecordDetail {
  id: string;
  type: 'contract' | 'purchase_order' | 'material_requirement' | 'usage';
  reference: string;
  projectId: string;
  projectCode?: string;
  projectName?: string;
  supplierName?: string;
  date: string;
  status?: string;
  amount: number;
  notes?: string | null;
  recordedBy?: string | null;
}

export class FinancialControlService {
  /**
   * Retrieves organization-wide executive financial summary derived exclusively
   * from verified tables: projects, purchase_orders, project_material_requirements, material_usage_records.
   */
  static async getExecutiveSummary(): Promise<{
    data: FinancialControlExecutiveSummary | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const [projectsRes, poRes, reqRes, usageRes] = await Promise.all([
        supabase.from('projects').select('id, contract_value, status'),
        supabase.from('purchase_orders').select('id, total_cost, subtotal, status'),
        supabase.from('project_material_requirements').select('id, estimated_total_cost'),
        supabase.from('material_usage_records').select('id, quantity_used, unit_cost'),
      ]);

      const anyError = projectsRes.error || poRes.error || reqRes.error || usageRes.error;
      if (anyError) {
        if (isJwtExpiredError(anyError)) {
          const { session } = await ensureValidSession();
          if (!session) {
            return { data: null, error: 'Session expired. Please sign in again.' };
          }
        }
        return { data: null, error: anyError.message || 'Unable to load financial summary.' };
      }

      // 1. Projects Contract Value
      const projects = projectsRes.data || [];
      let totalContractValue = 0;
      let activeProjectsCount = 0;
      projects.forEach((p: any) => {
        if (p.contract_value != null && !isNaN(Number(p.contract_value))) {
          totalContractValue += Number(p.contract_value);
        }
        if (p.status === 'in_progress' || p.status === 'approved') {
          activeProjectsCount++;
        }
      });

      // 2. Procurement Committed
      const purchaseOrders = poRes.data || [];
      let totalProcurementCommitted = 0;
      purchaseOrders.forEach((po: any) => {
        const cost = po.total_cost ?? po.subtotal;
        if (cost != null && !isNaN(Number(cost))) {
          totalProcurementCommitted += Number(cost);
        }
      });

      // 3. Requirements Estimate
      const requirements = reqRes.data || [];
      let totalRequirementsEstimate = 0;
      requirements.forEach((r: any) => {
        if (r.estimated_total_cost != null && !isNaN(Number(r.estimated_total_cost))) {
          totalRequirementsEstimate += Number(r.estimated_total_cost);
        }
      });

      // 4. Material Usage Expenditure
      const usages = usageRes.data || [];
      let totalUsageExpenditure = 0;
      usages.forEach((u: any) => {
        const q = Number(u.quantity_used) || 0;
        const c = Number(u.unit_cost) || 0;
        totalUsageExpenditure += q * c;
      });

      return {
        data: {
          totalContractValue,
          totalProcurementCommitted,
          totalRequirementsEstimate,
          totalUsageExpenditure,
          activeProjectsCount,
          financiallyActiveProjectsCount: projects.filter(
            (p: any) => p.contract_value != null && Number(p.contract_value) > 0
          ).length,
          totalPurchaseOrdersCount: purchaseOrders.length,
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to query financial summary.',
      };
    }
  }

  /**
   * Retrieves list of projects with aggregated financial commitments, requirements, and usage.
   */
  static async getProjectFinancialsList(params?: {
    search?: string;
    status?: string;
  }): Promise<{
    data: ProjectFinancialSummaryItem[];
    count: number;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], count: 0, error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const [projectsRes, poRes, reqRes, usageRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, project_code, name, status, start_date, contract_value, currency')
          .order('created_at', { ascending: false }),
        supabase
          .from('purchase_orders')
          .select('id, project_id, total_cost, subtotal, status'),
        supabase
          .from('project_material_requirements')
          .select('id, project_id, estimated_total_cost'),
        supabase
          .from('material_usage_records')
          .select('id, project_id, quantity_used, unit_cost'),
      ]);

      if (projectsRes.error) {
        return { data: [], count: 0, error: projectsRes.error.message };
      }

      const projects = projectsRes.data || [];
      const poList = poRes.data || [];
      const reqList = reqRes.data || [];
      const usageList = usageRes.data || [];

      // Map aggregations by project_id
      const poByProject: Record<string, { total: number; count: number }> = {};
      poList.forEach((po: any) => {
        if (!po.project_id) return;
        if (!poByProject[po.project_id]) {
          poByProject[po.project_id] = { total: 0, count: 0 };
        }
        poByProject[po.project_id].count++;
        const cost = po.total_cost ?? po.subtotal;
        if (cost != null && !isNaN(Number(cost))) {
          poByProject[po.project_id].total += Number(cost);
        }
      });

      const reqByProject: Record<string, number> = {};
      reqList.forEach((r: any) => {
        if (!r.project_id) return;
        if (!reqByProject[r.project_id]) reqByProject[r.project_id] = 0;
        if (r.estimated_total_cost != null && !isNaN(Number(r.estimated_total_cost))) {
          reqByProject[r.project_id] += Number(r.estimated_total_cost);
        }
      });

      const usageByProject: Record<string, number> = {};
      usageList.forEach((u: any) => {
        if (!u.project_id) return;
        if (!usageByProject[u.project_id]) usageByProject[u.project_id] = 0;
        const q = Number(u.quantity_used) || 0;
        const c = Number(u.unit_cost) || 0;
        usageByProject[u.project_id] += q * c;
      });

      let items: ProjectFinancialSummaryItem[] = projects.map((p: any) => {
        const poData = poByProject[p.id] || { total: 0, count: 0 };
        const reqEst = reqByProject[p.id] || 0;
        const useVal = usageByProject[p.id] || 0;
        const cv = p.contract_value != null ? Number(p.contract_value) : null;
        const hasActivity =
          cv != null || poData.count > 0 || reqEst > 0 || useVal > 0;

        return {
          projectId: p.id,
          projectCode: p.project_code,
          projectName: p.name,
          status: p.status,
          startDate: p.start_date,
          contractValue: cv,
          currency: p.currency || 'NGN',
          procurementCommitted: poData.total,
          purchaseOrdersCount: poData.count,
          requirementsEstimate: reqEst,
          usageRecordedValue: useVal,
          hasFinancialActivity: hasActivity,
        };
      });

      // Filter by status if requested
      if (params?.status && params.status !== 'all') {
        items = items.filter((it) => it.status === params.status);
      }

      // Filter by search query if requested
      if (params?.search && params.search.trim()) {
        const term = params.search.trim().toLowerCase();
        items = items.filter(
          (it) =>
            it.projectCode.toLowerCase().includes(term) ||
            it.projectName.toLowerCase().includes(term)
        );
      }

      return {
        data: items,
        count: items.length,
        error: null,
      };
    } catch (err) {
      return {
        data: [],
        count: 0,
        error: err instanceof Error ? err.message : 'Failed to query project financials.',
      };
    }
  }

  /**
   * Retrieves supplier commitments breakdown
   */
  static async getSupplierCommitments(): Promise<{
    data: SupplierFinancialCommitment[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          total_cost,
          subtotal,
          supplier_id,
          suppliers:supplier_id (
            id,
            name,
            supplier_code
          )
        `);

      if (error) {
        return { data: [], error: error.message };
      }

      const map: Record<string, SupplierFinancialCommitment> = {};
      (data || []).forEach((po: any) => {
        const sup = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
        const supId = sup?.id || po.supplier_id || 'unknown';
        const supName = sup?.name || 'Unassigned Vendor';
        const supCode = sup?.supplier_code || 'VEND';

        if (!map[supId]) {
          map[supId] = {
            supplierId: supId,
            supplierName: supName,
            supplierCode: supCode,
            ordersCount: 0,
            totalCommitted: 0,
          };
        }

        map[supId].ordersCount++;
        const cost = po.total_cost ?? po.subtotal;
        if (cost != null && !isNaN(Number(cost))) {
          map[supId].totalCommitted += Number(cost);
        }
      });

      const list = Object.values(map).sort((a, b) => b.totalCommitted - a.totalCommitted);
      return { data: list, error: null };
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err.message : 'Failed to load supplier commitments.',
      };
    }
  }
}

export default FinancialControlService;
