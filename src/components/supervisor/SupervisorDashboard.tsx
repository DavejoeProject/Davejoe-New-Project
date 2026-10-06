import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat,
  Calendar,
  Clock,
  UserCheck,
  LogOut,
  Building,
  TrendingUp,
  AlertTriangle,
  Package,
  RefreshCw,
  Search,
  CheckCircle2,
  Users,
  MapPin,
  Plus,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  SiteSupervisorService,
  SupervisorDashboardData,
  SupervisorProjectItem,
} from '../../services/siteSupervisorService';
import { formatNigerianDate, formatNaira } from '../../services/materialsService';
import { ATTENDANCE_STATUS_CONFIG, formatTimeFromIso } from '../../services/attendanceService';
import { AttendanceRegister } from '../attendance/AttendanceRegister';
import { ClockInWorkerModal } from './ClockInWorkerModal';
import { ClockOutWorkerModal } from './ClockOutWorkerModal';
import { RecordAttendanceModal } from './RecordAttendanceModal';
import { LogProductivityModal } from './LogProductivityModal';
import { ReportSiteIssueModal } from './ReportSiteIssueModal';
import { NewMaterialRequestModal } from '../dashboard/NewMaterialRequestModal';

export type SupervisorNavKey =
  | 'today'
  | 'projects'
  | 'attendance'
  | 'workforce'
  | 'productivity'
  | 'issues'
  | 'profile';

export const SupervisorDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<SupervisorNavKey>('today');
  const [data, setData] = useState<SupervisorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected project for project workspace drill-down
  const [selectedProject, setSelectedProject] = useState<SupervisorProjectItem | null>(null);

  // Modals
  const [isClockInOpen, setIsClockInOpen] = useState<boolean>(false);
  const [isClockOutOpen, setIsClockOutOpen] = useState<boolean>(false);
  const [isRecordAttendanceOpen, setIsRecordAttendanceOpen] = useState<boolean>(false);
  const [isLogProductivityOpen, setIsLogProductivityOpen] = useState<boolean>(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState<boolean>(false);
  const [isRequestMaterialOpen, setIsRequestMaterialOpen] = useState<boolean>(false);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchDashboardData = useCallback(
    async (manual: boolean = false) => {
      if (!user) return;
      if (manual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      const res = await SiteSupervisorService.getSupervisorDashboard(user.id);
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
    fetchDashboardData();
  }, [fetchDashboardData]);

  const supervisorName =
    data?.supervisorName ||
    profile?.display_name ||
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
    'Site Supervisor';

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col select-none">
      {/* Top Enterprise Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#01875F] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block -mb-0.5">
                DAVEJOE MANAGEMENT TOOL
              </span>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Site Supervisor Operations
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
                  Site Supervisor
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
            </button>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-2 text-xs">
              <div className="w-8 h-8 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-xs border border-[#01875F]/20">
                {supervisorName[0] || 'S'}
              </div>
              <span className="hidden md:inline font-semibold text-slate-800">{supervisorName}</span>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Welcome Banner & Quick Action Buttons */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
              <Calendar className="w-3.5 h-3.5 text-[#01875F]" />
              <span>{formatNigerianDate(new Date().toISOString())}</span>
              <span>&bull;</span>
              <span>{data?.projects.length || 0} Assigned Projects</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {getGreeting()}, {supervisorName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Here's what requires your site attention, timekeeping, and physical execution today.
            </p>
          </div>

          {/* Quick Action Strip */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsClockInOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Clock In Worker</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClockOutOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Clock Out Worker</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLogProductivityOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Log Output</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReportIssueOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Report Issue</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRequestMaterialOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-[#01875F]" />
              <span>Request Material</span>
            </button>
          </div>
        </div>

        {/* Supervisor KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Projects
              </span>
              <Building className="w-4 h-4 text-[#01875F]" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {data?.kpis.activeProjects ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Supervised site charters</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Workforce On Site
              </span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-700">
              {data?.kpis.workforceOnSite ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Clocked in today (Active shift)</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Attendance Issues
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-700">
              {data?.kpis.attendanceIssues ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Late arrivals or absent</p>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                Open Site Issues
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-700">
              {data?.kpis.openSiteIssues ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Defects &amp; pending tasks</p>
          </div>
        </div>

        {/* Operational Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1 overflow-x-auto">
          {[
            { key: 'today', label: "Today's Operations", icon: Clock },
            { key: 'projects', label: 'My Projects', icon: Building },
            { key: 'attendance', label: 'Attendance & Muster', icon: UserCheck },
            { key: 'productivity', label: 'Productivity Logs', icon: TrendingUp },
            { key: 'issues', label: 'Site Tasks & Issues', icon: AlertTriangle },
            { key: 'profile', label: 'Supervisor Profile', icon: Shield },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveTab(t.key as SupervisorNavKey);
                  setSelectedProject(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#01875F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Today's Operations */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            {/* Split Grid: Today's Attendance Snapshot vs Today's Productivity Logs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Today's Attendance Box */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#01875F]" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Today's Site Attendance ({data?.todayAttendance.length || 0})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('attendance')}
                    className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    View Register &rarr;
                  </button>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading attendance...</div>
                ) : (data?.todayAttendance.length || 0) === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-700">No attendance recorded today</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Use "Clock In Worker" to register morning gate arrivals.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                    {data?.todayAttendance.map((att) => {
                      const prof = att.workforce_members?.profiles;
                      const name =
                        prof?.display_name ||
                        `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
                        `Artisan ${att.workforce_members?.workforce_code || '---'}`;
                      const stConfig = ATTENDANCE_STATUS_CONFIG[att.status] || ATTENDANCE_STATUS_CONFIG.present;

                      return (
                        <div key={att.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-[11px] shrink-0">
                              {name[0] || 'A'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{name}</span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                [{att.workforce_members?.workforce_code}] &bull; {att.projects?.name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-mono text-slate-600">
                              In: {formatTimeFromIso(att.clock_in_time)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stConfig.badgeClasses}`}
                            >
                              {stConfig.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Today's Productivity Output */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Today's Physical Output ({data?.todayProductivity.length || 0})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('productivity')}
                    className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    View All &rarr;
                  </button>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading productivity...</div>
                ) : (data?.todayProductivity.length || 0) === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                    <p className="text-xs font-bold text-slate-700">No output logs recorded today</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Use "Log Output" to record completed physical units and milestones.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
                    {data?.todayProductivity.map((prod) => {
                      const prof = prod.workforce_members?.profiles;
                      const name =
                        prof?.display_name ||
                        `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
                        `Artisan ${prod.workforce_members?.workforce_code || '---'}`;

                      return (
                        <div key={prod.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{name}</span>
                            <span className="text-[11px] text-slate-500">
                              {prod.notes || `${prod.projects?.name} output`}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold font-mono text-purple-700 block">
                              {prod.count} {prod.unit_of_measure}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {prod.projects?.project_code}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Open Site Issues & Action Items */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Site Issues &amp; Immediate Action Items ({data?.openTasks.length || 0})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReportIssueOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#01875F] hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Report Site Issue</span>
                </button>
              </div>

              {isLoading ? (
                <div className="py-6 text-center text-xs text-slate-400">Checking tasks...</div>
              ) : (data?.openTasks.length || 0) === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-700">No open site issues</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    All safety checkpoints, snagging tasks, and inspection actions are clear.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data?.openTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                            {task.projects?.project_code || 'PRJ'} &bull; {task.projects?.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              task.priority === 'critical'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : task.priority === 'high'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {task.priority.toUpperCase()}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{task.title}</h4>
                        {task.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>

                      {task.due_date && (
                        <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                          <span>Target: {formatNigerianDate(task.due_date)}</span>
                          <span className="text-amber-700 font-semibold">Action Required</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: My Projects */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Assigned Project Operations</h3>
                <p className="text-xs text-slate-500">
                  Projects under your site supervision, personnel muster, and progress oversight.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading projects...</div>
            ) : (data?.projects.length || 0) === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No projects currently assigned</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  You are not yet linked to active projects in the workforce assignment directory. Contact Management.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data?.projects.map((proj) => {
                  const loc = [proj.address, proj.city, proj.state].filter(Boolean).join(', ') || 'Site location pending';

                  return (
                    <div
                      key={proj.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono text-xs font-bold text-[#01875F] bg-[#E6F4EA] px-2 py-0.5 rounded-md border border-[#01875F]/20">
                            {proj.project_code}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            {proj.status}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{proj.name}</h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{loc}</span>
                        </p>

                        {/* Project Operational Stats */}
                        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Workforce
                            </span>
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {proj.workforce_count}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              On Site
                            </span>
                            <span className="text-sm font-bold text-emerald-700 font-mono">
                              {proj.today_attendance_count}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Tasks
                            </span>
                            <span className="text-sm font-bold text-amber-700 font-mono">
                              {proj.open_tasks_count}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setIsClockInOpen(true);
                          }}
                          className="text-xs font-bold text-[#01875F] hover:underline cursor-pointer"
                        >
                          + Clock In
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsLogProductivityOpen(true);
                          }}
                          className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
                        >
                          + Log Output
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Attendance & Muster */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            <AttendanceRegister hideTopNav={true} />
          </div>
        )}

        {/* Tab 4: Productivity Logs */}
        {activeTab === 'productivity' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Physical Output &amp; Productivity Ledger</h3>
                <p className="text-xs text-slate-500">
                  Daily units completed on supervised project sites.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLogProductivityOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Output</span>
              </button>
            </div>

            {(data?.todayProductivity.length || 0) === 0 ? (
              <div className="py-12 text-center">
                <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">No productivity entries recorded today</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Log tiling, masonry, electrical points, or screeding outputs using the action button above.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3 px-4">Artisan</th>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Output Count</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.todayProductivity.map((p) => {
                      const prof = p.workforce_members?.profiles;
                      const name =
                        prof?.display_name ||
                        `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
                        `Artisan ${p.workforce_members?.workforce_code || '---'}`;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-900">{name}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 block">{p.projects?.name}</span>
                            <span className="font-mono text-[10px] text-slate-400 block">{p.projects?.project_code}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{formatNigerianDate(p.work_date)}</td>
                          <td className="py-3 px-4 font-bold font-mono text-purple-700">
                            {p.count} {p.unit_of_measure}
                          </td>
                          <td className="py-3 px-4 text-slate-500">{p.notes || '---'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Site Issues */}
        {activeTab === 'issues' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Site Action Items, Defects &amp; Tasks</h3>
                <p className="text-xs text-slate-500">
                  Open tasks, rectification checkpoints, and site observations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportIssueOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Site Task / Issue</span>
              </button>
            </div>

            {(data?.openTasks.length || 0) === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">All Site Issues Cleared</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No open defects or safety flags pending on your assigned projects.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.openTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] font-bold text-slate-400 uppercase">
                          [{t.projects?.project_code}] {t.projects?.name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.priority === 'critical'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : t.priority === 'high'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.priority.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">{t.title}</h4>
                      {t.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      {t.due_date && (
                        <span className="text-[11px] font-medium text-slate-500 block">
                          Due: {formatNigerianDate(t.due_date)}
                        </span>
                      )}
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Profile & Session Scope */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 max-w-xl">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 rounded-2xl bg-[#01875F] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                {supervisorName[0] || 'S'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{supervisorName}</h3>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
                  Site Supervisor
                </span>
              </div>
            </div>

            <div className="pt-5 space-y-4 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-mono font-semibold text-slate-800">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Assigned Role:</span>
                <span className="font-semibold text-slate-800">Site Supervisor (Field Operations)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Assigned Projects:</span>
                <span className="font-bold font-mono text-[#01875F]">
                  {data?.projects.length || 0} Projects Active
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Authority Scope:</span>
                <span className="font-medium text-slate-700">Timekeeping, Site Output &amp; Operations</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-500 font-medium">Account Status:</span>
                <span className="font-semibold text-emerald-700">Active</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Global Interactive Modals */}
      <ClockInWorkerModal
        isOpen={isClockInOpen}
        onClose={() => setIsClockInOpen(false)}
        onSuccess={() => fetchDashboardData(true)}
        projects={data?.projects || []}
      />

      <ClockOutWorkerModal
        isOpen={isClockOutOpen}
        onClose={() => setIsClockOutOpen(false)}
        onSuccess={() => fetchDashboardData(true)}
        todayAttendance={data?.todayAttendance || []}
      />

      <RecordAttendanceModal
        isOpen={isRecordAttendanceOpen}
        onClose={() => setIsRecordAttendanceOpen(false)}
        onSuccess={() => fetchDashboardData(true)}
        projects={data?.projects || []}
      />

      <LogProductivityModal
        isOpen={isLogProductivityOpen}
        onClose={() => setIsLogProductivityOpen(false)}
        onSuccess={() => fetchDashboardData(true)}
        projects={data?.projects || []}
      />

      <ReportSiteIssueModal
        isOpen={isReportIssueOpen}
        onClose={() => setIsReportIssueOpen(false)}
        onSuccess={() => fetchDashboardData(true)}
        projects={data?.projects || []}
      />

      <NewMaterialRequestModal
        isOpen={isRequestMaterialOpen}
        onClose={() => setIsRequestMaterialOpen(false)}
        onRequestCreated={() => fetchDashboardData(true)}
        preselectedProjectId={data?.projects[0]?.id}
      />
    </div>
  );
};

export default SupervisorDashboard;
