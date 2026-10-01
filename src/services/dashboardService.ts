import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';

// ==============================================================================
// FORMATTING HELPERS
// ==============================================================================

/**
 * Formats a numeric amount to Nigerian Naira with 2 decimal places.
 * Example: 2500000 -> "₦2,500,000.00", 0 -> "₦0.00"
 */
export function formatNaira(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount) || amount === 0) {
    return '₦0.00';
  }
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats count numbers cleanly without decimal places.
 * Example: 1250 -> "1,250", 0 -> "0"
 */
export function formatCount(count: number | null | undefined): string {
  if (count == null || isNaN(count) || count === 0) {
    return '0';
  }
  return count.toLocaleString('en-NG');
}

/**
 * Formats dates in a clean Nigerian-friendly enterprise format.
 * Example: "1 Oct 2026", "24 Jun 2025, 11:20 AM"
 */
export function formatDateNigerian(
  dateInput: string | Date | null | undefined,
  includeTime: boolean = false
): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);

    if (includeTime) {
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

// ==============================================================================
// DATA INTERFACES
// ==============================================================================

export interface ServiceResult<T> {
  data: T;
  error: string | null;
}

// Section 1: Executive KPIs
export interface ExecutiveKpis {
  activeProjects: number;
  totalProjects: number;
  totalWorkforce: number;
  pendingApprovals: number;
  projectCost: number;
  projectCostFormatted: string;
}

// Section 2: Project Performance
export interface ProjectPerformanceItem {
  id: string;
  name: string;
  code?: string;
  status: string;
  budget?: number;
  budgetFormatted?: string;
  actualCost?: number;
  actualCostFormatted?: string;
  progress?: number; // Only defined if the database actually has a real numeric progress value
  location?: string;
  client?: string;
  targetDate?: string;
}

export interface ProjectPerformanceData {
  projects: ProjectPerformanceItem[];
  totalCount: number;
  activeCount: number;
}

// Section 3: Pending Approvals
export interface ApprovalItem {
  id: string;
  type: string; // 'Material Request' | 'Purchase Order' | 'Overtime Request'
  reference: string;
  amount?: number;
  amountFormatted?: string;
  requester?: string;
  date: string;
  rawDate?: string;
  status: string;
  moduleKey: string;
  originalTable: string;
}

export interface PendingApprovalsData {
  items: ApprovalItem[];
  totalCount: number;
}

// Section 4: Alerts
export interface AlertItem {
  id: string;
  type: 'LOW STOCK' | 'OVERDUE PROJECT' | 'UNRESOLVED CONDUCT ISSUE' | 'MATERIAL LOSS' | 'RECONCILIATION VARIANCE' | string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp?: string;
  moduleKey?: string;
}

export interface AlertsData {
  alerts: AlertItem[];
  totalCount: number;
}

// Section 5: Workforce Snapshot
export interface WorkforceSnapshotData {
  activeWorkforce: number;
  attendanceToday: number;
  productivityRecords: number;
  pendingOvertime: number;
  openConductIssues: number;
}

// Section 6: Materials Snapshot
export interface MaterialsSnapshotData {
  totalMaterials: number;
  lowStockItems: number;
  pendingMaterialRequests: number;
  pendingProcurement: number;
  unreconciledMaterials: number;
  materialsValuation: number;
  materialsValuationFormatted: string;
}

// Section 7: Financial Control
export interface FinancialControlData {
  projectCost: number;
  projectCostFormatted: string;
  budgetTotal: number;
  budgetTotalFormatted: string;
  actualSpendTotal: number;
  actualSpendFormatted: string;
  procurementCost: number;
  procurementCostFormatted: string;
  variance: number;
  varianceFormatted: string;
}

// Section 8: Recent Activity
export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  rawDate?: string;
  type: string;
}

export interface RecentActivityData {
  activities: ActivityItem[];
}

// Aggregated Management Overview State
export interface ManagementOverviewState {
  kpis: ServiceResult<ExecutiveKpis>;
  projects: ServiceResult<ProjectPerformanceData>;
  approvals: ServiceResult<PendingApprovalsData>;
  alerts: ServiceResult<AlertsData>;
  workforce: ServiceResult<WorkforceSnapshotData>;
  materials: ServiceResult<MaterialsSnapshotData>;
  finances: ServiceResult<FinancialControlData>;
  activity: ServiceResult<RecentActivityData>;
}

// Backward-compatible Phase 7.1 types
export interface ProjectItem {
  id: string;
  name: string;
  location: string;
  progress: number;
  status: string;
  budget?: string;
  spent?: string;
  client?: string;
  siteSupervisor?: string;
  targetDate?: string;
  image?: string;
}

export interface AttentionItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  actionLabel?: string;
  module?: string;
  timestamp?: string;
  resolved?: boolean;
}

export interface ScheduleItem {
  id: string;
  day: string;
  month: string;
  title: string;
  location: string;
  time: string;
  status: string;
}

export interface DashboardData {
  kpis: {
    activeProjects: number;
    totalProjects: number;
    pendingApprovals: number;
    activeAlerts: number;
    totalWorkforce: number;
    onSiteToday: number;
    materialsValue: string;
    openInspections: number;
  };
  projects: ProjectItem[];
  recentActivities: ActivityItem[];
  attentionItems: AttentionItem[];
  workforceSnapshot: {
    total: number;
    present: number;
    late: number;
    absent: number;
  };
  financialSnapshot: {
    budget: string;
    spent: string;
    variance: string;
  };
}

export const EMPTY_DASHBOARD_DATA: DashboardData = {
  kpis: {
    activeProjects: 0,
    totalProjects: 0,
    pendingApprovals: 0,
    activeAlerts: 0,
    totalWorkforce: 0,
    onSiteToday: 0,
    materialsValue: '₦0.00',
    openInspections: 0,
  },
  projects: [],
  recentActivities: [],
  attentionItems: [],
  workforceSnapshot: {
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
  },
  financialSnapshot: {
    budget: '₦0.00',
    spent: '₦0.00',
    variance: '₦0.00',
  },
};

// ==============================================================================
// SERVICE IMPLEMENTATION
// ==============================================================================

export class DashboardService {
  /**
   * SECTION 1: EXECUTIVE KPI CARDS
   * Calculates live KPIs from Supabase:
   * 1. Active Projects
   * 2. Total Workforce
   * 3. Pending Approvals
   * 4. Project Cost / Current Spend
   */
  static async getExecutiveKpis(): Promise<ServiceResult<ExecutiveKpis>> {
    const defaultData: ExecutiveKpis = {
      activeProjects: 0,
      totalProjects: 0,
      totalWorkforce: 0,
      pendingApprovals: 0,
      projectCost: 0,
      projectCostFormatted: '₦0.00',
    };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const [projRes, wfRes, mrRes, poRes, otRes] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('workforce_members').select('*'),
        supabase.from('material_requests').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('overtime_requests').select('*'),
      ]);

      // If any essential table had a database error, capture it
      if (projRes.error) {
        return { data: defaultData, error: `Projects query error: ${projRes.error.message}` };
      }
      if (wfRes.error) {
        return { data: defaultData, error: `Workforce query error: ${wfRes.error.message}` };
      }

      const projects = projRes.data || [];
      const workforce = wfRes.data || [];
      const matRequests = mrRes.data || [];
      const purchaseOrders = poRes.data || [];
      const overtimeReqs = otRes.data || [];

      // 1. Active Projects: Count projects whose status represents active work
      const activeProjectsCount = projects.filter((p: any) => {
        const status = (p.status || '').toLowerCase().trim();
        return status !== 'completed' && status !== 'cancelled' && status !== 'archived';
      }).length;

      // 2. Total Workforce: Active workforce members
      const activeWfCount = workforce.filter((w: any) => {
        const s = (w.status || 'active').toLowerCase().trim();
        return s === 'active' || s === 'available' || s === 'assigned';
      }).length;

      // 3. Pending Approvals: Aggregated from workflow tables
      const pendingMr = matRequests.filter((r: any) => {
        const s = (r.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'submitted' || s === 'awaiting_approval';
      }).length;

      const pendingPo = purchaseOrders.filter((po: any) => {
        const s = (po.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'draft' || s === 'awaiting_approval';
      }).length;

      const pendingOt = overtimeReqs.filter((ot: any) => {
        const s = (ot.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'submitted';
      }).length;

      const totalApprovals = pendingMr + pendingPo + pendingOt;

      // 4. Project Cost / Current Spend from real database records
      let totalSpend = 0;
      for (const p of projects) {
        const costVal = p.actual_cost ?? p.spent ?? p.total_spent ?? p.budget ?? p.contract_sum;
        if (costVal != null && !isNaN(Number(costVal))) {
          totalSpend += Number(costVal);
        }
      }
      // Also add purchase orders actual spent if applicable
      for (const po of purchaseOrders) {
        const amount = po.total_amount ?? po.amount ?? po.total_cost;
        if (amount != null && !isNaN(Number(amount))) {
          totalSpend += Number(amount);
        }
      }

      return {
        data: {
          activeProjects: activeProjectsCount,
          totalProjects: projects.length,
          totalWorkforce: activeWfCount,
          pendingApprovals: totalApprovals,
          projectCost: totalSpend,
          projectCostFormatted: formatNaira(totalSpend),
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to fetch executive KPIs from database.',
      };
    }
  }

  /**
   * SECTION 2: PROJECT PERFORMANCE
   * Shows actual projects from Supabase projects table.
   * Only displays progress if real progress field exists.
   */
  static async getProjectPerformance(): Promise<ServiceResult<ProjectPerformanceData>> {
    const defaultData: ProjectPerformanceData = {
      projects: [],
      totalCount: 0,
      activeCount: 0,
    };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { data: defaultData, error: error.message };
      }

      const rows = data || [];
      const mappedProjects: ProjectPerformanceItem[] = rows.map((p: any) => {
        const rawBudget = p.budget ?? p.contract_sum ?? p.budget_amount;
        const rawSpent = p.actual_cost ?? p.spent ?? p.total_spent;
        const budgetNum = rawBudget != null && !isNaN(Number(rawBudget)) ? Number(rawBudget) : undefined;
        const spentNum = rawSpent != null && !isNaN(Number(rawSpent)) ? Number(rawSpent) : undefined;

        // ONLY display progress if a real numeric progress field exists in row
        let progressVal: number | undefined = undefined;
        if (typeof p.progress === 'number' && !isNaN(p.progress)) {
          progressVal = p.progress;
        } else if (typeof p.completion_percentage === 'number' && !isNaN(p.completion_percentage)) {
          progressVal = p.completion_percentage;
        }

        return {
          id: String(p.id),
          name: p.name || p.title || p.project_name || 'Untitled Project',
          code: p.code || p.project_code || p.reference || undefined,
          status: p.status || 'Active',
          budget: budgetNum,
          budgetFormatted: budgetNum != null ? formatNaira(budgetNum) : undefined,
          actualCost: spentNum,
          actualCostFormatted: spentNum != null ? formatNaira(spentNum) : undefined,
          progress: progressVal,
          location: p.location || p.site_address || p.site_location || undefined,
          client: p.client || p.client_name || undefined,
          targetDate: p.end_date || p.target_date || p.completion_date || undefined,
        };
      });

      const activeCount = mappedProjects.filter((p) => {
        const s = p.status.toLowerCase().trim();
        return s !== 'completed' && s !== 'cancelled' && s !== 'archived';
      }).length;

      return {
        data: {
          projects: mappedProjects,
          totalCount: mappedProjects.length,
          activeCount,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to fetch project performance records.',
      };
    }
  }

  /**
   * SECTION 3: PENDING APPROVALS
   * Aggregates real records requiring management action from:
   * - material_requests
   * - purchase_orders
   * - overtime_requests
   */
  static async getPendingApprovals(): Promise<ServiceResult<PendingApprovalsData>> {
    const defaultData: PendingApprovalsData = { items: [], totalCount: 0 };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const [mrRes, poRes, otRes] = await Promise.all([
        supabase.from('material_requests').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('overtime_requests').select('*'),
      ]);

      const items: ApprovalItem[] = [];

      // 1. Material Requests
      if (mrRes.data) {
        for (const req of mrRes.data as any[]) {
          const s = (req.status || '').toLowerCase().trim();
          if (s === 'pending' || s === 'submitted' || s === 'awaiting_approval') {
            const rawAmt = req.total_amount ?? req.estimated_cost ?? req.amount;
            const amtNum = rawAmt != null && !isNaN(Number(rawAmt)) ? Number(rawAmt) : undefined;

            items.push({
              id: String(req.id),
              type: 'Material Request',
              reference: req.code || req.request_number || req.reference || `MR-${String(req.id).slice(0, 6)}`,
              amount: amtNum,
              amountFormatted: amtNum != null ? formatNaira(amtNum) : undefined,
              requester: req.requester_name || req.requested_by || 'Site Team',
              date: formatDateNigerian(req.created_at || req.date),
              rawDate: req.created_at || req.date,
              status: req.status || 'Pending Approval',
              moduleKey: 'material-requests',
              originalTable: 'material_requests',
            });
          }
        }
      }

      // 2. Purchase Orders
      if (poRes.data) {
        for (const po of poRes.data as any[]) {
          const s = (po.status || '').toLowerCase().trim();
          if (s === 'pending' || s === 'draft' || s === 'awaiting_approval') {
            const rawAmt = po.total_amount ?? po.amount ?? po.total_cost;
            const amtNum = rawAmt != null && !isNaN(Number(rawAmt)) ? Number(rawAmt) : undefined;

            items.push({
              id: String(po.id),
              type: 'Purchase Order',
              reference: po.po_number || po.code || po.reference || `PO-${String(po.id).slice(0, 6)}`,
              amount: amtNum,
              amountFormatted: amtNum != null ? formatNaira(amtNum) : undefined,
              requester: po.vendor_name || po.supplier || po.created_by || 'Procurement',
              date: formatDateNigerian(po.created_at || po.issue_date),
              rawDate: po.created_at || po.issue_date,
              status: po.status || 'Pending Approval',
              moduleKey: 'procurement',
              originalTable: 'purchase_orders',
            });
          }
        }
      }

      // 3. Overtime Requests
      if (otRes.data) {
        for (const ot of otRes.data as any[]) {
          const s = (ot.status || '').toLowerCase().trim();
          if (s === 'pending' || s === 'submitted') {
            const rawAmt = ot.estimated_cost ?? ot.cost;
            const amtNum = rawAmt != null && !isNaN(Number(rawAmt)) ? Number(rawAmt) : undefined;

            items.push({
              id: String(ot.id),
              type: 'Overtime Request',
              reference: ot.reference || `OT-${String(ot.id).slice(0, 6)}`,
              amount: amtNum,
              amountFormatted: amtNum != null ? formatNaira(amtNum) : (ot.hours ? `${ot.hours} hrs` : undefined),
              requester: ot.member_name || ot.supervisor || 'Site Supervisor',
              date: formatDateNigerian(ot.created_at || ot.date),
              rawDate: ot.created_at || ot.date,
              status: ot.status || 'Pending Review',
              moduleKey: 'overtime',
              originalTable: 'overtime_requests',
            });
          }
        }
      }

      // Sort newest first
      items.sort((a, b) => {
        const da = a.rawDate ? new Date(a.rawDate).getTime() : 0;
        const db = b.rawDate ? new Date(b.rawDate).getTime() : 0;
        return db - da;
      });

      return {
        data: {
          items,
          totalCount: items.length,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to fetch pending approvals from database.',
      };
    }
  }

  /**
   * SECTION 4: ALERTS
   * Only displays actual system conditions:
   * - LOW STOCK (current_stock <= reorder_level)
   * - OVERDUE PROJECT (end_date < now() and status active)
   * - UNRESOLVED CONDUCT ISSUE (workforce_conduct_records where status = 'open')
   * - MATERIAL LOSS (material_losses where status = 'open' or 'reported')
   * - RECONCILIATION VARIANCE (material_reconciliations with variance != 0)
   */
  static async getManagementAlerts(): Promise<ServiceResult<AlertsData>> {
    const defaultData: AlertsData = { alerts: [], totalCount: 0 };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const [matRes, projRes, condRes, lossRes, recRes] = await Promise.all([
        supabase.from('materials').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('workforce_conduct_records').select('*'),
        supabase.from('material_losses').select('*'),
        supabase.from('material_reconciliations').select('*'),
      ]);

      const alerts: AlertItem[] = [];
      const now = new Date().getTime();

      // 1. Low Stock Alert
      if (matRes.data) {
        for (const m of matRes.data as any[]) {
          const current = m.current_stock ?? m.stock_quantity ?? m.quantity;
          const reorder = m.reorder_level ?? m.reorder_point ?? m.minimum_level;

          if (current != null && reorder != null && Number(current) <= Number(reorder)) {
            alerts.push({
              id: `stock-${m.id}`,
              type: 'LOW STOCK',
              title: `Low Stock: ${m.name || 'Material Item'}`,
              description: `Current balance (${current} ${m.unit || 'units'}) has reached or fallen below reorder threshold (${reorder}).`,
              severity: 'warning',
              moduleKey: 'stock',
            });
          }
        }
      }

      // 2. Overdue Project Alert
      if (projRes.data) {
        for (const p of projRes.data as any[]) {
          const status = (p.status || '').toLowerCase().trim();
          const targetDateStr = p.end_date || p.target_date || p.completion_date;

          if (targetDateStr && status !== 'completed' && status !== 'cancelled' && status !== 'archived') {
            const targetTime = new Date(targetDateStr).getTime();
            if (!isNaN(targetTime) && targetTime < now) {
              alerts.push({
                id: `overdue-${p.id}`,
                type: 'OVERDUE PROJECT',
                title: `Project Target Exceeded: ${p.name || 'Project'}`,
                description: `Scheduled target completion date was ${formatDateNigerian(targetDateStr)}. Status is ${p.status || 'Active'}.`,
                severity: 'critical',
                moduleKey: 'all-projects',
              });
            }
          }
        }
      }

      // 3. Unresolved Conduct Issue
      if (condRes.data) {
        for (const c of condRes.data as any[]) {
          const s = (c.status || 'open').toLowerCase().trim();
          if (s === 'open' || s === 'pending' || s === 'unresolved') {
            alerts.push({
              id: `conduct-${c.id}`,
              type: 'UNRESOLVED CONDUCT ISSUE',
              title: `Workforce Conduct: ${c.infraction_type || c.title || 'Infraction Reported'}`,
              description: c.description || 'Open conduct or safety violation pending management review.',
              severity: c.severity === 'high' || c.severity === 'critical' ? 'critical' : 'warning',
              moduleKey: 'conduct',
            });
          }
        }
      }

      // 4. Material Loss
      if (lossRes.data) {
        for (const l of lossRes.data as any[]) {
          const s = (l.status || 'open').toLowerCase().trim();
          if (s === 'open' || s === 'reported' || s === 'unresolved') {
            alerts.push({
              id: `loss-${l.id}`,
              type: 'MATERIAL LOSS',
              title: `Material Loss Incident: ${l.material_name || l.item_name || 'Site Loss'}`,
              description: `Reported loss of ${l.quantity || 0} ${l.unit || 'units'} pending investigation and write-off signoff.`,
              severity: 'warning',
              moduleKey: 'losses-returns',
            });
          }
        }
      }

      // 5. Reconciliation Variance
      if (recRes.data) {
        for (const r of recRes.data as any[]) {
          const variance = Number(r.variance ?? r.discrepancy ?? 0);
          if (variance !== 0) {
            alerts.push({
              id: `rec-${r.id}`,
              type: 'RECONCILIATION VARIANCE',
              title: `Stock Variance: ${r.material_name || 'Inventory Audit'}`,
              description: `Discrepancy of ${variance > 0 ? '+' : ''}${variance} detected during physical reconciliation.`,
              severity: 'critical',
              moduleKey: 'reconciliation',
            });
          }
        }
      }

      return {
        data: {
          alerts,
          totalCount: alerts.length,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to evaluate operational alerts.',
      };
    }
  }

  /**
   * SECTION 5: WORKFORCE SNAPSHOT
   * Metrics derived from:
   * - workforce_members
   * - attendance_records
   * - productivity_records
   * - overtime_requests
   * - workforce_conduct_records
   */
  static async getWorkforceSnapshot(): Promise<ServiceResult<WorkforceSnapshotData>> {
    const defaultData: WorkforceSnapshotData = {
      activeWorkforce: 0,
      attendanceToday: 0,
      productivityRecords: 0,
      pendingOvertime: 0,
      openConductIssues: 0,
    };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const [wfRes, attRes, prodRes, otRes, condRes] = await Promise.all([
        supabase.from('workforce_members').select('*'),
        supabase.from('attendance_records').select('*'),
        supabase.from('productivity_records').select('*'),
        supabase.from('overtime_requests').select('*'),
        supabase.from('workforce_conduct_records').select('*'),
      ]);

      if (wfRes.error) {
        return { data: defaultData, error: `Workforce query error: ${wfRes.error.message}` };
      }

      const workforce = wfRes.data || [];
      const attendance = attRes.data || [];
      const productivity = prodRes.data || [];
      const overtime = otRes.data || [];
      const conduct = condRes.data || [];

      // 1. Active Workforce
      const activeCount = workforce.filter((w: any) => {
        const s = (w.status || 'active').toLowerCase().trim();
        return s === 'active' || s === 'available' || s === 'assigned';
      }).length;

      // 2. Attendance Today
      const todayStr = new Date().toISOString().split('T')[0];
      const todayCount = attendance.filter((a: any) => {
        const attDate = a.date || a.attendance_date || (a.created_at ? a.created_at.split('T')[0] : '');
        return attDate === todayStr;
      }).length;

      // 3. Productivity Records
      const prodCount = productivity.length;

      // 4. Pending Overtime
      const pendingOtCount = overtime.filter((ot: any) => {
        const s = (ot.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'submitted';
      }).length;

      // 5. Open Conduct Issues
      const openConductCount = conduct.filter((c: any) => {
        const s = (c.status || 'open').toLowerCase().trim();
        return s === 'open' || s === 'pending' || s === 'unresolved';
      }).length;

      return {
        data: {
          activeWorkforce: activeCount,
          attendanceToday: todayCount,
          productivityRecords: prodCount,
          pendingOvertime: pendingOtCount,
          openConductIssues: openConductCount,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to fetch workforce snapshot from database.',
      };
    }
  }

  /**
   * SECTION 6: MATERIALS SNAPSHOT
   * Metrics derived from:
   * - materials
   * - material_requests
   * - purchase_orders
   * - material_deliveries
   * - material_losses
   * - material_returns
   * - material_reconciliations
   */
  static async getMaterialsSnapshot(): Promise<ServiceResult<MaterialsSnapshotData>> {
    const defaultData: MaterialsSnapshotData = {
      totalMaterials: 0,
      lowStockItems: 0,
      pendingMaterialRequests: 0,
      pendingProcurement: 0,
      unreconciledMaterials: 0,
      materialsValuation: 0,
      materialsValuationFormatted: '₦0.00',
    };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const [matRes, reqRes, poRes, recRes] = await Promise.all([
        supabase.from('materials').select('*'),
        supabase.from('material_requests').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('material_reconciliations').select('*'),
      ]);

      if (matRes.error) {
        return { data: defaultData, error: `Materials query error: ${matRes.error.message}` };
      }

      const materials = matRes.data || [];
      const requests = reqRes.data || [];
      const pos = poRes.data || [];
      const reconciliations = recRes.data || [];

      // Low stock count & total valuation
      let lowStockCount = 0;
      let totalValuation = 0;

      for (const m of materials as any[]) {
        const current = m.current_stock ?? m.stock_quantity ?? m.quantity;
        const reorder = m.reorder_level ?? m.reorder_point;
        const price = m.unit_price ?? m.price ?? m.cost;

        if (current != null && reorder != null && Number(current) <= Number(reorder)) {
          lowStockCount++;
        }

        if (current != null && price != null && !isNaN(Number(current)) && !isNaN(Number(price))) {
          totalValuation += Number(current) * Number(price);
        }
      }

      // Pending material requests
      const pendingReqCount = requests.filter((r: any) => {
        const s = (r.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'submitted' || s === 'awaiting_approval';
      }).length;

      // Pending procurement orders
      const pendingPoCount = pos.filter((po: any) => {
        const s = (po.status || '').toLowerCase().trim();
        return s === 'pending' || s === 'draft' || s === 'awaiting_approval';
      }).length;

      // Unreconciled materials with variance
      const unreconciledCount = reconciliations.filter((rec: any) => {
        const v = Number(rec.variance ?? rec.discrepancy ?? 0);
        return v !== 0;
      }).length;

      return {
        data: {
          totalMaterials: materials.length,
          lowStockItems: lowStockCount,
          pendingMaterialRequests: pendingReqCount,
          pendingProcurement: pendingPoCount,
          unreconciledMaterials: unreconciledCount,
          materialsValuation: totalValuation,
          materialsValuationFormatted: formatNaira(totalValuation),
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to fetch materials snapshot from database.',
      };
    }
  }

  /**
   * SECTION 7: FINANCIAL CONTROL
   * Derives real financial figures from:
   * - projects
   * - purchase_orders
   */
  static async getFinancialSummary(): Promise<ServiceResult<FinancialControlData>> {
    const defaultData: FinancialControlData = {
      projectCost: 0,
      projectCostFormatted: '₦0.00',
      budgetTotal: 0,
      budgetTotalFormatted: '₦0.00',
      actualSpendTotal: 0,
      actualSpendFormatted: '₦0.00',
      procurementCost: 0,
      procurementCostFormatted: '₦0.00',
      variance: 0,
      varianceFormatted: '₦0.00',
    };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const [projRes, poRes] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('purchase_orders').select('*'),
      ]);

      if (projRes.error) {
        return { data: defaultData, error: `Financial records query error: ${projRes.error.message}` };
      }

      const projects = projRes.data || [];
      const pos = poRes.data || [];

      let totalBudget = 0;
      let totalActualSpend = 0;
      let totalProcurement = 0;

      for (const p of projects as any[]) {
        const b = p.budget ?? p.contract_sum ?? p.budget_amount;
        if (b != null && !isNaN(Number(b))) totalBudget += Number(b);

        const a = p.actual_cost ?? p.spent ?? p.total_spent;
        if (a != null && !isNaN(Number(a))) totalActualSpend += Number(a);
      }

      for (const po of pos as any[]) {
        const amt = po.total_amount ?? po.amount ?? po.total_cost;
        if (amt != null && !isNaN(Number(amt))) totalProcurement += Number(amt);
      }

      const variance = totalBudget - totalActualSpend;

      return {
        data: {
          projectCost: totalActualSpend,
          projectCostFormatted: formatNaira(totalActualSpend),
          budgetTotal: totalBudget,
          budgetTotalFormatted: formatNaira(totalBudget),
          actualSpendTotal: totalActualSpend,
          actualSpendFormatted: formatNaira(totalActualSpend),
          procurementCost: totalProcurement,
          procurementCostFormatted: formatNaira(totalProcurement),
          variance,
          varianceFormatted: formatNaira(variance),
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to fetch financial summary from database.',
      };
    }
  }

  /**
   * SECTION 8: RECENT ACTIVITY
   * Aggregates real operational events from actual database records:
   * - projects
   * - material_requests
   * - purchase_orders
   * - attendance_records
   * - material_deliveries
   * - workforce_conduct_records
   */
  static async getRecentActivity(): Promise<ServiceResult<RecentActivityData>> {
    const defaultData: RecentActivityData = { activities: [] };

    if (!isSupabaseConfigured) {
      return { data: defaultData, error: 'Database connection is not configured.' };
    }

    try {
      const [projRes, mrRes, poRes, delRes, condRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('material_requests').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('material_deliveries').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('workforce_conduct_records').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      const activities: ActivityItem[] = [];

      // 1. Projects created
      if (projRes.data) {
        for (const p of projRes.data as any[]) {
          activities.push({
            id: `proj-${p.id}`,
            title: `Project registered: ${p.name || 'New Project'}`,
            subtitle: p.location ? `Site: ${p.location}` : 'Project portfolio',
            timestamp: formatDateNigerian(p.created_at, true),
            rawDate: p.created_at,
            type: 'project',
          });
        }
      }

      // 2. Material requests created
      if (mrRes.data) {
        for (const mr of mrRes.data as any[]) {
          activities.push({
            id: `mr-${mr.id}`,
            title: `Material request created: ${mr.code || mr.request_number || 'Requisition'}`,
            subtitle: `Status: ${mr.status || 'Pending'}`,
            timestamp: formatDateNigerian(mr.created_at, true),
            rawDate: mr.created_at,
            type: 'material_request',
          });
        }
      }

      // 3. Purchase orders created
      if (poRes.data) {
        for (const po of poRes.data as any[]) {
          activities.push({
            id: `po-${po.id}`,
            title: `Purchase order logged: ${po.po_number || po.code || 'PO'}`,
            subtitle: po.total_amount ? `Total: ${formatNaira(Number(po.total_amount))}` : 'Procurement',
            timestamp: formatDateNigerian(po.created_at, true),
            rawDate: po.created_at,
            type: 'purchase_order',
          });
        }
      }

      // 4. Material deliveries
      if (delRes.data) {
        for (const del of delRes.data as any[]) {
          activities.push({
            id: `del-${del.id}`,
            title: `Material delivery logged: ${del.delivery_note_number || del.waybill_number || 'Delivery'}`,
            subtitle: del.site_name ? `Site: ${del.site_name}` : 'Logistics',
            timestamp: formatDateNigerian(del.created_at || del.delivery_date, true),
            rawDate: del.created_at || del.delivery_date,
            type: 'delivery',
          });
        }
      }

      // 5. Workforce conduct
      if (condRes.data) {
        for (const c of condRes.data as any[]) {
          activities.push({
            id: `cond-${c.id}`,
            title: `Conduct incident recorded: ${c.infraction_type || 'Incident'}`,
            subtitle: `Severity: ${c.severity || 'Normal'}`,
            timestamp: formatDateNigerian(c.created_at, true),
            rawDate: c.created_at,
            type: 'conduct',
          });
        }
      }

      // Sort newest first
      activities.sort((a, b) => {
        const da = a.rawDate ? new Date(a.rawDate).getTime() : 0;
        const db = b.rawDate ? new Date(b.rawDate).getTime() : 0;
        return db - da;
      });

      return {
        data: {
          activities: activities.slice(0, 8),
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: defaultData,
        error: err?.message || 'Failed to fetch recent activities from database.',
      };
    }
  }

  /**
   * AGGREGATED COMMAND CENTRE OVERVIEW
   * Fetches all live sections in parallel using Promise.all
   */
  static async getManagementOverview(): Promise<ManagementOverviewState> {
    const [kpis, projects, approvals, alerts, workforce, materials, finances, activity] =
      await Promise.all([
        this.getExecutiveKpis(),
        this.getProjectPerformance(),
        this.getPendingApprovals(),
        this.getManagementAlerts(),
        this.getWorkforceSnapshot(),
        this.getMaterialsSnapshot(),
        this.getFinancialSummary(),
        this.getRecentActivity(),
      ]);

    return {
      kpis,
      projects,
      approvals,
      alerts,
      workforce,
      materials,
      finances,
      activity,
    };
  }

  /**
   * Legacy method for Phase 7.1 compatibility
   */
  static async getDashboardData(): Promise<DashboardData> {
    const overview = await this.getManagementOverview();
    return {
      kpis: {
        activeProjects: overview.kpis.data.activeProjects,
        totalProjects: overview.kpis.data.totalProjects,
        pendingApprovals: overview.kpis.data.pendingApprovals,
        activeAlerts: overview.alerts.data.totalCount,
        totalWorkforce: overview.workforce.data.activeWorkforce,
        onSiteToday: overview.workforce.data.attendanceToday,
        materialsValue: overview.materials.data.materialsValuationFormatted,
        openInspections: 0,
      },
      projects: overview.projects.data.projects.map((p) => ({
        id: p.id,
        name: p.name,
        location: p.location || 'Site Location',
        progress: p.progress ?? 0,
        status: p.status,
        budget: p.budgetFormatted,
        spent: p.actualCostFormatted,
        client: p.client,
        targetDate: p.targetDate,
      })),
      recentActivities: overview.activity.data.activities,
      attentionItems: overview.approvals.data.items.map((i) => ({
        id: i.id,
        title: i.reference,
        description: `${i.type} awaiting approval. Requester: ${i.requester || 'Team'}`,
        severity: 'warning' as const,
        actionLabel: 'Review',
        module: i.moduleKey,
        timestamp: i.date,
      })),
      workforceSnapshot: {
        total: overview.workforce.data.activeWorkforce,
        present: overview.workforce.data.attendanceToday,
        late: 0,
        absent: 0,
      },
      financialSnapshot: {
        budget: overview.finances.data.budgetTotalFormatted,
        spent: overview.finances.data.actualSpendFormatted,
        variance: overview.finances.data.varianceFormatted,
      },
    };
  }

  /**
   * Action: Resolve an attention item
   */
  static async resolveAttentionItem(itemId: string, actionType: string): Promise<void> {
    await AuditLogger.log({
      action: `ceo.${actionType}`,
      module: 'management',
      recordId: itemId,
      newValues: { status: 'approved_by_ceo' },
    });
  }
}
