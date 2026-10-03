import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  WorkforceMemberRecord,
  ProjectAssignmentItem,
  WorkforceStatus,
} from './workforceService';

export interface AttendanceRecordItem {
  id: string;
  attendance_date: string;
  status: string;
  recorded_by: string | null;
  created_at: string;
  project_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
}

export interface ProductivityRecordItem {
  id: string;
  work_date: string | null;
  unit_of_measure: string | null;
  count: number | null;
  notes: string | null;
  created_at: string;
  project_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
}

export interface OvertimeRequestItem {
  id: string;
  requested_hours: number;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  project_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
}

export interface ConductRecordItem {
  id: string;
  record_type: string | null;
  severity: string;
  description: string | null;
  action_taken: string | null;
  recorded_by: string | null;
  created_at: string;
  project_id: string;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
}

export interface OperationalSnapshotMetrics {
  activeAssignmentCount: number;
  totalAssignmentsCount: number;
  attendanceCount: number;
  productivityCount: number;
  overtimeCount: number;
  conductCount: number;
}

export class WorkforceControlService {
  /**
   * Fetches the complete profile and details of an individual workforce member
   */
  static async getWorkforceMember(
    workforceId: string
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
          updated_at,
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
        .eq('id', workforceId)
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
        .eq('workforce_member_id', workforceId)
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
   * Fetches operational snapshot metrics for the overview tab
   */
  static async getOperationalSnapshot(
    workforceId: string
  ): Promise<{ data: OperationalSnapshotMetrics; error: string | null }> {
    const defaultMetrics: OperationalSnapshotMetrics = {
      activeAssignmentCount: 0,
      totalAssignmentsCount: 0,
      attendanceCount: 0,
      productivityCount: 0,
      overtimeCount: 0,
      conductCount: 0,
    };

    if (!isSupabaseConfigured) {
      return { data: defaultMetrics, error: 'Database is not configured.' };
    }

    try {
      const [assignRes, attRes, prodRes, otRes, condRes] = await Promise.all([
        supabase
          .from('project_workforce_assignments')
          .select('id, is_active')
          .eq('workforce_member_id', workforceId),
        supabase
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('workforce_member_id', workforceId),
        supabase
          .from('productivity_records')
          .select('id', { count: 'exact', head: true })
          .eq('workforce_member_id', workforceId),
        supabase
          .from('overtime_requests')
          .select('id', { count: 'exact', head: true })
          .eq('workforce_member_id', workforceId),
        supabase
          .from('workforce_conduct_records')
          .select('id', { count: 'exact', head: true })
          .eq('workforce_member_id', workforceId),
      ]);

      const anyError =
        assignRes.error || attRes.error || prodRes.error || otRes.error || condRes.error;
      if (anyError) {
        return { data: defaultMetrics, error: anyError.message };
      }

      const assignments = assignRes.data || [];
      const activeAssignments = assignments.filter((a) => a.is_active).length;

      return {
        data: {
          activeAssignmentCount: activeAssignments,
          totalAssignmentsCount: assignments.length,
          attendanceCount: attRes.count ?? 0,
          productivityCount: prodRes.count ?? 0,
          overtimeCount: otRes.count ?? 0,
          conductCount: condRes.count ?? 0,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: defaultMetrics, error: err?.message || 'Failed to fetch snapshot.' };
    }
  }

  /**
   * Fetches real attendance records for this workforce member
   */
  static async getAttendanceRecords(
    workforceId: string
  ): Promise<{ data: AttendanceRecordItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          attendance_date,
          status,
          recorded_by,
          created_at,
          project_id,
          projects (
            id,
            name,
            project_code
          )
        `)
        .eq('workforce_member_id', workforceId)
        .order('attendance_date', { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as unknown as AttendanceRecordItem[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load attendance records.' };
    }
  }

  /**
   * Fetches real productivity records for this workforce member
   */
  static async getProductivityRecords(
    workforceId: string
  ): Promise<{ data: ProductivityRecordItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('productivity_records')
        .select(`
          id,
          work_date,
          unit_of_measure,
          count,
          notes,
          created_at,
          project_id,
          projects (
            id,
            name,
            project_code
          )
        `)
        .eq('workforce_member_id', workforceId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as unknown as ProductivityRecordItem[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load productivity records.' };
    }
  }

  /**
   * Fetches real overtime requests for this workforce member
   */
  static async getOvertimeRequests(
    workforceId: string
  ): Promise<{ data: OvertimeRequestItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
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
          projects (
            id,
            name,
            project_code
          )
        `)
        .eq('workforce_member_id', workforceId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as unknown as OvertimeRequestItem[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load overtime requests.' };
    }
  }

  /**
   * Fetches real conduct records for this workforce member
   */
  static async getConductRecords(
    workforceId: string
  ): Promise<{ data: ConductRecordItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      const { data, error } = await supabase
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
          projects (
            id,
            name,
            project_code
          )
        `)
        .eq('workforce_member_id', workforceId)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: (data as unknown as ConductRecordItem[]) || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load conduct records.' };
    }
  }

  /**
   * Ends an active project assignment by setting is_active = false
   */
  static async endAssignment(assignmentId: string): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: 'Database is not configured.' };
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('project_workforce_assignments')
        .update({
          is_active: false,
          end_date: today,
        })
        .eq('id', assignmentId);

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to end assignment.' };
    }
  }

  /**
   * Updates workforce status (active, inactive, suspended, terminated)
   */
  static async updateStatus(
    workforceId: string,
    status: WorkforceStatus
  ): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) {
      return { error: 'Database is not configured.' };
    }

    try {
      const { error } = await supabase
        .from('workforce_members')
        .update({ status })
        .eq('id', workforceId);

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update status.' };
    }
  }
}
