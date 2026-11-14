import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { normalizeRoleKey } from './authService';

function isLeadershipRole(slug?: string | null, name?: string | null): boolean {
  const s = (slug || '').toLowerCase().trim().replace(/[-\s]+/g, '_');
  const n = (name || '').toLowerCase().trim();
  if (
    s === 'management' ||
    s === 'ceo' ||
    s === 'managing_director' ||
    s === 'executive_director' ||
    s === 'executive_director_business_operations_strategy'
  ) {
    return true;
  }
  return (
    n === 'management' ||
    n === 'ceo' ||
    n === 'managing director' ||
    n.includes('management / ceo') ||
    n.includes('executive director')
  );
}

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
    dotClasses: 'bg-[#18b892]',
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

export const ALL_NINE_ROLES: Array<{
  slug: string;
  name: string;
  department: string;
  badgeClasses: string;
}> = [
  { slug: 'management', name: 'Management / CEO', department: 'Executive Governance', badgeClasses: 'bg-purple-50 text-purple-700 border-purple-200' },
  { slug: 'executive_director', name: 'Executive Director', department: 'Strategy & Operations', badgeClasses: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { slug: 'admin', name: 'Admin Coordinator', department: 'Administration', badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200' },
  { slug: 'technical', name: 'Technical / QC Officer', department: 'Engineering & QC', badgeClasses: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { slug: 'supervisor', name: 'Site Supervisor', department: 'Site Operations', badgeClasses: 'bg-teal-50 text-teal-700 border-teal-200' },
  { slug: 'procurement', name: 'Procurement & Logistics', department: 'Supply Chain', badgeClasses: 'bg-amber-50 text-amber-700 border-amber-200' },
  { slug: 'accounts', name: 'Accounts / Finance', department: 'Financial Control', badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { slug: 'artisan', name: 'Artisan / Site Trades', department: 'Field Execution', badgeClasses: 'bg-orange-50 text-orange-700 border-orange-200' },
  { slug: 'social_media_manager', name: 'Social Media Manager', department: 'Digital Communications', badgeClasses: 'bg-pink-50 text-pink-700 border-pink-200' },
];

export interface PersonnelRecord {
  id: string;
  profileId: string | null;
  workforceId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  primaryRoleSlug: string;
  primaryRoleName: string;
  department: string;
  assignedRoles: { id: string; name: string; slug: string }[];
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  isWorkforceMember: boolean;
  workforceCode: string | null;
  trade: string;
  createdAt: string;
  activeAssignment?: ProjectAssignmentItem | null;
  assignments?: ProjectAssignmentItem[];
}

export interface PersonnelDirectoryMetrics {
  totalPersonnel: number;
  activePersonnel: number;
  suspendedPersonnel: number;
  assignedPersonnel: number;
  availablePersonnel: number;
  byRoleCount: Record<string, number>;
}

export interface PersonnelFilter {
  search?: string;
  role?: string;
  status?: string;
  assignmentStatus?: 'all' | 'assigned' | 'available';
  trade?: string;
  excludeLeadershipRoles?: boolean;
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
      const { data: existingActive } = await supabase
        .from('project_workforce_assignments')
        .select('id')
        .eq('project_id', payload.projectId)
        .eq('workforce_member_id', payload.workforceMemberId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (existingActive?.id) {
        return { error: 'This staff member is already actively assigned to the selected project.' };
      }

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
   * Resolves or creates a public.workforce_members identity for any registered staff user
   * so Admin/Management/Exec can assign them to projects or open their Control Centre.
   */
  static async ensureWorkforceMemberForStaff(person: {
    profileId?: string | null;
    workforceId?: string | null;
    fullName: string;
    phone?: string | null;
    trade?: string | null;
    primaryRoleSlug?: string;
  }): Promise<{ data: WorkforceMemberRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      if (person.workforceId) {
        return await this.getWorkforceMemberById(person.workforceId);
      }

      if (!person.profileId) {
        return { data: null, error: 'Cannot resolve workforce record without a profile or workforce ID.' };
      }

      // 1. Check if a workforce_members record already exists for this profile
      const { data: existingByProfile } = await supabase
        .from('workforce_members')
        .select('id')
        .eq('profile_id', person.profileId)
        .limit(1)
        .maybeSingle();

      if (existingByProfile?.id) {
        return await this.getWorkforceMemberById(existingByProfile.id);
      }

      // 2. Try server-side SECURITY DEFINER RPC ensure_user_workforce_member
      const { data: rpcWfId, error: rpcErr } = await supabase.rpc('ensure_user_workforce_member', {
        p_user_id: person.profileId,
      });

      if (!rpcErr && typeof rpcWfId === 'string' && rpcWfId) {
        return await this.getWorkforceMemberById(rpcWfId);
      }

      // 3. Direct insert fallback if RPC is unavailable or user status requires direct linking
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const normSlug = normalizeRoleKey(person.primaryRoleSlug) || person.primaryRoleSlug || 'staff';
      const prefixMap: Record<string, string> = {
        supervisor: 'SUP',
        technical: 'QC',
        procurement: 'LOG',
        accounts: 'ACC',
        artisan: 'ART',
        social_media_manager: 'SMM',
        admin: 'ADM',
      };
      const prefix = prefixMap[normSlug] || 'STF';
      const randSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data: inserted, error: insertError } = await supabase
        .from('workforce_members')
        .insert({
          workforce_code: `${prefix}-${randSuffix}`,
          trade: person.trade?.trim() || 'Enterprise Staff',
          status: 'active',
          phone: person.phone?.trim() || null,
          profile_id: person.profileId,
          created_by: user?.id || null,
          notes: `Linked from Staff Directory (${person.fullName})`,
        })
        .select('id')
        .single();

      if (insertError) {
        return { data: null, error: insertError.message };
      }

      return await this.getWorkforceMemberById(inserted.id);
    } catch (err: any) {
      return {
        data: null,
        error: err?.message || 'Failed to prepare staff record for project assignment.',
      };
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

  /**
   * Complete Personnel Directory: Combines all registered users across all nine roles,
   * application profiles, workforce membership, and project assignments into a single deduplicated roster.
   */
  static async getCompletePersonnelDirectory(
    filter?: PersonnelFilter
  ): Promise<{
    data: PersonnelRecord[];
    metrics: PersonnelDirectoryMetrics;
    uniqueRoles: { slug: string; name: string }[];
    uniqueTrades: string[];
    error: string | null;
    schemaWarning?: string | null;
  }> {
    const excludeLeadership = Boolean(filter?.excludeLeadershipRoles);
    const baseRoles = ALL_NINE_ROLES.filter(
      (r) => !excludeLeadership || !isLeadershipRole(r.slug, r.name)
    );

    const emptyResult = {
      data: [],
      metrics: {
        totalPersonnel: 0,
        activePersonnel: 0,
        suspendedPersonnel: 0,
        assignedPersonnel: 0,
        availablePersonnel: 0,
        byRoleCount: {
          management: 0,
          executive_director: 0,
          admin: 0,
          technical: 0,
          supervisor: 0,
          procurement: 0,
          accounts: 0,
          artisan: 0,
          social_media_manager: 0,
        },
      },
      uniqueRoles: baseRoles.map((r) => ({ slug: r.slug, name: r.name })),
      uniqueTrades: [],
      error: null,
      schemaWarning: null as string | null,
    };

    if (!isSupabaseConfigured) {
      return { ...emptyResult, error: 'Database is not configured.' };
    }

    try {
      // 1. Query authoritative staff directory RPC + roles + workforce_members + assignments
      const [
        rpcDirectoryRes,
        { data: dbRolesData },
        { data: workforceData },
        { data: assignmentsData },
      ] = await Promise.all([
        supabase.rpc('get_staff_directory', { p_exclude_leadership: excludeLeadership }),
        supabase.from('roles').select('id, name, slug').order('name'),
        supabase.from('workforce_members').select('*').order('created_at', { ascending: false }),
        supabase.from('project_workforce_assignments').select(`
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
        `).order('created_at', { ascending: false }),
      ]);

      let profilesData: any[] = [];
      let schemaWarning: string | null = null;
      const rolesByUser: Record<string, { id: string; name: string; slug: string }[]> = {};
      const rpcLinkedWorkforceByProfile: Record<string, any> = {};

      if (!rpcDirectoryRes.error && Array.isArray(rpcDirectoryRes.data)) {
        for (const row of rpcDirectoryRes.data as any[]) {
          profilesData.push({
            id: row.profile_id,
            email: row.email,
            first_name: row.first_name,
            last_name: row.last_name,
            display_name: row.display_name,
            phone: row.phone,
            job_title: row.job_title,
            status: row.profile_status || 'active',
            created_at: row.profile_created_at,
          });
          const rawRoles = Array.isArray(row.assigned_roles) ? row.assigned_roles : [];
          rolesByUser[row.profile_id] = rawRoles
            .filter((r: any) => r && (r.slug || r.name))
            .map((r: any) => ({
              id: String(r.id || r.slug || r.name),
              name: String(r.name || r.slug),
              slug: String(r.slug || r.name),
            }));
          if (row.workforce_id) {
            rpcLinkedWorkforceByProfile[row.profile_id] = {
              id: row.workforce_id,
              workforce_code: row.workforce_code,
              trade: row.workforce_trade,
              status: row.workforce_status,
              phone: row.workforce_phone,
              profile_id: row.profile_id,
            };
          }
        }
      } else {
        if (rpcDirectoryRes.error) {
          console.warn(
            '[WorkforceService] get_staff_directory RPC unavailable; falling back to direct table queries:',
            rpcDirectoryRes.error.message
          );
        }

        // Fallback to direct table queries if get_staff_directory RPC is not deployed yet
        const [
          { data: directProfiles, error: profilesError },
          { data: userRolesData, error: userRolesError },
        ] = await Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('user_roles').select('user_id, roles(id, name, slug)'),
        ]);

        if (profilesError) {
          return { ...emptyResult, error: `Profiles error: ${profilesError.message}` };
        }

        if (userRolesError) {
          console.warn('[WorkforceService] user_roles fallback query warning:', userRolesError.message);
        }

        profilesData = directProfiles || [];

        if (userRolesData) {
          for (const item of userRolesData as any[]) {
            if (!rolesByUser[item.user_id]) rolesByUser[item.user_id] = [];
            if (item.roles) {
              rolesByUser[item.user_id].push({
                id: item.roles.id,
                name: item.roles.name,
                slug: item.roles.slug,
              });
            }
          }
        }

        if (rpcDirectoryRes.error && (profilesData.length <= 1 || Boolean(userRolesError))) {
          schemaWarning =
            'Supabase database migration "20261114000002_admin_staff_directory_and_project_assignment.sql" has not been executed yet. Current database Row-Level Security is restricting visibility to your own profile. Run that migration in the Supabase SQL Editor to populate all staff profiles and assigned roles here.';
        }
      }

      // Map workforce members by profile_id
      const workforceByProfileId: Record<string, any> = { ...rpcLinkedWorkforceByProfile };
      const allWorkforceMembers = workforceData || [];
      for (const w of allWorkforceMembers) {
        if (w.profile_id) {
          workforceByProfileId[w.profile_id] = w;
        }
      }

      // Map assignments by workforce_member_id
      const assignmentsByMemberId: Record<string, ProjectAssignmentItem[]> = {};
      const activeAssignmentsByMemberId: Record<string, ProjectAssignmentItem> = {};
      for (const assign of (assignmentsData as unknown as ProjectAssignmentItem[]) || []) {
        if (!assignmentsByMemberId[assign.workforce_member_id]) {
          assignmentsByMemberId[assign.workforce_member_id] = [];
        }
        assignmentsByMemberId[assign.workforce_member_id].push(assign);
        if (assign.is_active && !activeAssignmentsByMemberId[assign.workforce_member_id]) {
          activeAssignmentsByMemberId[assign.workforce_member_id] = assign;
        }
      }

      // 2. Build Unified Personnel Records
      const records: PersonnelRecord[] = [];
      const processedWorkforceIds = new Set<string>();
      const tradeSet = new Set<string>();

      const roleConfigMap = new Map(ALL_NINE_ROLES.map((r) => [r.slug, r]));
      const dynamicRoleMap = new Map<string, { slug: string; name: string }>();
      for (const r of baseRoles) {
        dynamicRoleMap.set(r.slug, { slug: r.slug, name: r.name });
      }
      for (const dbRole of (dbRolesData as any[]) || []) {
        const canonicalSlug = normalizeRoleKey(dbRole.slug) || normalizeRoleKey(dbRole.name) || dbRole.slug;
        if (!canonicalSlug) continue;
        if (excludeLeadership && isLeadershipRole(canonicalSlug, dbRole.name)) continue;
        if (!dynamicRoleMap.has(canonicalSlug)) {
          dynamicRoleMap.set(canonicalSlug, { slug: canonicalSlug, name: dbRole.name || canonicalSlug });
        }
      }

      const priorityOrder = [
        'management',
        'executive_director',
        'admin',
        'technical',
        'supervisor',
        'procurement',
        'accounts',
        'social_media_manager',
        'artisan',
      ];

      for (const prof of profilesData || []) {
        const rawRoles = rolesByUser[prof.id] || [];
        // Deduplicate assigned roles by slug
        const dedupedRoleMap = new Map<string, { id: string; name: string; slug: string }>();
        for (const r of rawRoles) {
          const canon = normalizeRoleKey(r.slug) || normalizeRoleKey(r.name) || r.slug.toLowerCase().trim();
          if (!dedupedRoleMap.has(canon)) {
            const stdCfg = roleConfigMap.get(canon);
            dedupedRoleMap.set(canon, {
              id: r.id,
              name: stdCfg?.name || r.name,
              slug: canon,
            });
          }
        }
        const uRoles = Array.from(dedupedRoleMap.values());

        const wf = workforceByProfileId[prof.id] || null;
        if (wf) processedWorkforceIds.add(wf.id);

        // Derive primary role slug
        let primarySlug = wf ? 'artisan' : 'unassigned';
        let primaryName = wf ? 'Artisan / Site Trades' : (prof.job_title || 'Staff Account');
        let department = wf ? 'Field Execution' : 'Operations';

        if (uRoles.length > 0) {
          const bestRole = uRoles.slice().sort((a, b) => {
            const idxA = priorityOrder.indexOf(a.slug);
            const idxB = priorityOrder.indexOf(b.slug);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
          })[0];

          primarySlug = bestRole.slug;
          const conf = roleConfigMap.get(bestRole.slug);
          primaryName = conf?.name || bestRole.name;
          department = conf?.department || 'Operations';

          for (const r of uRoles) {
            if (excludeLeadership && isLeadershipRole(r.slug, r.name)) continue;
            if (!dynamicRoleMap.has(r.slug)) {
              dynamicRoleMap.set(r.slug, { slug: r.slug, name: r.name });
            }
          }
        } else if (prof.job_title) {
          const normTitleRole = normalizeRoleKey(prof.job_title);
          if (normTitleRole && roleConfigMap.has(normTitleRole)) {
            const conf = roleConfigMap.get(normTitleRole)!;
            primarySlug = conf.slug;
            primaryName = conf.name;
            department = conf.department;
          }
        }

        // Exclude Management/CEO and Executive Director accounts when requested (e.g., Admin Staff view)
        if (excludeLeadership) {
          const hasLeadershipAssignment =
            uRoles.some((r) => isLeadershipRole(r.slug, r.name)) ||
            isLeadershipRole(primarySlug, primaryName);
          if (hasLeadershipAssignment) {
            continue;
          }
        }

        const trade = wf?.trade || prof.job_title || primaryName;
        if (trade) tradeSet.add(trade.trim());

        const activeAssignment = wf ? activeAssignmentsByMemberId[wf.id] || null : null;
        const assignments = wf ? assignmentsByMemberId[wf.id] || [] : [];

        const fullName =
          prof.display_name?.trim() ||
          `${prof.first_name || ''} ${prof.last_name || ''}`.trim() ||
          prof.email?.split('@')[0] ||
          'Personnel';

        records.push({
          id: prof.id,
          profileId: prof.id,
          workforceId: wf?.id || null,
          fullName,
          email: prof.email || null,
          phone: prof.phone || wf?.phone || null,
          primaryRoleSlug: primarySlug,
          primaryRoleName: primaryName,
          department,
          assignedRoles: uRoles,
          status: (prof.status as any) || 'active',
          isWorkforceMember: Boolean(wf),
          workforceCode: wf?.workforce_code || null,
          trade,
          createdAt: prof.created_at,
          activeAssignment,
          assignments,
        });
      }

      // Add standalone workforce members (artisans without profile account)
      for (const wf of allWorkforceMembers) {
        if (!processedWorkforceIds.has(wf.id)) {
          const trade = wf.trade || 'General Artisan';
          if (trade) tradeSet.add(trade.trim());

          const activeAssignment = activeAssignmentsByMemberId[wf.id] || null;
          const assignments = assignmentsByMemberId[wf.id] || [];

          records.push({
            id: wf.id,
            profileId: null,
            workforceId: wf.id,
            fullName: wf.emergency_contact_name || `Worker ${wf.workforce_code}`,
            email: null,
            phone: wf.phone || wf.emergency_contact_phone || null,
            primaryRoleSlug: 'artisan',
            primaryRoleName: 'Artisan / Site Trades',
            department: 'Field Execution',
            assignedRoles: [{ id: 'artisan', name: 'Artisan / Site Trades', slug: 'artisan' }],
            status: (wf.status as any) || 'active',
            isWorkforceMember: true,
            workforceCode: wf.workforce_code,
            trade,
            createdAt: wf.created_at,
            activeAssignment,
            assignments,
          });
        }
      }

      // 3. Compute Metrics across visible records
      const totalPersonnel = records.length;
      let activePersonnel = 0;
      let suspendedPersonnel = 0;
      let assignedPersonnel = 0;
      let availablePersonnel = 0;
      const byRoleCount: Record<string, number> = {
        management: 0,
        executive_director: 0,
        admin: 0,
        technical: 0,
        supervisor: 0,
        procurement: 0,
        accounts: 0,
        artisan: 0,
        social_media_manager: 0,
      };

      for (const p of records) {
        if (p.status === 'active') activePersonnel++;
        if (p.status === 'suspended') suspendedPersonnel++;
        if (p.activeAssignment) assignedPersonnel++;
        if (p.status === 'active' && !p.activeAssignment) availablePersonnel++;

        const countedSlugs = new Set<string>();
        if (p.assignedRoles.length > 0) {
          for (const r of p.assignedRoles) {
            countedSlugs.add(r.slug);
          }
        } else if (p.primaryRoleSlug && p.primaryRoleSlug !== 'unassigned') {
          countedSlugs.add(p.primaryRoleSlug);
        }

        for (const s of countedSlugs) {
          byRoleCount[s] = (byRoleCount[s] || 0) + 1;
        }
      }

      // 4. Apply Filters
      let filtered = records;

      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        filtered = filtered.filter((p) => {
          const allRolesText = p.assignedRoles.map((r) => `${r.name} ${r.slug}`).join(' ').toLowerCase();
          return (
            p.fullName.toLowerCase().includes(term) ||
            (p.email || '').toLowerCase().includes(term) ||
            (p.phone || '').toLowerCase().includes(term) ||
            (p.workforceCode || '').toLowerCase().includes(term) ||
            p.trade.toLowerCase().includes(term) ||
            p.primaryRoleName.toLowerCase().includes(term) ||
            allRolesText.includes(term) ||
            (p.activeAssignment?.projects?.name || '').toLowerCase().includes(term)
          );
        });
      }

      if (filter?.role && filter.role !== 'all') {
        const targetRole = filter.role.toLowerCase().trim();
        filtered = filtered.filter((p) => {
          if (p.primaryRoleSlug.toLowerCase().trim() === targetRole) return true;
          return p.assignedRoles.some(
            (r) =>
              r.slug.toLowerCase().trim() === targetRole ||
              (normalizeRoleKey(r.slug) || '') === targetRole
          );
        });
      }

      if (filter?.status && filter.status !== 'all') {
        const targetStatus = filter.status.toLowerCase().trim();
        filtered = filtered.filter((p) => p.status.toLowerCase().trim() === targetStatus);
      }

      if (filter?.assignmentStatus && filter.assignmentStatus !== 'all') {
        if (filter.assignmentStatus === 'assigned') {
          filtered = filtered.filter((p) => Boolean(p.activeAssignment));
        } else if (filter.assignmentStatus === 'available') {
          filtered = filtered.filter((p) => !p.activeAssignment && p.status === 'active');
        }
      }

      if (filter?.trade && filter.trade !== 'all') {
        filtered = filtered.filter((p) => p.trade.toLowerCase().trim() === filter.trade?.toLowerCase().trim());
      }

      return {
        data: filtered,
        metrics: {
          totalPersonnel,
          activePersonnel,
          suspendedPersonnel,
          assignedPersonnel,
          availablePersonnel,
          byRoleCount,
        },
        uniqueRoles: Array.from(dynamicRoleMap.values()),
        uniqueTrades: Array.from(tradeSet).sort(),
        error: null,
        schemaWarning,
      };
    } catch (err: any) {
      console.error('[WorkforceService] getCompletePersonnelDirectory error:', err);
      return {
        ...emptyResult,
        error: err?.message || 'Failed to fetch complete workforce roster.',
      };
    }
  }
}

