import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  MapPin,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Package,
  Eye,
  RefreshCw,
  Search,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  AssignedProjectsService,
  AssignedProjectSummary,
} from '../../services/assignedProjectsService';
import { AttendanceService } from '../../services/attendanceService';
import { formatNigerianDate } from '../../services/materialsService';
import { AssignedProjectDetailModal } from './AssignedProjectDetailModal';

interface AssignedProjectsSectionProps {
  title?: string;
  subtitle?: string;
  emptyMessage?: string;
  onOpenProjectDetails?: (project: AssignedProjectSummary) => void;
  onClockInSuccess?: () => void;
  onProjectsLoaded?: (projects: AssignedProjectSummary[]) => void;
  compact?: boolean;
}

export const AssignedProjectsSection: React.FC<AssignedProjectsSectionProps> = ({
  title = 'My Assigned Projects',
  subtitle = 'Every project currently assigned to you with full schedule, site specifications, and start-day clock-in.',
  emptyMessage = 'No projects are assigned to your profile yet. Once an Administrator assigns you to a project, it will appear here with full operational details.',
  onOpenProjectDetails,
  onClockInSuccess,
  onProjectsLoaded,
  compact = false,
}) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<AssignedProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [todayAttStatus, setTodayAttStatus] = useState<{
    isClockedIn: boolean;
    isClockedOut: boolean;
    projectId: string | null;
    projectName: string | null;
  }>({
    isClockedIn: false,
    isClockedOut: false,
    projectId: null,
    projectName: null,
  });

  const [selectedProject, setSelectedProject] = useState<AssignedProjectSummary | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [clockingProjectId, setClockingProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = useCallback(
    async (manual = false) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      if (manual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [projRes, attRes] = await Promise.all([
          AssignedProjectsService.getMyAssignedProjects(user.id),
          AttendanceService.getUserTodayAttendanceStatus(user.id),
        ]);

        if (projRes.error) {
          setError(projRes.error);
        } else {
          setProjects(projRes.projects);
          if (onProjectsLoaded) onProjectsLoaded(projRes.projects);
        }

        setTodayAttStatus({
          isClockedIn: attRes.isClockedIn,
          isClockedOut: attRes.isClockedOut,
          projectId: attRes.projectId,
          projectName: attRes.projectName,
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to load assigned projects.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, onProjectsLoaded]
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const handleClockInToProject = async (proj: AssignedProjectSummary) => {
    if (!user?.id) return;
    setClockingProjectId(proj.project_id);
    setActionError(null);
    setActionSuccess(null);

    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
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
          // Optional geolocation
        }
      }

      const res = await AttendanceService.clockInNonLeadershipUser({
        userId: user.id,
        projectId: proj.project_id,
        latitude: lat,
        longitude: lng,
      });

      if (!res.success) {
        setActionError(res.error || 'Unable to clock in for this project.');
      } else {
        setActionSuccess(`Clocked in for "${proj.name}" today!`);
        await loadData(true);
        if (onClockInSuccess) onClockInSuccess();
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Clock-in failed.');
    } finally {
      setClockingProjectId(null);
    }
  };

  const handleOpenDetails = (proj: AssignedProjectSummary) => {
    if (onOpenProjectDetails) {
      onOpenProjectDetails(proj);
      return;
    }
    setSelectedProject(proj);
    setActionError(null);
    setActionSuccess(null);
    setIsDetailModalOpen(true);
  };

  const filteredProjects = projects.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.project_code.toLowerCase().includes(term) ||
      (p.city || '').toLowerCase().includes(term) ||
      (p.state || '').toLowerCase().includes(term) ||
      (p.client_name || '').toLowerCase().includes(term) ||
      (p.role_on_project || '').toLowerCase().includes(term)
    );
  });

  const readyTodayCount = projects.filter((p) => p.can_clock_in_today).length;
  const startingTodayCount = projects.filter((p) => p.is_starting_today).length;
  const upcomingCount = projects.filter((p) => p.is_upcoming).length;
  const alreadyClockedToday = todayAttStatus.isClockedIn || todayAttStatus.isClockedOut;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="w-5 h-5 text-[#18b892]" />
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E6F4EA] text-[#18b892] border border-[#18b892]/20">
              {projects.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!compact && projects.length > 2 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search assigned projects..."
                className="pl-8 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#18b892] w-48 sm:w-56"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#18b892]' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      {!compact && projects.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Assigned</span>
            <span className="text-lg font-bold font-mono text-slate-900">{projects.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/60">
            <span className="text-[10px] font-bold uppercase text-emerald-700 block">
              Clock-In Ready
            </span>
            <span className="text-lg font-bold font-mono text-[#18b892]">
              {readyTodayCount}
              {startingTodayCount > 0 && (
                <span className="text-[11px] font-sans font-semibold ml-1.5">
                  ({startingTodayCount} starts today)
                </span>
              )}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/60">
            <span className="text-[10px] font-bold uppercase text-amber-700 block">Upcoming</span>
            <span className="text-lg font-bold font-mono text-amber-700">{upcomingCount}</span>
          </div>
        </div>
      )}

      {/* Inline Feedback Banners */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#18b892]" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#18b892]" />
          <span>Loading your assigned projects...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-10 px-4 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
          <Building2 className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">
            {searchTerm ? 'No matching assigned projects' : 'No Assigned Projects Found'}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchTerm ? 'Try adjusting your search query.' : emptyMessage}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((proj) => {
            const loc =
              [proj.address, proj.city, proj.state].filter(Boolean).join(', ') ||
              'Site address pending';
            const isThisProjectClockedInToday =
              alreadyClockedToday && todayAttStatus.projectId === proj.project_id;
            const isClockingThis = clockingProjectId === proj.project_id;

            return (
              <div
                key={proj.project_id}
                className="bg-slate-50/40 hover:bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-[#18b892]/50 shadow-2xs transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-[#18b892] bg-[#E6F4EA] px-2 py-0.5 rounded-md border border-[#18b892]/20">
                      {proj.project_code}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {proj.is_starting_today ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Starts Today
                        </span>
                      ) : proj.is_upcoming && proj.effective_start_date ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Starts {formatNigerianDate(proj.effective_start_date)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                          {proj.status.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Scope */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{proj.name}</h4>
                    {proj.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata List */}
                  <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{loc}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#18b892] shrink-0" />
                      <span className="truncate">
                        Start:{' '}
                        <strong className="text-slate-800">
                          {proj.effective_start_date
                            ? formatNigerianDate(proj.effective_start_date)
                            : 'Active'}
                        </strong>
                        {proj.expected_completion_date && (
                          <> &rarr; {formatNigerianDate(proj.expected_completion_date)}</>
                        )}
                      </span>
                    </div>
                    {proj.role_on_project && (
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Role: <strong className="text-slate-800">{proj.role_on_project}</strong>
                        </span>
                      </div>
                    )}
                    {proj.client_name && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <span className="truncate">Client: {proj.client_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2.5 border-t border-slate-200/70 text-center">
                    <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">
                        Team
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-800 flex items-center justify-center gap-0.5">
                        <Users className="w-3 h-3 text-slate-400" />
                        {proj.workforce_count}
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">
                        On Site
                      </span>
                      <span className="text-xs font-bold font-mono text-emerald-700">
                        {proj.today_attendance_count}
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">
                        Tasks
                      </span>
                      <span className="text-xs font-bold font-mono text-amber-700">
                        {proj.open_tasks_count}
                      </span>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">
                        BOQ
                      </span>
                      <span className="text-xs font-bold font-mono text-blue-700 flex items-center justify-center gap-0.5">
                        <Package className="w-3 h-3 text-blue-400" />
                        {proj.materials_count}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(proj)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#18b892] text-slate-700 hover:text-[#18b892] text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </button>

                  {isThisProjectClockedInToday ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-[#18b892] border border-emerald-200 text-[11px] font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Clocked In Today</span>
                    </span>
                  ) : !alreadyClockedToday ? (
                    <button
                      type="button"
                      disabled={!proj.can_clock_in_today || Boolean(clockingProjectId)}
                      onClick={() => void handleClockInToProject(proj)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        proj.can_clock_in_today
                          ? 'bg-[#18b892] hover:bg-[#139c7b] text-white shadow-2xs cursor-pointer disabled:opacity-50'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {isClockingThis
                          ? 'Clocking In...'
                          : proj.can_clock_in_today
                          ? 'Clock In'
                          : `Starts ${
                              proj.effective_start_date
                                ? formatNigerianDate(proj.effective_start_date)
                                : 'Soon'
                            }`}
                      </span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Shift logged today
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Details Modal (when custom handler not overriding) */}
      <AssignedProjectDetailModal
        project={selectedProject}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onClockIn={handleClockInToProject}
        isClockingIn={Boolean(
          selectedProject && clockingProjectId === selectedProject.project_id
        )}
        isAlreadyClockedInToday={alreadyClockedToday}
        clockInError={actionError}
        clockInSuccess={actionSuccess}
      />
    </div>
  );
};
