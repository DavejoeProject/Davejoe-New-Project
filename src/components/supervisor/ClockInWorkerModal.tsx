import React, { useState, useEffect } from 'react';
import { X, Clock, UserCheck, AlertCircle, MapPin, CheckCircle2 } from 'lucide-react';
import { AttendanceService, AttendanceStatus, ALL_ATTENDANCE_STATUSES, ATTENDANCE_STATUS_CONFIG } from '../../services/attendanceService';
import { SiteSupervisorService, SupervisorProjectItem } from '../../services/siteSupervisorService';

interface ClockInWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects: SupervisorProjectItem[];
  preselectedProjectId?: string;
}

export const ClockInWorkerModal: React.FC<ClockInWorkerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projects,
  preselectedProjectId,
}) => {
  const [projectId, setProjectId] = useState<string>(preselectedProjectId || (projects[0]?.id || ''));
  const [workers, setWorkers] = useState<Array<{ id: string; name: string; workforce_code: string; trade: string }>>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [captureLocation, setCaptureLocation] = useState<boolean>(true);
  const [locationCoords, setLocationCoords] = useState<{ latitude?: number; longitude?: number }>({});
  
  const [isLoadingWorkers, setIsLoadingWorkers] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync preselected project
  useEffect(() => {
    if (preselectedProjectId) {
      setProjectId(preselectedProjectId);
    } else if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [preselectedProjectId, projects, projectId]);

  // Load project workforce when project changes
  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;
    async function loadWorkforce() {
      setIsLoadingWorkers(true);
      setErrorMessage(null);
      const res = await SiteSupervisorService.getProjectWorkforce(projectId);
      if (isMounted) {
        if (res.error) {
          setErrorMessage(res.error);
          setWorkers([]);
        } else {
          setWorkers(res.workers);
          if (res.workers.length > 0) {
            setSelectedWorkerId(res.workers[0].id);
          } else {
            setSelectedWorkerId('');
          }
        }
        setIsLoadingWorkers(false);
      }
    }

    loadWorkforce();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  // Attempt to capture browser geolocation if permitted
  useEffect(() => {
    if (isOpen && captureLocation && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('[Geolocation] Coordinates not available:', err.message);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    }
  }, [isOpen, captureLocation]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setErrorMessage('Please select a project.');
      return;
    }
    if (!selectedWorkerId) {
      setErrorMessage('Please select an artisan / worker to clock in.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await AttendanceService.clockInWorker({
      projectId,
      workforceMemberId: selectedWorkerId,
      status,
      latitude: locationCoords.latitude,
      longitude: locationCoords.longitude,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessMessage('Worker successfully clocked in to project.');
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess();
        onClose();
      }, 900);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center border border-[#01875F]/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Clock In Worker</h3>
              <p className="text-xs text-slate-500">Record gate arrival &amp; on-site timekeeping</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Project Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Project <span className="text-rose-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#01875F]/20 focus:border-[#01875F] transition-all"
            >
              {projects.length === 0 ? (
                <option value="">No assigned projects available</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.project_code}] {p.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Worker Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Artisan / Worker <span className="text-rose-500">*</span>
            </label>
            {isLoadingWorkers ? (
              <div className="py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500">
                Loading project workforce...
              </div>
            ) : workers.length === 0 ? (
              <div className="py-3 px-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
                No active workers assigned to this project yet. Please assign artisans first in the Workforce module.
              </div>
            ) : (
              <select
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#01875F]/20 focus:border-[#01875F] transition-all"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    [{w.workforce_code}] {w.name} &bull; {w.trade}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Attendance Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['present', 'late', 'half_day'] as AttendanceStatus[]).map((st) => {
                const config = ATTENDANCE_STATUS_CONFIG[st];
                const isSelected = status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E6F4EA] border-[#01875F] text-[#01875F] ring-1 ring-[#01875F]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${config.dotClasses}`} />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GPS Coordinates Notification */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>
                {locationCoords.latitude && locationCoords.longitude
                  ? `Location verified: ${locationCoords.latitude.toFixed(4)}, ${locationCoords.longitude.toFixed(4)}`
                  : 'Site GPS capture enabled'}
              </span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={captureLocation}
                onChange={(e) => setCaptureLocation(e.target.checked)}
                className="rounded border-slate-300 text-[#01875F] focus:ring-[#01875F]"
              />
              <span className="text-[11px] text-slate-600 font-medium">GPS</span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || workers.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording Clock-In...' : 'Confirm Clock-In'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
