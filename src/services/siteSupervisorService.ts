import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { AttendanceService, AttendanceRecordItem, getNigerianTodayIso } from './attendanceService';
import { formatNigerianDate } from './materialsService';

export interface SupervisorProjectItem {
  id: string;
  project_code: string;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  expected_completion_date: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  contract_value: number | null;
  workforce_count: number;
  today_attendance_count: number;
  open_tasks_count: number;
  pending_requests_count?: number;
  open_qc_findings_count?: number;
}

export interface SupervisorTaskItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
}

export interface SupervisorProductivityItem {
  id: string;
  project_id: string;
  workforce_member_id: string;
  work_date: string;
  unit_of_measure: string;
  count: number;
  notes: string | null;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
  workforce_members?: {
    id: string;
    workforce_code: string;
    trade: string;
    profiles?: {
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
}

export interface SupervisorAlert {
  id: string;
  type: 'attendance' | 'task' | 'material' | 'qc' | 'schedule';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  description: string;
  projectId?: string;
  projectName?: string;
  date?: string;
  actionLabel?: string;
  actionTarget?: string;
}

export interface SupervisorDailyReport {
  id: string;
  project_id: string;
  project_name?: string;
  project_code?: string;
  title: string;
  report_date: string;
  work_planned?: string;
  work_completed: string;
  areas_worked?: string;
  quantities_completed?: string;
  workforce_present?: number;
  materials_received?: string;
  materials_used?: string;
  delays_issues?: string;
  safety_concerns?: string;
  next_steps?: string;
  created_by: string;
  created_at: string;
  supervisor_name?: string;
}

export interface SupervisorMaterialRequestItem {
  id: string;
  project_id: string;
  project_name?: string;
  request_code: string | null;
  status: string;
  priority: string;
  requested_by: string;
  notes: string | null;
  created_at: string;
}

export interface SupervisorInspectionItem {
  id: string;
  project_id: string;
  project_name?: string;
  inspection_type: string;
  status: string;
  result: string | null;
  scheduled_date: string | null;
  created_at: string;
  findings_count: number;
  findings: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    created_at: string;
  }>;
}

export interface SupervisorKPIs {
  activeProjects: number;
  attentionProjects: number;
  workforceOnSite: number;
  attendanceIssues: number;
  openTasks: number;
  pendingMaterialRequests: number;
  openQcFindings: number;
  unresolvedSiteIssues: number;
}

export interface SupervisorDashboardData {
  supervisorName: string;
  supervisorEmail: string;
  supervisorRole: string;
  kpis: SupervisorKPIs;
  alerts: SupervisorAlert[];
  projects: SupervisorProjectItem[];
  todayAttendance: AttendanceRecordItem[];
  todayProductivity: SupervisorProductivityItem[];
  openTasks: SupervisorTaskItem[];
  materialRequests: SupervisorMaterialRequestItem[];
  inspections: SupervisorInspectionItem[];
  dailyReports: SupervisorDailyReport[];
}

export class SiteSupervisorService {
  /**
   * Resolves projects authorized for this supervisor.
   */
  static async getSupervisorProjects(userId: string): Promise<{
    projects: SupervisorProjectItem[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { projects: [], error: 'Database is not configured.' };
    }

    try {
      await ensureValidSession();

      // Check project_members table
      const { data: projMembers } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      let assignedProjectIds: string[] = (projMembers || []).map((pm: any) => pm.project_id);

      // Check workforce member link
      const { data: memberData } = await supabase
        .from('workforce_members')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (memberData?.id) {
        const { data: assignments } = await supabase
          .from('project_workforce_assignments')
          .select('project_id')
          .eq('workforce_member_id', memberData.id)
          .eq('is_active', true);

        if (assignments && assignments.length > 0) {
          const ids = assignments.map((a: any) => a.project_id);
          assignedProjectIds = Array.from(new Set([...assignedProjectIds, ...ids]));
        }
      }

      // Check projects created_by
      const { data: createdProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('created_by', userId);

      if (createdProjects && createdProjects.length > 0) {
        const ids = createdProjects.map((p: any) => p.id);
        assignedProjectIds = Array.from(new Set([...assignedProjectIds, ...ids]));
      }

      // Query projects table
      let projQuery = supabase.from('projects').select('*');

      // If specific projects are assigned to this supervisor, scope to them
      if (assignedProjectIds.length > 0) {
        projQuery = projQuery.in('id', assignedProjectIds);
      } else {
        // If no explicit assignment records exist yet, select active projects in progress
        projQuery = projQuery.in('status', ['active', 'in_progress', 'snagging', 'approved', 'on_hold']);
      }

      const { data: rawProjects, error: projErr } = await projQuery.order('name');
      if (projErr) {
        return { projects: [], error: projErr.message };
      }

      const projectsList = rawProjects || [];
      if (projectsList.length === 0) {
        return { projects: [], error: null };
      }

      const projectIds = projectsList.map((p: any) => p.id);
      const today = getNigerianTodayIso();

      // Concurrently query workforce counts, today's attendance, open tasks, material requests, and inspection findings
      const [assignRes, attRes, taskRes, reqRes, inspRes] = await Promise.all([
        supabase
          .from('project_workforce_assignments')
          .select('project_id')
          .in('project_id', projectIds)
          .eq('is_active', true),
        supabase
          .from('attendance_records')
          .select('project_id, status')
          .in('project_id', projectIds)
          .eq('attendance_date', today),
        supabase
          .from('project_tasks')
          .select('project_id')
          .in('project_id', projectIds)
          .neq('status', 'completed'),
        supabase
          .from('material_requests')
          .select('project_id, status')
          .in('project_id', projectIds)
          .in('status', ['submitted', 'under_review', 'draft']),
        supabase
          .from('technical_inspections')
          .select('project_id, status, result')
          .in('project_id', projectIds),
      ]);

      const workforceCountByProj: Record<string, number> = {};
      (assignRes.data || []).forEach((a: any) => {
        workforceCountByProj[a.project_id] = (workforceCountByProj[a.project_id] || 0) + 1;
      });

      const todayAttByProj: Record<string, number> = {};
      (attRes.data || []).forEach((att: any) => {
        if (att.status === 'present' || att.status === 'late') {
          todayAttByProj[att.project_id] = (todayAttByProj[att.project_id] || 0) + 1;
        }
      });

      const openTasksByProj: Record<string, number> = {};
      (taskRes.data || []).forEach((t: any) => {
        openTasksByProj[t.project_id] = (openTasksByProj[t.project_id] || 0) + 1;
      });

      const pendingRequestsByProj: Record<string, number> = {};
      (reqRes.data || []).forEach((r: any) => {
        pendingRequestsByProj[r.project_id] = (pendingRequestsByProj[r.project_id] || 0) + 1;
      });

      const qcIssuesByProj: Record<string, number> = {};
      (inspRes.data || []).forEach((i: any) => {
        if (i.result === 'failed' || i.status === 'rejected') {
          qcIssuesByProj[i.project_id] = (qcIssuesByProj[i.project_id] || 0) + 1;
        }
      });

      const formatted: SupervisorProjectItem[] = projectsList.map((p: any) => ({
        id: p.id,
        project_code: p.project_code || p.code || 'PRJ',
        name: p.name,
        description: p.description || null,
        status: p.status || 'active',
        start_date: p.start_date || null,
        expected_completion_date: p.expected_completion_date || null,
        address: p.address || null,
        city: p.city || null,
        state: p.state || null,
        contract_value: p.contract_value != null ? Number(p.contract_value) : null,
        workforce_count: workforceCountByProj[p.id] || 0,
        today_attendance_count: todayAttByProj[p.id] || 0,
        open_tasks_count: openTasksByProj[p.id] || 0,
        pending_requests_count: pendingRequestsByProj[p.id] || 0,
        open_qc_findings_count: qcIssuesByProj[p.id] || 0,
      }));

      return { projects: formatted, error: null };
    } catch (err: any) {
      return {
        projects: [],
        error: err instanceof Error ? err.message : 'Failed to query supervisor projects.',
      };
    }
  }

  /**
   * Comprehensive operational dashboard data for Site Supervisor
   */
  static async getSupervisorDashboard(userId: string): Promise<{
    data: SupervisorDashboardData | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) {
        return { data: null, error: 'Session is not authenticated.' };
      }

      // 1. Fetch Supervisor Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, display_name, email')
        .eq('id', userId)
        .maybeSingle();

      const supervisorName =
        profile?.display_name ||
        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
        session.user.email?.split('@')[0] ||
        'Site Supervisor';

      // 2. Fetch Projects
      const { projects, error: projErr } = await this.getSupervisorProjects(userId);
      if (projErr) return { data: null, error: projErr };

      const projectIds = projects.map((p) => p.id);
      const today = getNigerianTodayIso();

      if (projectIds.length === 0) {
        return {
          data: {
            supervisorName,
            supervisorEmail: profile?.email || session.user.email || '',
            supervisorRole: 'Site Supervisor',
            kpis: {
              activeProjects: 0,
              attentionProjects: 0,
              workforceOnSite: 0,
              attendanceIssues: 0,
              openTasks: 0,
              pendingMaterialRequests: 0,
              openQcFindings: 0,
              unresolvedSiteIssues: 0,
            },
            alerts: [],
            projects: [],
            todayAttendance: [],
            todayProductivity: [],
            openTasks: [],
            materialRequests: [],
            inspections: [],
            dailyReports: [],
          },
          error: null,
        };
      }

      // Concurrently query all supervisor domain data
      const [
        attendanceRes,
        prodRes,
        taskRes,
        matReqRes,
        inspRes,
        reportsRes,
      ] = await Promise.all([
        AttendanceService.getTodayAttendance(),
        supabase
          .from('productivity_records')
          .select(`
            id,
            project_id,
            workforce_member_id,
            work_date,
            unit_of_measure,
            count,
            notes,
            created_at,
            projects:project_id ( id, name, project_code ),
            workforce_members:workforce_member_id (
              id,
              workforce_code,
              trade,
              profiles:profiles!workforce_members_profile_id_fkey ( id, display_name, first_name, last_name )
            )
          `)
          .in('project_id', projectIds)
          .eq('work_date', today)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_tasks')
          .select(`
            id,
            project_id,
            title,
            description,
            status,
            priority,
            assigned_to,
            due_date,
            completed_at,
            created_at,
            projects:project_id ( id, name, project_code )
          `)
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_requests')
          .select(`
            id,
            project_id,
            request_code,
            status,
            priority,
            requested_by,
            notes,
            created_at,
            projects:project_id ( id, name, project_code )
          `)
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('technical_inspections')
          .select(`
            id,
            project_id,
            inspection_type,
            status,
            result,
            scheduled_date,
            created_at,
            projects:project_id ( id, name, project_code ),
            inspection_findings ( id, title, description, severity, status, created_at )
          `)
          .in('project_id', projectIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('project_notes')
          .select(`
            id,
            project_id,
            title,
            content,
            note_type,
            created_by,
            created_at,
            projects:project_id ( id, name, project_code )
          `)
          .in('project_id', projectIds)
          .eq('note_type', 'daily_report')
          .order('created_at', { ascending: false }),
      ]);

      // 3. Today's Attendance filtered to supervisor projects
      const filteredAttendance = (attendanceRes.records || []).filter((r) =>
        projectIds.includes(r.project_id)
      );

      // 4. Productivity
      const todayProductivity: SupervisorProductivityItem[] = (prodRes.data || []).map((p: any) => ({
        id: p.id,
        project_id: p.project_id,
        workforce_member_id: p.workforce_member_id,
        work_date: p.work_date,
        unit_of_measure: p.unit_of_measure || 'units',
        count: p.count != null ? Number(p.count) : 0,
        notes: p.notes || null,
        created_at: p.created_at,
        projects: p.projects || null,
        workforce_members: p.workforce_members || null,
      }));

      // 5. Tasks
      const allTasks: SupervisorTaskItem[] = (taskRes.data || []).map((t: any) => ({
        id: t.id,
        project_id: t.project_id,
        title: t.title,
        description: t.description || null,
        status: t.status || 'pending',
        priority: t.priority || 'medium',
        assigned_to: t.assigned_to || null,
        due_date: t.due_date || null,
        completed_at: t.completed_at || null,
        created_at: t.created_at,
        projects: t.projects || null,
      }));
      const openTasks = allTasks.filter((t) => t.status !== 'completed');

      // 6. Material Requests
      const materialRequests: SupervisorMaterialRequestItem[] = (matReqRes.data || []).map((r: any) => ({
        id: r.id,
        project_id: r.project_id,
        project_name: r.projects?.name || 'Project',
        request_code: r.request_code || `REQ-${r.id.slice(0, 8)}`,
        status: r.status || 'submitted',
        priority: r.priority || 'normal',
        requested_by: r.requested_by,
        notes: r.notes || null,
        created_at: r.created_at,
      }));
      const pendingMaterialRequests = materialRequests.filter((r) =>
        ['submitted', 'under_review', 'draft'].includes(r.status.toLowerCase())
      );

      // 7. Inspections & QC Findings
      const inspections: SupervisorInspectionItem[] = (inspRes.data || []).map((i: any) => ({
        id: i.id,
        project_id: i.project_id,
        project_name: i.projects?.name || 'Project',
        inspection_type: i.inspection_type || 'General QC',
        status: i.status || 'scheduled',
        result: i.result || null,
        scheduled_date: i.scheduled_date || null,
        created_at: i.created_at,
        findings_count: Array.isArray(i.inspection_findings) ? i.inspection_findings.length : 0,
        findings: Array.isArray(i.inspection_findings) ? i.inspection_findings : [],
      }));

      let openQcFindingsCount = 0;
      inspections.forEach((i) => {
        i.findings.forEach((f) => {
          if (f.status === 'open' || f.status === 'rectification_required') {
            openQcFindingsCount++;
          }
        });
      });

      // 8. Daily Reports (stored in project_notes with note_type = 'daily_report')
      const dailyReports: SupervisorDailyReport[] = (reportsRes.data || []).map((rn: any) => {
        let parsed = { work_completed: rn.content };
        try {
          if (rn.content && rn.content.startsWith('{')) {
            parsed = JSON.parse(rn.content);
          }
        } catch {
          // Plain text content
        }

        return {
          id: rn.id,
          project_id: rn.project_id,
          project_name: rn.projects?.name || 'Project',
          project_code: rn.projects?.project_code || 'PRJ',
          title: rn.title || 'Daily Site Report',
          report_date: formatNigerianDate(rn.created_at),
          work_completed: parsed.work_completed || rn.content || '',
          work_planned: (parsed as any).work_planned,
          areas_worked: (parsed as any).areas_worked,
          quantities_completed: (parsed as any).quantities_completed,
          workforce_present: (parsed as any).workforce_present,
          materials_received: (parsed as any).materials_received,
          materials_used: (parsed as any).materials_used,
          delays_issues: (parsed as any).delays_issues,
          safety_concerns: (parsed as any).safety_concerns,
          next_steps: (parsed as any).next_steps,
          created_by: rn.created_by,
          created_at: rn.created_at,
        };
      });

      // KPI Calculations
      let workforceOnSite = 0;
      let attendanceIssues = 0;

      for (const a of filteredAttendance) {
        if (a.status === 'present' || a.status === 'late') {
          if (!a.is_clocked_out) {
            workforceOnSite++;
          }
        }
        if (a.status === 'absent' || a.status === 'late') {
          attendanceIssues++;
        }
      }

      const activeProjectsCount = projects.filter(
        (p) => p.status === 'active' || p.status === 'in_progress'
      ).length;

      const attentionProjectsCount = projects.filter((p) => {
        const s = (p.status || '').toLowerCase();
        return s === 'on_hold' || s === 'snagging' || (p.open_tasks_count && p.open_tasks_count > 3);
      }).length;

      const unresolvedSiteIssues = openTasks.filter(
        (t) => t.priority === 'critical' || t.priority === 'high'
      ).length;

      const kpis: SupervisorKPIs = {
        activeProjects: activeProjectsCount,
        attentionProjects: attentionProjectsCount,
        workforceOnSite,
        attendanceIssues,
        openTasks: openTasks.length,
        pendingMaterialRequests: pendingMaterialRequests.length,
        openQcFindings: openQcFindingsCount,
        unresolvedSiteIssues,
      };

      // Generate structured site-level alerts
      const alerts: SupervisorAlert[] = [];

      // Alert 1: Unresolved critical site issues
      openTasks
        .filter((t) => t.priority === 'critical' || t.priority === 'high')
        .slice(0, 3)
        .forEach((t) => {
          alerts.push({
            id: `alert-task-${t.id}`,
            type: 'task',
            severity: t.priority === 'critical' ? 'danger' : 'warning',
            title: `Critical Site Task: ${t.title}`,
            description: t.description || 'Action required immediately by site supervisor.',
            projectId: t.project_id,
            projectName: t.projects?.name,
            date: t.due_date || t.created_at,
            actionLabel: 'View Task',
            actionTarget: 'issues',
          });
        });

      // Alert 2: Attendance exceptions today
      if (attendanceIssues > 0) {
        alerts.push({
          id: `alert-att-${today}`,
          type: 'attendance',
          severity: 'warning',
          title: `Attendance Exceptions: ${attendanceIssues} absent / late workers`,
          description: `Discrepancies identified on site today. Review muster roll and confirm deployment.`,
          date: today,
          actionLabel: 'Review Muster',
          actionTarget: 'attendance',
        });
      }

      // Alert 3: Pending Material Requisitions
      if (pendingMaterialRequests.length > 0) {
        alerts.push({
          id: `alert-mat-pending`,
          type: 'material',
          severity: 'info',
          title: `${pendingMaterialRequests.length} Material Requests Pending Approval`,
          description: `Site requisitions submitted to procurement / management for review.`,
          actionLabel: 'View Materials',
          actionTarget: 'materials',
        });
      }

      // Alert 4: Open QC Findings
      if (openQcFindingsCount > 0) {
        alerts.push({
          id: `alert-qc-open`,
          type: 'qc',
          severity: 'danger',
          title: `${openQcFindingsCount} Open QC Rectification Findings`,
          description: `Inspection defects flagged by technical officers awaiting site rectification.`,
          actionLabel: 'Audit Findings',
          actionTarget: 'inspections',
        });
      }

      return {
        data: {
          supervisorName,
          supervisorEmail: profile?.email || session.user.email || '',
          supervisorRole: 'Site Supervisor',
          kpis,
          alerts,
          projects,
          todayAttendance: filteredAttendance,
          todayProductivity,
          openTasks,
          materialRequests,
          inspections,
          dailyReports,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to query supervisor dashboard.',
      };
    }
  }

  /**
   * Fetches workers assigned to a specific project
   */
  static async getProjectWorkforce(projectId: string): Promise<{
    workers: Array<{
      id: string;
      workforce_code: string;
      name: string;
      trade: string;
      status: string;
      role_on_project: string | null;
      start_date: string | null;
    }>;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) return { workers: [], error: 'Database is not configured.' };

    try {
      await ensureValidSession();
      const { data, error } = await supabase
        .from('project_workforce_assignments')
        .select(`
          id,
          role_on_project,
          start_date,
          workforce_members:workforce_member_id (
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
          )
        `)
        .eq('project_id', projectId)
        .eq('is_active', true);

      if (error) return { workers: [], error: error.message };

      const workers = (data || []).map((item: any) => {
        const m = item.workforce_members;
        const prof = m?.profiles;
        const name =
          prof?.display_name ||
          `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
          `Artisan ${m?.workforce_code || '---'}`;

        return {
          id: m?.id || item.id,
          workforce_code: m?.workforce_code || '---',
          name,
          trade: m?.trade || 'Artisan',
          status: m?.status || 'active',
          role_on_project: item.role_on_project || null,
          start_date: item.start_date || null,
        };
      });

      return { workers, error: null };
    } catch (err: any) {
      return { workers: [], error: err instanceof Error ? err.message : 'Failed to load project workforce.' };
    }
  }

  /**
   * Submits a structured Daily Site Report using verified public.project_notes
   */
  static async submitDailySiteReport(payload: {
    projectId: string;
    title: string;
    reportDate: string;
    workPlanned?: string;
    workCompleted: string;
    areasWorked?: string;
    quantitiesCompleted?: string;
    workforcePresent?: number;
    materialsReceived?: string;
    materialsUsed?: string;
    delaysIssues?: string;
    safetyConcerns?: string;
    nextSteps?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) return { success: false, error: 'Session is not authenticated.' };

      if (!payload.projectId) return { success: false, error: 'Project is required.' };
      if (!payload.workCompleted.trim()) return { success: false, error: 'Work completed description is required.' };

      const structuredContent = JSON.stringify({
        report_date: payload.reportDate,
        work_planned: payload.workPlanned || null,
        work_completed: payload.workCompleted.trim(),
        areas_worked: payload.areasWorked || null,
        quantities_completed: payload.quantitiesCompleted || null,
        workforce_present: payload.workforcePresent != null ? Number(payload.workforcePresent) : null,
        materials_received: payload.materialsReceived || null,
        materials_used: payload.materialsUsed || null,
        delays_issues: payload.delaysIssues || null,
        safety_concerns: payload.safetyConcerns || null,
        next_steps: payload.nextSteps || null,
      });

      const { error } = await supabase.from('project_notes').insert({
        project_id: payload.projectId,
        title: payload.title.trim() || `Daily Site Report — ${payload.reportDate}`,
        content: structuredContent,
        note_type: 'daily_report',
        created_by: session.user.id,
      });

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to submit daily site report.',
      };
    }
  }

  /**
   * Log real daily productivity for a worker
   */
  static async logProductivity(payload: {
    projectId: string;
    workforceMemberId: string;
    workDate: string;
    count: number;
    unitOfMeasure: string;
    notes?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) return { success: false, error: 'Session is not authenticated.' };

      if (payload.count < 0) {
        return { success: false, error: 'Productivity count cannot be negative.' };
      }

      const { error } = await supabase.from('productivity_records').insert({
        project_id: payload.projectId,
        workforce_member_id: payload.workforceMemberId,
        work_date: payload.workDate,
        count: payload.count,
        unit_of_measure: payload.unitOfMeasure,
        notes: payload.notes || null,
      });

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to log productivity.' };
    }
  }

  /**
   * Report site issue / operational task
   */
  static async reportSiteIssue(payload: {
    projectId: string;
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    dueDate?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) return { success: false, error: 'Session is not authenticated.' };

      const { error } = await supabase.from('project_tasks').insert({
        project_id: payload.projectId,
        title: payload.title,
        description: payload.description || null,
        priority: payload.priority || 'medium',
        status: 'pending',
        due_date: payload.dueDate || null,
        created_by: session.user.id,
      });

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to report site issue.' };
    }
  }

  /**
   * Update progress status of a task
   */
  static async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  ): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      await ensureValidSession();
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase.from('project_tasks').update(updates).eq('id', taskId);
      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update task status.' };
    }
  }

  /**
   * Report safety / conduct notice
   */
  static async reportSafetyConduct(payload: {
    projectId: string;
    workforceMemberId: string;
    recordType: 'warning' | 'safety' | 'absence' | 'other';
    severity: 'minor' | 'major' | 'critical';
    description: string;
    actionTaken?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) return { success: false, error: 'Session is not authenticated.' };

      const { error } = await supabase.from('workforce_conduct_records').insert({
        project_id: payload.projectId,
        workforce_member_id: payload.workforceMemberId,
        record_type: payload.recordType,
        severity: payload.severity,
        description: payload.description,
        action_taken: payload.actionTaken || null,
        recorded_by: session.user.id,
      });

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to report safety/conduct.' };
    }
  }
}
