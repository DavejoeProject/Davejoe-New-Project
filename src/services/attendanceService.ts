import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { formatNigerianDate } from './materialsService';
import { AuthService } from './authService';

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
    dotClasses: 'bg-[#18b892]',
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
  projectIds?: string[];
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
   * Authoritative project authorization check for attendance management.
   */
  private static async isProjectAuthorizedForUser(userId: string, projectId: string): Promise<boolean> {
    try {
      const { assignedSlugs } = await AuthService.getUserRolesDetailed(userId);
      const isPrivileged = assignedSlugs.some((s) =>
        ['admin', 'management', 'executive_director'].includes(s.toLowerCase().trim())
      );
      if (isPrivileged) return true;

      const { data: member } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .maybeSingle();
      if (member) return true;

      const { data: wfMember } = await supabase
        .from('workforce_members')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (wfMember?.id) {
        const { data: assignment } = await supabase
          .from('project_workforce_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('workforce_member_id', wfMember.id)
          .eq('is_active', true)
          .maybeSingle();
        if (assignment) return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Transforms raw attendance database row with derived clock-in and clock-out times
   */
  private static transformRow(row: any): AttendanceRecordItem {
    const createdAt = row.created_at || null;
    const updatedAt = row.updated_at || null;

    let isClockedOut = false;
    let clockOutTime: string | null = null;

    if (row.actual_hours != null && Number(row.actual_hours) > 0) {
      isClockedOut = true;
      clockOutTime = updatedAt || createdAt;
    } else if (row.evidence_reference === 'clock_out_recorded') {
      isClockedOut = true;
      clockOutTime = updatedAt || createdAt;
    } else if (createdAt && updatedAt) {
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
      if (filter?.projectIds && filter.projectIds.length > 0) {
        query = query.in('project_id', filter.projectIds);
      } else if (filter?.projectId && filter.projectId !== 'all') {
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
   * Enforces project authorization, duplicate prevention, and authentic geolocation capture.
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

      if (!params.projectId) {
        return { data: null, error: 'Project is required.' };
      }
      if (!params.workforceMemberId) {
        return { data: null, error: 'Workforce member is required.' };
      }

      // 1. Authoritative project authorization check
      const isAuthorized = await this.isProjectAuthorizedForUser(session.user.id, params.projectId);
      if (!isAuthorized) {
        return { data: null, error: 'Access Denied: You are not an assigned supervisor for this project.' };
      }

      const today = getNigerianTodayIso();
      const status = params.status || 'present';

      // 2. Strict verification: prevent duplicate shift for this worker on this project today
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
          error: `Worker is already clocked in / recorded for today (${existing.status.toUpperCase()}). Duplicate shifts are prevented.`,
        };
      }

      // 3. Genuine evidence typing without coordinate fabrication
      const hasValidGps =
        params.latitude != null &&
        !isNaN(params.latitude) &&
        params.longitude != null &&
        !isNaN(params.longitude) &&
        (params.latitude !== 0 || params.longitude !== 0);

      const payload: any = {
        project_id: params.projectId,
        workforce_member_id: params.workforceMemberId,
        attendance_date: today,
        status,
        expected_hours: 8,
        evidence_type: hasValidGps ? 'gps' : 'manual',
        evidence_reference: 'clock_in_recorded',
        recorded_by: session.user.id,
      };

      if (hasValidGps) {
        payload.latitude = params.latitude;
        payload.longitude = params.longitude;
      }

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
          actual_hours,
          expected_hours,
          evidence_type,
          evidence_reference,
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
   * Clock out worker: records departure timestamp and calculates actual hours worked.
   * Rejects invalid or negative work durations and unassigned project mutations.
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

      if (!attendanceRecordId) {
        return { success: false, error: 'Attendance record ID is required.' };
      }

      // 1. Verify the record exists
      const { data: record, error: findErr } = await supabase
        .from('attendance_records')
        .select('id, project_id, created_at, updated_at, actual_hours, evidence_reference, status')
        .eq('id', attendanceRecordId)
        .single();

      if (findErr || !record) {
        return { success: false, error: findErr ? findErr.message : 'Attendance record not found.' };
      }

      // 2. Authoritative project authorization check
      const isAuthorized = await this.isProjectAuthorizedForUser(session.user.id, record.project_id);
      if (!isAuthorized) {
        return { success: false, error: 'Access Denied: You are not authorized to modify attendance for this project.' };
      }

      // 3. Prevent clock-out on already-closed shift
      const isAlreadyOut =
        (record.actual_hours != null && Number(record.actual_hours) > 0) ||
        record.evidence_reference === 'clock_out_recorded';
      if (isAlreadyOut) {
        return { success: false, error: 'Worker has already been clocked out for this session.' };
      }

      // 4. Validate work duration: departure cannot precede arrival
      const createdMs = new Date(record.created_at).getTime();
      const nowMs = Date.now();
      if (nowMs < createdMs) {
        return { success: false, error: 'Invalid work duration: Departure timestamp cannot precede clock-in timestamp.' };
      }

      // Calculate work duration in hours rounded to 2 decimals (minimum 0.1 hours for logged session)
      const durationHours = Math.max(0.1, Math.round(((nowMs - createdMs) / 3600000) * 100) / 100);
      const nowIso = new Date().toISOString();

      // 5. Update record with departure timestamp & actual hours worked
      const { error: updateErr } = await supabase
        .from('attendance_records')
        .update({
          actual_hours: durationHours,
          evidence_reference: 'clock_out_recorded',
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

      if (!params.projectId) return { data: null, error: 'Project is required.' };
      if (!params.workforceMemberId) return { data: null, error: 'Workforce member is required.' };
      if (!params.attendanceDate) return { data: null, error: 'Attendance date is required.' };

      // Authoritative project authorization check
      const isAuthorized = await this.isProjectAuthorizedForUser(session.user.id, params.projectId);
      if (!isAuthorized) {
        return { data: null, error: 'Access Denied: You are not an assigned supervisor for this project.' };
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
      const hasGps =
        params.latitude != null &&
        !isNaN(params.latitude) &&
        params.longitude != null &&
        !isNaN(params.longitude) &&
        (params.latitude !== 0 || params.longitude !== 0);

      const payload: any = {
        project_id: params.projectId,
        workforce_member_id: params.workforceMemberId,
        attendance_date: dateStr,
        status: params.status,
        expected_hours: 8,
        evidence_type: hasGps ? 'gps' : 'manual',
        evidence_reference: 'manual_register_recorded',
        recorded_by: session.user.id,
      };

      if (hasGps) {
        payload.latitude = params.latitude;
        payload.longitude = params.longitude;
      }

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

  /**
   * Universal resolution of today's attendance status for any non-leadership user
   */
  static async getUserTodayAttendanceStatus(userId: string): Promise<{
    hasRecord: boolean;
    attendanceId: string | null;
    status: AttendanceStatus | 'not_recorded';
    clockInTime: string | null;
    clockOutTime: string | null;
    isClockedIn: boolean;
    isClockedOut: boolean;
    actualHours: number;
    projectName: string | null;
    projectId: string | null;
    error: string | null;
  }> {
    const fallback = {
      hasRecord: false,
      attendanceId: null,
      status: 'not_recorded' as const,
      clockInTime: null,
      clockOutTime: null,
      isClockedIn: false,
      isClockedOut: false,
      actualHours: 0,
      projectName: null,
      projectId: null,
      error: null,
    };

    if (!isSupabaseConfigured || !userId) return fallback;

    try {
      await ensureValidSession();
      const today = getNigerianTodayIso();

      // 1. Find linked workforce_member record
      const { data: wfMember } = await supabase
        .from('workforce_members')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      const memberId = wfMember?.id;

      // 2. Query today's attendance record
      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          attendance_date,
          status,
          created_at,
          updated_at,
          actual_hours,
          project_id,
          projects:project_id(id, name)
        `)
        .eq('attendance_date', today);

      if (memberId) {
        query = query.or(`workforce_member_id.eq.${memberId},recorded_by.eq.${userId}`);
      } else {
        query = query.eq('recorded_by', userId);
      }

      let record: any = null;
      const { data: recordData, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!error && recordData) {
        record = recordData;
      } else if (error) {
        let fallbackQuery = supabase
          .from('attendance_records')
          .select('id, attendance_date, status, created_at, updated_at, actual_hours, project_id')
          .eq('attendance_date', today);

        if (memberId) {
          fallbackQuery = fallbackQuery.or(`workforce_member_id.eq.${memberId},recorded_by.eq.${userId}`);
        } else {
          fallbackQuery = fallbackQuery.eq('recorded_by', userId);
        }

        const { data: fbData } = await fallbackQuery.order('created_at', { ascending: false }).limit(1).maybeSingle();
        record = fbData;
      }

      if (!record) return fallback;

      const createdAt = record.created_at;
      const updatedAt = record.updated_at;
      let isOut = false;
      let clockOutTime: string | null = null;
      let actualHours = Number(record.actual_hours) || 0;

      if (createdAt && updatedAt) {
        const diffMs = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
        if (diffMs > 60000 || actualHours > 0) {
          isOut = true;
          clockOutTime = updatedAt;
          if (actualHours <= 0) {
            actualHours = Number((diffMs / 3600000).toFixed(2));
          }
        }
      }

      return {
        hasRecord: true,
        attendanceId: record.id,
        status: (record.status as AttendanceStatus) || 'present',
        clockInTime: createdAt,
        clockOutTime,
        isClockedIn: !isOut,
        isClockedOut: isOut,
        actualHours,
        projectName: (record as any).projects?.name || 'Project Operation',
        projectId: record.project_id || null,
        error: null,
      };
    } catch (err: any) {
      console.warn('[AttendanceService] getUserTodayAttendanceStatus warning:', err);
      return fallback;
    }
  }

  /**
   * Resolves or dynamically ensures a workforce_members identity for any corporate or field user.
   * Covers all 9 enterprise and operational roles:
   * Management/CEO, Executive Director, Admin, Site Supervisor, Technical QC,
   * Procurement & Logistics, Accounts & Finance, Artisan, Social Media Manager.
   */
  static async resolveOrCreateStaffIdentity(
    userId: string,
    profile: any,
    assignedSlugs: string[] = []
  ): Promise<string | null> {
    if (!isSupabaseConfigured || !userId) return null;

    // Resolve assigned roles if not provided
    let activeSlugs = [...assignedSlugs];
    if (activeSlugs.length === 0) {
      try {
        const { assignedSlugs: fetchedSlugs } = await AuthService.getUserRolesDetailed(userId);
        if (fetchedSlugs && fetchedSlugs.length > 0) {
          activeSlugs = fetchedSlugs;
        }
      } catch (rolesErr) {
        console.warn('[AttendanceService] Could not pre-fetch user roles for identity resolution:', rolesErr);
      }
    }

    const primaryRole = activeSlugs[0] || 'staff';
    const rolePrefixes: Record<string, string> = {
      supervisor: 'SUP',
      technical: 'QC',
      procurement: 'LOG',
      accounts: 'ACC',
      artisan: 'ART',
      social_media_manager: 'SMM',
      admin: 'ADM',
      management: 'MGT',
      executive_director: 'EXEC',
    };
    const prefix = rolePrefixes[primaryRole] || 'STF';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedCode = `${prefix}-${randomSuffix}`;

    const roleTrades: Record<string, string> = {
      supervisor: 'Site Supervisor',
      technical: 'Technical Inspection & QC Officer',
      procurement: 'Procurement & Logistics Officer',
      accounts: 'Accounts & Finance Officer',
      artisan: 'Site Artisan',
      social_media_manager: 'Social Media & Communications Manager',
      admin: 'Admin & Workforce Coordinator',
      management: 'Management / CEO',
      executive_director: 'Executive Director',
    };
    const tradeLabel = profile?.job_title || roleTrades[primaryRole] || 'Enterprise Staff';

    // Phase 1: Check if already explicitly linked by profile_id
    try {
      const { data: existingWf, error: existingErr } = await supabase
        .from('workforce_members')
        .select('id, workforce_code, trade')
        .eq('profile_id', userId)
        .maybeSingle();

      if (!existingErr && existingWf?.id) {
        return existingWf.id;
      }
    } catch (err) {
      console.warn('[AttendanceService] Phase 1 check error:', err);
    }

    // Phase 2: Call SECURITY DEFINER RPC ensure_user_workforce_member
    // Supports parameter signatures: { p_user_id: userId }, { user_id: userId }, or parameterless {}
    const rpcAttempts = [
      { name: 'ensure_user_workforce_member', args: { p_user_id: userId } },
      { name: 'ensure_user_workforce_member', args: { user_id: userId } },
      { name: 'ensure_user_workforce_member', args: {} },
    ];

    for (const attempt of rpcAttempts) {
      try {
        const { data: rpcWfId, error: rpcErr } = await supabase.rpc(attempt.name, attempt.args);
        if (!rpcErr && rpcWfId && typeof rpcWfId === 'string' && rpcWfId.length > 10) {
          return rpcWfId;
        }
        if (rpcErr) {
          console.warn(`[AttendanceService] Phase 2 RPC attempt (${JSON.stringify(attempt.args)}) returned:`, rpcErr.message);
        }
      } catch (rpcEx) {
        console.warn('[AttendanceService] Phase 2 RPC exception:', rpcEx);
      }
    }

    // Phase 3: Match with an existing unlinked workforce_member record (by phone)
    try {
      const phone = profile?.phone?.trim();
      if (phone) {
        const { data: matchedPhoneWf } = await supabase
          .from('workforce_members')
          .select('id, profile_id')
          .eq('phone', phone)
          .maybeSingle();

        if (matchedPhoneWf?.id) {
          if (!matchedPhoneWf.profile_id) {
            await supabase
              .from('workforce_members')
              .update({ profile_id: userId, status: 'active' })
              .eq('id', matchedPhoneWf.id);
          }
          return matchedPhoneWf.id;
        }
      }
    } catch (phoneErr) {
      console.warn('[AttendanceService] Phase 3 phone link warning:', phoneErr);
    }

    // Phase 4: Direct client-side insertion into public.workforce_members
    const insertPayload: any = {
      workforce_code: generatedCode,
      trade: tradeLabel,
      status: 'active',
      profile_id: userId,
      phone: profile?.phone?.trim() || null,
      created_by: userId,
      notes: `Staff profile enrolled for ${tradeLabel} daily operational attendance`,
    };

    try {
      const { data: createdWf, error: insertErr } = await supabase
        .from('workforce_members')
        .insert(insertPayload)
        .select('id')
        .single();

      if (!insertErr && createdWf?.id) {
        return createdWf.id;
      }

      if (insertErr) {
        console.warn('[AttendanceService] Phase 4 direct insert returned:', insertErr.message);
      }
    } catch (err) {
      console.warn('[AttendanceService] Phase 4 direct insert exception:', err);
    }

    // Phase 5: Re-check if parallel action or DB trigger created the record
    try {
      const { data: recheckedWf } = await supabase
        .from('workforce_members')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      if (recheckedWf?.id) {
        return recheckedWf.id;
      }
    } catch {
      // Non-blocking
    }

    return null;
  }

  /**
   * Universal Clock-In for ALL Active Authorized Staff Roles:
   * Site Supervisor, Technical QC, Procurement & Logistics, Accounts & Finance,
   * Artisan, Social Media Manager, Admin, Management / CEO, and Executive Director.
   */
  static async clockInNonLeadershipUser(params: {
    userId: string;
    projectId?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ success: boolean; data?: any; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) return { success: false, error: 'User is not authenticated.' };

      // 1. Verify user profile and account status
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, status, display_name, first_name, last_name, job_title, phone')
        .eq('id', params.userId)
        .maybeSingle();

      if (profile?.status && profile.status.toLowerCase().trim() !== 'active') {
        return {
          success: false,
          error: `Account status is ${profile.status.toUpperCase()}. Only active personnel may clock in.`,
        };
      }

      // 2. Allow all 9 corporate and field roles to record daily attendance
      const { assignedSlugs } = await AuthService.getUserRolesDetailed(params.userId);

      // 3. Resolve or auto-ensure workforce_members record for staff
      const workforceMemberId = await AttendanceService.resolveOrCreateStaffIdentity(
        params.userId,
        profile,
        assignedSlugs
      );

      if (!workforceMemberId) {
        return {
          success: false,
          error: 'Unable to establish employee attendance identity in database. Please ask an Administrator to register you in the Staff Directory.',
        };
      }

      // 4. Resolve target project
      let targetProjectId = params.projectId;
      if (!targetProjectId) {
        // Check active assignment
        const { data: assign } = await supabase
          .from('project_workforce_assignments')
          .select('project_id')
          .eq('workforce_member_id', workforceMemberId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (assign?.project_id) {
          targetProjectId = assign.project_id;
        } else {
          // Fallback to first available enterprise project
          const { data: proj } = await supabase.from('projects').select('id').limit(1).maybeSingle();
          targetProjectId = proj?.id;

          // If no projects exist in database, create a default operational project
          if (!targetProjectId) {
            try {
              const { data: defaultProj } = await supabase
                .from('projects')
                .insert({
                  name: 'Davejoe Head Office & Central Operations',
                  project_code: 'HQ-OPS',
                  status: 'in_progress',
                  description: 'Default operational location for corporate and site attendance',
                  created_by: params.userId,
                })
                .select('id')
                .maybeSingle();
              if (defaultProj?.id) {
                targetProjectId = defaultProj.id;
              }
            } catch {
              // Non-blocking
            }
          }
        }
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No active project or operational site found to register attendance.',
        };
      }

      const today = getNigerianTodayIso();

      // 5. Prevent duplicate clock-in for today
      // Match by either workforce_member_id OR recorded_by to prevent any double shifts
      let dupQuery = supabase
        .from('attendance_records')
        .select('id, status, created_at')
        .eq('attendance_date', today);

      if (workforceMemberId) {
        dupQuery = dupQuery.or(`workforce_member_id.eq.${workforceMemberId},recorded_by.eq.${params.userId}`);
      } else {
        dupQuery = dupQuery.eq('recorded_by', params.userId);
      }

      const { data: existingShift } = await dupQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingShift) {
        return {
          success: false,
          error: `You have already clocked in for today (${existingShift.status.toUpperCase()}). Duplicate shifts are prevented.`,
        };
      }

      // 6. Persist attendance record
      const hasGps = params.latitude != null && params.longitude != null;
      const payload: any = {
        project_id: targetProjectId,
        workforce_member_id: workforceMemberId,
        attendance_date: today,
        status: 'present',
        expected_hours: 8,
        recorded_by: params.userId,
        evidence_type: hasGps ? 'gps' : 'manual',
        evidence_reference: 'non_leadership_self_clock',
      };

      if (hasGps) {
        payload.latitude = params.latitude;
        payload.longitude = params.longitude;
      }

      let insertedRecord: any = null;
      const { data: inserted, error: insErr } = await supabase
        .from('attendance_records')
        .insert(payload)
        .select(`
          id,
          attendance_date,
          status,
          created_at,
          projects:project_id(name)
        `)
        .single();

      if (insErr) {
        console.warn('[AttendanceService] Insert with join failed, retrying simple insert:', insErr.message);
        // Fallback retry without foreign table projection in case join expansion failed
        const { data: retryData, error: retryErr } = await supabase
          .from('attendance_records')
          .insert(payload)
          .select('id, attendance_date, status, created_at, project_id')
          .single();

        if (retryErr) {
          return { success: false, error: retryErr.message };
        }
        insertedRecord = retryData;
      } else {
        insertedRecord = inserted;
      }

      return { success: true, data: insertedRecord, error: null };
    } catch (err: any) {
      console.error('[AttendanceService] clockInNonLeadershipUser error:', err);
      return { success: false, error: err.message || 'Failed to record clock-in.' };
    }
  }

  /**
   * Universal Clock-Out for Non-Leadership Roles
   */
  static async clockOutNonLeadershipUser(params: {
    userId: string;
    attendanceRecordId?: string;
  }): Promise<{ success: boolean; actualHours: number; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, actualHours: 0, error: 'Database is not configured.' };

    try {
      const today = getNigerianTodayIso();
      let recordId = params.attendanceRecordId;

      // If ID not provided, resolve today's open record
      if (!recordId) {
        const status = await this.getUserTodayAttendanceStatus(params.userId);
        if (!status.hasRecord || !status.attendanceId) {
          return { success: false, actualHours: 0, error: 'No active clock-in session found for today.' };
        }
        if (status.isClockedOut) {
          return { success: false, actualHours: status.actualHours, error: 'You are already clocked out for today.' };
        }
        recordId = status.attendanceId;
      }

      // Fetch the clock-in timestamp to compute duration
      const { data: record, error: findErr } = await supabase
        .from('attendance_records')
        .select('id, created_at, updated_at, actual_hours')
        .eq('id', recordId)
        .single();

      if (findErr || !record) {
        return { success: false, actualHours: 0, error: 'Attendance record not found.' };
      }

      const clockInTime = new Date(record.created_at).getTime();
      const nowTime = Date.now();
      const elapsedHours = Number(Math.max(0.1, (nowTime - clockInTime) / 3600000).toFixed(2));
      const nowIso = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('attendance_records')
        .update({
          updated_at: nowIso,
          actual_hours: elapsedHours,
          status: 'present',
        })
        .eq('id', recordId);

      if (updateErr) {
        return { success: false, actualHours: 0, error: updateErr.message };
      }

      return { success: true, actualHours: elapsedHours, error: null };
    } catch (err: any) {
      console.error('[AttendanceService] clockOutNonLeadershipUser error:', err);
      return { success: false, actualHours: 0, error: err.message || 'Failed to process clock-out.' };
    }
  }

  /**
   * Universal Clock-In alias for all authorized staff roles
   */
  static async clockInStaffUser(params: {
    userId: string;
    projectId?: string;
    latitude?: number;
    longitude?: number;
  }) {
    return AttendanceService.clockInNonLeadershipUser(params);
  }

  /**
   * Universal Clock-Out alias for all authorized staff roles
   */
  static async clockOutStaffUser(params: {
    userId: string;
    attendanceRecordId?: string;
  }) {
    return AttendanceService.clockOutNonLeadershipUser(params);
  }

  /**
   * Retrieves personal attendance history for any of the 9 roles
   */
  static async getUserAttendanceHistory(
    userId: string,
    limit: number = 30
  ): Promise<{ data: any[]; error: string | null }> {
    if (!isSupabaseConfigured || !userId) return { data: [], error: null };

    try {
      await ensureValidSession();

      // Find linked workforce member id
      const { data: wfMember } = await supabase
        .from('workforce_members')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();

      const memberId = wfMember?.id;

      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          attendance_date,
          status,
          created_at,
          updated_at,
          actual_hours,
          project_id,
          projects:project_id(id, name, project_code)
        `);

      if (memberId) {
        query = query.or(`workforce_member_id.eq.${memberId},recorded_by.eq.${userId}`);
      } else {
        query = query.eq('recorded_by', userId);
      }

      const { data, error } = await query
        .order('attendance_date', { ascending: false })
        .limit(limit);

      if (error) {
        return { data: [], error: error.message };
      }

      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to retrieve attendance history.' };
    }
  }
}

