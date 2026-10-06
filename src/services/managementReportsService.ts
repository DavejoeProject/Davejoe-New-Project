import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';
import { formatNaira, formatNigerianDate } from './materialsService';

export type ReportDateRange =
  | 'all'
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'this_quarter'
  | 'this_year';

export interface DateFilterRange {
  startDate?: string;
  endDate?: string;
}

export function getDateBounds(range: ReportDateRange): { start?: Date; end?: Date } {
  if (range === 'all') return {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86400000) };
    case 'this_week': {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(today.setDate(diff));
      return { start: monday, end: new Date() };
    }
    case 'this_month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: firstDay, end: new Date() };
    }
    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const firstDay = new Date(now.getFullYear(), qMonth, 1);
      return { start: firstDay, end: new Date() };
    }
    case 'this_year': {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      return { start: firstDay, end: new Date() };
    }
    default:
      return {};
  }
}

export interface ExecutiveReportData {
  generatedAt: string;
  portfolio: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    onHoldProjects: number;
    totalContractValue: number;
  };
  financials: {
    totalContractValue: number;
    procurementCommitted: number;
    requirementsEstimate: number;
    materialUsageRecorded: number;
  };
  workforce: {
    totalWorkforce: number;
    activeWorkforce: number;
    assignedWorkforce: number;
    attendanceLogsCount: number;
    overtimeHoursTotal: number;
    conductNoticesCount: number;
  };
  materials: {
    totalMaterials: number;
    lowStockCount: number;
    outOfStockCount: number;
    requisitionsCount: number;
    purchaseOrdersCount: number;
    deliveriesCount: number;
    reconciliationsCount: number;
    variancesCount: number;
  };
  alerts: Array<{
    type: 'approval' | 'stock' | 'loss' | 'variance' | 'conduct';
    title: string;
    description: string;
    count: number;
    route: string;
  }>;
}

export interface ProjectReportRow {
  id: string;
  code: string;
  name: string;
  status: string;
  startDate: string | null;
  contractValue: number | null;
  assignedWorkersCount: number;
  purchaseOrdersCount: number;
  purchaseOrdersTotal: number;
  materialUsageValue: number;
  deliveriesCount: number;
}

export interface WorkforceReportData {
  totalRoster: number;
  activeCount: number;
  inactiveCount: number;
  suspendedCount: number;
  terminatedCount: number;
  assignedCount: number;
  tradesBreakdown: Record<string, number>;
  attendanceSummary: {
    presentCount: number;
    absentCount: number;
    lateCount: number;
    leaveCount: number;
  };
  productivityRecordsCount: number;
  overtimeHoursCount: number;
  conductNoticesCount: number;
}

export interface MaterialReportData {
  totalMaterials: number;
  activeCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoriesBreakdown: Record<string, number>;
  requisitionsSummary: {
    total: number;
    pending: number;
    approved: number;
    fulfilled: number;
  };
  procurementSummary: {
    totalOrders: number;
    totalValue: number;
    pendingApproval: number;
  };
  deliveriesSummary: {
    totalDeliveries: number;
    totalReceipts: number;
  };
  stockMovementTypesCount: Record<string, number>;
  reconciliationsSummary: {
    totalAudits: number;
    balancedAudits: number;
    varianceAudits: number;
    netVarianceQuantity: number;
  };
}

export interface FinancialReportData {
  totalContractValue: number;
  totalProcurementCommitted: number;
  totalRequirementsEstimate: number;
  totalUsageExpenditure: number;
  projectsBreakdown: Array<{
    id: string;
    code: string;
    name: string;
    contractValue: number | null;
    procurementCommitted: number;
    requirementsEstimate: number;
    usageExpenditure: number;
  }>;
  supplierCommitments: Array<{
    name: string;
    code: string;
    ordersCount: number;
    totalCommitted: number;
  }>;
}

export class ManagementReportsService {
  /**
   * Generates comprehensive Executive Portfolio Management Report
   */
  static async getExecutiveReportData(
    dateRange: ReportDateRange = 'all'
  ): Promise<{ data: ExecutiveReportData | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const [
        projectsRes,
        poRes,
        reqRes,
        usageRes,
        workforceRes,
        assignmentsRes,
        attendanceRes,
        overtimeRes,
        conductRes,
        materialsRes,
        mrRes,
        delivRes,
        recRes,
        lossRes,
      ] = await Promise.all([
        supabase.from('projects').select('id, status, contract_value, created_at'),
        supabase.from('purchase_orders').select('id, total_cost, subtotal, status, created_at'),
        supabase.from('project_material_requirements').select('id, estimated_total_cost'),
        supabase.from('material_usage_records').select('id, quantity_used, unit_cost'),
        supabase.from('workforce_members').select('id, status'),
        supabase.from('project_workforce_assignments').select('id'),
        supabase.from('attendance_records').select('id, status'),
        supabase.from('overtime_requests').select('id, requested_hours, status'),
        supabase.from('conduct_records').select('id, severity'),
        supabase.from('materials').select('id, current_stock, reorder_level, status'),
        supabase.from('material_requests').select('id, status'),
        supabase.from('material_deliveries').select('id'),
        supabase.from('material_reconciliations').select('id, variance_quantity'),
        supabase.from('material_losses').select('id, quantity, approved_by'),
      ]);

      const anyError =
        projectsRes.error ||
        poRes.error ||
        workforceRes.error ||
        materialsRes.error;
      if (anyError) {
        return { data: null, error: anyError.message };
      }

      // Portfolio
      const projects = projectsRes.data || [];
      const totalProjects = projects.length;
      let activeProjects = 0;
      let completedProjects = 0;
      let onHoldProjects = 0;
      let totalContractValue = 0;

      projects.forEach((p: any) => {
        if (p.status === 'in_progress' || p.status === 'approved') activeProjects++;
        if (p.status === 'completed' || p.status === 'closed') completedProjects++;
        if (p.status === 'on_hold') onHoldProjects++;
        if (p.contract_value != null && !isNaN(Number(p.contract_value))) {
          totalContractValue += Number(p.contract_value);
        }
      });

      // Financials
      const poList = poRes.data || [];
      let procurementCommitted = 0;
      let pendingPOApprovalCount = 0;
      poList.forEach((po: any) => {
        const cost = po.total_cost ?? po.subtotal;
        if (cost != null && !isNaN(Number(cost))) {
          procurementCommitted += Number(cost);
        }
        if (po.status === 'submitted' || po.status === 'draft') {
          pendingPOApprovalCount++;
        }
      });

      let requirementsEstimate = 0;
      (reqRes.data || []).forEach((r: any) => {
        if (r.estimated_total_cost != null && !isNaN(Number(r.estimated_total_cost))) {
          requirementsEstimate += Number(r.estimated_total_cost);
        }
      });

      let materialUsageRecorded = 0;
      (usageRes.data || []).forEach((u: any) => {
        materialUsageRecorded += (Number(u.quantity_used) || 0) * (Number(u.unit_cost) || 0);
      });

      // Workforce
      const wfList = workforceRes.data || [];
      const activeWorkforce = wfList.filter((w: any) => w.status === 'active').length;
      const assignedWorkforce = (assignmentsRes.data || []).length;
      const attendanceLogsCount = (attendanceRes.data || []).length;

      let overtimeHoursTotal = 0;
      (overtimeRes.data || []).forEach((ot: any) => {
        overtimeHoursTotal += Number(ot.requested_hours) || 0;
      });

      const conductNoticesCount = (conductRes.data || []).length;

      // Materials
      const matList = materialsRes.data || [];
      const totalMaterials = matList.length;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      matList.forEach((m: any) => {
        const stock = Number(m.current_stock ?? 0);
        const reorder = Number(m.reorder_level ?? 0);
        if (stock <= 0) outOfStockCount++;
        else if (reorder > 0 && stock <= reorder) lowStockCount++;
      });

      const mrList = mrRes.data || [];
      const pendingMRCount = mrList.filter((m: any) =>
        ['submitted', 'under_review', 'draft'].includes(m.status)
      ).length;

      const reconciliations = recRes.data || [];
      let variancesCount = 0;
      reconciliations.forEach((rec: any) => {
        if (Math.abs(Number(rec.variance_quantity) || 0) > 0.0001) {
          variancesCount++;
        }
      });

      const lossesList = lossRes.data || [];
      const pendingLossesCount = lossesList.filter((l: any) => !l.approved_by).length;

      // Build Actionable Control Alerts
      const alerts: ExecutiveReportData['alerts'] = [];
      if (pendingPOApprovalCount > 0) {
        alerts.push({
          type: 'approval',
          title: 'Purchase Orders Awaiting Approval',
          description: `${pendingPOApprovalCount} commercial purchase order(s) require management review.`,
          count: pendingPOApprovalCount,
          route: '/management/materials/procurement',
        });
      }
      if (pendingMRCount > 0) {
        alerts.push({
          type: 'approval',
          title: 'Site Material Requests Pending Review',
          description: `${pendingMRCount} site requisition(s) require managerial sign-off.`,
          count: pendingMRCount,
          route: '/management/materials/requests',
        });
      }
      if (outOfStockCount > 0 || lowStockCount > 0) {
        alerts.push({
          type: 'stock',
          title: 'Critical Inventory Thresholds Reached',
          description: `${outOfStockCount} item(s) out of stock; ${lowStockCount} below reorder level.`,
          count: outOfStockCount + lowStockCount,
          route: '/management/materials/stock',
        });
      }
      if (variancesCount > 0) {
        alerts.push({
          type: 'variance',
          title: 'Physical Audit Discrepancies Identified',
          description: `${variancesCount} reconciliation audit(s) show stock balance variances.`,
          count: variancesCount,
          route: '/management/materials/reconciliation',
        });
      }
      if (pendingLossesCount > 0) {
        alerts.push({
          type: 'loss',
          title: 'Material Losses Requiring Investigation',
          description: `${pendingLossesCount} damage/loss record(s) pending management approval.`,
          count: pendingLossesCount,
          route: '/management/materials/losses-returns',
        });
      }

      return {
        data: {
          generatedAt: new Date().toISOString(),
          portfolio: {
            totalProjects,
            activeProjects,
            completedProjects,
            onHoldProjects,
            totalContractValue,
          },
          financials: {
            totalContractValue,
            procurementCommitted,
            requirementsEstimate,
            materialUsageRecorded,
          },
          workforce: {
            totalWorkforce: wfList.length,
            activeWorkforce,
            assignedWorkforce,
            attendanceLogsCount,
            overtimeHoursTotal,
            conductNoticesCount,
          },
          materials: {
            totalMaterials,
            lowStockCount,
            outOfStockCount,
            requisitionsCount: mrList.length,
            purchaseOrdersCount: poList.length,
            deliveriesCount: (delivRes.data || []).length,
            reconciliationsCount: reconciliations.length,
            variancesCount,
          },
          alerts,
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Unable to generate executive report.',
      };
    }
  }

  /**
   * Generates Project Portfolio Report
   */
  static async getProjectReportData(): Promise<{
    data: ProjectReportRow[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const [projectsRes, poRes, useRes, assignRes, delivRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, project_code, name, status, start_date, contract_value')
          .order('created_at', { ascending: false }),
        supabase.from('purchase_orders').select('project_id, total_cost, subtotal'),
        supabase.from('material_usage_records').select('project_id, quantity_used, unit_cost'),
        supabase.from('project_workforce_assignments').select('project_id'),
        supabase.from('material_deliveries').select('project_id'),
      ]);

      if (projectsRes.error) return { data: [], error: projectsRes.error.message };

      const projects = projectsRes.data || [];
      const poList = poRes.data || [];
      const useList = useRes.data || [];
      const assignList = assignRes.data || [];
      const delivList = delivRes.data || [];

      const rows: ProjectReportRow[] = projects.map((p: any) => {
        const pPOs = poList.filter((po: any) => po.project_id === p.id);
        let poTotal = 0;
        pPOs.forEach((po: any) => {
          const c = po.total_cost ?? po.subtotal;
          if (c != null && !isNaN(Number(c))) poTotal += Number(c);
        });

        const pUses = useList.filter((u: any) => u.project_id === p.id);
        let useTotal = 0;
        pUses.forEach((u: any) => {
          useTotal += (Number(u.quantity_used) || 0) * (Number(u.unit_cost) || 0);
        });

        const workersCount = assignList.filter((a: any) => a.project_id === p.id).length;
        const delivCount = delivList.filter((d: any) => d.project_id === p.id).length;

        return {
          id: p.id,
          code: p.project_code,
          name: p.name,
          status: p.status,
          startDate: p.start_date,
          contractValue: p.contract_value != null ? Number(p.contract_value) : null,
          assignedWorkersCount: workersCount,
          purchaseOrdersCount: pPOs.length,
          purchaseOrdersTotal: poTotal,
          materialUsageValue: useTotal,
          deliveriesCount: delivCount,
        };
      });

      return { data: rows, error: null };
    } catch (err) {
      return {
        data: [],
        error: err instanceof Error ? err.message : 'Failed to query project reports.',
      };
    }
  }

  /**
   * Generates Workforce Operational Report
   */
  static async getWorkforceReportData(): Promise<{
    data: WorkforceReportData | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const [wfRes, assignRes, attRes, prodRes, otRes, condRes] = await Promise.all([
        supabase.from('workforce_members').select('id, status, trade'),
        supabase.from('project_workforce_assignments').select('id, workforce_member_id'),
        supabase.from('attendance_records').select('id, status'),
        supabase.from('productivity_records').select('id'),
        supabase.from('overtime_requests').select('id, requested_hours'),
        supabase.from('conduct_records').select('id, severity'),
      ]);

      if (wfRes.error) return { data: null, error: wfRes.error.message };

      const wfList = wfRes.data || [];
      const totalRoster = wfList.length;
      let activeCount = 0;
      let inactiveCount = 0;
      let suspendedCount = 0;
      let terminatedCount = 0;
      const tradesBreakdown: Record<string, number> = {};

      wfList.forEach((w: any) => {
        if (w.status === 'active') activeCount++;
        else if (w.status === 'inactive') inactiveCount++;
        else if (w.status === 'suspended') suspendedCount++;
        else if (w.status === 'terminated') terminatedCount++;

        const tr = w.trade || 'Unassigned Trade';
        tradesBreakdown[tr] = (tradesBreakdown[tr] || 0) + 1;
      });

      const assignedUnique = new Set(
        (assignRes.data || []).map((a: any) => a.workforce_member_id)
      ).size;

      const attList = attRes.data || [];
      const attendanceSummary = {
        presentCount: attList.filter((a: any) => a.status === 'present').length,
        absentCount: attList.filter((a: any) => a.status === 'absent').length,
        lateCount: attList.filter((a: any) => a.status === 'late').length,
        leaveCount: attList.filter((a: any) => a.status === 'on_leave').length,
      };

      let overtimeHoursCount = 0;
      (otRes.data || []).forEach((o: any) => {
        overtimeHoursCount += Number(o.requested_hours) || 0;
      });

      return {
        data: {
          totalRoster,
          activeCount,
          inactiveCount,
          suspendedCount,
          terminatedCount,
          assignedCount: assignedUnique,
          tradesBreakdown,
          attendanceSummary,
          productivityRecordsCount: (prodRes.data || []).length,
          overtimeHoursCount,
          conductNoticesCount: (condRes.data || []).length,
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to query workforce report.',
      };
    }
  }

  /**
   * Generates Materials Operations Report
   */
  static async getMaterialReportData(): Promise<{
    data: MaterialReportData | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const [matRes, mrRes, poRes, delRes, recpRes, movRes, auditRes] = await Promise.all([
        supabase.from('materials').select('id, category, current_stock, reorder_level, status'),
        supabase.from('material_requests').select('id, status'),
        supabase.from('purchase_orders').select('id, status, total_cost, subtotal'),
        supabase.from('material_deliveries').select('id'),
        supabase.from('material_receipts').select('id'),
        supabase.from('material_stock_movements').select('id, movement_type'),
        supabase.from('material_reconciliations').select('id, variance_quantity'),
      ]);

      if (matRes.error) return { data: null, error: matRes.error.message };

      const matList = matRes.data || [];
      const totalMaterials = matList.length;
      let activeCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;
      const categoriesBreakdown: Record<string, number> = {};

      matList.forEach((m: any) => {
        if (m.status === 'active') activeCount++;
        const stock = Number(m.current_stock ?? 0);
        const reorder = Number(m.reorder_level ?? 0);
        if (stock <= 0) outOfStockCount++;
        else if (reorder > 0 && stock <= reorder) lowStockCount++;

        const cat = m.category || 'General';
        categoriesBreakdown[cat] = (categoriesBreakdown[cat] || 0) + 1;
      });

      const mrList = mrRes.data || [];
      const requisitionsSummary = {
        total: mrList.length,
        pending: mrList.filter((r: any) => ['submitted', 'draft', 'under_review'].includes(r.status))
          .length,
        approved: mrList.filter((r: any) => r.status === 'approved').length,
        fulfilled: mrList.filter((r: any) => r.status === 'fulfilled').length,
      };

      const poList = poRes.data || [];
      let totalPOValue = 0;
      let pendingPOApproval = 0;
      poList.forEach((po: any) => {
        const c = po.total_cost ?? po.subtotal;
        if (c != null && !isNaN(Number(c))) totalPOValue += Number(c);
        if (po.status === 'submitted' || po.status === 'draft') pendingPOApproval++;
      });

      const stockMovementTypesCount: Record<string, number> = {};
      (movRes.data || []).forEach((mov: any) => {
        const t = mov.movement_type || 'unclassified';
        stockMovementTypesCount[t] = (stockMovementTypesCount[t] || 0) + 1;
      });

      const audits = auditRes.data || [];
      let balancedAudits = 0;
      let varianceAudits = 0;
      let netVarianceQuantity = 0;
      audits.forEach((a: any) => {
        const v = Number(a.variance_quantity) || 0;
        netVarianceQuantity += v;
        if (Math.abs(v) < 0.0001) balancedAudits++;
        else varianceAudits++;
      });

      return {
        data: {
          totalMaterials,
          activeCount,
          lowStockCount,
          outOfStockCount,
          categoriesBreakdown,
          requisitionsSummary,
          procurementSummary: {
            totalOrders: poList.length,
            totalValue: totalPOValue,
            pendingApproval: pendingPOApproval,
          },
          deliveriesSummary: {
            totalDeliveries: (delRes.data || []).length,
            totalReceipts: (recpRes.data || []).length,
          },
          stockMovementTypesCount,
          reconciliationsSummary: {
            totalAudits: audits.length,
            balancedAudits,
            varianceAudits,
            netVarianceQuantity,
          },
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to query materials report.',
      };
    }
  }

  /**
   * Generates Financial & Cost Control Report
   */
  static async getFinancialReportData(): Promise<{
    data: FinancialReportData | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      const [projectsRes, poRes, reqRes, usageRes, supRes] = await Promise.all([
        supabase.from('projects').select('id, project_code, name, contract_value'),
        supabase
          .from('purchase_orders')
          .select('id, project_id, supplier_id, total_cost, subtotal, suppliers:supplier_id(name, supplier_code)'),
        supabase.from('project_material_requirements').select('id, project_id, estimated_total_cost'),
        supabase.from('material_usage_records').select('id, project_id, quantity_used, unit_cost'),
        supabase.from('suppliers').select('id, name, supplier_code'),
      ]);

      if (projectsRes.error) return { data: null, error: projectsRes.error.message };

      const projects = projectsRes.data || [];
      const poList = poRes.data || [];
      const reqList = reqRes.data || [];
      const usageList = usageRes.data || [];

      let totalContractValue = 0;
      let totalProcurementCommitted = 0;
      let totalRequirementsEstimate = 0;
      let totalUsageExpenditure = 0;

      const poByProject: Record<string, number> = {};
      const supCommitmentsMap: Record<
        string,
        { name: string; code: string; ordersCount: number; totalCommitted: number }
      > = {};

      poList.forEach((po: any) => {
        const c = po.total_cost ?? po.subtotal;
        const num = c != null && !isNaN(Number(c)) ? Number(c) : 0;
        totalProcurementCommitted += num;

        if (po.project_id) {
          poByProject[po.project_id] = (poByProject[po.project_id] || 0) + num;
        }

        const supObj = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
        const sId = supObj?.id || po.supplier_id || 'unknown';
        const sName = supObj?.name || 'Unassigned Supplier';
        const sCode = supObj?.supplier_code || 'VEND';

        if (!supCommitmentsMap[sId]) {
          supCommitmentsMap[sId] = { name: sName, code: sCode, ordersCount: 0, totalCommitted: 0 };
        }
        supCommitmentsMap[sId].ordersCount++;
        supCommitmentsMap[sId].totalCommitted += num;
      });

      const reqByProject: Record<string, number> = {};
      reqList.forEach((r: any) => {
        if (r.estimated_total_cost != null && !isNaN(Number(r.estimated_total_cost))) {
          const val = Number(r.estimated_total_cost);
          totalRequirementsEstimate += val;
          if (r.project_id) {
            reqByProject[r.project_id] = (reqByProject[r.project_id] || 0) + val;
          }
        }
      });

      const usageByProject: Record<string, number> = {};
      usageList.forEach((u: any) => {
        const val = (Number(u.quantity_used) || 0) * (Number(u.unit_cost) || 0);
        totalUsageExpenditure += val;
        if (u.project_id) {
          usageByProject[u.project_id] = (usageByProject[u.project_id] || 0) + val;
        }
      });

      const projectsBreakdown = projects.map((p: any) => {
        const cv = p.contract_value != null ? Number(p.contract_value) : null;
        if (cv != null) totalContractValue += cv;

        return {
          id: p.id,
          code: p.project_code,
          name: p.name,
          contractValue: cv,
          procurementCommitted: poByProject[p.id] || 0,
          requirementsEstimate: reqByProject[p.id] || 0,
          usageExpenditure: usageByProject[p.id] || 0,
        };
      });

      const supplierCommitments = Object.values(supCommitmentsMap).sort(
        (a, b) => b.totalCommitted - a.totalCommitted
      );

      return {
        data: {
          totalContractValue,
          totalProcurementCommitted,
          totalRequirementsEstimate,
          totalUsageExpenditure,
          projectsBreakdown,
          supplierCommitments,
        },
        error: null,
      };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to query financial report.',
      };
    }
  }

  /**
   * Utility to export dataset to CSV
   */
  static exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
    const escapeCell = (val: string | number) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvContent = [
      headers.map(escapeCell).join(','),
      ...rows.map((row) => row.map(escapeCell).join(',')),
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default ManagementReportsService;
