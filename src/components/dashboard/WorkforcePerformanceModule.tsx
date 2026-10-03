import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Users,
  CalendarCheck,
  Activity,
  Clock,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
} from 'lucide-react';
import {
  WorkforcePerformanceService,
  OvertimeItem,
  ConductItem,
} from '../../services/workforcePerformanceService';
import { WorkforceNavTabs } from './WorkforceNavTabs';

interface WorkforcePerformanceModuleProps {
  onBackToDashboard?: () => void;
}

export const WorkforcePerformanceModule: React.FC<WorkforcePerformanceModuleProps> = ({
  onBackToDashboard,
}) => {
  const navigate = useNavigate();

  const [summaryData, setSummaryData] = useState<{
    metrics: {
      totalWorkforce: number;
      activeWorkforce: number;
      assignedWorkforce: number;
      availableWorkforce: number;
      attendanceToday: number;
      productivityRecords: number;
      pendingOvertime: number;
      conductRecords: number;
    };
    projectBreakdown: Array<{
      projectId: string;
      projectName: string;
      projectCode: string;
      assignedCount: number;
      attendanceCount: number;
      productivityCount: number;
      pendingOvertimeCount: number;
      conductCount: number;
    }>;
    workerBreakdown: Array<{
      workforceId: string;
      workerName: string;
      code: string;
      trade: string;
      status: string;
      currentProject: string | null;
      currentProjectId: string | null;
      attendanceCount: number;
      productivityCount: number;
      overtimeCount: number;
      conductCount: number;
    }>;
    exceptions: {
      pendingOvertime: OvertimeItem[];
      criticalConduct: ConductItem[];
      availableWorkers: Array<{ id: string; name: string; code: string; trade: string }>;
    };
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSummary = useCallback(async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    const res = await WorkforcePerformanceService.getWorkforcePerformanceSummary();
    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSummaryData(res);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Top Header & Breadcrumb */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                WORKFORCE CONTROL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <TrendingUp className="w-7 h-7 text-[#01875F]" />
              <span>Workforce Performance Control</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Organization-wide workforce performance, deployment, and operational exceptions.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchSummary(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh performance metrics from database"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <WorkforceNavTabs activeTab="performance" />

      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-20 bg-slate-50 rounded-lg border border-slate-100" />
            ))}
          </div>
          <div className="h-48 bg-slate-50 rounded-lg" />
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load performance summary.</h2>
          <p className="text-xs text-slate-500 mt-1">{errorMessage}</p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fetchSummary(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : summaryData ? (
        <>
          {/* Executive Summary Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                TOTAL WORKFORCE
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                {summaryData.metrics.totalWorkforce}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                ACTIVE
              </span>
              <span className="text-xl font-bold text-emerald-700 mt-1 block font-mono">
                {summaryData.metrics.activeWorkforce}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                ASSIGNED
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                {summaryData.metrics.assignedWorkforce}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                AVAILABLE
              </span>
              <span className="text-xl font-bold text-[#01875F] mt-1 block font-mono">
                {summaryData.metrics.availableWorkforce}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                ATTENDED TODAY
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                {summaryData.metrics.attendanceToday}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                OUTPUT LOGS
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                {summaryData.metrics.productivityRecords}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                PENDING OT
              </span>
              <span className="text-xl font-bold text-amber-700 mt-1 block font-mono">
                {summaryData.metrics.pendingOvertime}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                CONDUCT LOGS
              </span>
              <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                {summaryData.metrics.conductRecords}
              </span>
            </div>
          </div>

          {/* Operational Exceptions Row */}
          {(summaryData.exceptions.pendingOvertime.length > 0 ||
            summaryData.exceptions.criticalConduct.length > 0 ||
            summaryData.exceptions.availableWorkers.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Overtime Pending Approval */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pending Overtime ({summaryData.exceptions.pendingOvertime.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate('/management/workforce/overtime')}
                    className="text-[11px] font-bold text-[#01875F] hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                {summaryData.exceptions.pendingOvertime.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No overtime requests pending review.</p>
                ) : (
                  <div className="space-y-1.5 divide-y divide-slate-50 text-xs">
                    {summaryData.exceptions.pendingOvertime.slice(0, 3).map((ot) => (
                      <div key={ot.id} className="pt-1.5 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {ot.workforce_members?.workforce_code} &bull; {ot.requested_hours} hrs
                          </span>
                          <span className="text-[10.5px] text-slate-400">
                            {ot.projects?.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate('/management/workforce/overtime')}
                          className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                        >
                          Review
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Critical / Major Conduct Reports */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-rose-800 flex items-center gap-1.5 uppercase">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Incident Reports ({summaryData.exceptions.criticalConduct.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate('/management/workforce/conduct')}
                    className="text-[11px] font-bold text-[#01875F] hover:underline cursor-pointer"
                  >
                    View All
                  </button>
                </div>
                {summaryData.exceptions.criticalConduct.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No major incidents recorded.</p>
                ) : (
                  <div className="space-y-1.5 divide-y divide-slate-50 text-xs">
                    {summaryData.exceptions.criticalConduct.slice(0, 3).map((c) => (
                      <div key={c.id} className="pt-1.5 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {c.workforce_members?.workforce_code} &bull; {c.record_type}
                          </span>
                          <span className="text-[10.5px] text-slate-400 truncate max-w-[160px] block">
                            {c.description}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          {c.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Artisans Ready for Deployment */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-[#01875F] flex items-center gap-1.5 uppercase">
                    <Users className="w-3.5 h-3.5" />
                    <span>Available Artisans ({summaryData.exceptions.availableWorkers.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => navigate('/management/workforce')}
                    className="text-[11px] font-bold text-[#01875F] hover:underline cursor-pointer"
                  >
                    Workforce Directory
                  </button>
                </div>
                {summaryData.exceptions.availableWorkers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">All active workforce members are currently assigned.</p>
                ) : (
                  <div className="space-y-1.5 divide-y divide-slate-50 text-xs">
                    {summaryData.exceptions.availableWorkers.slice(0, 3).map((w) => (
                      <div key={w.id} className="pt-1.5 flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-slate-800 block">{w.name}</span>
                          <span className="text-[10.5px] text-slate-400">
                            {w.code} &bull; {w.trade}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/management/workforce/${w.id}`)}
                          className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20 hover:bg-[#d2edd9] cursor-pointer"
                        >
                          Control Centre
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Project-Level Workforce Performance Summary */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#01875F]" />
                <span>Performance &amp; Deployment by Project</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Workforce density, muster records, and operational logs aggregated by construction site.
              </p>
            </div>

            {summaryData.projectBreakdown.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No projects registered.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4 font-bold">Project</th>
                      <th className="py-3.5 px-3 font-bold">Project Code</th>
                      <th className="py-3.5 px-3 font-bold text-center">Assigned Workforce</th>
                      <th className="py-3.5 px-3 font-bold text-center">Attendance Logs</th>
                      <th className="py-3.5 px-3 font-bold text-center">Output Records</th>
                      <th className="py-3.5 px-3 font-bold text-center">Pending Overtime</th>
                      <th className="py-3.5 px-4 font-bold text-center">Conduct Reports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaryData.projectBreakdown.map((p) => (
                      <tr key={p.projectId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/management/projects/${p.projectId}`)}
                            className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{p.projectName}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {p.projectCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900">
                          {p.assignedCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                          {p.attendanceCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                          {p.productivityCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono">
                          {p.pendingOvertimeCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {p.pendingOvertimeCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono">
                          {p.conductCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              {p.conductCount}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Worker-Level Performance Summary */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#01875F]" />
                  <span>Workforce Member Performance Overview</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Factual operational counts per registered workforce member.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/management/workforce')}
                className="text-xs font-bold text-[#01875F] hover:underline cursor-pointer"
              >
                Workforce Directory →
              </button>
            </div>

            {summaryData.workerBreakdown.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No workforce members registered in the database yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4 font-bold">Worker</th>
                      <th className="py-3.5 px-3 font-bold">Code</th>
                      <th className="py-3.5 px-3 font-bold">Trade</th>
                      <th className="py-3.5 px-3 font-bold">Current Deployment</th>
                      <th className="py-3.5 px-3 font-bold text-center">Attendance Logs</th>
                      <th className="py-3.5 px-3 font-bold text-center">Productivity Logs</th>
                      <th className="py-3.5 px-3 font-bold text-center">Overtime Requests</th>
                      <th className="py-3.5 px-4 font-bold text-center">Conduct Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summaryData.workerBreakdown.map((w) => (
                      <tr key={w.workforceId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/management/workforce/${w.workforceId}`)}
                            className="font-bold text-slate-900 hover:text-[#01875F] flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                            title="Open Workforce Control Centre"
                          >
                            <span>{w.workerName}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {w.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-slate-800">{w.trade}</td>
                        <td className="py-3.5 px-3">
                          {w.currentProject && w.currentProjectId ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/management/projects/${w.currentProjectId}`)}
                              className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{w.currentProject}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-medium border border-slate-200">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-800">
                          {w.attendanceCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-800">
                          {w.productivityCount}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-800">
                          {w.overtimeCount}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-800">
                          {w.conductCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default WorkforcePerformanceModule;
