import React, { useState, useEffect, useCallback } from 'react';
import {
  Hammer,
  Calendar,
  Clock,
  UserCheck,
  LogOut,
  Building,
  TrendingUp,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Plus,
  Shield,
  Phone,
  User,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  ArtisanDashboardService,
  ArtisanDashboardData,
} from '../../services/artisanDashboardService';
import { formatNigerianDate } from '../../services/materialsService';
import { ATTENDANCE_STATUS_CONFIG, formatTimeFromIso } from '../../services/attendanceService';
import { RequestOvertimeModal } from './RequestOvertimeModal';

export const ArtisanDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();

  const [data, setData] = useState<ArtisanDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isClocking, setIsClocking] = useState<boolean>(false);
  const [clockActionMessage, setClockActionMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Overtime Modal
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState<boolean>(false);

  // Time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchArtisanData = useCallback(
    async (manual: boolean = false) => {
      if (!user) return;
      if (manual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      const res = await ArtisanDashboardService.getArtisanDashboard(user.id);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setData(res.data);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [user]
  );

  useEffect(() => {
    fetchArtisanData();
  }, [fetchArtisanData]);

  // Handle Self Clock-In
  const handleClockIn = async () => {
    if (!user) return;
    setIsClocking(true);
    setErrorMessage(null);
    setClockActionMessage(null);

    // Attempt to capture GPS coordinates if browser allows
    let coords: { latitude?: number; longitude?: number } = {};
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch {
        // Continue even if GPS access is denied
      }
    }

    const res = await ArtisanDashboardService.selfClockIn({
      userId: user.id,
      projectId: data?.activeProject?.projectId,
      latitude: coords.latitude,
      longitude: coords.longitude,
    });

    setIsClocking(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setClockActionMessage('Clocked in successfully for today.');
      fetchArtisanData(true);
      setTimeout(() => setClockActionMessage(null), 3000);
    }
  };

  // Handle Self Clock-Out
  const handleClockOut = async () => {
    if (!data?.todayStatus.attendanceId) return;
    setIsClocking(true);
    setErrorMessage(null);
    setClockActionMessage(null);

    const res = await ArtisanDashboardService.selfClockOut(data.todayStatus.attendanceId);
    setIsClocking(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setClockActionMessage('Clocked out successfully. Rest well!');
      fetchArtisanData(true);
      setTimeout(() => setClockActionMessage(null), 3000);
    }
  };

  const workerName =
    data?.profile.display_name ||
    profile?.display_name ||
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
    'Artisan';

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col select-none">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#01875F] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block -mb-0.5">
                DAVEJOE MANAGEMENT TOOL
              </span>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Artisan Workspace
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
                  {data?.profile.trade || 'Workforce'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => fetchArtisanData(true)}
              disabled={isRefreshing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
            </button>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-2 text-xs">
              <div className="w-8 h-8 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-xs border border-[#01875F]/20">
                {workerName[0] || 'A'}
              </div>
              <span className="hidden md:inline font-semibold text-slate-800">{workerName}</span>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Artisan Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
              <Calendar className="w-3.5 h-3.5 text-[#01875F]" />
              <span>{formatNigerianDate(new Date().toISOString())}</span>
              <span>&bull;</span>
              <span className="font-mono">Code: {data?.profile.workforce_code || '---'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {getGreeting()}, {workerName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Here's your workday at a glance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
              {data?.profile.trade || 'Artisan'}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          </div>
        </div>

        {/* Action feedback banners */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchArtisanData(true)}
              className="font-bold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {clockActionMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{clockActionMessage}</span>
          </div>
        )}

        {/* 1. Today's Attendance & Timekeeping Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#01875F]" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Today's Attendance Status
              </h3>
            </div>
            <span className="text-xs font-medium text-slate-500">
              {formatNigerianDate(new Date().toISOString())}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 items-center">
            {/* Status Display */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Current Shift State
              </span>
              {!data?.todayStatus.hasRecord ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Not Clocked In Today</span>
                </div>
              ) : data.todayStatus.isClockedOut ? (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  <span>Clocked Out (Shift Ended)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-[#01875F] animate-pulse" />
                  <span>Clocked In (Active On Site)</span>
                </div>
              )}
            </div>

            {/* Time Breakdown */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Clock In</span>
                <span className="text-sm font-bold font-mono text-emerald-700">
                  {formatTimeFromIso(data?.todayStatus.clockInTime)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Clock Out</span>
                <span className="text-sm font-bold font-mono text-slate-700">
                  {formatTimeFromIso(data?.todayStatus.clockOutTime)}
                </span>
              </div>
            </div>

            {/* State-Aware Action Button */}
            <div className="flex justify-start md:justify-end">
              {!data?.todayStatus.hasRecord ? (
                <button
                  type="button"
                  onClick={handleClockIn}
                  disabled={isClocking}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>{isClocking ? 'Recording...' : 'CLOCK IN TODAY'}</span>
                </button>
              ) : !data.todayStatus.isClockedOut ? (
                <button
                  type="button"
                  onClick={handleClockOut}
                  disabled={isClocking}
                  className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isClocking ? 'Recording...' : 'CLOCK OUT (END SHIFT)'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full md:w-auto px-6 py-3 bg-slate-100 text-slate-400 text-xs font-bold rounded-xl border border-slate-200 cursor-not-allowed"
                >
                  CLOCKED OUT TODAY
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. My Project Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-[#01875F]" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                My Assigned Project
              </h3>
            </div>
            {data?.activeProject && (
              <span className="text-xs font-mono font-bold text-[#01875F] bg-[#E6F4EA] px-2 py-0.5 rounded-md border border-[#01875F]/20">
                {data.activeProject.projectCode}
              </span>
            )}
          </div>

          {!data?.activeProject ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No active project assignment recorded yet. Your Site Supervisor will link you to an operational project.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Project</span>
                <span className="text-sm font-bold text-slate-900">{data.activeProject.projectName}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Role on Project</span>
                <span className="text-xs font-semibold text-slate-800">{data.activeProject.roleOnProject}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Location</span>
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{data.activeProject.location || 'Site Location'}</span>
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Assignment</span>
                <span className="text-xs text-slate-600">
                  {data.activeProject.startDate ? formatNigerianDate(data.activeProject.startDate) : 'Active'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. Split Grid: My Work (Productivity) & My Overtime */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Productivity */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  My Work &amp; Productivity
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {data?.recentProductivity.length || 0} entries
              </span>
            </div>

            {(data?.recentProductivity.length || 0) === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No productivity entries recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                {data?.recentProductivity.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">
                        {p.notes || 'Completed Work Output'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {p.projectName} &bull; {formatNigerianDate(p.workDate)}
                      </span>
                    </div>
                    <span className="font-bold font-mono text-purple-700 text-xs">
                      {p.count} {p.unitOfMeasure}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overtime Requests */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Overtime Requests
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOvertimeModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#01875F] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Request Overtime</span>
              </button>
            </div>

            {(data?.recentOvertime.length || 0) === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No overtime requests submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                {data?.recentOvertime.map((o) => (
                  <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">{o.reason}</span>
                      <span className="text-[10px] text-slate-400">
                        {formatNigerianDate(o.createdAt)}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        o.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : o.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {o.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. My Recent Attendance History (Last 14 Days) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#01875F]" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                My Attendance History (Past 14 Days)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {data?.recentAttendance.length || 0} records
            </span>
          </div>

          {(data?.recentAttendance.length || 0) === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No historical attendance records yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Clock In</th>
                    <th className="py-3 px-4">Clock Out</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.recentAttendance.map((a) => {
                    const stConfig = ATTENDANCE_STATUS_CONFIG[a.status] || ATTENDANCE_STATUS_CONFIG.present;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {formatNigerianDate(a.attendance_date)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {a.projects?.name || 'Assigned Project'}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-emerald-700">
                          {formatTimeFromIso(a.clock_in_time)}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-600">
                          {formatTimeFromIso(a.clock_out_time)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${stConfig.badgeClasses}`}
                          >
                            {stConfig.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 5. My Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 max-w-xl">
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-[#01875F] text-white flex items-center justify-center font-bold text-xl shadow-2xs">
              {workerName[0] || 'A'}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{workerName}</h3>
              <p className="text-xs text-slate-500 font-mono">
                Code: {data?.profile.workforce_code || '---'} &bull; {data?.profile.trade}
              </p>
            </div>
          </div>

          <div className="pt-4 space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Trade Specialization:</span>
              <span className="font-semibold text-slate-800">{data?.profile.trade}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Workforce Code:</span>
              <span className="font-mono font-bold text-slate-800">{data?.profile.workforce_code}</span>
            </div>
            {data?.profile.phone && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Contact Phone:</span>
                <span className="font-mono text-slate-800">{data.profile.phone}</span>
              </div>
            )}
            {data?.profile.emergency_contact_name && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Emergency Contact:</span>
                <span className="text-slate-800">
                  {data.profile.emergency_contact_name} ({data.profile.emergency_contact_phone || '---'})
                </span>
              </div>
            )}
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 font-medium">Status:</span>
              <span className="font-semibold text-emerald-700">Active</span>
            </div>
          </div>
        </div>
      </main>

      {/* Overtime Request Modal */}
      {user && (
        <RequestOvertimeModal
          isOpen={isOvertimeModalOpen}
          onClose={() => setIsOvertimeModalOpen(false)}
          onSuccess={() => fetchArtisanData(true)}
          userId={user.id}
          projectId={data?.activeProject?.projectId}
          projectName={data?.activeProject?.projectName}
        />
      )}
    </div>
  );
};

export default ArtisanDashboard;
