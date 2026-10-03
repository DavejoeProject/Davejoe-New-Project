import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  RefreshCw,
  Edit3,
  UserPlus,
  FolderKanban,
  CalendarCheck,
  Activity,
  Clock,
  ShieldAlert,
  AlertCircle,
  Phone,
  Briefcase,
  FileText,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Shield,
  XCircle,
} from 'lucide-react';
import {
  WorkforceControlService,
  AttendanceRecordItem,
  ProductivityRecordItem,
  OvertimeRequestItem,
  ConductRecordItem,
  OperationalSnapshotMetrics,
} from '../../services/workforceControlService';
import {
  WorkforceMemberRecord,
  ProjectAssignmentItem,
  WORKFORCE_STATUS_CONFIG,
  WorkforceStatus,
} from '../../services/workforceService';
import { formatDateNigerian } from '../../services/dashboardService';
import { EditWorkforceModal } from './EditWorkforceModal';
import { AssignWorkerModal } from './AssignWorkerModal';

interface WorkforceControlCentreProps {
  workforceId: string;
  onBackToWorkforce: () => void;
}

type TabKey = 'overview' | 'deployment' | 'attendance' | 'productivity' | 'overtime' | 'conduct';

export const WorkforceControlCentre: React.FC<WorkforceControlCentreProps> = ({
  workforceId,
  onBackToWorkforce,
}) => {
  const navigate = useNavigate();

  // Core worker state
  const [member, setMember] = useState<WorkforceMemberRecord | null>(null);
  const [isLoadingWorker, setIsLoadingWorker] = useState(true);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Tab data caches
  const [snapshot, setSnapshot] = useState<OperationalSnapshotMetrics | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecordItem[]>([]);
  const [productivity, setProductivity] = useState<ProductivityRecordItem[]>([]);
  const [overtime, setOvertime] = useState<OvertimeRequestItem[]>([]);
  const [conduct, setConduct] = useState<ConductRecordItem[]>([]);

  // Tab loading & error states
  const [tabLoading, setTabLoading] = useState<Record<TabKey, boolean>>({
    overview: false,
    deployment: false,
    attendance: false,
    productivity: false,
    overtime: false,
    conduct: false,
  });

  const [tabError, setTabError] = useState<Record<TabKey, string | null>>({
    overview: null,
    deployment: null,
    attendance: null,
    productivity: null,
    overtime: null,
    conduct: null,
  });

  // Modals & Action dialogs
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignmentToEnd, setAssignmentToEnd] = useState<ProjectAssignmentItem | null>(null);
  const [isEndingAssignment, setIsEndingAssignment] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // 1. Load Core Workforce Member
  const loadWorker = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoadingWorker(true);
      }
      setWorkerError(null);

      const res = await WorkforceControlService.getWorkforceMember(workforceId);
      if (res.error) {
        setWorkerError(res.error);
      } else {
        setMember(res.data);
      }

      setIsLoadingWorker(false);
      setIsRefreshing(false);
    },
    [workforceId]
  );

  useEffect(() => {
    loadWorker();
  }, [loadWorker]);

  // 2. Load Tab Data on Demand (Progressive Disclosure)
  const loadTabData = useCallback(
    async (tab: TabKey) => {
      setTabLoading((prev) => ({ ...prev, [tab]: true }));
      setTabError((prev) => ({ ...prev, [tab]: null }));

      try {
        if (tab === 'overview') {
          const res = await WorkforceControlService.getOperationalSnapshot(workforceId);
          if (res.error) {
            setTabError((prev) => ({ ...prev, overview: res.error }));
          } else {
            setSnapshot(res.data);
          }
        } else if (tab === 'attendance') {
          const res = await WorkforceControlService.getAttendanceRecords(workforceId);
          if (res.error) {
            setTabError((prev) => ({ ...prev, attendance: res.error }));
          } else {
            setAttendance(res.data);
          }
        } else if (tab === 'productivity') {
          const res = await WorkforceControlService.getProductivityRecords(workforceId);
          if (res.error) {
            setTabError((prev) => ({ ...prev, productivity: res.error }));
          } else {
            setProductivity(res.data);
          }
        } else if (tab === 'overtime') {
          const res = await WorkforceControlService.getOvertimeRequests(workforceId);
          if (res.error) {
            setTabError((prev) => ({ ...prev, overtime: res.error }));
          } else {
            setOvertime(res.data);
          }
        } else if (tab === 'conduct') {
          const res = await WorkforceControlService.getConductRecords(workforceId);
          if (res.error) {
            setTabError((prev) => ({ ...prev, conduct: res.error }));
          } else {
            setConduct(res.data);
          }
        }
      } catch (err: any) {
        setTabError((prev) => ({
          ...prev,
          [tab]: err?.message || `Failed to load ${tab} data.`,
        }));
      } finally {
        setTabLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [workforceId]
  );

  // Trigger loading when activeTab changes
  useEffect(() => {
    if (!member) return;
    loadTabData(activeTab);
  }, [activeTab, member, loadTabData]);

  // Handle End Assignment Action
  const handleConfirmEndAssignment = async () => {
    if (!assignmentToEnd) return;
    setIsEndingAssignment(true);

    const res = await WorkforceControlService.endAssignment(assignmentToEnd.id);
    setIsEndingAssignment(false);

    if (res.error) {
      showToast(`Error: ${res.error}`);
    } else {
      showToast('Assignment ended successfully. Worker is now available.');
      setAssignmentToEnd(null);
      loadWorker(true);
      if (activeTab === 'overview') {
        loadTabData('overview');
      }
    }
  };

  // Helper for project navigation
  const handleNavigateToProject = (projectId: string) => {
    navigate(`/management/projects/${projectId}`);
  };

  // -------------------------------------------------------------
  // RENDER STATES: LOADING & ERRORS
  // -------------------------------------------------------------

  if (isLoadingWorker) {
    return (
      <div className="space-y-6 animate-pulse max-w-7xl mx-auto pb-12 select-auto">
        <div className="h-24 bg-white rounded-xl border border-slate-200/80 p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-slate-200/80 p-4" />
          ))}
        </div>
        <div className="h-96 bg-white rounded-xl border border-slate-200/80" />
      </div>
    );
  }

  if (workerError) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-2xs p-10 text-center max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Unable to load this workforce member.</h2>
        <p className="text-xs text-slate-500 mt-1">{workerError}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBackToWorkforce}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            ← Back to Workforce
          </button>
          <button
            type="button"
            onClick={() => loadWorker(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-lg mx-auto my-12">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4 border border-slate-200">
          <Users className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Workforce member not found</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          The workforce member you are looking for does not exist or is no longer available.
        </p>
        <div className="mt-6 pt-6 border-t border-slate-100 flex justify-center">
          <button
            type="button"
            onClick={onBackToWorkforce}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workforce</span>
          </button>
        </div>
      </div>
    );
  }

  // Derive worker display name and status config
  const prof = member.profiles;
  const workerDisplayName =
    prof?.display_name ||
    (prof?.first_name || prof?.last_name
      ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
      : `Artisan ${member.workforce_code}`);

  const statusCfg = WORKFORCE_STATUS_CONFIG[member.status] || {
    label: member.status,
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  };

  const activeDeployment = member.active_assignment;

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#01875F]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header with Breadcrumb and Main Identity */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onBackToWorkforce}
              className="inline-flex items-center gap-1.5 font-semibold text-[#01875F] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Workforce</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500 font-medium">Workforce Control Centre</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">{workerDisplayName}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadWorker(true);
                loadTabData(activeTab);
              }}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh member data from database"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Workforce</span>
            </button>
          </div>
        </div>

        {/* Worker Identity Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-xl shrink-0 border border-[#01875F]/20 shadow-2xs">
              {prof?.avatar_url ? (
                <img
                  src={prof.avatar_url}
                  alt={workerDisplayName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                workerDisplayName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded">
                  {member.workforce_code}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                  {member.trade}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.badgeClasses}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClasses}`} />
                  {statusCfg.label.toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1.5">
                {workerDisplayName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Assign to Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive Workforce Summary (Restrained Summary Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* CURRENT STATUS */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            CURRENT STATUS
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusCfg.badgeClasses}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClasses}`} />
              {statusCfg.label}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Roster state</span>
        </div>

        {/* CURRENT DEPLOYMENT */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            CURRENT DEPLOYMENT
          </span>
          {activeDeployment ? (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => handleNavigateToProject(activeDeployment.project_id)}
                className="text-xs font-bold text-[#01875F] hover:underline flex items-center gap-1 text-left truncate max-w-full cursor-pointer"
                title={`Open project control centre for ${activeDeployment.projects?.name}`}
              >
                <span className="truncate">{activeDeployment.projects?.name || 'Assigned Project'}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </button>
              <span className="text-[11px] text-slate-500 font-mono mt-0.5 block">
                [{activeDeployment.projects?.project_code || 'PRJ'}] &bull; {activeDeployment.role_on_project || member.trade}
              </span>
            </div>
          ) : (
            <div className="mt-1">
              <span className="text-xs font-semibold text-slate-600 block">
                Available — No active project
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">Ready for deployment</span>
            </div>
          )}
        </div>

        {/* TRADE / CRAFT */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            TRADE / CRAFT
          </span>
          <span className="text-sm font-bold text-slate-900 mt-1 block truncate">
            {member.trade}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Primary artisan specialty</span>
        </div>

        {/* WORKFORCE CODE */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            WORKFORCE CODE
          </span>
          <span className="text-sm font-bold font-mono text-slate-900 mt-1 block">
            {member.workforce_code}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Unique system identifier</span>
        </div>
      </div>

      {/* 3. Main Control Centre Tabbed Navigation */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-slate-200/80 overflow-x-auto bg-slate-50/50 px-3">
          {[
            { key: 'overview' as TabKey, label: 'Overview', icon: Users },
            { key: 'deployment' as TabKey, label: 'Deployment', icon: FolderKanban },
            { key: 'attendance' as TabKey, label: 'Attendance', icon: CalendarCheck },
            { key: 'productivity' as TabKey, label: 'Productivity', icon: Activity },
            { key: 'overtime' as TabKey, label: 'Overtime', icon: Clock },
            { key: 'conduct' as TabKey, label: 'Conduct', icon: ShieldAlert },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-[#01875F] text-[#01875F] bg-white'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#01875F]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Subgrid: Workforce Info & Current Deployment */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* A. Workforce Information */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#01875F]" />
                    <span>Workforce Information</span>
                  </h3>

                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Workforce Code:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {member.workforce_code}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Trade / Craft:</span>
                      <span className="font-semibold text-slate-800">{member.trade}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Status:</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${statusCfg.badgeClasses}`}
                      >
                        <span className={`w-1 h-1 rounded-full ${statusCfg.dotClasses}`} />
                        {statusCfg.label}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Phone Number:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {member.phone || 'Not provided'}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Emergency Contact Name:</span>
                      <span className="font-medium text-slate-800">
                        {member.emergency_contact_name || 'Not provided'}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Emergency Contact Phone:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {member.emergency_contact_phone || 'Not provided'}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Registration Date:</span>
                      <span className="font-medium text-slate-800">
                        {formatDateNigerian(member.created_at)}
                      </span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500 font-medium">Last Updated:</span>
                      <span className="font-medium text-slate-800">
                        {member.updated_at ? formatDateNigerian(member.updated_at) : 'Not updated'}
                      </span>
                    </div>
                  </div>

                  {member.notes && (
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 block mb-1">
                        NOTES &amp; BACKGROUND:
                      </span>
                      <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/60 leading-relaxed whitespace-pre-line">
                        {member.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* B. Current Deployment */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-[#01875F]" />
                      <span>Current Deployment</span>
                    </h3>
                    {activeDeployment && (
                      <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Site
                      </span>
                    )}
                  </div>

                  {activeDeployment ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-2">
                        <span className="text-[10.5px] font-bold uppercase text-emerald-800">
                          PROJECT
                        </span>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-slate-900">
                            {activeDeployment.projects?.name}
                          </h4>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                            {activeDeployment.projects?.project_code}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleNavigateToProject(activeDeployment.project_id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#01875F] hover:underline cursor-pointer pt-1"
                        >
                          <span>Open Project Control Centre</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="divide-y divide-slate-100 text-xs">
                        <div className="py-2 flex justify-between">
                          <span className="text-slate-500 font-medium">Role on Project:</span>
                          <span className="font-semibold text-slate-800">
                            {activeDeployment.role_on_project || member.trade}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-slate-500 font-medium">Assignment Start:</span>
                          <span className="font-mono text-slate-800">
                            {activeDeployment.start_date
                              ? formatDateNigerian(activeDeployment.start_date)
                              : 'Not specified'}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-slate-500 font-medium">Expected End:</span>
                          <span className="font-mono text-slate-800">
                            {activeDeployment.end_date
                              ? formatDateNigerian(activeDeployment.end_date)
                              : 'Open-ended'}
                          </span>
                        </div>
                        <div className="py-2 flex justify-between">
                          <span className="text-slate-500 font-medium">Assignment Status:</span>
                          <span className="font-bold text-emerald-700">Active</span>
                        </div>
                        {activeDeployment.notes && (
                          <div className="py-2">
                            <span className="text-slate-500 font-medium block mb-1">
                              Deployment Notes:
                            </span>
                            <span className="text-slate-700 italic">
                              {activeDeployment.notes}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setAssignmentToEnd(activeDeployment)}
                          className="w-full py-2 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          End Current Assignment
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <FolderKanban className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-slate-600">
                        No active project assignment
                      </p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        This artisan is currently unassigned and available for deployment on any active project.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsAssignModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Deploy to Project</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* C. Operational Snapshot */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#01875F]" />
                    <span>Operational Snapshot (Real Database Records)</span>
                  </h3>
                  {tabLoading.overview && (
                    <span className="text-[11px] text-slate-400">Loading snapshot...</span>
                  )}
                </div>

                {tabError.overview ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
                    <span>Unable to load operational snapshot.</span>
                    <button
                      type="button"
                      onClick={() => loadTabData('overview')}
                      className="font-bold underline cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-center">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                        Active Assignment
                      </span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                        {snapshot ? snapshot.activeAssignmentCount : activeDeployment ? 1 : 0}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-center">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                        Total Assignments
                      </span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                        {snapshot ? snapshot.totalAssignmentsCount : member.assignments?.length || 0}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-center">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                        Attendance Records
                      </span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                        {snapshot ? snapshot.attendanceCount : 0}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-center">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                        Productivity Logs
                      </span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                        {snapshot ? snapshot.productivityCount : 0}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-center">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                        Overtime Requests
                      </span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                        {snapshot ? snapshot.overtimeCount : 0}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/70 text-center">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                        Conduct Reports
                      </span>
                      <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                        {snapshot ? snapshot.conductCount : 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: DEPLOYMENT */}
          {activeTab === 'deployment' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Project Assignment History</h3>
                  <p className="text-xs text-slate-500">
                    Real project assignments retrieved from public.project_workforce_assignments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-center"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Assign to Project</span>
                </button>
              </div>

              {(!member.assignments || member.assignments.length === 0) ? (
                <div className="p-12 text-center bg-slate-50/50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No project assignments</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    This worker has not yet been assigned to any project in the organization.
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setIsAssignModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Assign to Project</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4 font-bold">Project</th>
                          <th className="py-3 px-3 font-bold">Project Code</th>
                          <th className="py-3 px-3 font-bold">Role on Project</th>
                          <th className="py-3 px-3 font-bold">Start Date</th>
                          <th className="py-3 px-3 font-bold">End Date</th>
                          <th className="py-3 px-3 font-bold">Status</th>
                          <th className="py-3 px-3 font-bold">Notes</th>
                          <th className="py-3 px-4 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {member.assignments.map((assign) => {
                          const isCurrentlyActive = assign.is_active;
                          return (
                            <tr key={assign.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToProject(assign.project_id)}
                                  className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{assign.projects?.name || 'Project'}</span>
                                  <ExternalLink className="w-3 h-3 text-slate-400" />
                                </button>
                              </td>
                              <td className="py-3 px-3">
                                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {assign.projects?.project_code || 'PRJ'}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-medium text-slate-800">
                                {assign.role_on_project || member.trade}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-700">
                                {assign.start_date ? formatDateNigerian(assign.start_date) : '—'}
                              </td>
                              <td className="py-3 px-3 font-mono text-slate-700">
                                {assign.end_date ? formatDateNigerian(assign.end_date) : 'Open'}
                              </td>
                              <td className="py-3 px-3">
                                {isCurrentlyActive ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Ended
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-500 max-w-[200px] truncate">
                                {assign.notes || '—'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isCurrentlyActive && (
                                  <button
                                    type="button"
                                    onClick={() => setAssignmentToEnd(assign)}
                                    className="px-2.5 py-1 text-red-600 hover:bg-red-50 border border-red-200 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    End Assignment
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Attendance Records</h3>
                  <p className="text-xs text-slate-500">
                    Real muster roll logs retrieved from public.attendance_records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadTabData('attendance')}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Reload attendance records"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${tabLoading.attendance ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              {tabLoading.attendance ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading attendance records...
                </div>
              ) : tabError.attendance ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-red-700">Unable to load attendance records.</p>
                  <p className="text-[11px] text-red-600 font-mono mt-1">{tabError.attendance}</p>
                  <button
                    type="button"
                    onClick={() => loadTabData('attendance')}
                    className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : attendance.length === 0 ? (
                <div className="p-12 text-center bg-slate-50/50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <CalendarCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No attendance records</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Attendance records for this workforce member will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4 font-bold">Attendance Date</th>
                          <th className="py-3 px-3 font-bold">Project</th>
                          <th className="py-3 px-3 font-bold">Status</th>
                          <th className="py-3 px-3 font-bold">Recorded By</th>
                          <th className="py-3 px-4 font-bold">Recorded At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attendance.map((att) => (
                          <tr key={att.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {formatDateNigerian(att.attendance_date)}
                            </td>
                            <td className="py-3 px-3">
                              {att.projects ? (
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToProject(att.project_id)}
                                  className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{att.projects.name}</span>
                                  <span className="font-mono text-slate-400">
                                    [{att.projects.project_code}]
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase ${
                                  att.status?.toLowerCase() === 'present'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : att.status?.toLowerCase() === 'late'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {att.status || 'Recorded'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                              {att.recorded_by || 'Supervisor'}
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                              {formatDateNigerian(att.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PRODUCTIVITY */}
          {activeTab === 'productivity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Productivity Records</h3>
                  <p className="text-xs text-slate-500">
                    Real site output metrics retrieved from public.productivity_records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadTabData('productivity')}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Reload productivity records"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${tabLoading.productivity ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              {tabLoading.productivity ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading productivity records...
                </div>
              ) : tabError.productivity ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-red-700">Unable to load productivity records.</p>
                  <p className="text-[11px] text-red-600 font-mono mt-1">{tabError.productivity}</p>
                  <button
                    type="button"
                    onClick={() => loadTabData('productivity')}
                    className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : productivity.length === 0 ? (
                <div className="p-12 text-center bg-slate-50/50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No productivity records</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Productivity records for this workforce member will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4 font-bold">Work Date</th>
                          <th className="py-3 px-3 font-bold">Project</th>
                          <th className="py-3 px-3 font-bold">Output / Count</th>
                          <th className="py-3 px-3 font-bold">Unit of Measure</th>
                          <th className="py-3 px-4 font-bold">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productivity.map((prod) => (
                          <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {prod.work_date ? formatDateNigerian(prod.work_date) : formatDateNigerian(prod.created_at)}
                            </td>
                            <td className="py-3 px-3">
                              {prod.projects ? (
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToProject(prod.project_id)}
                                  className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{prod.projects.name}</span>
                                  <span className="font-mono text-slate-400">
                                    [{prod.projects.project_code}]
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              {prod.count != null ? prod.count : '—'}
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              {prod.unit_of_measure || 'units'}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {prod.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: OVERTIME */}
          {activeTab === 'overtime' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Overtime Requests</h3>
                  <p className="text-xs text-slate-500">
                    Real overtime requisitions retrieved from public.overtime_requests.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadTabData('overtime')}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Reload overtime requests"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${tabLoading.overtime ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              {tabLoading.overtime ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading overtime requests...
                </div>
              ) : tabError.overtime ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-red-700">Unable to load overtime requests.</p>
                  <p className="text-[11px] text-red-600 font-mono mt-1">{tabError.overtime}</p>
                  <button
                    type="button"
                    onClick={() => loadTabData('overtime')}
                    className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : overtime.length === 0 ? (
                <div className="p-12 text-center bg-slate-50/50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No overtime records</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Overtime requests for this workforce member will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4 font-bold">Request Date</th>
                          <th className="py-3 px-3 font-bold">Project</th>
                          <th className="py-3 px-3 font-bold">Requested Hours</th>
                          <th className="py-3 px-3 font-bold">Reason</th>
                          <th className="py-3 px-3 font-bold">Status</th>
                          <th className="py-3 px-4 font-bold">Approval Info</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overtime.map((ot) => (
                          <tr key={ot.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {formatDateNigerian(ot.created_at)}
                            </td>
                            <td className="py-3 px-3">
                              {ot.projects ? (
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToProject(ot.project_id)}
                                  className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{ot.projects.name}</span>
                                  <span className="font-mono text-slate-400">
                                    [{ot.projects.project_code}]
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-900">
                              {ot.requested_hours} hrs
                            </td>
                            <td className="py-3 px-3 text-slate-700 max-w-[200px] truncate">
                              {ot.reason || '—'}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase ${
                                  ot.status?.toLowerCase() === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : ot.status?.toLowerCase() === 'rejected'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {ot.status || 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500">
                              {ot.approved_at ? (
                                <span className="text-[11px]">
                                  Approved: {formatDateNigerian(ot.approved_at)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: CONDUCT */}
          {activeTab === 'conduct' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Workforce Conduct Records</h3>
                  <p className="text-xs text-slate-500">
                    Real incident and disciplinary reports retrieved from public.workforce_conduct_records.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadTabData('conduct')}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Reload conduct records"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${tabLoading.conduct ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              {tabLoading.conduct ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading conduct records...
                </div>
              ) : tabError.conduct ? (
                <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                  <p className="text-xs font-bold text-red-700">Unable to load conduct records.</p>
                  <p className="text-[11px] text-red-600 font-mono mt-1">{tabError.conduct}</p>
                  <button
                    type="button"
                    onClick={() => loadTabData('conduct')}
                    className="mt-3 px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : conduct.length === 0 ? (
                <div className="p-12 text-center bg-slate-50/50 rounded-xl border border-slate-200">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No conduct records</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Disciplinary, safety, and conduct logs for this workforce member will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <th className="py-3 px-4 font-bold">Date</th>
                          <th className="py-3 px-3 font-bold">Project</th>
                          <th className="py-3 px-3 font-bold">Record Type</th>
                          <th className="py-3 px-3 font-bold">Severity</th>
                          <th className="py-3 px-3 font-bold">Description</th>
                          <th className="py-3 px-4 font-bold">Action Taken</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {conduct.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {formatDateNigerian(c.created_at)}
                            </td>
                            <td className="py-3 px-3">
                              {c.projects ? (
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToProject(c.project_id)}
                                  className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{c.projects.name}</span>
                                  <span className="font-mono text-slate-400">
                                    [{c.projects.project_code}]
                                  </span>
                                </button>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-700 font-medium">
                              {c.record_type || 'Incident'}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase ${
                                  c.severity?.toLowerCase() === 'high' || c.severity?.toLowerCase() === 'severe'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : c.severity?.toLowerCase() === 'medium'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {c.severity || 'Normal'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-700 max-w-[240px] truncate">
                              {c.description || '—'}
                            </td>
                            <td className="py-3 px-4 text-slate-700 font-medium">
                              {c.action_taken || 'Under review'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Interactive Modals */}
      <EditWorkforceModal
        member={member}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={(msg) => {
          showToast(msg);
          loadWorker(true);
        }}
      />

      <AssignWorkerModal
        member={member}
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssigned={(msg) => {
          showToast(msg);
          loadWorker(true);
          if (activeTab === 'overview' || activeTab === 'deployment') {
            loadTabData(activeTab);
          }
        }}
      />

      {/* 5. End Assignment Confirmation Dialog */}
      {assignmentToEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">End this project assignment?</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ending the assignment will mark the current deployment as inactive.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Worker:</span>
                <span className="font-bold text-slate-800">{workerDisplayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Project:</span>
                <span className="font-bold text-slate-800">
                  {assignmentToEnd.projects?.name || 'Project'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Role:</span>
                <span className="font-medium text-slate-800">
                  {assignmentToEnd.role_on_project || member.trade}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignmentToEnd(null)}
                disabled={isEndingAssignment}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndAssignment}
                disabled={isEndingAssignment}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                {isEndingAssignment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Ending Assignment...</span>
                  </>
                ) : (
                  <span>Confirm End Assignment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkforceControlCentre;
