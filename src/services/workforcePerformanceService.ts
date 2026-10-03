import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Verified Enums
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'excused';
export type OvertimeStatus = 'requested' | 'approved' | 'rejected' | 'cancelled' | 'paid';
export type ConductSeverity = 'minor' | 'major' | 'critical';
export type ConductRecordType = 'warning' | 'safety' | 'absence' | 'other';

export const ALL_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'half_day',
  'excused',
];

export const ATTENDANCE_STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  present: {
    label: 'Present',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClasses: 'bg-[#01875F]',
  },
  late: {
    label: 'Late',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClasses: 'bg-amber-500',
  },
  half_day: {
    label: 'Half Day',
    badgeClasses: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClasses: 'bg-sky-500',
  },
  excused: {
    label: 'Excused',
    badgeClasses: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dotClasses: 'bg-indigo-500',
  },
  absent: {
    label: 'Absent',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClasses: 'bg-rose-500',
  },
};

export const OVERTIME_STATUS_CONFIG: Record<
  OvertimeStatus,
  { label: string; badgeClasses: string }
> = {
  requested: {
    label: 'Pending Review',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  approved: {
    label: 'Approved',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  paid: {
    label: 'Paid',
    badgeClasses: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export const CONDUCT_SEVERITY_CONFIG: Record<
  ConductSeverity,
  { label: string; badgeClasses: string }
> = {
  minor: {
    label: 'Minor',
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  major: {
    label: 'Major',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  critical: {
    label: 'Critical',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export interface WorkerSummaryProfile {
  id: string;
  workforce_code: string;
  trade: string;
  status?: string;
  profiles?: {
    id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface AttendanceItem {
  id: string;
  attendance_date: string;
  status: AttendanceStatus;
  recorded_by: string | null;
  created_at: string;
  project_id: string;
  workforce_member_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
  workforce_members?: WorkerSummaryProfile | null;
}

export interface ProductivityItem {
  id: string;
  work_date: string | null;
  unit_of_measure: string | null;
  count: number | null;
  notes: string | null;
  created_at: string;
  project_id: string;
  workforce_member_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
  workforce_members?: WorkerSummaryProfile | null;
}

export interface OvertimeItem {
  id: string;
  requested_hours: number;
  reason: string | null;
  status: OvertimeStatus;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  project_id: string;
  workforce_member_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
  workforce_members?: WorkerSummaryProfile | null;
}

export interface ConductItem {
  id: string;
  record_type: string;
  severity: ConductSeverity;
  description: string | null;
  action_taken: string | null;
  recorded_by: string | null;
  created_at: string;
  project_id: string;
  workforce_member_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
  workforce_members?: WorkerSummaryProfile | null;
}

export interface FilterOptions {
  projects: Array<{ id: string; name: string; project_code: string }>;
  workers: Array<{ id: string; name: string; code: string; trade: string }>;
}

export class WorkforcePerformanceService {
  /**
   * Helper to retrieve projects and workers list for filter dropdowns
   */
  static async getFilterOptions(): Promise<{ data: FilterOptions; error: string | null }> {
    const empty: FilterOptions = { projects: [], workers: [] };
    if (!isSupabaseConfigured) return { data: empty, error: 'Database is not configured.' };

    try {
      const [projRes, wfRes] = await Promise.all([
        supabase.from('projects').select('id, name, project_code').order('name'),
        supabase
          .from('workforce_members')
          .select(`
            id,
            workforce_code,
            trade,
            profiles:profiles!workforce_members_profile_id_fkey(id, display_name, first_name, last_name)
          `)
          .order('workforce_code'),
      ]);

      if (projRes.error) return { data: empty, error: projRes.error.message };
      if (wfRes.error) return { data: empty, error: wfRes.error.message };

      const projects = projRes.data || [];
      const workers = (wfRes.data || []).map((w: any) => {
        const prof = w.profiles;
        const name =
          prof?.display_name ||
          (prof?.first_name || prof?.last_name
            ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
            : `Artisan ${w.workforce_code}`);
        return {
          id: w.id,
          name,
          code: w.workforce_code,
          trade: w.trade,
        };
      });

      return { data: { projects, workers }, error: null };
    } catch (err: any) {
      return { data: empty, error: err?.message || 'Failed to load filter options.' };
    }
  }

  // =========================================================================
  // 1. ATTENDANCE CONTROL
  // =========================================================================

  static async getAttendanceData(filter?: {
    date?: string;
    projectId?: string;
    workforceId?: string;
    status?: string;
    search?: string;
  }): Promise<{
    records: AttendanceItem[];
    metrics: {
      totalToday: number;
      presentToday: number;
      absentToday: number;
      lateToday: number;
      halfDayToday: number;
      excusedToday: number;
      totalHistorical: number;
    };
    error: string | null;
  }> {
    const emptyMetrics = {
      totalToday: 0,
      presentToday: 0,
      absentToday: 0,
      lateToday: 0,
      halfDayToday: 0,
      excusedToday: 0,
      totalHistorical: 0,
    };

    if (!isSupabaseConfigured) {
      return { records: [], metrics: emptyMetrics, error: 'Database is not configured.' };
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      // Query real attendance records with joined projects and workforce_members
      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          attendance_date,
          status,
          recorded_by,
          created_at,
          project_id,
          workforce_member_id,
          projects (
            id,
            name,
            project_code
          ),
          workforce_members (
            id,
            workforce_code,
            trade,
            profiles:profiles!workforce_members_profile_id_fkey (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .order('attendance_date', { ascending: false });

      if (filter?.date && filter.date.trim()) {
        query = query.eq('attendance_date', filter.date.trim());
      }
      if (filter?.projectId && filter.projectId !== 'all') {
        query = query.eq('project_id', filter.projectId);
      }
      if (filter?.workforceId && filter.workforceId !== 'all') {
        query = query.eq('workforce_member_id', filter.workforceId);
      }
      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error) {
        return { records: [], metrics: emptyMetrics, error: error.message };
      }

      let allRecords = (data as unknown as AttendanceItem[]) || [];

      // Filter by search query if provided
      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        allRecords = allRecords.filter((rec) => {
          const worker = rec.workforce_members;
          const prof = worker?.profiles;
          const name = (prof?.display_name || `${prof?.first_name || ''} ${prof?.last_name || ''}`).toLowerCase();
          const code = (worker?.workforce_code || '').toLowerCase();
          const trade = (worker?.trade || '').toLowerCase();
          const projName = (rec.projects?.name || '').toLowerCase();
          const projCode = (rec.projects?.project_code || '').toLowerCase();
          return (
            name.includes(term) ||
            code.includes(term) ||
            trade.includes(term) ||
            projName.includes(term) ||
            projCode.includes(term)
          );
        });
      }

      // Calculate attendance metrics
      let totalToday = 0;
      let presentToday = 0;
      let absentToday = 0;
      let lateToday = 0;
      let halfDayToday = 0;
      let excusedToday = 0;

      for (const rec of allRecords) {
        if (rec.attendance_date === today) {
          totalToday++;
          const st = rec.status;
          if (st === 'present') presentToday++;
          else if (st === 'absent') absentToday++;
          else if (st === 'late') lateToday++;
          else if (st === 'half_day') halfDayToday++;
          else if (st === 'excused') excusedToday++;
        }
      }

      return {
        records: allRecords,
        metrics: {
          totalToday,
          presentToday,
          absentToday,
          lateToday,
          halfDayToday,
          excusedToday,
          totalHistorical: allRecords.length,
        },
        error: null,
      };
    } catch (err: any) {
      return { records: [], metrics: emptyMetrics, error: err?.message || 'Failed to load attendance.' };
    }
  }

  // =========================================================================
  // 2. PRODUCTIVITY CONTROL
  // =========================================================================

  static async getProductivityData(filter?: {
    date?: string;
    projectId?: string;
    workforceId?: string;
    search?: string;
  }): Promise<{
    records: ProductivityItem[];
    metrics: {
      totalRecords: number;
      uniqueWorkersCount: number;
      uniqueProjectsCount: number;
      unitsSummary: Array<{ unit: string; totalOutput: number; recordCount: number }>;
    };
    error: string | null;
  }> {
    const emptyMetrics = {
      totalRecords: 0,
      uniqueWorkersCount: 0,
      uniqueProjectsCount: 0,
      unitsSummary: [],
    };

    if (!isSupabaseConfigured) {
      return { records: [], metrics: emptyMetrics, error: 'Database is not configured.' };
    }

    try {
      let query = supabase
        .from('productivity_records')
        .select(`
          *,
          projects (
            id,
            name,
            project_code
          ),
          workforce_members (
            id,
            workforce_code,
            trade,
            profiles:profiles!workforce_members_profile_id_fkey (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filter?.date && filter.date.trim()) {
        query = query.eq('work_date', filter.date.trim());
      }
      if (filter?.projectId && filter.projectId !== 'all') {
        query = query.eq('project_id', filter.projectId);
      }
      if (filter?.workforceId && filter.workforceId !== 'all') {
        query = query.eq('workforce_member_id', filter.workforceId);
      }

      const { data, error } = await query;
      if (error) {
        return { records: [], metrics: emptyMetrics, error: error.message };
      }

      let allRecords = (data as unknown as ProductivityItem[]) || [];

      // Filter by search query
      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        allRecords = allRecords.filter((rec) => {
          const worker = rec.workforce_members;
          const prof = worker?.profiles;
          const name = (prof?.display_name || `${prof?.first_name || ''} ${prof?.last_name || ''}`).toLowerCase();
          const code = (worker?.workforce_code || '').toLowerCase();
          const trade = (worker?.trade || '').toLowerCase();
          const projName = (rec.projects?.name || '').toLowerCase();
          const notes = (rec.notes || '').toLowerCase();
          return (
            name.includes(term) ||
            code.includes(term) ||
            trade.includes(term) ||
            projName.includes(term) ||
            notes.includes(term)
          );
        });
      }

      const workerIds = new Set<string>();
      const projectIds = new Set<string>();
      const unitMap: Record<string, { totalOutput: number; recordCount: number }> = {};

      for (const rec of allRecords) {
        if (rec.workforce_member_id) workerIds.add(rec.workforce_member_id);
        if (rec.project_id) projectIds.add(rec.project_id);

        const unit = (rec.unit_of_measure || 'units').toLowerCase().trim();
        if (!unitMap[unit]) {
          unitMap[unit] = { totalOutput: 0, recordCount: 0 };
        }
        unitMap[unit].recordCount++;
        if (rec.count != null && !isNaN(Number(rec.count))) {
          unitMap[unit].totalOutput += Number(rec.count);
        }
      }

      const unitsSummary = Object.entries(unitMap).map(([unit, val]) => ({
        unit,
        totalOutput: val.totalOutput,
        recordCount: val.recordCount,
      }));

      return {
        records: allRecords,
        metrics: {
          totalRecords: allRecords.length,
          uniqueWorkersCount: workerIds.size,
          uniqueProjectsCount: projectIds.size,
          unitsSummary,
        },
        error: null,
      };
    } catch (err: any) {
      return { records: [], metrics: emptyMetrics, error: err?.message || 'Failed to load productivity.' };
    }
  }

  // =========================================================================
  // 3. OVERTIME CONTROL
  // =========================================================================

  static async getOvertimeData(filter?: {
    projectId?: string;
    workforceId?: string;
    status?: string;
    search?: string;
  }): Promise<{
    records: OvertimeItem[];
    metrics: {
      totalRequests: number;
      pendingRequests: number;
      approvedRequests: number;
      rejectedRequests: number;
      totalRequestedHours: number;
    };
    error: string | null;
  }> {
    const emptyMetrics = {
      totalRequests: 0,
      pendingRequests: 0,
      approvedRequests: 0,
      rejectedRequests: 0,
      totalRequestedHours: 0,
    };

    if (!isSupabaseConfigured) {
      return { records: [], metrics: emptyMetrics, error: 'Database is not configured.' };
    }

    try {
      let query = supabase
        .from('overtime_requests')
        .select(`
          id,
          requested_hours,
          reason,
          status,
          approved_by,
          approved_at,
          notes,
          created_at,
          project_id,
          workforce_member_id,
          projects (
            id,
            name,
            project_code
          ),
          workforce_members (
            id,
            workforce_code,
            trade,
            profiles:profiles!workforce_members_profile_id_fkey (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filter?.projectId && filter.projectId !== 'all') {
        query = query.eq('project_id', filter.projectId);
      }
      if (filter?.workforceId && filter.workforceId !== 'all') {
        query = query.eq('workforce_member_id', filter.workforceId);
      }
      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error) {
        return { records: [], metrics: emptyMetrics, error: error.message };
      }

      let allRecords = (data as unknown as OvertimeItem[]) || [];

      // Filter by search query
      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        allRecords = allRecords.filter((rec) => {
          const worker = rec.workforce_members;
          const prof = worker?.profiles;
          const name = (prof?.display_name || `${prof?.first_name || ''} ${prof?.last_name || ''}`).toLowerCase();
          const code = (worker?.workforce_code || '').toLowerCase();
          const projName = (rec.projects?.name || '').toLowerCase();
          const reason = (rec.reason || '').toLowerCase();
          return name.includes(term) || code.includes(term) || projName.includes(term) || reason.includes(term);
        });
      }

      let pendingRequests = 0;
      let approvedRequests = 0;
      let rejectedRequests = 0;
      let totalRequestedHours = 0;

      for (const rec of allRecords) {
        const st = rec.status;
        if (st === 'requested') pendingRequests++;
        else if (st === 'approved') approvedRequests++;
        else if (st === 'rejected') rejectedRequests++;

        if (rec.requested_hours != null && !isNaN(Number(rec.requested_hours))) {
          totalRequestedHours += Number(rec.requested_hours);
        }
      }

      return {
        records: allRecords,
        metrics: {
          totalRequests: allRecords.length,
          pendingRequests,
          approvedRequests,
          rejectedRequests,
          totalRequestedHours,
        },
        error: null,
      };
    } catch (err: any) {
      return { records: [], metrics: emptyMetrics, error: err?.message || 'Failed to load overtime.' };
    }
  }

  /**
   * Approves a real overtime request
   */
  static async approveOvertime(id: string, notes?: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) return { error: 'Database is not configured.' };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('overtime_requests')
        .update({
          status: 'approved',
          approved_by: user?.id || null,
          approved_at: now,
          notes: notes?.trim() || null,
        })
        .eq('id', id);

      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to approve overtime request.' };
    }
  }

  /**
   * Rejects a real overtime request
   */
  static async rejectOvertime(id: string, rejectionReason?: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) return { error: 'Database is not configured.' };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('overtime_requests')
        .update({
          status: 'rejected',
          approved_by: user?.id || null,
          approved_at: now,
          notes: rejectionReason?.trim() || 'Rejected by Management',
        })
        .eq('id', id);

      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to reject overtime request.' };
    }
  }

  // =========================================================================
  // 4. CONDUCT CONTROL
  // =========================================================================

  static async getConductData(filter?: {
    projectId?: string;
    workforceId?: string;
    severity?: string;
    recordType?: string;
    search?: string;
  }): Promise<{
    records: ConductItem[];
    metrics: {
      totalRecords: number;
      criticalCount: number;
      majorCount: number;
      minorCount: number;
    };
    error: string | null;
  }> {
    const emptyMetrics = {
      totalRecords: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
    };

    if (!isSupabaseConfigured) {
      return { records: [], metrics: emptyMetrics, error: 'Database is not configured.' };
    }

    try {
      let query = supabase
        .from('workforce_conduct_records')
        .select(`
          id,
          record_type,
          severity,
          description,
          action_taken,
          recorded_by,
          created_at,
          project_id,
          workforce_member_id,
          projects (
            id,
            name,
            project_code
          ),
          workforce_members (
            id,
            workforce_code,
            trade,
            profiles:profiles!workforce_members_profile_id_fkey (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (filter?.projectId && filter.projectId !== 'all') {
        query = query.eq('project_id', filter.projectId);
      }
      if (filter?.workforceId && filter.workforceId !== 'all') {
        query = query.eq('workforce_member_id', filter.workforceId);
      }
      if (filter?.severity && filter.severity !== 'all') {
        query = query.eq('severity', filter.severity);
      }
      if (filter?.recordType && filter.recordType !== 'all') {
        query = query.eq('record_type', filter.recordType);
      }

      const { data, error } = await query;
      if (error) {
        return { records: [], metrics: emptyMetrics, error: error.message };
      }

      let allRecords = (data as unknown as ConductItem[]) || [];

      // Filter by search query
      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        allRecords = allRecords.filter((rec) => {
          const worker = rec.workforce_members;
          const prof = worker?.profiles;
          const name = (prof?.display_name || `${prof?.first_name || ''} ${prof?.last_name || ''}`).toLowerCase();
          const code = (worker?.workforce_code || '').toLowerCase();
          const projName = (rec.projects?.name || '').toLowerCase();
          const desc = (rec.description || '').toLowerCase();
          const action = (rec.action_taken || '').toLowerCase();
          return (
            name.includes(term) ||
            code.includes(term) ||
            projName.includes(term) ||
            desc.includes(term) ||
            action.includes(term)
          );
        });
      }

      let criticalCount = 0;
      let majorCount = 0;
      let minorCount = 0;

      for (const rec of allRecords) {
        const sev = rec.severity;
        if (sev === 'critical') criticalCount++;
        else if (sev === 'major') majorCount++;
        else if (sev === 'minor') minorCount++;
      }

      return {
        records: allRecords,
        metrics: {
          totalRecords: allRecords.length,
          criticalCount,
          majorCount,
          minorCount,
        },
        error: null,
      };
    } catch (err: any) {
      return { records: [], metrics: emptyMetrics, error: err?.message || 'Failed to load conduct records.' };
    }
  }

  // =========================================================================
  // 5. ORGANIZATION-WIDE WORKFORCE PERFORMANCE CONTROL SUMMARY
  // =========================================================================

  static async getWorkforcePerformanceSummary(): Promise<{
    metrics: {
      totalWorkforce: number;
      activeWorkforce: number;
      assignedWorkforce: number;
      availableWorkforce: number;
      attendanceToday: number;
      productivityRecords: number;
      pendingOvertime: number;
      conductRecords: number;
    };
    projectBreakdown: Array<{
      projectId: string;
      projectName: string;
      projectCode: string;
      assignedCount: number;
      attendanceCount: number;
      productivityCount: number;
      pendingOvertimeCount: number;
      conductCount: number;
    }>;
    workerBreakdown: Array<{
      workforceId: string;
      workerName: string;
      code: string;
      trade: string;
      status: string;
      currentProject: string | null;
      currentProjectId: string | null;
      attendanceCount: number;
      productivityCount: number;
      overtimeCount: number;
      conductCount: number;
    }>;
    exceptions: {
      pendingOvertime: OvertimeItem[];
      criticalConduct: ConductItem[];
      availableWorkers: Array<{ id: string; name: string; code: string; trade: string }>;
    };
    error: string | null;
  }> {
    const emptyResult = {
      metrics: {
        totalWorkforce: 0,
        activeWorkforce: 0,
        assignedWorkforce: 0,
        availableWorkforce: 0,
        attendanceToday: 0,
        productivityRecords: 0,
        pendingOvertime: 0,
        conductRecords: 0,
      },
      projectBreakdown: [],
      workerBreakdown: [],
      exceptions: {
        pendingOvertime: [],
        criticalConduct: [],
        availableWorkers: [],
      },
      error: null,
    };

    if (!isSupabaseConfigured) {
      return { ...emptyResult, error: 'Database is not configured.' };
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch verified records concurrently
      const [membersRes, assignRes, attRes, prodRes, otRes, condRes, projRes] =
        await Promise.all([
          supabase
            .from('workforce_members')
            .select(`
              id,
              workforce_code,
              trade,
              status,
              profiles:profiles!workforce_members_profile_id_fkey(id, display_name, first_name, last_name, avatar_url)
            `),
          supabase
            .from('project_workforce_assignments')
            .select('id, project_id, workforce_member_id, is_active'),
          supabase
            .from('attendance_records')
            .select('id, attendance_date, status, project_id, workforce_member_id'),
          supabase
            .from('productivity_records')
            .select('id, work_date, count, unit_of_measure, project_id, workforce_member_id'),
          supabase
            .from('overtime_requests')
            .select(`
              id,
              requested_hours,
              reason,
              status,
              created_at,
              project_id,
              workforce_member_id,
              projects(id, name, project_code),
              workforce_members(id, workforce_code, trade, profiles!workforce_members_profile_id_fkey(id, display_name, first_name, last_name))
            `),
          supabase
            .from('workforce_conduct_records')
            .select(`
              id,
              record_type,
              severity,
              description,
              created_at,
              project_id,
              workforce_member_id,
              projects(id, name, project_code),
              workforce_members(id, workforce_code, trade, profiles!workforce_members_profile_id_fkey(id, display_name, first_name, last_name))
            `),
          supabase
            .from('projects')
            .select('id, name, project_code, status'),
        ]);

      const anyError =
        membersRes.error ||
        assignRes.error ||
        attRes.error ||
        prodRes.error ||
        otRes.error ||
        condRes.error ||
        projRes.error;

      if (anyError) {
        return { ...emptyResult, error: anyError.message };
      }

      const members = membersRes.data || [];
      const assignments = assignRes.data || [];
      const attendance = attRes.data || [];
      const productivity = prodRes.data || [];
      const overtime = (otRes.data as unknown as OvertimeItem[]) || [];
      const conduct = (condRes.data as unknown as ConductItem[]) || [];
      const projects = projRes.data || [];

      // 1. Overall Metrics
      const totalWorkforce = members.length;
      let activeWorkforce = 0;
      for (const m of members) {
        if ((m.status || '').toLowerCase() === 'active') activeWorkforce++;
      }

      const activeAssignmentsByMemberId: Record<string, string> = {};
      const activeAssignmentsByProjectId: Record<string, number> = {};

      for (const a of assignments) {
        if (a.is_active) {
          activeAssignmentsByMemberId[a.workforce_member_id] = a.project_id;
          activeAssignmentsByProjectId[a.project_id] =
            (activeAssignmentsByProjectId[a.project_id] || 0) + 1;
        }
      }

      const assignedWorkforce = Object.keys(activeAssignmentsByMemberId).length;
      let availableWorkforce = 0;
      const availableWorkersList: Array<{ id: string; name: string; code: string; trade: string }> = [];

      for (const m of members) {
        const isAct = (m.status || '').toLowerCase() === 'active';
        if (isAct && !activeAssignmentsByMemberId[m.id]) {
          availableWorkforce++;
          const prof = (m as any).profiles;
          const name =
            prof?.display_name ||
            `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
            `Artisan ${m.workforce_code}`;
          availableWorkersList.push({
            id: m.id,
            name,
            code: m.workforce_code,
            trade: m.trade,
          });
        }
      }

      const attendanceToday = attendance.filter((a) => a.attendance_date === today).length;
      const productivityRecords = productivity.length;
      const pendingOvertimeList = overtime.filter((o) => o.status === 'requested');
      const pendingOvertimeCount = pendingOvertimeList.length;
      const conductRecords = conduct.length;
      const criticalConductList = conduct.filter(
        (c) => c.severity === 'critical' || c.severity === 'major'
      );

      // 2. Project Breakdown
      const projMap: Record<
        string,
        {
          assignedCount: number;
          attendanceCount: number;
          productivityCount: number;
          pendingOvertimeCount: number;
          conductCount: number;
        }
      > = {};

      for (const p of projects) {
        projMap[p.id] = {
          assignedCount: activeAssignmentsByProjectId[p.id] || 0,
          attendanceCount: 0,
          productivityCount: 0,
          pendingOvertimeCount: 0,
          conductCount: 0,
        };
      }

      for (const a of attendance) {
        if (projMap[a.project_id]) projMap[a.project_id].attendanceCount++;
      }
      for (const prod of productivity) {
        if (projMap[prod.project_id]) projMap[prod.project_id].productivityCount++;
      }
      for (const ot of overtime) {
        if (ot.status === 'requested' && projMap[ot.project_id]) {
          projMap[ot.project_id].pendingOvertimeCount++;
        }
      }
      for (const c of conduct) {
        if (projMap[c.project_id]) projMap[c.project_id].conductCount++;
      }

      const projectBreakdown = projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        projectCode: p.project_code,
        assignedCount: projMap[p.id]?.assignedCount || 0,
        attendanceCount: projMap[p.id]?.attendanceCount || 0,
        productivityCount: projMap[p.id]?.productivityCount || 0,
        pendingOvertimeCount: projMap[p.id]?.pendingOvertimeCount || 0,
        conductCount: projMap[p.id]?.conductCount || 0,
      }));

      // 3. Worker Breakdown
      const workerMap: Record<
        string,
        { attendanceCount: number; productivityCount: number; overtimeCount: number; conductCount: number }
      > = {};

      for (const m of members) {
        workerMap[m.id] = {
          attendanceCount: 0,
          productivityCount: 0,
          overtimeCount: 0,
          conductCount: 0,
        };
      }

      for (const a of attendance) {
        if (workerMap[a.workforce_member_id]) workerMap[a.workforce_member_id].attendanceCount++;
      }
      for (const prod of productivity) {
        if (workerMap[prod.workforce_member_id]) workerMap[prod.workforce_member_id].productivityCount++;
      }
      for (const ot of overtime) {
        if (workerMap[ot.workforce_member_id]) workerMap[ot.workforce_member_id].overtimeCount++;
      }
      for (const c of conduct) {
        if (workerMap[c.workforce_member_id]) workerMap[c.workforce_member_id].conductCount++;
      }

      const projectsById: Record<string, { name: string; code: string }> = {};
      for (const p of projects) {
        projectsById[p.id] = { name: p.name, code: p.project_code };
      }

      const workerBreakdown = members.map((m: any) => {
        const prof = m.profiles;
        const name =
          prof?.display_name ||
          `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
          `Artisan ${m.workforce_code}`;
        const currProjId = activeAssignmentsByMemberId[m.id] || null;
        const currProj = currProjId ? projectsById[currProjId]?.name || 'Assigned Project' : null;

        return {
          workforceId: m.id,
          workerName: name,
          code: m.workforce_code,
          trade: m.trade,
          status: m.status,
          currentProject: currProj,
          currentProjectId: currProjId,
          attendanceCount: workerMap[m.id]?.attendanceCount || 0,
          productivityCount: workerMap[m.id]?.productivityCount || 0,
          overtimeCount: workerMap[m.id]?.overtimeCount || 0,
          conductCount: workerMap[m.id]?.conductCount || 0,
        };
      });

      return {
        metrics: {
          totalWorkforce,
          activeWorkforce,
          assignedWorkforce,
          availableWorkforce,
          attendanceToday,
          productivityRecords,
          pendingOvertime: pendingOvertimeCount,
          conductRecords,
        },
        projectBreakdown,
        workerBreakdown,
        exceptions: {
          pendingOvertime: pendingOvertimeList,
          criticalConduct: criticalConductList,
          availableWorkers: availableWorkersList,
        },
        error: null,
      };
    } catch (err: any) {
      return { ...emptyResult, error: err?.message || 'Failed to calculate performance summary.' };
    }
  }
}
