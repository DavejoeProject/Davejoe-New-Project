import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { getNigerianTodayIso } from './attendanceService';

export interface AssignedProjectSummary {
  project_id: string;
  project_code: string;
  name: string;
  description: string | null;
  project_type: string | null;
  status: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  client_name: string | null;
  client_contact_person: string | null;
  client_phone: string | null;
  client_email: string | null;
  assignment_id: string | null;
  workforce_member_id: string | null;
  role_on_project: string | null;
  assignment_start_date: string | null;
  assignment_end_date: string | null;
  assignment_notes: string | null;
  assigned_at: string | null;
  effective_start_date: string | null;
  can_clock_in_today: boolean;
  is_starting_today: boolean;
  is_upcoming: boolean;
  workforce_count: number;
  today_attendance_count: number;
  open_tasks_count: number;
  materials_count: number;
}

export interface AssignedProjectTeamMember {
  assignment_id: string;
  workforce_member_id: string;
  workforce_code: string;
  name: string;
  trade: string;
  role_on_project: string;
  start_date: string | null;
  end_date: string | null;
  phone: string | null;
  status: string;
}

export interface AssignedProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  deliverable?: string | null;
  required_materials?: string | null;
  required_tools?: string | null;
  required_ppe?: string | null;
  technical_specifications?: string | null;
  safety_instructions?: string | null;
  created_at: string;
}

export interface AssignedProjectMaterial {
  id: string;
  material_id: string;
  material_name: string;
  unit_of_measure: string;
  required_quantity: number;
  approved_quantity: number | null;
  purpose: string | null;
  status: string;
}

export interface AssignedProjectNote {
  id: string;
  title: string | null;
  content: string | null;
  note_type: string;
  created_at: string;
}

export interface AssignedProjectFullDetails {
  project: {
    id: string;
    project_code: string;
    name: string;
    description: string | null;
    project_type: string | null;
    status: string;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    start_date: string | null;
    expected_completion_date: string | null;
    actual_completion_date: string | null;
    client_name: string | null;
    client_contact_person: string | null;
    client_phone: string | null;
    client_email: string | null;
  };
  team: AssignedProjectTeamMember[];
  tasks: AssignedProjectTask[];
  materials: AssignedProjectMaterial[];
  notes: AssignedProjectNote[];
}

function normalizeDateIso(val: string | null | undefined): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

function computeScheduleFlags(
  assignmentStart: string | null,
  projectStart: string | null,
  status: string | null
) {
  const today = getNigerianTodayIso();
  const effective = normalizeDateIso(assignmentStart) || normalizeDateIso(projectStart);
  const statusLower = (status || 'in_progress').toLowerCase().trim();
  const closedStatuses = ['cancelled', 'closed', 'completed'];
  const isStartingToday = Boolean(effective && effective === today);
  const isUpcoming = Boolean(effective && effective > today);
  const canClockInToday = !isUpcoming && !closedStatuses.includes(statusLower);
  return {
    effective_start_date: effective,
    can_clock_in_today: canClockInToday,
    is_starting_today: isStartingToday,
    is_upcoming: isUpcoming,
  };
}

export class AssignedProjectsService {
  /**
   * Resolves ALL projects assigned to the currently authenticated user across
   * project_workforce_assignments (via ALL matching workforce_members rows) AND
   * project_members, using get_my_assigned_projects RPC first with resilient fallback.
   */
  static async getMyAssignedProjects(userId?: string): Promise<{
    projects: AssignedProjectSummary[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { projects: [], error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      const targetUserId = userId || session?.user?.id;
      if (!targetUserId) {
        return { projects: [], error: 'Not authenticated.' };
      }

      // 1. Primary path: Authoritative SECURITY DEFINER RPC
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_assigned_projects');
        if (!rpcErr && Array.isArray(rpcData)) {
          const normalized: AssignedProjectSummary[] = rpcData.map((row: any) => ({
            project_id: row.project_id,
            project_code: row.project_code || 'PRJ',
            name: row.name || 'Project',
            description: row.description || null,
            project_type: row.project_type || null,
            status: row.status || 'in_progress',
            address: row.address || null,
            city: row.city || null,
            state: row.state || null,
            country: row.country || null,
            start_date: row.start_date || null,
            expected_completion_date: row.expected_completion_date || null,
            actual_completion_date: row.actual_completion_date || null,
            client_name: row.client_name || null,
            client_contact_person: row.client_contact_person || null,
            client_phone: row.client_phone || null,
            client_email: row.client_email || null,
            assignment_id: row.assignment_id || null,
            workforce_member_id: row.workforce_member_id || null,
            role_on_project: row.role_on_project || null,
            assignment_start_date: row.assignment_start_date || null,
            assignment_end_date: row.assignment_end_date || null,
            assignment_notes: row.assignment_notes || null,
            assigned_at: row.assigned_at || null,
            effective_start_date: row.effective_start_date || null,
            can_clock_in_today: Boolean(row.can_clock_in_today),
            is_starting_today: Boolean(row.is_starting_today),
            is_upcoming: Boolean(row.is_upcoming),
            workforce_count: Number(row.workforce_count) || 0,
            today_attendance_count: Number(row.today_attendance_count) || 0,
            open_tasks_count: Number(row.open_tasks_count) || 0,
            materials_count: Number(row.materials_count) || 0,
          }));
          return { projects: normalized, error: null };
        }
      } catch {
        // Fall through to resilient direct queries if RPC not yet deployed
      }

      // 2. Fallback path: Direct multi-row query without .maybeSingle() traps
      const [{ data: wfByProfile }, { data: profileRow }, { data: pmRows }] = await Promise.all([
        supabase.from('workforce_members').select('id, trade, phone').eq('profile_id', targetUserId),
        supabase.from('profiles').select('id, phone').eq('id', targetUserId).maybeSingle(),
        supabase.from('project_members').select('id, project_id, role, created_at').eq('user_id', targetUserId),
      ]);

      const wfIdSet = new Set<string>((wfByProfile || []).map((w: any) => w.id));
      const userPhone = profileRow?.phone?.trim();
      if (userPhone) {
        const { data: wfByPhone } = await supabase
          .from('workforce_members')
          .select('id')
          .eq('phone', userPhone)
          .is('profile_id', null);
        (wfByPhone || []).forEach((w: any) => wfIdSet.add(w.id));
      }

      const wfIds = Array.from(wfIdSet);
      let pwaRows: any[] = [];
      if (wfIds.length > 0) {
        const { data: assignData } = await supabase
          .from('project_workforce_assignments')
          .select('id, project_id, workforce_member_id, role_on_project, start_date, end_date, notes, is_active, created_at')
          .in('workforce_member_id', wfIds)
          .eq('is_active', true);
        pwaRows = assignData || [];
      }

      const projectMetaMap = new Map<string, any>();
      for (const a of pwaRows) {
        if (!projectMetaMap.has(a.project_id)) {
          projectMetaMap.set(a.project_id, {
            assignment_id: a.id,
            workforce_member_id: a.workforce_member_id,
            role_on_project: a.role_on_project || null,
            assignment_start_date: a.start_date || null,
            assignment_end_date: a.end_date || null,
            assignment_notes: a.notes || null,
            assigned_at: a.created_at || null,
          });
        }
      }

      for (const pm of pmRows || []) {
        if (!projectMetaMap.has(pm.project_id)) {
          projectMetaMap.set(pm.project_id, {
            assignment_id: pm.id || null,
            workforce_member_id: wfIds[0] || null,
            role_on_project: pm.role || null,
            assignment_start_date: null,
            assignment_end_date: null,
            assignment_notes: null,
            assigned_at: pm.created_at || null,
          });
        }
      }

      const projectIds = Array.from(projectMetaMap.keys());
      if (projectIds.length === 0) {
        return { projects: [], error: null };
      }

      const { data: rawProjects, error: projErr } = await supabase
        .from('projects')
        .select(`
          *,
          clients ( id, name, contact_person, phone, email )
        `)
        .in('id', projectIds)
        .order('name');

      if (projErr) {
        return { projects: [], error: projErr.message };
      }

      const today = getNigerianTodayIso();
      const [wfCountsRes, attCountsRes, taskCountsRes, matCountsRes] = await Promise.all([
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
          .select('project_id, status')
          .in('project_id', projectIds),
        supabase
          .from('project_material_requirements')
          .select('project_id')
          .in('project_id', projectIds),
      ]);

      const wfCountMap: Record<string, number> = {};
      (wfCountsRes.data || []).forEach((r: any) => {
        wfCountMap[r.project_id] = (wfCountMap[r.project_id] || 0) + 1;
      });

      const attCountMap: Record<string, number> = {};
      (attCountsRes.data || []).forEach((r: any) => {
        if (r.status === 'present' || r.status === 'late') {
          attCountMap[r.project_id] = (attCountMap[r.project_id] || 0) + 1;
        }
      });

      const taskCountMap: Record<string, number> = {};
      (taskCountsRes.data || []).forEach((r: any) => {
        const st = (r.status || '').toLowerCase();
        if (st !== 'completed' && st !== 'cancelled') {
          taskCountMap[r.project_id] = (taskCountMap[r.project_id] || 0) + 1;
        }
      });

      const matCountMap: Record<string, number> = {};
      (matCountsRes.data || []).forEach((r: any) => {
        matCountMap[r.project_id] = (matCountMap[r.project_id] || 0) + 1;
      });

      const projects: AssignedProjectSummary[] = (rawProjects || []).map((pr: any) => {
        const meta = projectMetaMap.get(pr.id) || {};
        const flags = computeScheduleFlags(meta.assignment_start_date, pr.start_date, pr.status);
        const client = pr.clients || null;
        return {
          project_id: pr.id,
          project_code: pr.project_code || pr.code || 'PRJ',
          name: pr.name || 'Project',
          description: pr.description || null,
          project_type: pr.project_type || null,
          status: pr.status || 'in_progress',
          address: pr.address || null,
          city: pr.city || null,
          state: pr.state || null,
          country: pr.country || null,
          start_date: pr.start_date || null,
          expected_completion_date: pr.expected_completion_date || null,
          actual_completion_date: pr.actual_completion_date || null,
          client_name: client?.name || null,
          client_contact_person: client?.contact_person || null,
          client_phone: client?.phone || null,
          client_email: client?.email || null,
          assignment_id: meta.assignment_id || null,
          workforce_member_id: meta.workforce_member_id || null,
          role_on_project: meta.role_on_project || null,
          assignment_start_date: meta.assignment_start_date || null,
          assignment_end_date: meta.assignment_end_date || null,
          assignment_notes: meta.assignment_notes || null,
          assigned_at: meta.assigned_at || null,
          ...flags,
          workforce_count: wfCountMap[pr.id] || 0,
          today_attendance_count: attCountMap[pr.id] || 0,
          open_tasks_count: taskCountMap[pr.id] || 0,
          materials_count: matCountMap[pr.id] || 0,
        };
      });

      // Sort: starting today first, then active/started, then upcoming by start date
      projects.sort((a, b) => {
        if (a.is_starting_today !== b.is_starting_today) return a.is_starting_today ? -1 : 1;
        if (a.can_clock_in_today !== b.can_clock_in_today) return a.can_clock_in_today ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return { projects, error: null };
    } catch (err: any) {
      return {
        projects: [],
        error: err?.message || 'Failed to load assigned projects.',
      };
    }
  }

  /**
   * Fetches complete operational details (project info, client, team, tasks,
   * assigned materials, and notes) for an assigned project.
   */
  static async getAssignedProjectDetails(projectId: string): Promise<{
    data: AssignedProjectFullDetails | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured || !projectId) {
      return { data: null, error: 'Project ID or database is unavailable.' };
    }

    try {
      await ensureValidSession();

      // 1. Primary path: SECURITY DEFINER RPC
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_my_project_full_details', {
          p_project_id: projectId,
        });
        if (!rpcErr && rpcData && (rpcData as any).project) {
          const payload = rpcData as any;
          return {
            data: {
              project: payload.project,
              team: Array.isArray(payload.team) ? payload.team : [],
              tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
              materials: Array.isArray(payload.materials) ? payload.materials : [],
              notes: Array.isArray(payload.notes) ? payload.notes : [],
            },
            error: null,
          };
        }
      } catch {
        // Fallback below
      }

      // 2. Fallback: Direct parallel queries
      const [projRes, teamRes, tasksRes, matsRes, notesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, clients ( id, name, contact_person, phone, email )')
          .eq('id', projectId)
          .maybeSingle(),
        supabase
          .from('project_workforce_assignments')
          .select(`
            id,
            role_on_project,
            start_date,
            end_date,
            workforce_members:workforce_member_id (
              id,
              workforce_code,
              trade,
              status,
              phone,
              profiles:profiles!workforce_members_profile_id_fkey (
                display_name,
                first_name,
                last_name
              )
            )
          `)
          .eq('project_id', projectId)
          .eq('is_active', true),
        supabase
          .from('project_tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('project_material_requirements')
          .select(`
            id,
            material_id,
            required_quantity,
            approved_quantity,
            purpose,
            status,
            materials:material_id ( id, name, unit_of_measure )
          `)
          .eq('project_id', projectId)
          .limit(50),
        supabase
          .from('project_notes')
          .select('id, title, content, note_type, created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      if (projRes.error || !projRes.data) {
        return { data: null, error: projRes.error?.message || 'Project details could not be loaded.' };
      }

      const pr = projRes.data as any;
      const team: AssignedProjectTeamMember[] = (teamRes.data || []).map((t: any) => {
        const wm = t.workforce_members;
        const prof = wm?.profiles;
        const name =
          prof?.display_name ||
          `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
          `Staff ${wm?.workforce_code || ''}`.trim();
        return {
          assignment_id: t.id,
          workforce_member_id: wm?.id || t.id,
          workforce_code: wm?.workforce_code || '---',
          name,
          trade: wm?.trade || 'Staff',
          role_on_project: t.role_on_project || wm?.trade || 'Team Member',
          start_date: t.start_date || null,
          end_date: t.end_date || null,
          phone: wm?.phone || null,
          status: wm?.status || 'active',
        };
      });

      const materials: AssignedProjectMaterial[] = (matsRes.data || []).map((m: any) => ({
        id: m.id,
        material_id: m.material_id,
        material_name: m.materials?.name || 'Material Item',
        unit_of_measure: m.materials?.unit_of_measure || 'units',
        required_quantity: Number(m.required_quantity) || 0,
        approved_quantity: m.approved_quantity != null ? Number(m.approved_quantity) : null,
        purpose: m.purpose || null,
        status: m.status || 'assigned',
      }));

      return {
        data: {
          project: {
            id: pr.id,
            project_code: pr.project_code || pr.code || 'PRJ',
            name: pr.name,
            description: pr.description || null,
            project_type: pr.project_type || null,
            status: pr.status || 'in_progress',
            address: pr.address || null,
            city: pr.city || null,
            state: pr.state || null,
            country: pr.country || null,
            start_date: pr.start_date || null,
            expected_completion_date: pr.expected_completion_date || null,
            actual_completion_date: pr.actual_completion_date || null,
            client_name: pr.clients?.name || null,
            client_contact_person: pr.clients?.contact_person || null,
            client_phone: pr.clients?.phone || null,
            client_email: pr.clients?.email || null,
          },
          team,
          tasks: (tasksRes.data as AssignedProjectTask[]) || [],
          materials,
          notes: (notesRes.data as AssignedProjectNote[]) || [],
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err?.message || 'Failed to load full project details.',
      };
    }
  }
}
