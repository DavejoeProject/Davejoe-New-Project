import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';

export type ContractWorkforceStatus = 'active' | 'inactive' | 'suspended';
export type WorkforceAssignmentStatus = 'active' | 'completed' | 'cancelled';

export const WORKFORCE_PUBLIC_COLUMNS =
  'id, full_name, address, phone_number, status, registration_notes, created_by, updated_by, created_at, updated_at';

export interface ProjectSummary {
  id: string;
  name: string;
  project_code: string | null;
  status: string | null;
}

export interface WorkforceProjectAssignmentRecord {
  id: string;
  workforce_id: string;
  project_id: string;
  assigned_at: string;
  assigned_by: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  assignment_status: WorkforceAssignmentStatus | string;
  assignment_notes: string | null;
  created_at: string;
  updated_at: string;
  project?: ProjectSummary | null;
  worker?: {
    id: string;
    full_name: string;
    phone_number: string;
    status: string;
  } | null;
}

export interface WorkforceProtectedDetails {
  workforce_id: string;
  next_of_kin: string | null;
  next_of_kin_phone: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
}

export interface WorkforceDirectoryRecord {
  id: string;
  full_name: string;
  address: string | null;
  phone_number: string;
  next_of_kin?: string | null;
  next_of_kin_phone?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  status: ContractWorkforceStatus | string;
  registration_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  assignments?: WorkforceProjectAssignmentRecord[];
  activeAssignmentsCount?: number;
}

export interface WorkforceDirectoryMetrics {
  totalRegistered: number;
  activeCount: number;
  inactiveCount: number;
  suspendedCount: number;
  assignedCount: number;
  unassignedCount: number;
}

export interface WorkforceDirectoryInput {
  full_name: string;
  address?: string;
  phone_number: string;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  status?: ContractWorkforceStatus;
  registration_notes?: string;
}

export interface AssignWorkforceProjectInput {
  workforce_id: string;
  project_id: string;
  assigned_at: string;
  expected_end_date?: string | null;
  assignment_notes?: string;
}

export function maskBankAccountNumber(accountNumber?: string | null): string {
  if (!accountNumber) return '—';
  const clean = accountNumber.trim();
  if (clean.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

function isMissingRpcError(error: any): boolean {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
}

export class WorkforceDirectoryService {
  static async listDirectory(filters?: {
    search?: string;
    status?: string;
    assignmentFilter?: 'all' | 'assigned' | 'unassigned';
  }): Promise<{
    data: WorkforceDirectoryRecord[];
    metrics: WorkforceDirectoryMetrics;
    error: string | null;
  }> {
    const emptyMetrics: WorkforceDirectoryMetrics = {
      totalRegistered: 0,
      activeCount: 0,
      inactiveCount: 0,
      suspendedCount: 0,
      assignedCount: 0,
      unassignedCount: 0,
    };

    if (!isSupabaseConfigured) {
      return { data: [], metrics: emptyMetrics, error: 'Supabase is not configured.' };
    }

    try {
      const [workersRes, assignmentsRes, projectsRes] = await Promise.all([
        supabase
          .from('workforce_directory')
          .select(WORKFORCE_PUBLIC_COLUMNS)
          .order('created_at', { ascending: false }),
        supabase
          .from('workforce_project_assignments')
          .select(
            'id, workforce_id, project_id, assigned_at, assigned_by, expected_end_date, actual_end_date, assignment_status, assignment_notes, created_at, updated_at'
          )
          .order('assigned_at', { ascending: false }),
        supabase
          .from('projects')
          .select('id, name, project_code, status')
          .order('name', { ascending: true }),
      ]);

      if (workersRes.error) {
        return { data: [], metrics: emptyMetrics, error: workersRes.error.message };
      }

      const projectsMap = new Map<string, ProjectSummary>();
      (projectsRes.data || []).forEach((p: any) => {
        projectsMap.set(p.id, {
          id: p.id,
          name: p.name,
          project_code: p.project_code || null,
          status: p.status || null,
        });
      });

      const assignmentsByWorker = new Map<string, WorkforceProjectAssignmentRecord[]>();
      if (!assignmentsRes.error && assignmentsRes.data) {
        (assignmentsRes.data as any[]).forEach((row) => {
          const rec: WorkforceProjectAssignmentRecord = {
            ...row,
            assignment_status: (row.assignment_status || 'active').toLowerCase(),
            project: projectsMap.get(row.project_id) || null,
          };
          const list = assignmentsByWorker.get(row.workforce_id) || [];
          list.push(rec);
          assignmentsByWorker.set(row.workforce_id, list);
        });
      }

      const allWorkers: WorkforceDirectoryRecord[] = ((workersRes.data || []) as any[]).map((w) => {
        const wAssignments = assignmentsByWorker.get(w.id) || [];
        const activeCount = wAssignments.filter(
          (a) => (a.assignment_status || '').toLowerCase() === 'active'
        ).length;
        return {
          ...w,
          status: (w.status || 'active').toLowerCase(),
          registration_notes: w.registration_notes ?? null,
          assignments: wAssignments,
          activeAssignmentsCount: activeCount,
        };
      });

      const metrics: WorkforceDirectoryMetrics = {
        totalRegistered: allWorkers.length,
        activeCount: allWorkers.filter((w) => w.status === 'active').length,
        inactiveCount: allWorkers.filter((w) => w.status === 'inactive').length,
        suspendedCount: allWorkers.filter((w) => w.status === 'suspended').length,
        assignedCount: allWorkers.filter((w) => (w.activeAssignmentsCount || 0) > 0).length,
        unassignedCount: allWorkers.filter((w) => (w.activeAssignmentsCount || 0) === 0).length,
      };

      let filtered = allWorkers;

      if (filters?.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        filtered = filtered.filter(
          (w) =>
            w.full_name.toLowerCase().includes(term) ||
            (w.phone_number || '').toLowerCase().includes(term) ||
            (w.address || '').toLowerCase().includes(term)
        );
      }

      if (filters?.status && filters.status !== 'all') {
        const target = filters.status.toLowerCase();
        filtered = filtered.filter((w) => (w.status || '').toLowerCase() === target);
      }

      if (filters?.assignmentFilter === 'assigned') {
        filtered = filtered.filter((w) => (w.activeAssignmentsCount || 0) > 0);
      } else if (filters?.assignmentFilter === 'unassigned') {
        filtered = filtered.filter((w) => (w.activeAssignmentsCount || 0) === 0);
      }

      return { data: filtered, metrics, error: null };
    } catch (err: any) {
      return {
        data: [],
        metrics: emptyMetrics,
        error: err?.message || 'Failed to load contract workforce directory.',
      };
    }
  }

  static async getMemberById(id: string): Promise<{
    data: WorkforceDirectoryRecord | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Supabase is not configured.' };
    }

    try {
      const [workerRes, assignmentsRes, projectsRes] = await Promise.all([
        supabase
          .from('workforce_directory')
          .select(WORKFORCE_PUBLIC_COLUMNS)
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('workforce_project_assignments')
          .select(
            'id, workforce_id, project_id, assigned_at, assigned_by, expected_end_date, actual_end_date, assignment_status, assignment_notes, created_at, updated_at'
          )
          .eq('workforce_id', id)
          .order('assigned_at', { ascending: false }),
        supabase.from('projects').select('id, name, project_code, status'),
      ]);

      if (workerRes.error) {
        return { data: null, error: workerRes.error.message };
      }
      if (!workerRes.data) {
        return { data: null, error: 'Workforce member record not found.' };
      }

      const projectsMap = new Map<string, ProjectSummary>();
      (projectsRes.data || []).forEach((p: any) => {
        projectsMap.set(p.id, {
          id: p.id,
          name: p.name,
          project_code: p.project_code || null,
          status: p.status || null,
        });
      });

      const assignments: WorkforceProjectAssignmentRecord[] = ((assignmentsRes.data || []) as any[]).map(
        (row) => ({
          ...row,
          assignment_status: (row.assignment_status || 'active').toLowerCase(),
          project: projectsMap.get(row.project_id) || null,
        })
      );

      return {
        data: {
          ...(workerRes.data as any),
          status: ((workerRes.data as any).status || 'active').toLowerCase(),
          registration_notes: (workerRes.data as any).registration_notes ?? null,
          assignments,
          activeAssignmentsCount: assignments.filter((a) => a.assignment_status === 'active').length,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Unable to load workforce profile.' };
    }
  }

  static async getWorkforceProtectedDetails(id: string): Promise<{
    data: WorkforceProtectedDetails | null;
    error: string | null;
    restricted?: boolean;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Supabase is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('get_workforce_protected_details', {
        p_workforce_id: id,
      });

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          return {
            data: {
              workforce_id: id,
              next_of_kin: null,
              next_of_kin_phone: null,
              bank_name: null,
              account_name: null,
              account_number: null,
            },
            error: null,
          };
        }
        return {
          data: {
            workforce_id: row.workforce_id || id,
            next_of_kin: row.next_of_kin ?? null,
            next_of_kin_phone: row.next_of_kin_phone ?? null,
            bank_name: row.bank_name ?? null,
            account_name: row.account_name ?? null,
            account_number: row.account_number ?? null,
          },
          error: null,
        };
      }

      if (isMissingRpcError(error)) {
        const fallbackRes = await supabase
          .from('workforce_directory')
          .select('id, next_of_kin, next_of_kin_phone, bank_name, account_name, account_number')
          .eq('id', id)
          .maybeSingle();

        if (fallbackRes.error) {
          const isPermErr =
            fallbackRes.error.code === '42501' ||
            fallbackRes.error.message.toLowerCase().includes('permission');
          return { data: null, error: fallbackRes.error.message, restricted: isPermErr };
        }

        const fb = fallbackRes.data as any;
        return {
          data: fb
            ? {
                workforce_id: fb.id || id,
                next_of_kin: fb.next_of_kin ?? null,
                next_of_kin_phone: fb.next_of_kin_phone ?? null,
                bank_name: fb.bank_name ?? null,
                account_name: fb.account_name ?? null,
                account_number: fb.account_number ?? null,
              }
            : null,
          error: null,
        };
      }

      const isRestricted =
        error.code === '42501' || error.message.toLowerCase().includes('permission');
      return { data: null, error: error.message, restricted: isRestricted };
    } catch (err: any) {
      return {
        data: null,
        error: err?.message || 'Unable to load protected workforce banking details.',
      };
    }
  }

  static async listAllAssignments(filters?: {
    search?: string;
    assignmentStatus?: 'all' | 'active' | 'completed' | 'cancelled';
  }): Promise<{
    data: WorkforceProjectAssignmentRecord[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Supabase is not configured.' };
    }

    try {
      const [assignmentsRes, workersRes, projectsRes] = await Promise.all([
        supabase
          .from('workforce_project_assignments')
          .select(
            'id, workforce_id, project_id, assigned_at, assigned_by, expected_end_date, actual_end_date, assignment_status, assignment_notes, created_at, updated_at'
          )
          .order('assigned_at', { ascending: false }),
        supabase.from('workforce_directory').select('id, full_name, phone_number, status'),
        supabase.from('projects').select('id, name, project_code, status'),
      ]);

      if (assignmentsRes.error) {
        return { data: [], error: assignmentsRes.error.message };
      }

      const workersMap = new Map<
        string,
        { id: string; full_name: string; phone_number: string; status: string }
      >();
      (workersRes.data || []).forEach((w: any) => {
        workersMap.set(w.id, {
          id: w.id,
          full_name: w.full_name,
          phone_number: w.phone_number,
          status: (w.status || 'active').toLowerCase(),
        });
      });

      const projectsMap = new Map<string, ProjectSummary>();
      (projectsRes.data || []).forEach((p: any) => {
        projectsMap.set(p.id, {
          id: p.id,
          name: p.name,
          project_code: p.project_code || null,
          status: p.status || null,
        });
      });

      let rows: WorkforceProjectAssignmentRecord[] = ((assignmentsRes.data || []) as any[]).map(
        (row) => ({
          ...row,
          assignment_status: (row.assignment_status || 'active').toLowerCase(),
          worker: workersMap.get(row.workforce_id) || null,
          project: projectsMap.get(row.project_id) || null,
        })
      );

      if (filters?.assignmentStatus && filters.assignmentStatus !== 'all') {
        rows = rows.filter((r) => r.assignment_status === filters.assignmentStatus);
      }

      if (filters?.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        rows = rows.filter(
          (r) =>
            (r.worker?.full_name || '').toLowerCase().includes(term) ||
            (r.worker?.phone_number || '').toLowerCase().includes(term) ||
            (r.project?.name || '').toLowerCase().includes(term) ||
            (r.project?.project_code || '').toLowerCase().includes(term) ||
            (r.assignment_notes || '').toLowerCase().includes(term)
        );
      }

      return { data: rows, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load assignment history.' };
    }
  }

  static async createMember(
    input: WorkforceDirectoryInput
  ): Promise<{ data: WorkforceDirectoryRecord | null; error: string | null }> {
    const fullName = input.full_name?.trim();
    const phone = input.phone_number?.trim();

    if (!fullName) {
      return { data: null, error: 'Full Name is required.' };
    }
    if (!phone) {
      return { data: null, error: 'Phone Number is required.' };
    }
    if (input.account_number?.trim() && !/^\d{6,20}$/.test(input.account_number.trim())) {
      return { data: null, error: 'Account Number must contain 6 to 20 digits.' };
    }

    try {
      // created_by / updated_by are populated server-side by trg_identity_workforce_directory
      const payload = {
        full_name: fullName,
        address: input.address?.trim() || null,
        phone_number: phone,
        next_of_kin: input.next_of_kin?.trim() || null,
        next_of_kin_phone: input.next_of_kin_phone?.trim() || null,
        bank_name: input.bank_name?.trim() || null,
        account_name: input.account_name?.trim() || null,
        account_number: input.account_number?.trim() || null,
        status: input.status || 'active',
        registration_notes: input.registration_notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('workforce_directory')
        .insert(payload)
        .select(WORKFORCE_PUBLIC_COLUMNS)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      await AuditLogger.log({
        action: 'CREATE_CONTRACT_WORKFORCE',
        module: 'workforce_directory',
        tableName: 'workforce_directory',
        recordId: data.id,
        newValues: {
          full_name: payload.full_name,
          phone_number: payload.phone_number,
          bank_name: payload.bank_name,
          account_number: maskBankAccountNumber(payload.account_number),
          status: payload.status,
          has_registration_notes: Boolean(payload.registration_notes),
        },
      });

      return { data: data as WorkforceDirectoryRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to register workforce member.' };
    }
  }

  static async updateMember(
    id: string,
    input: WorkforceDirectoryInput,
    previous?: WorkforceDirectoryRecord | null
  ): Promise<{ data: WorkforceDirectoryRecord | null; error: string | null }> {
    const fullName = input.full_name?.trim();
    const phone = input.phone_number?.trim();

    if (!fullName) {
      return { data: null, error: 'Full Name is required.' };
    }
    if (!phone) {
      return { data: null, error: 'Phone Number is required.' };
    }
    if (input.account_number?.trim() && !/^\d{6,20}$/.test(input.account_number.trim())) {
      return { data: null, error: 'Account Number must contain 6 to 20 digits.' };
    }

    try {
      // updated_by is set server-side via trigger auth.uid()
      const payload = {
        full_name: fullName,
        address: input.address?.trim() || null,
        phone_number: phone,
        next_of_kin: input.next_of_kin?.trim() || null,
        next_of_kin_phone: input.next_of_kin_phone?.trim() || null,
        bank_name: input.bank_name?.trim() || null,
        account_name: input.account_name?.trim() || null,
        account_number: input.account_number?.trim() || null,
        status: input.status || previous?.status || 'active',
        registration_notes: input.registration_notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('workforce_directory')
        .update(payload)
        .eq('id', id)
        .select(WORKFORCE_PUBLIC_COLUMNS)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      await AuditLogger.log({
        action: 'UPDATE_CONTRACT_WORKFORCE',
        module: 'workforce_directory',
        tableName: 'workforce_directory',
        recordId: id,
        oldValues: previous
          ? {
              full_name: previous.full_name,
              phone_number: previous.phone_number,
              bank_name: previous.bank_name,
              account_number: maskBankAccountNumber(previous.account_number),
              status: previous.status,
            }
          : undefined,
        newValues: {
          full_name: payload.full_name,
          phone_number: payload.phone_number,
          bank_name: payload.bank_name,
          account_number: maskBankAccountNumber(payload.account_number),
          status: payload.status,
          has_registration_notes: Boolean(payload.registration_notes),
        },
      });

      return { data: data as WorkforceDirectoryRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update workforce member.' };
    }
  }

  static async updateStatus(
    id: string,
    status: ContractWorkforceStatus,
    previousStatus?: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('workforce_directory')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) return { error: error.message };

      await AuditLogger.log({
        action: 'UPDATE_CONTRACT_WORKFORCE_STATUS',
        module: 'workforce_directory',
        tableName: 'workforce_directory',
        recordId: id,
        oldValues: previousStatus ? { status: previousStatus } : undefined,
        newValues: { status },
      });

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update status.' };
    }
  }

  static async listProjects(): Promise<{ data: ProjectSummary[]; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_code, status')
        .order('name', { ascending: true });

      if (error) return { data: [], error: error.message };
      return { data: (data || []) as ProjectSummary[], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load projects.' };
    }
  }

  static async assignToProject(
    input: AssignWorkforceProjectInput
  ): Promise<{ data: WorkforceProjectAssignmentRecord | null; error: string | null }> {
    if (!input.workforce_id || !input.project_id) {
      return { data: null, error: 'Please select a project to assign.' };
    }

    try {
      // Check for duplicate active assignment on the same project
      const { data: existingActive, error: dupErr } = await supabase
        .from('workforce_project_assignments')
        .select('id, assignment_status')
        .eq('workforce_id', input.workforce_id)
        .eq('project_id', input.project_id)
        .eq('assignment_status', 'active');

      if (dupErr) {
        return { data: null, error: dupErr.message };
      }

      if (existingActive && existingActive.length > 0) {
        return {
          data: null,
          error: 'This workforce member already has an active assignment on the selected project.',
        };
      }

      // assigned_by is populated server-side via trg_identity_workforce_assignments
      const payload = {
        workforce_id: input.workforce_id,
        project_id: input.project_id,
        assigned_at: input.assigned_at || new Date().toISOString(),
        expected_end_date: input.expected_end_date || null,
        assignment_status: 'active',
        assignment_notes: input.assignment_notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('workforce_project_assignments')
        .insert(payload)
        .select(
          'id, workforce_id, project_id, assigned_at, assigned_by, expected_end_date, actual_end_date, assignment_status, assignment_notes, created_at, updated_at'
        )
        .single();

      if (error) {
        if (error.code === '23505') {
          return {
            data: null,
            error: 'This workforce member already has an active assignment on the selected project.',
          };
        }
        return { data: null, error: error.message };
      }

      await AuditLogger.log({
        action: 'ASSIGN_CONTRACT_WORKFORCE_PROJECT',
        module: 'workforce_directory',
        tableName: 'workforce_project_assignments',
        recordId: data.id,
        newValues: payload,
      });

      return { data: data as WorkforceProjectAssignmentRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to assign workforce member to project.' };
    }
  }

  static async updateAssignmentStatus(
    assignmentId: string,
    status: 'completed' | 'cancelled'
  ): Promise<{ error: string | null }> {
    try {
      const actualEndDate = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('workforce_project_assignments')
        .update({
          assignment_status: status,
          actual_end_date: actualEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (error) return { error: error.message };

      await AuditLogger.log({
        action: `MARK_WORKFORCE_ASSIGNMENT_${status.toUpperCase()}`,
        module: 'workforce_directory',
        tableName: 'workforce_project_assignments',
        recordId: assignmentId,
        newValues: {
          assignment_status: status,
          actual_end_date: actualEndDate,
        },
      });

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update assignment status.' };
    }
  }
}
