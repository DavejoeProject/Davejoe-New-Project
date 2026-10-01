import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban,
  Users,
  CheckSquare,
  CircleDollarSign,
  AlertTriangle,
  Clock,
  Package,
  Calendar,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Plus,
  ShoppingCart,
  FileText,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import {
  DashboardService,
  ManagementOverviewState,
  formatNaira,
  formatCount,
  formatDateNigerian,
} from '../../services/dashboardService';
import { DashboardNavKey } from './Sidebar';

interface DashboardOverviewProps {
  onSelectModule: (module: DashboardNavKey) => void;
  userName?: string;
  userRole?: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onSelectModule,
  userName = 'Mayowa',
  userRole = 'Management / CEO',
}) => {
  const [overviewState, setOverviewState] = useState<ManagementOverviewState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Master fetch: loads all sections independently in parallel
  const loadOverviewData = useCallback(async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await DashboardService.getManagementOverview();
      setOverviewState(result);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('[DashboardOverview] Error loading management overview:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

  // Section-specific retry handlers
  const retryKpis = async () => {
    const res = await DashboardService.getExecutiveKpis();
    setOverviewState((prev) => (prev ? { ...prev, kpis: res } : null));
  };

  const retryProjects = async () => {
    const res = await DashboardService.getProjectPerformance();
    setOverviewState((prev) => (prev ? { ...prev, projects: res } : null));
  };

  const retryApprovals = async () => {
    const res = await DashboardService.getPendingApprovals();
    setOverviewState((prev) => (prev ? { ...prev, approvals: res } : null));
  };

  const retryWorkforce = async () => {
    const res = await DashboardService.getWorkforceSnapshot();
    setOverviewState((prev) => (prev ? { ...prev, workforce: res } : null));
  };

  const retryMaterials = async () => {
    const res = await DashboardService.getMaterialsSnapshot();
    setOverviewState((prev) => (prev ? { ...prev, materials: res } : null));
  };

  const retryFinances = async () => {
    const res = await DashboardService.getFinancialSummary();
    setOverviewState((prev) => (prev ? { ...prev, finances: res } : null));
  };

  const retryAlerts = async () => {
    const res = await DashboardService.getManagementAlerts();
    setOverviewState((prev) => (prev ? { ...prev, alerts: res } : null));
  };

  const retryActivity = async () => {
    const res = await DashboardService.getRecentActivity();
    setOverviewState((prev) => (prev ? { ...prev, activity: res } : null));
  };

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const currentDateFormatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Render Section Error with Retry
  const renderSectionError = (errorMsg: string, onRetry: () => void) => (
    <div className="py-6 px-4 text-center border border-red-200 rounded-lg bg-red-50/70 my-2">
      <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
      <p className="text-xs font-semibold text-red-800">Unable to load this section.</p>
      <p className="text-[11px] text-red-600 mt-0.5 mb-3 font-mono">{errorMsg}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-red-300 hover:bg-red-50 text-red-700 text-xs font-medium rounded shadow-2xs transition-colors cursor-pointer"
      >
        <RefreshCw className="w-3 h-3" />
        <span>Retry</span>
      </button>
    </div>
  );

  // Initial loading skeleton
  if (isLoading && !overviewState) {
    return (
      <div className="space-y-6 pb-12 animate-pulse max-w-7xl mx-auto">
        <div className="h-24 bg-white rounded-xl border border-slate-200/80 p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200/80 p-5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white rounded-xl border border-slate-200/80" />
          <div className="h-72 bg-white rounded-xl border border-slate-200/80" />
        </div>
      </div>
    );
  }

  const kpis = overviewState?.kpis;
  const projects = overviewState?.projects;
  const approvals = overviewState?.approvals;
  const alerts = overviewState?.alerts;
  const workforce = overviewState?.workforce;
  const materials = overviewState?.materials;
  const finances = overviewState?.finances;
  const activity = overviewState?.activity;

  return (
    <div className="space-y-6 sm:space-y-7 pb-12 select-auto">
      {/* ============================================================================== */}
      {/* HEADER: GREETING & OPERATIONAL CONTEXT */}
      {/* ============================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              COMMAND CENTRE
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
              {userRole}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Here's what's happening across your projects.
          </p>
        </div>

        {/* Date & Refresh Action */}
        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-[#01875F]" />
            <span>{currentDateFormatted}</span>
          </div>

          <button
            type="button"
            onClick={() => loadOverviewData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            title="Refresh live Supabase database metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* SECTION 1: EXECUTIVE KPI CARDS */}
      {/* ============================================================================== */}
      {kpis?.error ? (
        renderSectionError(kpis.error, retryKpis)
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Projects */}
          <div
            onClick={() => onSelectModule('all-projects')}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#E6F4EA] flex items-center justify-center text-[#01875F]">
                <FolderKanban className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-slate-400 group-hover:text-[#01875F] transition-colors">
                Projects &rarr;
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 block">ACTIVE PROJECTS</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight font-mono">
              {formatCount(kpis?.data.activeProjects)}
            </div>
            <span className="text-[11.5px] text-slate-400 mt-1 block">
              {kpis?.data.activeProjects === 0 ? 'No projects yet' : `${kpis?.data.totalProjects} total registered`}
            </span>
          </div>

          {/* Card 2: Total Workforce */}
          <div
            onClick={() => onSelectModule('workforce')}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#E6F4EA] flex items-center justify-center text-[#01875F]">
                <Users className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-slate-400 group-hover:text-[#01875F] transition-colors">
                Workforce &rarr;
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 block">TOTAL WORKFORCE</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight font-mono">
              {formatCount(kpis?.data.totalWorkforce)}
            </div>
            <span className="text-[11.5px] text-slate-400 mt-1 block">
              {kpis?.data.totalWorkforce === 0 ? 'No workforce records' : 'Active workforce members'}
            </span>
          </div>

          {/* Card 3: Pending Approvals */}
          <div
            onClick={() => onSelectModule('approvals')}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#E6F4EA] flex items-center justify-center text-[#01875F]">
                <CheckSquare className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-slate-400 group-hover:text-[#01875F] transition-colors">
                Review &rarr;
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 block">PENDING APPROVALS</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight font-mono">
              {formatCount(kpis?.data.pendingApprovals)}
            </div>
            <span className="text-[11.5px] text-slate-400 mt-1 block">
              {kpis?.data.pendingApprovals === 0 ? 'No pending approvals' : 'Requires CEO authorization'}
            </span>
          </div>

          {/* Card 4: Project Cost / Current Spend (₦) */}
          <div
            onClick={() => onSelectModule('project-costs')}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-[#E6F4EA] flex items-center justify-center text-[#01875F]">
                <CircleDollarSign className="w-5 h-5" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-slate-400 group-hover:text-[#01875F] transition-colors">
                Finances &rarr;
              </span>
            </div>
            <span className="text-xs font-medium text-slate-500 block">PROJECT COST / SPEND</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight font-mono truncate">
              {kpis?.data.projectCostFormatted || '₦0.00'}
            </div>
            <span className="text-[11.5px] text-slate-400 mt-1 block">
              {kpis?.data.projectCost === 0 ? '₦0.00 recorded' : 'Total recorded expenditures'}
            </span>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* ROW 2: PROJECT PERFORMANCE (Left) & PENDING APPROVALS (Right) */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 2: PROJECT PERFORMANCE */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Project Performance
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('all-projects')}
                className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>View All Projects</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-4">
              {projects?.error ? (
                renderSectionError(projects.error, retryProjects)
              ) : projects?.data.projects.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No projects yet</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Projects created in the system will appear here with timeline and expenditure metrics.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects?.data.projects.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 border border-slate-200/80 rounded-lg hover:border-[#01875F]/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                            {p.code && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                                {p.code}
                              </span>
                            )}
                          </div>
                          {p.location && (
                            <span className="text-xs text-slate-400 mt-0.5 block">{p.location}</span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {p.status}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                        {p.budgetFormatted && (
                          <span>
                            Budget: <strong className="font-mono text-slate-800">{p.budgetFormatted}</strong>
                          </span>
                        )}
                        {p.actualCostFormatted && (
                          <span>
                            Cost: <strong className="font-mono text-slate-800">{p.actualCostFormatted}</strong>
                          </span>
                        )}
                        {/* ONLY display progress if real progress field exists */}
                        {p.progress != null && (
                          <span className="font-semibold text-[#01875F]">
                            Progress: {p.progress}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectModule('all-projects')}
              className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View All Projects &rarr;</span>
            </button>
          </div>
        </div>

        {/* SECTION 3: PENDING APPROVALS */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Pending Approvals
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('approvals')}
                className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>View All Approvals</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-4">
              {approvals?.error ? (
                renderSectionError(approvals.error, retryApprovals)
              ) : approvals?.data.items.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No pending approvals</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    You have no outstanding approvals at this time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvals?.data.items.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 border border-slate-200/80 rounded-lg hover:border-[#01875F]/30 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {item.reference}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E6F4EA] text-[#01875F]">
                            {item.type}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-slate-500 mt-1 flex items-center gap-2">
                          <span>By: {item.requester || 'Team'}</span>
                          <span>&bull;</span>
                          <span>{item.date}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {item.amountFormatted && (
                          <div className="text-xs font-mono font-bold text-slate-900">
                            {item.amountFormatted}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelectModule(item.moduleKey as DashboardNavKey)}
                          className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer mt-0.5 inline-block"
                        >
                          Review &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectModule('approvals')}
              className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View All Approvals &rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* ROW 3: WORKFORCE SNAPSHOT (Left) & MATERIALS SNAPSHOT (Right) */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 5: WORKFORCE SNAPSHOT */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Workforce
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('workforce')}
                className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>View Workforce</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-4">
              {workforce?.error ? (
                renderSectionError(workforce.error, retryWorkforce)
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Active Workforce</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(workforce?.data.activeWorkforce)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Attendance Today</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(workforce?.data.attendanceToday)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Productivity Logs</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(workforce?.data.productivityRecords)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Pending Overtime</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(workforce?.data.pendingOvertime)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Open Conduct Issues</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(workforce?.data.openConductIssues)}
                      </span>
                    </div>
                  </div>

                  {workforce?.data.activeWorkforce === 0 && (
                    <div className="py-4 text-center">
                      <p className="text-xs text-slate-400 italic">No workforce records currently stored in database.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectModule('workforce')}
              className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View Workforce &rarr;</span>
            </button>
          </div>
        </div>

        {/* SECTION 6: MATERIALS SNAPSHOT */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Materials
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('materials')}
                className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>View Materials</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-4">
              {materials?.error ? (
                renderSectionError(materials.error, retryMaterials)
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Total Materials</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(materials?.data.totalMaterials)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Low Stock Items</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(materials?.data.lowStockItems)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Material Requests</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(materials?.data.pendingMaterialRequests)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Pending Procurement</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(materials?.data.pendingProcurement)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Unreconciled Variances</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block">
                        {formatCount(materials?.data.unreconciledMaterials)}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70">
                      <span className="text-[11px] font-medium text-slate-500 block">Materials Value</span>
                      <span className="text-lg font-bold text-slate-900 font-mono mt-0.5 block truncate">
                        {materials?.data.materialsValuationFormatted || '₦0.00'}
                      </span>
                    </div>
                  </div>

                  {materials?.data.totalMaterials === 0 && (
                    <div className="py-4 text-center">
                      <p className="text-xs text-slate-400 italic">No material alerts</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectModule('materials')}
              className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View Materials &rarr;</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* SECTION 7: FINANCIAL CONTROL (Full-width summary) */}
      {/* ============================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
              <CircleDollarSign className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Financial Control
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onSelectModule('project-costs')}
            className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            <span>Financial Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="pt-4">
          {finances?.error ? (
            renderSectionError(finances.error, retryFinances)
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50/70 rounded-lg border border-slate-200/70">
                <span className="text-xs font-medium text-slate-500 block">PROJECT COST / SPEND</span>
                <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                  {finances?.data.projectCostFormatted || '₦0.00'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Actual site expenditures</span>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-lg border border-slate-200/70">
                <span className="text-xs font-medium text-slate-500 block">BUDGET TOTAL</span>
                <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                  {finances?.data.budgetTotalFormatted || '₦0.00'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Total allocated budget</span>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-lg border border-slate-200/70">
                <span className="text-xs font-medium text-slate-500 block">BUDGET VS ACTUAL VARIANCE</span>
                <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                  {finances?.data.varianceFormatted || '₦0.00'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Remaining budget cushion</span>
              </div>

              <div className="p-4 bg-slate-50/70 rounded-lg border border-slate-200/70">
                <span className="text-xs font-medium text-slate-500 block">PROCUREMENT COMMITTED</span>
                <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                  {finances?.data.procurementCostFormatted || '₦0.00'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">Purchase orders logged</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================================== */}
      {/* ROW 4: ALERTS (Left) & RECENT ACTIVITY (Right) */}
      {/* ============================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 4: ALERTS */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Alerts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectModule('alerts')}
                className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>View All Alerts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-4">
              {alerts?.error ? (
                renderSectionError(alerts.error, retryAlerts)
              ) : alerts?.data.alerts.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <ShieldCheck className="w-5 h-5 text-[#01875F]" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No alerts</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Everything currently requires no immediate attention.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts?.data.alerts.slice(0, 5).map((a) => (
                    <div
                      key={a.id}
                      className="p-3.5 border border-slate-200/80 rounded-lg hover:border-[#01875F]/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">{a.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            a.severity === 'critical'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {a.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{a.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onSelectModule('alerts')}
              className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <span>View All Alerts &rarr;</span>
            </button>
          </div>
        </div>

        {/* SECTION 8: RECENT ACTIVITY */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Recent Activity
                </h2>
              </div>
            </div>

            <div className="pt-4">
              {activity?.error ? (
                renderSectionError(activity.error, retryActivity)
              ) : activity?.data.activities.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">No recent activity</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Operational actions, project creations, material requests, and workforce assignments will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity?.data.activities.slice(0, 6).map((act) => (
                    <div key={act.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-slate-100 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-[#01875F] mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-800 block truncate">{act.title}</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{act.subtitle} &bull; {act.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* SECTION 9: CEO QUICK ACTIONS */}
      {/* ============================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          CEO QUICK ACTIONS
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => onSelectModule('all-projects')}
            className="p-3 rounded-lg border border-slate-200 hover:border-[#01875F] hover:bg-slate-50/70 text-left transition-all cursor-pointer group"
          >
            <FolderKanban className="w-4 h-4 text-[#01875F] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-900 block">Create Project</span>
            <span className="text-[10.5px] text-slate-400 block mt-0.5">Projects portfolio</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('workforce')}
            className="p-3 rounded-lg border border-slate-200 hover:border-[#01875F] hover:bg-slate-50/70 text-left transition-all cursor-pointer group"
          >
            <UserPlus className="w-4 h-4 text-[#01875F] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-900 block">Add Workforce</span>
            <span className="text-[10.5px] text-slate-400 block mt-0.5">Rosters &amp; artisans</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('material-requests')}
            className="p-3 rounded-lg border border-slate-200 hover:border-[#01875F] hover:bg-slate-50/70 text-left transition-all cursor-pointer group"
          >
            <FileText className="w-4 h-4 text-[#01875F] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-900 block">Material Request</span>
            <span className="text-[10.5px] text-slate-400 block mt-0.5">Site requisitions</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('procurement')}
            className="p-3 rounded-lg border border-slate-200 hover:border-[#01875F] hover:bg-slate-50/70 text-left transition-all cursor-pointer group"
          >
            <ShoppingCart className="w-4 h-4 text-[#01875F] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-900 block">Create Procurement</span>
            <span className="text-[10.5px] text-slate-400 block mt-0.5">Purchase orders</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectModule('approvals')}
            className="p-3 rounded-lg border border-slate-200 hover:border-[#01875F] hover:bg-slate-50/70 text-left transition-all cursor-pointer group"
          >
            <CheckSquare className="w-4 h-4 text-[#01875F] mb-1.5 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-slate-900 block">Review Approvals</span>
            <span className="text-[10.5px] text-slate-400 block mt-0.5">Pending sign-offs</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
