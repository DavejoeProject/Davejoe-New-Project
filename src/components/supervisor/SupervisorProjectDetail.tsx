import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  Users,
  Package,
  ClipboardCheck,
  TrendingUp,
  FileText,
  AlertCircle,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  MapPin,
  ShieldAlert,
  Truck,
  Layers,
} from 'lucide-react';
import { ProjectRecord, ProjectService, PROJECT_STATUS_CONFIG } from '../../services/projectService';
import {
  SiteSupervisorService,
  SupervisorProjectItem,
  SupervisorDailyReport,
} from '../../services/siteSupervisorService';
import {
  ProjectControlService,
  ProjectMetricsData,
  ProjectWorkforceItem,
  ProjectMaterialRequirementItem,
  ProjectMaterialRequestItem,
  ProjectMaterialDeliveryItem,
  ProjectMaterialUsageItem,
  ProjectActivityEntry,
} from '../../services/projectControlService';
import { formatNigerianDate, formatNaira } from '../../services/materialsService';
import { CreateDailyReportModal } from './CreateDailyReportModal';
import { ClockInWorkerModal } from './ClockInWorkerModal';
import { LogProductivityModal } from './LogProductivityModal';
import { ReportSiteIssueModal } from './ReportSiteIssueModal';
import { NewMaterialRequestModal } from '../dashboard/NewMaterialRequestModal';
import { supabase } from '../../lib/supabase';

export type SupervisorProjectTab =
  | 'overview'
  | 'reports'
  | 'tasks'
  | 'workforce'
  | 'attendance'
  | 'productivity'
  | 'materials'
  | 'inspections'
  | 'issues'
  | 'activity';

interface SupervisorProjectDetailProps {
  projectId: string;
  onBack: () => void;
  supervisorProjects: SupervisorProjectItem[];
}

export const SupervisorProjectDetail: React.FC<SupervisorProjectDetailProps> = ({
  projectId,
  onBack,
  supervisorProjects,
}) => {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [activeTab, setActiveTab] = useState<SupervisorProjectTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab Data
  const [metrics, setMetrics] = useState<ProjectMetricsData | null>(null);
  const [workforce, setWorkforce] = useState<ProjectWorkforceItem[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [dailyReports, setDailyReports] = useState<SupervisorDailyReport[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [productivityRecords, setProductivityRecords] = useState<any[]>([]);
  const [materialRequirements, setMaterialRequirements] = useState<ProjectMaterialRequirementItem[]>([]);
  const [materialRequests, setMaterialRequests] = useState<ProjectMaterialRequestItem[]>([]);
  const [materialDeliveries, setMaterialDeliveries] = useState<ProjectMaterialDeliveryItem[]>([]);
  const [materialUsage, setMaterialUsage] = useState<ProjectMaterialUsageItem[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [activityHistory, setActivityHistory] = useState<ProjectActivityEntry[]>([]);

  // Modals
  const [isDailyReportOpen, setIsDailyReportOpen] = useState<boolean>(false);
  const [isClockInOpen, setIsClockInOpen] = useState<boolean>(false);
  const [isLogProdOpen, setIsLogProdOpen] = useState<boolean>(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState<boolean>(false);
  const [isRequestMatOpen, setIsRequestMatOpen] = useState<boolean>(false);

  const fetchProjectData = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      // 1. Fetch project header
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projErr) throw projErr;
      if (!projData) throw new Error('Project not found or unauthorized.');
      setProject(projData);

      // 2. Concurrently fetch all tabs data
      const [
        metricsRes,
        workforceRes,
        tasksRes,
        reportsRes,
        attRes,
        prodRes,
        matDataRes,
        inspRes,
      ] = await Promise.all([
        ProjectControlService.getProjectMetrics(projectId),
        ProjectControlService.getProjectWorkforce(projectId),
        supabase.from('project_tasks').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('project_notes').select('*').eq('project_id', projectId).eq('note_type', 'daily_report').order('created_at', { ascending: false }),
        supabase.from('attendance_records').select(`
          id,
          attendance_date,
          status,
          clock_in_time,
          clock_out_time,
          is_clocked_out,
          workforce_member_id,
          workforce_members (
            id,
            workforce_code,
            trade,
            profiles ( display_name, first_name, last_name )
          )
        `).eq('project_id', projectId).order('attendance_date', { ascending: false }).limit(30),
        supabase.from('productivity_records').select(`
          id,
          work_date,
          unit_of_measure,
          count,
          notes,
          created_at,
          workforce_members ( workforce_code, trade, profiles ( display_name, first_name, last_name ) )
        `).eq('project_id', projectId).order('created_at', { ascending: false }).limit(30),
        ProjectControlService.getProjectMaterialsData(projectId),
        supabase.from('technical_inspections').select(`
          id,
          inspection_type,
          status,
          result,
          scheduled_date,
          created_at,
          inspection_findings ( id, title, description, severity, status, created_at )
        `).eq('project_id', projectId).order('created_at', { ascending: false }),
      ]);

      setMetrics(metricsRes.data);
      setWorkforce(workforceRes.data || []);
      setTasks(tasksRes.data || []);
      setAttendanceRecords(attRes.data || []);
      setProductivityRecords(prodRes.data || []);
      setMaterialRequirements(matDataRes.requirements || []);
      setMaterialRequests(matDataRes.requests || []);
      setMaterialDeliveries(matDataRes.deliveries || []);
      setMaterialUsage(matDataRes.usage || []);
      setInspections(inspRes.data || []);

      // Parse daily reports
      const parsedReports: SupervisorDailyReport[] = (reportsRes.data || []).map((rn: any) => {
        let parsed = { work_completed: rn.content };
        try {
          if (rn.content && rn.content.startsWith('{')) parsed = JSON.parse(rn.content);
        } catch {}
        return {
          id: rn.id,
          project_id: rn.project_id,
          title: rn.title || 'Daily Site Report',
          report_date: formatNigerianDate(rn.created_at),
          work_completed: parsed.work_completed || rn.content || '',
          work_planned: (parsed as any).work_planned,
          areas_worked: (parsed as any).areas_worked,
          quantities_completed: (parsed as any).quantities_completed,
          workforce_present: (parsed as any).workforce_present,
          materials_received: (parsed as any).materials_received,
          materials_used: (parsed as any).materials_used,
          delays_issues: (parsed as any).delays_issues,
          safety_concerns: (parsed as any).safety_concerns,
          next_steps: (parsed as any).next_steps,
          created_by: rn.created_by,
          created_at: rn.created_at,
        };
      });
      setDailyReports(parsedReports);

      // Activity history
      if (projData) {
        const actRes = await ProjectControlService.getProjectActivities(projData);
        setActivityHistory(actRes.data || []);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load project details.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleUpdateTaskStatus = async (taskId: string, newStatus: 'in_progress' | 'completed') => {
    const res = await SiteSupervisorService.updateTaskStatus(taskId, newStatus);
    if (!res.error) {
      fetchProjectData();
    }
  };

  const statusCfg = project?.status
    ? PROJECT_STATUS_CONFIG[project.status as any] || PROJECT_STATUS_CONFIG['in_progress']
    : PROJECT_STATUS_CONFIG['in_progress'];

  return (
    <div className="space-y-6">
      {/* Breadcrumbs & Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Projects</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="font-mono text-xs font-bold text-slate-500">
              {project?.project_code || 'PRJ'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchProjectData}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDailyReportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Daily Report</span>
            </button>
          </div>
        </div>

        {/* Project Header Info */}
        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {project?.name || 'Project Operations Centre'}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.badgeClass}`}>
                {statusCfg.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 mt-1.5">
              {project?.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{project.address}, {project.city || ''}</span>
                </span>
              )}
              {project?.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Started: {formatNigerianDate(project.start_date)}</span>
                </span>
              )}
              {project?.expected_completion_date && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Target: {formatNigerianDate(project.expected_completion_date)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsClockInOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Clock In Worker
            </button>
            <button
              onClick={() => setIsLogProdOpen(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Log Output
            </button>
            <button
              onClick={() => setIsReportIssueOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Flag Issue
            </button>
          </div>
        </div>
      </div>

      {/* 10 Operational Tabs */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1 overflow-x-auto text-xs">
        {[
          { key: 'overview', label: 'Overview', icon: FolderKanban },
          { key: 'reports', label: `Daily Reports (${dailyReports.length})`, icon: FileText },
          { key: 'tasks', label: `Tasks (${tasks.length})`, icon: CheckCircle2 },
          { key: 'workforce', label: `Workforce (${workforce.length})`, icon: Users },
          { key: 'attendance', label: `Attendance (${attendanceRecords.length})`, icon: Clock },
          { key: 'productivity', label: `Productivity (${productivityRecords.length})`, icon: TrendingUp },
          { key: 'materials', label: 'Materials', icon: Package },
          { key: 'inspections', label: `QC & Inspections (${inspections.length})`, icon: ClipboardCheck },
          { key: 'issues', label: 'Site Issues', icon: AlertTriangle },
          { key: 'activity', label: 'Activity History', icon: Clock },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#01875F] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Assigned Artisans</span>
              <span className="text-2xl font-bold font-mono text-slate-900">{workforce.length}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Active site roster</span>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Open Site Tasks</span>
              <span className="text-2xl font-bold font-mono text-amber-700">
                {tasks.filter((t) => t.status !== 'completed').length}
              </span>
              <span className="text-[10px] text-slate-500 block mt-1">Pending completion</span>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Daily Reports Filed</span>
              <span className="text-2xl font-bold font-mono text-[#01875F]">{dailyReports.length}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Verified site logs</span>
            </div>
            <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Material Requests</span>
              <span className="text-2xl font-bold font-mono text-blue-700">{materialRequests.length}</span>
              <span className="text-[10px] text-slate-500 block mt-1">Project requisitions</span>
            </div>
          </div>

          {/* Critical site notices */}
          {tasks.filter((t) => t.priority === 'critical' && t.status !== 'completed').length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Critical Site Issues Detected on Project</span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                There are {tasks.filter((t) => t.priority === 'critical' && t.status !== 'completed').length} critical issues pending resolution. Review the Tasks / Site Issues tab immediately.
              </p>
            </div>
          )}

          {/* Quick Overview Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Daily Reports */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-700">Recent Daily Reports</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className="text-xs font-semibold text-[#01875F] hover:underline"
                >
                  View All &rarr;
                </button>
              </div>
              {dailyReports.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  No daily reports logged yet for this site.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {dailyReports.slice(0, 3).map((r) => (
                    <div key={r.id} className="py-2.5">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{r.title}</span>
                        <span className="text-[11px] text-slate-400 font-normal">{r.report_date}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] line-clamp-2 mt-0.5">{r.work_completed}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Tasks */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-slate-700">Pending Tasks</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className="text-xs font-semibold text-[#01875F] hover:underline"
                >
                  View All &rarr;
                </button>
              </div>
              {tasks.filter((t) => t.status !== 'completed').length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  All site tasks completed!
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {tasks
                    .filter((t) => t.status !== 'completed')
                    .slice(0, 3)
                    .map((t) => (
                      <div key={t.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900 block">{t.title}</span>
                          <span className="text-[10px] text-slate-400">Due: {t.due_date ? formatNigerianDate(t.due_date) : 'No due date'}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700">
                          {t.priority}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY REPORTS */}
      {activeTab === 'reports' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Daily Site Reports</h3>
              <p className="text-xs text-slate-500">Formal, structured records of daily progress and site observations</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDailyReportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Report</span>
            </button>
          </div>

          {dailyReports.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No daily reports logged yet. Click "Submit Report" above to file today's report.
            </div>
          ) : (
            <div className="space-y-4">
              {dailyReports.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">{r.title}</h4>
                    <span className="text-xs text-slate-500 font-mono">{r.report_date}</span>
                  </div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                    <span className="font-bold text-slate-900 block mb-0.5">Work Completed:</span>
                    {r.work_completed}
                  </div>
                  {r.areas_worked && (
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Areas:</span> {r.areas_worked}
                    </div>
                  )}
                  {r.materials_used && (
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Materials Used:</span> {r.materials_used}
                    </div>
                  )}
                  {r.delays_issues && (
                    <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                      <span className="font-semibold">Site Delays / Issues:</span> {r.delays_issues}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TASKS & PROGRESS */}
      {activeTab === 'tasks' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Site Execution Tasks</h3>
              <p className="text-xs text-slate-500">Track and update specific daily assignments on this site</p>
            </div>
            <button
              type="button"
              onClick={() => setIsReportIssueOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Site Task</span>
            </button>
          </div>

          {tasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No tasks currently tracked for this site.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {tasks.map((t) => (
                <div key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{t.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.priority === 'critical' ? 'bg-rose-100 text-rose-700' :
                        t.priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.priority}
                      </span>
                    </div>
                    {t.description && <p className="text-slate-600 text-xs">{t.description}</p>}
                    <span className="text-[11px] text-slate-400 block">
                      Status: <strong className="capitalize text-slate-700">{t.status}</strong> • Due: {t.due_date ? formatNigerianDate(t.due_date) : 'Unscheduled'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {t.status !== 'in_progress' && t.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTaskStatus(t.id, 'in_progress')}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                      >
                        Start
                      </button>
                    )}
                    {t.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateTaskStatus(t.id, 'completed')}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-100 transition-colors"
                      >
                        Mark Done
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WORKFORCE */}
      {activeTab === 'workforce' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Assigned Site Workforce</h3>
              <p className="text-xs text-slate-500">Artisans and trades allocated to this project</p>
            </div>
            <button
              onClick={() => setIsClockInOpen(true)}
              className="px-3 py-1.5 bg-[#01875F] text-white rounded-xl text-xs font-bold"
            >
              Clock In Worker
            </button>
          </div>

          {workforce.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No workforce assigned to this site yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Artisan Code</th>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Trade</th>
                    <th className="py-2.5 px-4">Role on Project</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workforce.map((w) => {
                    const m = w.workforce_members;
                    const name = m?.profiles?.display_name || `${m?.profiles?.first_name || ''} ${m?.profiles?.last_name || ''}`.trim() || 'Artisan';
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">{m?.workforce_code || '---'}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{name}</td>
                        <td className="py-3 px-4 text-slate-600">{m?.trade || 'Artisan'}</td>
                        <td className="py-3 px-4 text-slate-500">{w.notes || 'Site Artisan'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                            {m?.status || 'Active'}
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
      )}

      {/* TAB 5: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Site Attendance &amp; Muster</h3>
              <p className="text-xs text-slate-500">Daily presence and shift records for this site</p>
            </div>
            <button
              onClick={() => setIsClockInOpen(true)}
              className="px-3 py-1.5 bg-[#01875F] text-white rounded-xl text-xs font-bold"
            >
              Clock In Worker
            </button>
          </div>

          {attendanceRecords.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No attendance records logged for this project yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Artisan</th>
                    <th className="py-2.5 px-4">Trade</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Shift Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceRecords.map((a) => {
                    const prof = a.workforce_members?.profiles;
                    const name =
                      prof?.display_name ||
                      `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
                      `Artisan ${a.workforce_members?.workforce_code || a.workforce_member_id?.slice(0, 8)}`;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono">{formatNigerianDate(a.attendance_date)}</td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{name}</span>
                          <span className="font-mono text-[10px] text-slate-400 block">
                            [{a.workforce_members?.workforce_code || '---'}]
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{a.workforce_members?.trade || 'Artisan'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === 'present' ? 'bg-emerald-50 text-emerald-700' :
                            a.status === 'late' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {a.is_clocked_out ? 'Completed Shift' : 'Active On Site'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: PRODUCTIVITY */}
      {activeTab === 'productivity' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Artisan Productivity Logs</h3>
              <p className="text-xs text-slate-500">Output logged by artisan and trade</p>
            </div>
            <button
              onClick={() => setIsLogProdOpen(true)}
              className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold"
            >
              Log Output
            </button>
          </div>

          {productivityRecords.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No productivity records logged for this project yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Artisan</th>
                    <th className="py-2.5 px-4">Trade</th>
                    <th className="py-2.5 px-4">Output Completed</th>
                    <th className="py-2.5 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productivityRecords.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono">{formatNigerianDate(p.work_date)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {p.workforce_members?.workforce_code || 'Artisan'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.workforce_members?.trade || 'Finishing'}</td>
                      <td className="py-3 px-4 font-bold text-purple-700">
                        {p.count} {p.unit_of_measure}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{p.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: MATERIALS */}
      {activeTab === 'materials' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Site Materials Operations</h3>
              <p className="text-xs text-slate-500">Requirements, requisitions, waybills received, and consumption</p>
            </div>
            <button
              onClick={() => setIsRequestMatOpen(true)}
              className="px-3 py-1.5 bg-[#01875F] text-white rounded-xl text-xs font-bold"
            >
              Request Material
            </button>
          </div>

          {/* Sub-sections */}
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase text-slate-700">Material Requisitions ({materialRequests.length})</h4>
            {materialRequests.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                No material requisitions logged.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {materialRequests.map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{r.request_code || 'Requisition'}</span>
                      <span className="text-[11px] text-slate-400 block">{r.notes || 'Site requirement'}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 capitalize">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deliveries & Waybills */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="font-bold text-xs uppercase text-slate-700">Site Deliveries &amp; Waybills ({materialDeliveries.length})</h4>
            {materialDeliveries.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                No material deliveries recorded for this project site.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {materialDeliveries.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{d.delivery_code || 'Delivery'}</span>
                      <span className="text-[11px] text-slate-500 block">
                        Waybill / Ack: {d.acknowledgement_reference || 'Pending signoff'} • Dest: {d.destination || 'Site'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">{formatNigerianDate(d.delivery_date || d.created_at)}</span>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">Received</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actual Site Usage */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="font-bold text-xs uppercase text-slate-700">Site Material Consumption ({materialUsage.length})</h4>
            {materialUsage.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">
                No material consumption entries recorded.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {materialUsage.map((u) => (
                  <div key={u.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{u.work_area || 'Site Area'}</span>
                      <span className="text-[11px] text-slate-500 block">{u.purpose || 'Interior execution'}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-purple-700 text-xs">{u.quantity_used} units</span>
                      <span className="text-[10px] text-slate-400 block">{formatNigerianDate(u.usage_date || '')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: INSPECTIONS & QC */}
      {activeTab === 'inspections' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Technical Inspection &amp; QC Logs</h3>
            <p className="text-xs text-slate-500">Quality audits, defect findings, and required rectifications</p>
          </div>

          {inspections.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No technical inspections filed for this project yet.
            </div>
          ) : (
            <div className="space-y-4">
              {inspections.map((i) => (
                <div key={i.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">{i.inspection_type}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      i.result === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                      i.result === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {i.result || i.status}
                    </span>
                  </div>
                  {Array.isArray(i.inspection_findings) && i.inspection_findings.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1.5">
                      <span className="font-bold text-xs text-slate-800 block">Findings to rectify:</span>
                      {i.inspection_findings.map((f: any) => (
                        <div key={f.id} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                          <div className="flex items-center justify-between font-semibold text-slate-900">
                            <span>{f.title}</span>
                            <span className="text-[10px] text-rose-600 font-bold uppercase">{f.severity}</span>
                          </div>
                          {f.description && <p className="text-slate-600 text-[11px] mt-0.5">{f.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: SITE ISSUES */}
      {activeTab === 'issues' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Site Issues &amp; Escalations</h3>
              <p className="text-xs text-slate-500">Operational delays, defects, and safety warnings requiring management notice</p>
            </div>
            <button
              onClick={() => setIsReportIssueOpen(true)}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
            >
              Flag Issue
            </button>
          </div>

          {tasks.filter((t) => t.priority === 'critical' || t.priority === 'high').length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No high-priority site issues reported for this project.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks
                .filter((t) => t.priority === 'critical' || t.priority === 'high')
                .map((t) => (
                  <div key={t.id} className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900 text-sm">{t.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 uppercase">
                        {t.priority}
                      </span>
                    </div>
                    {t.description && <p className="text-rose-800">{t.description}</p>}
                    <span className="text-[10px] text-slate-500 block pt-1">
                      Logged on: {formatNigerianDate(t.created_at)} • Status: {t.status}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 10: ACTIVITY HISTORY */}
      {activeTab === 'activity' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Project Activity Timeline</h3>
            <p className="text-xs text-slate-500">Audit trail of material movements, workforce muster, and site updates</p>
          </div>

          {activityHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No historical activities recorded yet.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {activityHistory.map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#01875F] mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">{a.title}</span>
                    <span className="text-slate-500 text-[11px] block">{a.subtitle}</span>
                    <span className="text-[10px] text-slate-400 mt-1 block font-mono">{a.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateDailyReportModal
        isOpen={isDailyReportOpen}
        onClose={() => setIsDailyReportOpen(false)}
        onSuccess={fetchProjectData}
        projects={supervisorProjects}
        preselectedProjectId={projectId}
      />
      <ClockInWorkerModal
        isOpen={isClockInOpen}
        onClose={() => setIsClockInOpen(false)}
        onSuccess={fetchProjectData}
        projects={supervisorProjects}
        preselectedProjectId={projectId}
      />
      <LogProductivityModal
        isOpen={isLogProdOpen}
        onClose={() => setIsLogProdOpen(false)}
        onSuccess={fetchProjectData}
        projects={supervisorProjects}
        preselectedProjectId={projectId}
      />
      <ReportSiteIssueModal
        isOpen={isReportIssueOpen}
        onClose={() => setIsReportIssueOpen(false)}
        onSuccess={fetchProjectData}
        projects={supervisorProjects}
        preselectedProjectId={projectId}
      />
      <NewMaterialRequestModal
        isOpen={isRequestMatOpen}
        onClose={() => setIsRequestMatOpen(false)}
        onSuccess={fetchProjectData}
        projects={supervisorProjects as any}
        preselectedProjectId={projectId}
      />
    </div>
  );
};
