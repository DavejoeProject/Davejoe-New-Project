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

export interface SupervisorDashboardData {
  supervisorName: string;
  supervisorEmail: string;
  supervisorRole: string;
  kpis: {
    activeProjects: number;
    workforceOnSite: number;
    attendanceIssues: number;
    openSiteIssues: number;
  };
  projects: SupervisorProjectItem[];
  todayAttendance: AttendanceRecordItem[];
  todayProductivity: SupervisorProductivityItem[];
  openTasks: SupervisorTaskItem[];
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

      // 1. Fetch projects
      // First check if supervisor is assigned to specific projects in project_workforce_assignments
      // or if they created the projects.
      const { data: memberData } = await supabase
        .from('workforce_members')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      let assignedProjectIds: string[] = [];

      if (memberData?.id) {
        const { data: assignments } = await supabase
          .from('project_workforce_assignments')
          .select('project_id')
          .eq('workforce_member_id', memberData.id)
          .eq('is_active', true);

        if (assignments && assignments.length > 0) {
          assignedProjectIds = assignments.map((a: any) => a.project_id);
        }
      }

      // Query projects table
      let projQuery = supabase.from('projects').select('*');

      if (assignedProjectIds.length > 0) {
        projQuery = projQuery.in('id', assignedProjectIds);
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

      // Concurrently query workforce counts, today's attendance, and open tasks
      const [assignRes, attRes, taskRes] = await Promise.all([
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

      const formatted: SupervisorProjectItem[] = projectsList.map((p: any) => ({
        id: p.id,
        project_code: p.project_code || 'PRJ',
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

      // If no projects, return clean zeroes
      if (projectIds.length === 0) {
        return {
          data: {
            supervisorName,
            supervisorEmail: profile?.email || session.user.email || '',
            supervisorRole: 'Site Supervisor',
            kpis: {
              activeProjects: 0,
              workforceOnSite: 0,
              attendanceIssues: 0,
              openSiteIssues: 0,
            },
            projects: [],
            todayAttendance: [],
            todayProductivity: [],
            openTasks: [],
          },
          error: null,
        };
      }

      // 3. Query today's attendance records for supervisor projects
      const { records: attRecords } = await AttendanceService.getTodayAttendance();
      const filteredAttendance = attRecords.filter((r) => projectIds.includes(r.project_id));

      // 4. Query today's productivity records for supervisor projects
      const { data: prodData } = await supabase
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
        .order('created_at', { ascending: false });

      const todayProductivity: SupervisorProductivityItem[] = (prodData || []).map((p: any) => ({
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

      // 5. Query open site issues & tasks from project_tasks
      const { data: taskData } = await supabase
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
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      const openTasks: SupervisorTaskItem[] = (taskData || []).map((t: any) => ({
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

      // Calculate restrained live KPIs
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
      ).length || projects.length;

      return {
        data: {
          supervisorName,
          supervisorEmail: profile?.email || session.user.email || '',
          supervisorRole: 'Site Supervisor',
          kpis: {
            activeProjects: activeProjectsCount,
            workforceOnSite,
            attendanceIssues,
            openSiteIssues: openTasks.length,
          },
          projects,
          todayAttendance: filteredAttendance,
          todayProductivity,
          openTasks,
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
