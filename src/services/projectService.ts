import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatNaira, formatDateNigerian } from './dashboardService';

export type ProjectStatus =
  | 'enquiry'
  | 'quotation'
  | 'approved'
  | 'in_progress'
  | 'snagging'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
  | 'closed';

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; badgeClass: string; bgClass: string; textClass: string }
> = {
  enquiry: {
    label: 'Enquiry',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
  },
  quotation: {
    label: 'Quotation',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
  },
  approved: {
    label: 'Approved',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
  },
  in_progress: {
    label: 'In Progress',
    badgeClass: 'bg-[#E6F4EA] text-[#01875F] border-[#01875F]/30 font-semibold',
    bgClass: 'bg-[#E6F4EA]',
    textClass: 'text-[#01875F]',
  },
  snagging: {
    label: 'Snagging',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
  },
  on_hold: {
    label: 'On Hold',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
  },
  closed: {
    label: 'Closed',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
    bgClass: 'bg-slate-200',
    textClass: 'text-slate-800',
  },
};

export const ALL_PROJECT_STATUSES: ProjectStatus[] = [
  'enquiry',
  'quotation',
  'approved',
  'in_progress',
  'snagging',
  'on_hold',
  'completed',
  'cancelled',
  'closed',
];

export interface ClientRecord {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  contact_person?: string | null;
}

export interface ProjectRecord {
  id: string;
  project_code: string;
  name: string;
  client_id: string;
  description: string | null;
  project_type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  status: ProjectStatus;
  currency: string;
  contract_value: number | null;
  start_date: string | null;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clients?: ClientRecord | null;
}

export interface CreateProjectPayload {
  project_code: string;
  name: string;
  client_id: string;
  description?: string | null;
  project_type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status?: ProjectStatus;
  currency?: string;
  contract_value?: number | null;
  start_date?: string | null;
  expected_completion_date?: string | null;
}

export interface UpdateProjectPayload {
  project_code?: string;
  name?: string;
  client_id?: string;
  description?: string | null;
  project_type?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  status?: ProjectStatus;
  currency?: string;
  contract_value?: number | null;
  start_date?: string | null;
  expected_completion_date?: string | null;
  actual_completion_date?: string | null;
}

export interface CreateClientPayload {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
}

export class ProjectService {
  /**
   * Fetches real projects with client relationship from Supabase
   */
  static async getProjects(filter?: {
    search?: string;
    status?: string;
  }): Promise<{ data: ProjectRecord[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Supabase database is not configured.' };
    }

    try {
      let query = supabase
        .from('projects')
        .select(`
          id,
          project_code,
          name,
          client_id,
          description,
          project_type,
          address,
          city,
          state,
          country,
          status,
          currency,
          contract_value,
          start_date,
          expected_completion_date,
          actual_completion_date,
          created_by,
          created_at,
          updated_at,
          clients (
            id,
            name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      if (filter?.search && filter.search.trim()) {
        const term = `%${filter.search.trim()}%`;
        query = query.or(`name.ilike.${term},project_code.ilike.${term},city.ilike.${term},state.ilike.${term}`);
      }

      const { data, error } = await query;

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as unknown as ProjectRecord[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to fetch projects from database.' };
    }
  }

  /**
   * Fetches single project by ID with client details
   */
  static async getProjectById(
    projectId: string
  ): Promise<{ data: ProjectRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          clients (
            id,
            name,
            email,
            phone,
            address,
            city,
            state
          )
        `)
        .eq('id', projectId)
        .maybeSingle();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: (data as unknown as ProjectRecord) || null, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to fetch project details.' };
    }
  }

  /**
   * Retrieves all clients from public.clients for selection
   */
  static async getClients(): Promise<{ data: ClientRecord[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, email, phone, address, city, state')
        .order('name');

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as ClientRecord[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load clients.' };
    }
  }

  /**
   * Creates a real client in public.clients so the foreign key requirement on client_id is satisfied
   */
  static async createClient(
    payload: CreateClientPayload
  ): Promise<{ data: ClientRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: payload.name.trim(),
          email: payload.email?.trim() || null,
          phone: payload.phone?.trim() || null,
          address: payload.address?.trim() || null,
          city: payload.city?.trim() || null,
          state: payload.state?.trim() || null,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      return { data: (data as ClientRecord) || null, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to create client.' };
    }
  }

  /**
   * Creates a real project in public.projects
   * Sets created_by to authenticated user ID
   */
  static async createProject(
    payload: CreateProjectPayload
  ): Promise<{ data: ProjectRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      // 1. Get authenticated user ID
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const insertData = {
        project_code: payload.project_code.trim(),
        name: payload.name.trim(),
        client_id: payload.client_id,
        description: payload.description?.trim() || null,
        project_type: payload.project_type?.trim() || null,
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || null,
        state: payload.state?.trim() || null,
        country: payload.country?.trim() || 'Nigeria',
        status: payload.status || 'enquiry',
        currency: payload.currency?.trim() || 'NGN',
        contract_value:
          payload.contract_value != null && !isNaN(Number(payload.contract_value))
            ? Number(payload.contract_value)
            : null,
        start_date: payload.start_date || null,
        expected_completion_date: payload.expected_completion_date || null,
        created_by: user?.id || null,
      };

      const { data, error } = await supabase
        .from('projects')
        .insert(insertData)
        .select(`
          *,
          clients (
            id,
            name,
            email,
            phone
          )
        `)
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
          return {
            data: null,
            error: `A project with code "${payload.project_code.trim()}" already exists. Please choose a unique project code.`,
          };
        }
        return { data: null, error: error.message };
      }

      return { data: (data as unknown as ProjectRecord) || null, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to create project.' };
    }
  }

  /**
   * Updates an existing project in public.projects
   * Status change triggers trg_project_status_history in database automatically
   */
  static async updateProject(
    projectId: string,
    payload: UpdateProjectPayload
  ): Promise<{ data: ProjectRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const updateData: Record<string, any> = {};

      if (payload.project_code !== undefined) updateData.project_code = payload.project_code.trim();
      if (payload.name !== undefined) updateData.name = payload.name.trim();
      if (payload.client_id !== undefined) updateData.client_id = payload.client_id;
      if (payload.description !== undefined) updateData.description = payload.description?.trim() || null;
      if (payload.project_type !== undefined) updateData.project_type = payload.project_type?.trim() || null;
      if (payload.address !== undefined) updateData.address = payload.address?.trim() || null;
      if (payload.city !== undefined) updateData.city = payload.city?.trim() || null;
      if (payload.state !== undefined) updateData.state = payload.state?.trim() || null;
      if (payload.country !== undefined) updateData.country = payload.country?.trim() || 'Nigeria';
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.currency !== undefined) updateData.currency = payload.currency?.trim() || 'NGN';
      if (payload.contract_value !== undefined) {
        updateData.contract_value =
          payload.contract_value != null && !isNaN(Number(payload.contract_value))
            ? Number(payload.contract_value)
            : null;
      }
      if (payload.start_date !== undefined) updateData.start_date = payload.start_date || null;
      if (payload.expected_completion_date !== undefined)
        updateData.expected_completion_date = payload.expected_completion_date || null;
      if (payload.actual_completion_date !== undefined)
        updateData.actual_completion_date = payload.actual_completion_date || null;

      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId)
        .select(`
          *,
          clients (
            id,
            name,
            email,
            phone
          )
        `)
        .single();

      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
          return {
            data: null,
            error: `A project with code "${payload.project_code}" already exists. Please choose a unique project code.`,
          };
        }
        return { data: null, error: error.message };
      }

      return { data: (data as unknown as ProjectRecord) || null, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update project.' };
    }
  }
}
