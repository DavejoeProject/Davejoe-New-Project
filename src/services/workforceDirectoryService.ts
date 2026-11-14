import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';

export type ContractWorkforceStatus = 'active' | 'inactive' | 'suspended';
export type WorkforceAssignmentStatus = 'active' | 'completed' | 'cancelled';

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
}

export interface WorkforceDirectoryRecord {
  id: string;
  full_name: string;
  address: string | null;
  phone_number: string;
  next_of_kin: string | null;
  next_of_kin_phone: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  status: ContractWorkforceStatus | string;
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
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('workforce_project_assignments')
          .select('*')
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
        supabase.from('workforce_directory').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('workforce_project_assignments')
          .select('*')
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
          assignments,
          activeAssignmentsCount: assignments.filter((a) => a.assignment_status === 'active').length,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Unable to load workforce profile.' };
    }
  }

  static async createMember(
    input: WorkforceDirectoryInput,
    actorUserId?: string
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
        created_by: actorUserId || null,
        updated_by: actorUserId || null,
      };

      const { data, error } = await supabase
        .from('workforce_directory')
        .insert(payload)
        .select('*')
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
    actorUserId?: string,
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
        updated_by: actorUserId || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('workforce_directory')
        .update(payload)
        .eq('id', id)
        .select('*')
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
    actorUserId?: string,
    previousStatus?: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('workforce_directory')
        .update({
          status,
          updated_by: actorUserId || null,
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
    input: AssignWorkforceProjectInput,
    actorUserId?: string
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

      const payload = {
        workforce_id: input.workforce_id,
        project_id: input.project_id,
        assigned_at: input.assigned_at || new Date().toISOString(),
        assigned_by: actorUserId || null,
        expected_end_date: input.expected_end_date || null,
        assignment_status: 'active',
        assignment_notes: input.assignment_notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('workforce_project_assignments')
        .insert(payload)
        .select('*')
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
    status: 'completed' | 'cancelled',
    actorUserId?: string
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
          updated_by: actorUserId || null,
        },
      });

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update assignment status.' };
    }
  }
}
