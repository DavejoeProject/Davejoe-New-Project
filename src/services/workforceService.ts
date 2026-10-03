import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type WorkforceStatus = 'active' | 'inactive' | 'suspended' | 'terminated';

export const ALL_WORKFORCE_STATUSES: WorkforceStatus[] = [
  'active',
  'inactive',
  'suspended',
  'terminated',
];

export const WORKFORCE_STATUS_CONFIG: Record<
  WorkforceStatus,
  { label: string; badgeClasses: string; dotClasses: string }
> = {
  active: {
    label: 'Active',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClasses: 'bg-[#01875F]',
  },
  inactive: {
    label: 'Inactive',
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  },
  suspended: {
    label: 'Suspended',
    badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClasses: 'bg-amber-500',
  },
  terminated: {
    label: 'Terminated',
    badgeClasses: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClasses: 'bg-rose-500',
  },
};

export interface ProfileRecord {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  job_title?: string | null;
}

export interface ProjectAssignmentItem {
  id: string;
  project_id: string;
  workforce_member_id: string;
  role_on_project: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
    status: string;
  } | null;
}

export interface WorkforceMemberRecord {
  id: string;
  workforce_code: string;
  trade: string;
  status: WorkforceStatus;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  profile_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
  profiles?: ProfileRecord | null;
  active_assignment?: ProjectAssignmentItem | null;
  assignments?: ProjectAssignmentItem[];
}

export interface WorkforceSummaryMetrics {
  totalWorkforce: number;
  activeWorkforce: number;
  assignedWorkforce: number;
  availableWorkforce: number;
}

export interface WorkforceFilter {
  search?: string;
  status?: string;
  trade?: string;
  assignmentStatus?: 'all' | 'assigned' | 'available';
}

export interface CreateWorkforceMemberPayload {
  workforce_code: string;
  trade: string;
  status?: WorkforceStatus;
  phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  profile_id?: string | null;
}

export interface UpdateWorkforceMemberPayload {
  trade?: string;
  status?: WorkforceStatus;
  phone?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
  profile_id?: string | null;
}

export interface AssignWorkerPayload {
  projectId: string;
  workforceMemberId: string;
  roleOnProject?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface AssignableProject {
  id: string;
  name: string;
  project_code: string;
  status: string;
}

export class WorkforceService {
  /**
   * Fetches real workforce directory records and computes reliable summary metrics
   * strictly from public.workforce_members and public.project_workforce_assignments
   */
  static async getWorkforceDirectory(
    filter?: WorkforceFilter
  ): Promise<{
    data: WorkforceMemberRecord[];
    metrics: WorkforceSummaryMetrics;
    uniqueTrades: string[];
    error: string | null;
  }> {
    const emptyResult = {
      data: [],
      metrics: {
        totalWorkforce: 0,
        activeWorkforce: 0,
        assignedWorkforce: 0,
        availableWorkforce: 0,
      },
      uniqueTrades: [],
      error: null,
    };

    if (!isSupabaseConfigured) {
      return {
        ...emptyResult,
        error: 'Database is not configured.',
      };
    }

    try {
      // 1. Fetch real workforce members with joined profiles
      const { data: membersData, error: membersError } = await supabase
        .from('workforce_members')
        .select(`
          id,
          workforce_code,
          trade,
          status,
          phone,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          profile_id,
          created_by,
          created_at,
          profiles:profiles!workforce_members_profile_id_fkey (
            id,
            display_name,
            first_name,
            last_name,
            avatar_url,
            phone,
            job_title
          )
        `)
        .order('workforce_code', { ascending: true });

      if (membersError) {
        return {
          ...emptyResult,
          error: `Workforce query error: ${membersError.message}`,
        };
      }

      const rawMembers = (membersData as unknown as WorkforceMemberRecord[]) || [];

      // 2. Fetch all real project assignments with joined project metadata
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('project_workforce_assignments')
        .select(`
          id,
          project_id,
          workforce_member_id,
          role_on_project,
          start_date,
          end_date,
          is_active,
          notes,
          created_at,
          projects (
            id,
            name,
            project_code,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        return {
          ...emptyResult,
          error: `Workforce assignments query error: ${assignmentsError.message}`,
        };
      }

      const rawAssignments = (assignmentsData as unknown as ProjectAssignmentItem[]) || [];

      // Map assignments by workforce_member_id
      const assignmentsByMemberId: Record<string, ProjectAssignmentItem[]> = {};
      const activeAssignmentsByMemberId: Record<string, ProjectAssignmentItem> = {};

      for (const assign of rawAssignments) {
        if (!assignmentsByMemberId[assign.workforce_member_id]) {
          assignmentsByMemberId[assign.workforce_member_id] = [];
        }
        assignmentsByMemberId[assign.workforce_member_id].push(assign);

        // Consider active assignment if is_active === true (or not false)
        if (assign.is_active && !activeAssignmentsByMemberId[assign.workforce_member_id]) {
          activeAssignmentsByMemberId[assign.workforce_member_id] = assign;
        }
      }

      // Compute reliable summary metrics strictly from verified rows
      const totalCount = rawMembers.length;
      let activeCount = 0;
      const assignedMemberIds = new Set<string>();

      for (const m of rawMembers) {
        const isStatusActive = (m.status || '').toLowerCase().trim() === 'active';
        if (isStatusActive) {
          activeCount++;
        }
        if (activeAssignmentsByMemberId[m.id]) {
          assignedMemberIds.add(m.id);
        }
      }

      const assignedCount = assignedMemberIds.size;
      // Available = Active workers who are not currently assigned
      let availableCount = 0;
      for (const m of rawMembers) {
        const isStatusActive = (m.status || '').toLowerCase().trim() === 'active';
        if (isStatusActive && !activeAssignmentsByMemberId[m.id]) {
          availableCount++;
        }
      }

      // Collect unique trades present in real records
      const tradeSet = new Set<string>();
      for (const m of rawMembers) {
        if (m.trade && m.trade.trim()) {
          tradeSet.add(m.trade.trim());
        }
      }
      const uniqueTrades = Array.from(tradeSet).sort();

      // Attach assignments and active assignment to member records
      const fullMembers: WorkforceMemberRecord[] = rawMembers.map((m) => ({
        ...m,
        assignments: assignmentsByMemberId[m.id] || [],
        active_assignment: activeAssignmentsByMemberId[m.id] || null,
      }));

      // 3. Apply client-side filters
      let filtered = fullMembers;

      // Filter by Search Query
      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        filtered = filtered.filter((m) => {
          const codeMatch = (m.workforce_code || '').toLowerCase().includes(term);
          const tradeMatch = (m.trade || '').toLowerCase().includes(term);
          const phoneMatch = (m.phone || '').toLowerCase().includes(term);
          const emergMatch =
            (m.emergency_contact_name || '').toLowerCase().includes(term) ||
            (m.emergency_contact_phone || '').toLowerCase().includes(term);
          const notesMatch = (m.notes || '').toLowerCase().includes(term);

          // Check profile names
          const prof = m.profiles;
          const dispMatch = (prof?.display_name || '').toLowerCase().includes(term);
          const firstMatch = (prof?.first_name || '').toLowerCase().includes(term);
          const lastMatch = (prof?.last_name || '').toLowerCase().includes(term);

          // Check active assigned project name
          const projNameMatch = (m.active_assignment?.projects?.name || '')
            .toLowerCase()
            .includes(term);
          const projCodeMatch = (m.active_assignment?.projects?.project_code || '')
            .toLowerCase()
            .includes(term);

          return (
            codeMatch ||
            tradeMatch ||
            phoneMatch ||
            emergMatch ||
            notesMatch ||
            dispMatch ||
            firstMatch ||
            lastMatch ||
            projNameMatch ||
            projCodeMatch
          );
        });
      }

      // Filter by Status
      if (filter?.status && filter.status !== 'all') {
        const targetStatus = filter.status.toLowerCase().trim();
        filtered = filtered.filter((m) => (m.status || '').toLowerCase().trim() === targetStatus);
      }

      // Filter by Trade
      if (filter?.trade && filter.trade !== 'all') {
        filtered = filtered.filter((m) => (m.trade || '').toLowerCase().trim() === filter.trade?.toLowerCase().trim());
      }

      // Filter by Assignment Status
      if (filter?.assignmentStatus && filter.assignmentStatus !== 'all') {
        if (filter.assignmentStatus === 'assigned') {
          filtered = filtered.filter((m) => Boolean(m.active_assignment));
        } else if (filter.assignmentStatus === 'available') {
          filtered = filtered.filter((m) => !m.active_assignment && (m.status || '').toLowerCase().trim() === 'active');
        }
      }

      return {
        data: filtered,
        metrics: {
          totalWorkforce: totalCount,
          activeWorkforce: activeCount,
          assignedWorkforce: assignedCount,
          availableWorkforce: availableCount,
        },
        uniqueTrades,
        error: null,
      };
    } catch (err: any) {
      return {
        ...emptyResult,
        error: err?.message || 'Failed to fetch workforce directory.',
      };
    }
  }

  /**
   * Retrieves single workforce member by ID with full profile and assignment history
   */
  static async getWorkforceMemberById(
    id: string
  ): Promise<{ data: WorkforceMemberRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { data: member, error: memberError } = await supabase
        .from('workforce_members')
        .select(`
          id,
          workforce_code,
          trade,
          status,
          phone,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          profile_id,
          created_by,
          created_at,
          profiles:profiles!workforce_members_profile_id_fkey (
            id,
            display_name,
            first_name,
            last_name,
            avatar_url,
            phone,
            job_title
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (memberError) {
        return { data: null, error: memberError.message };
      }
      if (!member) {
        return { data: null, error: 'Workforce member not found.' };
      }

      // Fetch assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('project_workforce_assignments')
        .select(`
          id,
          project_id,
          workforce_member_id,
          role_on_project,
          start_date,
          end_date,
          is_active,
          notes,
          created_at,
          projects (
            id,
            name,
            project_code,
            status
          )
        `)
        .eq('workforce_member_id', id)
        .order('created_at', { ascending: false });

      if (assignmentsError) {
        return { data: null, error: assignmentsError.message };
      }

      const rawAssignments = (assignments as unknown as ProjectAssignmentItem[]) || [];
      const activeAssignment = rawAssignments.find((a) => a.is_active) || null;

      const record: WorkforceMemberRecord = {
        ...(member as unknown as WorkforceMemberRecord),
        assignments: rawAssignments,
        active_assignment: activeAssignment,
      };

      return { data: record, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch workforce member.' };
    }
  }

  /**
   * Creates a real workforce member in public.workforce_members
   */
  static async createWorkforceMember(
    payload: CreateWorkforceMemberPayload
  ): Promise<{ data: WorkforceMemberRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const insertData = {
        workforce_code: payload.workforce_code.trim(),
        trade: payload.trade.trim(),
        status: payload.status || 'active',
        phone: payload.phone?.trim() || null,
        emergency_contact_name: payload.emergency_contact_name?.trim() || null,
        emergency_contact_phone: payload.emergency_contact_phone?.trim() || null,
        notes: payload.notes?.trim() || null,
        profile_id: payload.profile_id || null,
        created_by: user?.id || null,
      };

      const { data, error } = await supabase
        .from('workforce_members')
        .insert(insertData)
        .select(`
          id,
          workforce_code,
          trade,
          status,
          phone,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          profile_id,
          created_by,
          created_at,
          profiles:profiles!workforce_members_profile_id_fkey (
            id,
            display_name,
            first_name,
            last_name,
            avatar_url,
            phone,
            job_title
          )
        `)
        .single();

      if (error) {
        if (
          error.code === '23505' ||
          error.message?.includes('duplicate key') ||
          error.message?.includes('unique constraint')
        ) {
          return {
            data: null,
            error: `Workforce code "${payload.workforce_code.trim()}" is already in use. Please enter a unique code.`,
          };
        }
        return { data: null, error: error.message };
      }

      return { data: (data as unknown as WorkforceMemberRecord) || null, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to create workforce member.' };
    }
  }

  /**
   * Updates an existing workforce member in public.workforce_members
   */
  static async updateWorkforceMember(
    id: string,
    payload: UpdateWorkforceMemberPayload
  ): Promise<{ data: WorkforceMemberRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const updateData: Record<string, any> = {};

      if (payload.trade !== undefined) updateData.trade = payload.trade.trim();
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.phone !== undefined) updateData.phone = payload.phone?.trim() || null;
      if (payload.emergency_contact_name !== undefined)
        updateData.emergency_contact_name = payload.emergency_contact_name?.trim() || null;
      if (payload.emergency_contact_phone !== undefined)
        updateData.emergency_contact_phone = payload.emergency_contact_phone?.trim() || null;
      if (payload.notes !== undefined) updateData.notes = payload.notes?.trim() || null;
      if (payload.profile_id !== undefined) updateData.profile_id = payload.profile_id || null;

      const { data, error } = await supabase
        .from('workforce_members')
        .update(updateData)
        .eq('id', id)
        .select(`
          id,
          workforce_code,
          trade,
          status,
          phone,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          profile_id,
          created_by,
          created_at,
          profiles:profiles!workforce_members_profile_id_fkey (
            id,
            display_name,
            first_name,
            last_name,
            avatar_url,
            phone,
            job_title
          )
        `)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: (data as unknown as WorkforceMemberRecord) || null, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update workforce member.' };
    }
  }

  /**
   * Assigns a workforce member to a project in public.project_workforce_assignments
   */
  static async assignWorkerToProject(
    payload: AssignWorkerPayload
  ): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: 'Database is not configured.' };
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('project_workforce_assignments').insert({
        project_id: payload.projectId,
        workforce_member_id: payload.workforceMemberId,
        role_on_project: payload.roleOnProject?.trim() || null,
        start_date: payload.startDate || null,
        end_date: payload.endDate || null,
        notes: payload.notes?.trim() || null,
        is_active: true,
        assigned_by: user?.id || null,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to assign worker to project.' };
    }
  }

  /**
   * Fetches real projects for assignment dropdown selection
   */
  static async getAssignableProjects(): Promise<{
    data: AssignableProject[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_code, status')
        .order('name');

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as AssignableProject[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load projects.' };
    }
  }

  /**
   * Fetches real registered user profiles for linking to workforce records
   */
  static async getAvailableProfiles(): Promise<{
    data: ProfileRecord[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, first_name, last_name, phone, job_title, avatar_url')
        .order('display_name');

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as ProfileRecord[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load profiles.' };
    }
  }
}
