import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { formatNigerianDate } from './materialsService';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'excused';

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

export interface AttendanceRecordItem {
  id: string;
  attendance_date: string;
  status: AttendanceStatus;
  recorded_by: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string | null;
  project_id: string;
  workforce_member_id: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  is_clocked_out: boolean;
  projects?: {
    id: string;
    name: string;
    project_code: string;
  } | null;
  workforce_members?: {
    id: string;
    workforce_code: string;
    trade: string;
    status: string;
    profiles?: {
      id: string;
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
      email?: string | null;
    } | null;
  } | null;
}

export interface AttendanceSummaryMetrics {
  totalExpected: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  halfDayCount: number;
  excusedCount: number;
  currentlyOnSiteCount: number;
  clockedOutCount: number;
}

export interface AttendanceFilterParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
  workforceMemberId?: string;
  status?: string;
  search?: string;
}

/**
 * Returns today's ISO date string (YYYY-MM-DD) in West Africa Time / Nigerian local context
 */
export function getNigerianTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats time from ISO timestamp
 */
export function formatTimeFromIso(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '--:--';
  }
}

export class AttendanceService {
  /**
   * Transforms raw attendance database row with derived clock-in and clock-out times
   */
  private static transformRow(row: any): AttendanceRecordItem {
    const createdAt = row.created_at || null;
    const updatedAt = row.updated_at || null;

    // A worker has clocked out if updated_at is distinctly after created_at (by at least 60 seconds)
    // or if the record status was explicitly closed.
    let isClockedOut = false;
    let clockOutTime: string | null = null;

    if (createdAt && updatedAt) {
      const createdMs = new Date(createdAt).getTime();
      const updatedMs = new Date(updatedAt).getTime();
      if (updatedMs - createdMs > 60000) {
        isClockedOut = true;
        clockOutTime = updatedAt;
      }
    }

    return {
      id: row.id,
      attendance_date: row.attendance_date,
      status: row.status as AttendanceStatus,
      recorded_by: row.recorded_by,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      project_id: row.project_id,
      workforce_member_id: row.workforce_member_id,
      clock_in_time: createdAt,
      clock_out_time: clockOutTime,
      is_clocked_out: isClockedOut,
      projects: row.projects || null,
      workforce_members: row.workforce_members || null,
    };
  }

  /**
   * Fetches today's attendance records
   */
  static async getTodayAttendance(filter?: AttendanceFilterParams): Promise<{
    records: AttendanceRecordItem[];
    metrics: AttendanceSummaryMetrics;
    error: string | null;
  }> {
    const today = getNigerianTodayIso();
    return this.getAttendanceRegister({ ...filter, date: today });
  }

  /**
   * Comprehensive attendance register query with optional filters
   */
  static async getAttendanceRegister(filter?: AttendanceFilterParams): Promise<{
    records: AttendanceRecordItem[];
    metrics: AttendanceSummaryMetrics;
    error: string | null;
  }> {
    const emptyMetrics: AttendanceSummaryMetrics = {
      totalExpected: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      halfDayCount: 0,
      excusedCount: 0,
      currentlyOnSiteCount: 0,
      clockedOutCount: 0,
    };

    if (!isSupabaseConfigured) {
      return { records: [], metrics: emptyMetrics, error: 'Database connection is not configured.' };
    }

    try {
      await ensureValidSession();

      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          attendance_date,
          status,
          recorded_by,
          latitude,
          longitude,
          created_at,
          updated_at,
          project_id,
          workforce_member_id,
          projects:project_id (
            id,
            name,
            project_code
          ),
          workforce_members:workforce_member_id (
            id,
            workforce_code,
            trade,
            status,
            profiles:profiles!workforce_members_profile_id_fkey (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url,
              email
            )
          )
        `)
        .order('attendance_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter?.date && filter.date.trim()) {
        query = query.eq('attendance_date', filter.date.trim());
      }
      if (filter?.startDate) {
        query = query.gte('attendance_date', filter.startDate);
      }
      if (filter?.endDate) {
        query = query.lte('attendance_date', filter.endDate);
      }
      if (filter?.projectId && filter.projectId !== 'all') {
        query = query.eq('project_id', filter.projectId);
      }
      if (filter?.workforceMemberId && filter.workforceMemberId !== 'all') {
        query = query.eq('workforce_member_id', filter.workforceMemberId);
      }
      if (filter?.status && filter.status !== 'all') {
        query = query.eq('status', filter.status);
      }

      const { data, error } = await query;
      if (error) {
        return { records: [], metrics: emptyMetrics, error: error.message };
      }

      let records = (data || []).map(this.transformRow);

      // Search filter across worker name, code, trade, project
      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        records = records.filter((r) => {
          const prof = r.workforce_members?.profiles;
          const name = (
            prof?.display_name ||
            `${prof?.first_name || ''} ${prof?.last_name || ''}`
          ).toLowerCase();
          const code = (r.workforce_members?.workforce_code || '').toLowerCase();
          const trade = (r.workforce_members?.trade || '').toLowerCase();
          const projName = (r.projects?.name || '').toLowerCase();
          const projCode = (r.projects?.project_code || '').toLowerCase();

          return (
            name.includes(term) ||
            code.includes(term) ||
            trade.includes(term) ||
            projName.includes(term) ||
            projCode.includes(term)
          );
        });
      }

      // Calculate live summary metrics
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let halfDayCount = 0;
      let excusedCount = 0;
      let clockedOutCount = 0;
      let currentlyOnSiteCount = 0;

      for (const r of records) {
        if (r.status === 'present') presentCount++;
        else if (r.status === 'late') lateCount++;
        else if (r.status === 'absent') absentCount++;
        else if (r.status === 'half_day') halfDayCount++;
        else if (r.status === 'excused') excusedCount++;

        if (r.is_clocked_out) {
          clockedOutCount++;
        } else if (r.status === 'present' || r.status === 'late') {
          currentlyOnSiteCount++;
        }
      }

      const metrics: AttendanceSummaryMetrics = {
        totalExpected: records.length,
        presentCount,
        lateCount,
        absentCount,
        halfDayCount,
        excusedCount,
        currentlyOnSiteCount,
        clockedOutCount,
      };

      return { records, metrics, error: null };
    } catch (err: any) {
      return {
        records: [],
        metrics: emptyMetrics,
        error: err instanceof Error ? err.message : 'Failed to query attendance register.',
      };
    }
  }

  /**
   * Clock in a worker (operational supervisor or worker self-clock)
   */
  static async clockInWorker(params: {
    projectId: string;
    workforceMemberId: string;
    status?: AttendanceStatus;
    latitude?: number;
    longitude?: number;
  }): Promise<{ data: AttendanceRecordItem | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) {
        return { data: null, error: 'User session is not authenticated.' };
      }

      const today = getNigerianTodayIso();
      const status = params.status || 'present';

      // 1. Check for duplicate attendance entry for this worker on this project today
      const { data: existing, error: checkErr } = await supabase
        .from('attendance_records')
        .select('id, status, created_at')
        .eq('workforce_member_id', params.workforceMemberId)
        .eq('project_id', params.projectId)
        .eq('attendance_date', today)
        .maybeSingle();

      if (checkErr) {
        return { data: null, error: `Verification failed: ${checkErr.message}` };
      }

      if (existing) {
        return {
          data: null,
          error: `Worker is already clocked in / recorded for today (${existing.status.toUpperCase()}). Duplicate entry prevented.`,
        };
      }

      // 2. Insert new verified attendance record
      const payload: any = {
        project_id: params.projectId,
        workforce_member_id: params.workforceMemberId,
        attendance_date: today,
        status,
        recorded_by: session.user.id,
      };

      if (params.latitude != null) payload.latitude = params.latitude;
      if (params.longitude != null) payload.longitude = params.longitude;

      const { data: inserted, error: insertErr } = await supabase
        .from('attendance_records')
        .insert(payload)
        .select(`
          id,
          attendance_date,
          status,
          recorded_by,
          latitude,
          longitude,
          created_at,
          updated_at,
          project_id,
          workforce_member_id,
          projects:project_id ( id, name, project_code ),
          workforce_members:workforce_member_id (
            id,
            workforce_code,
            trade,
            status,
            profiles:profiles!workforce_members_profile_id_fkey ( id, display_name, first_name, last_name )
          )
        `)
        .single();

      if (insertErr) {
        return { data: null, error: insertErr.message };
      }

      return { data: this.transformRow(inserted), error: null };
    } catch (err: any) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to clock in worker.',
      };
    }
  }

  /**
   * Clock out worker: updates existing attendance record
   */
  static async clockOutWorker(attendanceRecordId: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) {
        return { success: false, error: 'User session is not authenticated.' };
      }

      // Verify the record exists and check if already clocked out
      const { data: record, error: findErr } = await supabase
        .from('attendance_records')
        .select('id, created_at, updated_at, status')
        .eq('id', attendanceRecordId)
        .single();

      if (findErr || !record) {
        return { success: false, error: findErr ? findErr.message : 'Attendance record not found.' };
      }

      const createdMs = new Date(record.created_at).getTime();
      const updatedMs = record.updated_at ? new Date(record.updated_at).getTime() : 0;
      if (updatedMs - createdMs > 60000) {
        return { success: false, error: 'Worker has already been clocked out for this session.' };
      }

      // Update timestamp to register departure
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('attendance_records')
        .update({
          updated_at: nowIso,
        })
        .eq('id', attendanceRecordId);

      if (updateErr) {
        return { success: false, error: updateErr.message };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to clock out worker.',
      };
    }
  }

  /**
   * Manual attendance record (for setting specific status, e.g. Absent, Excused, Half-Day)
   */
  static async recordAttendance(params: {
    projectId: string;
    workforceMemberId: string;
    attendanceDate: string;
    status: AttendanceStatus;
    latitude?: number;
    longitude?: number;
  }): Promise<{ data: AttendanceRecordItem | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) {
        return { data: null, error: 'User session is not authenticated.' };
      }

      const dateStr = params.attendanceDate.trim();

      // Check existing record
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('workforce_member_id', params.workforceMemberId)
        .eq('project_id', params.projectId)
        .eq('attendance_date', dateStr)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { data: updated, error: updErr } = await supabase
          .from('attendance_records')
          .update({
            status: params.status,
            recorded_by: session.user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select(`
            id,
            attendance_date,
            status,
            recorded_by,
            latitude,
            longitude,
            created_at,
            updated_at,
            project_id,
            workforce_member_id,
            projects:project_id ( id, name, project_code ),
            workforce_members:workforce_member_id (
              id,
              workforce_code,
              trade,
              status,
              profiles:profiles!workforce_members_profile_id_fkey ( id, display_name, first_name, last_name )
            )
          `)
          .single();

        if (updErr) return { data: null, error: updErr.message };
        return { data: this.transformRow(updated), error: null };
      }

      // Insert new
      const payload: any = {
        project_id: params.projectId,
        workforce_member_id: params.workforceMemberId,
        attendance_date: dateStr,
        status: params.status,
        recorded_by: session.user.id,
      };

      if (params.latitude != null) payload.latitude = params.latitude;
      if (params.longitude != null) payload.longitude = params.longitude;

      const { data: inserted, error: insErr } = await supabase
        .from('attendance_records')
        .insert(payload)
        .select(`
          id,
          attendance_date,
          status,
          recorded_by,
          latitude,
          longitude,
          created_at,
          updated_at,
          project_id,
          workforce_member_id,
          projects:project_id ( id, name, project_code ),
          workforce_members:workforce_member_id (
            id,
            workforce_code,
            trade,
            status,
            profiles:profiles!workforce_members_profile_id_fkey ( id, display_name, first_name, last_name )
          )
        `)
        .single();

      if (insErr) return { data: null, error: insErr.message };
      return { data: this.transformRow(inserted), error: null };
    } catch (err: any) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to record attendance.',
      };
    }
  }

  /**
   * Fetches single attendance record by ID
   */
  static async getAttendanceById(id: string): Promise<{ data: AttendanceRecordItem | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      await ensureValidSession();
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          attendance_date,
          status,
          recorded_by,
          latitude,
          longitude,
          created_at,
          updated_at,
          project_id,
          workforce_member_id,
          projects:project_id ( id, name, project_code ),
          workforce_members:workforce_member_id (
            id,
            workforce_code,
            trade,
            status,
            phone,
            emergency_contact_name,
            emergency_contact_phone,
            profiles:profiles!workforce_members_profile_id_fkey (
              id,
              display_name,
              first_name,
              last_name,
              avatar_url,
              email
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) return { data: null, error: error.message };
      return { data: this.transformRow(data), error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to fetch attendance details.' };
    }
  }
}
