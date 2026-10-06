import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import {
  AttendanceRecordItem,
  AttendanceStatus,
  getNigerianTodayIso,
  formatTimeFromIso,
} from './attendanceService';
import { formatNigerianDate } from './materialsService';

export interface ArtisanWorkerProfile {
  id: string; // workforce_members.id
  workforce_code: string;
  trade: string;
  status: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  profile_id: string | null;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export interface ArtisanActiveProject {
  assignmentId: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  roleOnProject: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  status: string;
}

export interface ArtisanTodayStatus {
  hasRecord: boolean;
  attendanceId: string | null;
  status: AttendanceStatus | 'not_recorded';
  clockInTime: string | null;
  clockOutTime: string | null;
  isClockedIn: boolean;
  isClockedOut: boolean;
}

export interface ArtisanProductivityRow {
  id: string;
  workDate: string;
  count: number;
  unitOfMeasure: string;
  notes: string | null;
  projectName: string;
}

export interface ArtisanOvertimeRow {
  id: string;
  createdAt: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled' | 'paid';
  projectName: string;
}

export interface ArtisanDashboardData {
  profile: ArtisanWorkerProfile;
  activeProject: ArtisanActiveProject | null;
  todayStatus: ArtisanTodayStatus;
  recentAttendance: AttendanceRecordItem[];
  recentProductivity: ArtisanProductivityRow[];
  recentOvertime: ArtisanOvertimeRow[];
}

export class ArtisanDashboardService {
  /**
   * Resolves the workforce_member record for an authenticated user.
   */
  static async getArtisanProfile(userId: string): Promise<{
    profile: ArtisanWorkerProfile | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) return { profile: null, error: 'Database is not configured.' };

    try {
      await ensureValidSession();

      // Query workforce_members where profile_id matches userId
      const { data: wfMember, error: wfErr } = await supabase
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
          profiles:profiles!workforce_members_profile_id_fkey (
            id,
            display_name,
            first_name,
            last_name,
            avatar_url,
            email
          )
        `)
        .eq('profile_id', userId)
        .maybeSingle();

      if (wfErr) {
        return { profile: null, error: wfErr.message };
      }

      if (wfMember) {
        const prof = (wfMember as any).profiles;
        return {
          profile: {
            id: wfMember.id,
            workforce_code: wfMember.workforce_code,
            trade: wfMember.trade,
            status: wfMember.status,
            phone: wfMember.phone,
            emergency_contact_name: wfMember.emergency_contact_name,
            emergency_contact_phone: wfMember.emergency_contact_phone,
            notes: wfMember.notes,
            profile_id: wfMember.profile_id,
            display_name:
              prof?.display_name ||
              `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
              `Artisan ${wfMember.workforce_code}`,
            first_name: prof?.first_name || null,
            last_name: prof?.last_name || null,
            avatar_url: prof?.avatar_url || null,
            email: prof?.email || null,
          },
          error: null,
        };
      }

      // If workforce_member was not explicitly linked by profile_id, fetch user profile and return fallback
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      return {
        profile: {
          id: userId,
          workforce_code: 'ART-GEN',
          trade: 'Artisan / Workforce',
          status: 'active',
          phone: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          notes: null,
          profile_id: userId,
          display_name:
            userProfile?.display_name ||
            `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() ||
            'Artisan',
          first_name: userProfile?.first_name || null,
          last_name: userProfile?.last_name || null,
          avatar_url: userProfile?.avatar_url || null,
          email: userProfile?.email || null,
        },
        error: null,
      };
    } catch (err: any) {
      return { profile: null, error: err instanceof Error ? err.message : 'Failed to query worker profile.' };
    }
  }

  /**
   * Loads full Artisan Dashboard
   */
  static async getArtisanDashboard(userId: string): Promise<{
    data: ArtisanDashboardData | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) return { data: null, error: 'Database is not configured.' };

    try {
      const { profile, error: profErr } = await this.getArtisanProfile(userId);
      if (profErr || !profile) return { data: null, error: profErr || 'Could not load worker profile.' };

      const memberId = profile.id;
      const today = getNigerianTodayIso();

      // 1. Fetch active assignment
      const { data: assignmentData } = await supabase
        .from('project_workforce_assignments')
        .select(`
          id,
          project_id,
          role_on_project,
          start_date,
          end_date,
          is_active,
          projects:project_id (
            id,
            name,
            project_code,
            address,
            city,
            state,
            status
          )
        `)
        .eq('workforce_member_id', memberId)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      let activeProject: ArtisanActiveProject | null = null;
      if (assignmentData && (assignmentData as any).projects) {
        const p = (assignmentData as any).projects;
        const loc = [p.address, p.city, p.state].filter(Boolean).join(', ') || null;
        activeProject = {
          assignmentId: assignmentData.id,
          projectId: p.id,
          projectName: p.name,
          projectCode: p.project_code,
          roleOnProject: assignmentData.role_on_project || profile.trade,
          startDate: assignmentData.start_date || null,
          endDate: assignmentData.end_date || null,
          location: loc,
          status: p.status || 'active',
        };
      }

      // 2. Fetch today's attendance record
      const { data: todayAtt } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('workforce_member_id', memberId)
        .eq('attendance_date', today)
        .maybeSingle();

      let todayStatus: ArtisanTodayStatus = {
        hasRecord: false,
        attendanceId: null,
        status: 'not_recorded',
        clockInTime: null,
        clockOutTime: null,
        isClockedIn: false,
        isClockedOut: false,
      };

      if (todayAtt) {
        const createdAt = todayAtt.created_at || null;
        const updatedAt = todayAtt.updated_at || null;
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

        todayStatus = {
          hasRecord: true,
          attendanceId: todayAtt.id,
          status: todayAtt.status as AttendanceStatus,
          clockInTime: createdAt,
          clockOutTime,
          isClockedIn: true,
          isClockedOut,
        };
      }

      // 3. Fetch recent attendance (last 14 days)
      const { data: recentAttData } = await supabase
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
          projects:project_id ( id, name, project_code )
        `)
        .eq('workforce_member_id', memberId)
        .order('attendance_date', { ascending: false })
        .limit(14);

      const recentAttendance: AttendanceRecordItem[] = (recentAttData || []).map((r: any) => {
        const createdAt = r.created_at || null;
        const updatedAt = r.updated_at || null;
        let isOut = false;
        if (createdAt && updatedAt) {
          if (new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60000) {
            isOut = true;
          }
        }
        return {
          id: r.id,
          attendance_date: r.attendance_date,
          status: r.status,
          recorded_by: r.recorded_by,
          latitude: r.latitude,
          longitude: r.longitude,
          created_at: r.created_at,
          updated_at: r.updated_at,
          project_id: r.project_id,
          workforce_member_id: r.workforce_member_id,
          clock_in_time: createdAt,
          clock_out_time: isOut ? updatedAt : null,
          is_clocked_out: isOut,
          projects: r.projects,
        };
      });

      // 4. Fetch recent productivity records
      const { data: prodData } = await supabase
        .from('productivity_records')
        .select(`
          id,
          work_date,
          count,
          unit_of_measure,
          notes,
          projects:project_id ( name )
        `)
        .eq('workforce_member_id', memberId)
        .order('work_date', { ascending: false })
        .limit(10);

      const recentProductivity: ArtisanProductivityRow[] = (prodData || []).map((p: any) => ({
        id: p.id,
        workDate: p.work_date,
        count: Number(p.count) || 0,
        unitOfMeasure: p.unit_of_measure || 'units',
        notes: p.notes,
        projectName: (p.projects as any)?.name || 'Project',
      }));

      // 5. Fetch recent overtime requests
      const { data: otData } = await supabase
        .from('overtime_requests')
        .select(`
          id,
          created_at,
          reason,
          status,
          projects:project_id ( name )
        `)
        .eq('workforce_member_id', memberId)
        .order('created_at', { ascending: false })
        .limit(10);

      const recentOvertime: ArtisanOvertimeRow[] = (otData || []).map((o: any) => ({
        id: o.id,
        createdAt: o.created_at,
        reason: o.reason || 'General overtime',
        status: o.status || 'requested',
        projectName: (o.projects as any)?.name || 'Project',
      }));

      return {
        data: {
          profile,
          activeProject,
          todayStatus,
          recentAttendance,
          recentProductivity,
          recentOvertime,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Failed to query artisan dashboard data.',
      };
    }
  }

  /**
   * Artisan self clock-in
   */
  static async selfClockIn(params: {
    userId: string;
    projectId?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { profile } = await this.getArtisanProfile(params.userId);
      if (!profile) return { success: false, error: 'Artisan profile not found.' };

      let targetProjectId = params.projectId;
      if (!targetProjectId) {
        // Find active assignment
        const { data: assign } = await supabase
          .from('project_workforce_assignments')
          .select('project_id')
          .eq('workforce_member_id', profile.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (assign?.project_id) {
          targetProjectId = assign.project_id;
        } else {
          // If no active assignment found, retrieve first available project
          const { data: proj } = await supabase.from('projects').select('id').limit(1).maybeSingle();
          if (proj?.id) {
            targetProjectId = proj.id;
          } else {
            return {
              success: false,
              error: 'No active project assignment found. Please contact your Site Supervisor to assign you to a project.',
            };
          }
        }
      }

      const today = getNigerianTodayIso();

      // Check if already clocked in today
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('workforce_member_id', profile.id)
        .eq('attendance_date', today)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `You have already clocked in for today (${existing.status.toUpperCase()}).`,
        };
      }

      const payload: any = {
        project_id: targetProjectId,
        workforce_member_id: profile.id,
        attendance_date: today,
        status: 'present',
        recorded_by: params.userId,
      };

      if (params.latitude != null) payload.latitude = params.latitude;
      if (params.longitude != null) payload.longitude = params.longitude;

      const { error: insErr } = await supabase.from('attendance_records').insert(payload);
      if (insErr) return { success: false, error: insErr.message };

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to self clock in.' };
    }
  }

  /**
   * Artisan self clock-out
   */
  static async selfClockOut(attendanceId: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('attendance_records')
        .update({ updated_at: nowIso })
        .eq('id', attendanceId);

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to clock out.' };
    }
  }

  /**
   * Submit overtime request
   */
  static async submitOvertimeRequest(params: {
    userId: string;
    projectId?: string;
    reason: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { profile } = await this.getArtisanProfile(params.userId);
      if (!profile) return { success: false, error: 'Worker profile not found.' };

      let targetProjectId = params.projectId;
      if (!targetProjectId) {
        const { data: assign } = await supabase
          .from('project_workforce_assignments')
          .select('project_id')
          .eq('workforce_member_id', profile.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (assign?.project_id) {
          targetProjectId = assign.project_id;
        } else {
          const { data: proj } = await supabase.from('projects').select('id').limit(1).maybeSingle();
          if (proj?.id) targetProjectId = proj.id;
        }
      }

      if (!targetProjectId) {
        return { success: false, error: 'A project must be assigned to request overtime.' };
      }

      const { error } = await supabase.from('overtime_requests').insert({
        project_id: targetProjectId,
        workforce_member_id: profile.id,
        reason: params.reason.trim(),
        status: 'requested',
      });

      if (error) return { success: false, error: error.message };
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to submit overtime request.' };
    }
  }
}
