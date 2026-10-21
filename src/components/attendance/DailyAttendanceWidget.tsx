import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  LogOut,
  MapPin,
  Building,
  CheckCircle2,
  AlertCircle,
  Timer,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  AttendanceService,
  formatTimeFromIso,
  getNigerianTodayIso,
} from '../../services/attendanceService';
import { formatNigerianDate } from '../../services/materialsService';

interface DailyAttendanceWidgetProps {
  className?: string;
  onAttendanceChanged?: () => void;
}

export const DailyAttendanceWidget: React.FC<DailyAttendanceWidgetProps> = ({
  className = '',
  onAttendanceChanged,
}) => {
  const { user, profile, hasRole, currentRoleKey } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Exclude leadership
  const isLeadership =
    currentRoleKey === 'management' ||
    currentRoleKey === 'executive_director' ||
    hasRole('management') ||
    hasRole('executive_director');

  const [statusData, setStatusData] = useState<{
    hasRecord: boolean;
    attendanceId: string | null;
    clockInTime: string | null;
    clockOutTime: string | null;
    isClockedIn: boolean;
    isClockedOut: boolean;
    actualHours: number;
    projectName: string | null;
    projectId: string | null;
  }>({
    hasRecord: false,
    attendanceId: null,
    clockInTime: null,
    clockOutTime: null,
    isClockedIn: false,
    isClockedOut: false,
    actualHours: 0,
    projectName: null,
    projectId: null,
  });

  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!user || isLeadership) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await AttendanceService.getUserTodayAttendanceStatus(user.id);
      setStatusData(res);

      if (res.isClockedIn && res.clockInTime) {
        const diffMs = Date.now() - new Date(res.clockInTime).getTime();
        setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)));
      }
    } catch (err: any) {
      console.warn('[DailyAttendanceWidget] status error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isLeadership]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Live timer tick every 30 seconds when clocked in
  useEffect(() => {
    if (!statusData.isClockedIn || !statusData.clockInTime) return;

    const interval = setInterval(() => {
      const diffMs = Date.now() - new Date(statusData.clockInTime!).getTime();
      setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)));
    }, 30000);

    return () => clearInterval(interval);
  }, [statusData.isClockedIn, statusData.clockInTime]);

  // If leadership, exclude from mandatory daily clocking
  if (isLeadership) return null;

  const handleClockIn = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Optional geolocation
      let lat: number | undefined;
      let lng: number | undefined;

      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
              maximumAge: 60000,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          // Geolocation optional fallback
        }
      }

      const res = await AttendanceService.clockInNonLeadershipUser({
        userId: user.id,
        latitude: lat,
        longitude: lng,
      });

      if (!res.success) {
        setError(res.error || 'Failed to clock in.');
      } else {
        setSuccessMsg('Successfully clocked in for today!');
        await fetchStatus();
        if (onAttendanceChanged) onAttendanceChanged();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred while clocking in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !statusData.attendanceId) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await AttendanceService.clockOutNonLeadershipUser({
        userId: user.id,
        attendanceRecordId: statusData.attendanceId,
      });

      if (!res.success) {
        setError(res.error || 'Failed to clock out.');
      } else {
        setSuccessMsg(`Clocked out successfully. Duration recorded: ${res.actualHours} hrs.`);
        await fetchStatus();
        if (onAttendanceChanged) onAttendanceChanged();
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      setError(err?.message || 'Error occurred while clocking out.');
    } finally {
      setSubmitting(false);
    }
  };

  const hours = Math.floor(elapsedMinutes / 60);
  const mins = elapsedMinutes % 60;

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Status & Time */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              statusData.isClockedIn
                ? 'bg-[#01875F] text-white animate-pulse'
                : statusData.isClockedOut
                ? 'bg-slate-100 text-slate-600'
                : 'bg-amber-50 text-amber-600 border border-amber-200/80'
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Daily Attendance & Shift
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-xs text-slate-500 font-medium">
                {formatNigerianDate(getNigerianTodayIso())}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                {statusData.isClockedIn
                  ? 'Currently on Duty'
                  : statusData.isClockedOut
                  ? 'Shift Completed for Today'
                  : 'Not Clocked In Yet'}
              </h3>

              {statusData.isClockedIn && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#01875F] animate-ping" />
                  Clocked In: {formatTimeFromIso(statusData.clockInTime)}
                </span>
              )}

              {statusData.isClockedOut && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  <CheckCircle2 className="w-3 h-3 text-slate-500" />
                  Total: {statusData.actualHours} hrs
                </span>
              )}
            </div>

            {/* Sub-info: Project & Elapsed */}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              {statusData.projectName && (
                <div className="flex items-center gap-1 truncate" title={statusData.projectName}>
                  <Building className="w-3.5 h-3.5 text-[#01875F] shrink-0" />
                  <span className="truncate">{statusData.projectName}</span>
                </div>
              )}

              {statusData.isClockedIn && (
                <div className="flex items-center gap-1 font-semibold text-slate-700">
                  <Timer className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Elapsed: {hours}h {mins}m</span>
                </div>
              )}

              {statusData.clockOutTime && (
                <div className="text-slate-400">
                  Out at {formatTimeFromIso(statusData.clockOutTime)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-center justify-end">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#01875F]" />
              <span>Verifying shift...</span>
            </div>
          ) : !statusData.isClockedIn && !statusData.isClockedOut ? (
            <button
              type="button"
              disabled={submitting}
              onClick={handleClockIn}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#01875F] hover:bg-[#00704e] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <Clock className="w-4 h-4" />
              <span>{submitting ? 'Clocking In...' : 'Clock In for Today'}</span>
            </button>
          ) : statusData.isClockedIn ? (
            <button
              type="button"
              disabled={submitting}
              onClick={handleClockOut}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              <span>{submitting ? 'Clocking Out...' : 'Clock Out of Duty'}</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Shift Logged</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#01875F]" />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
};
