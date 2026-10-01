import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Edit3,
  Building2,
  FolderKanban,
  Users,
  Package,
  ShoppingBag,
  CircleDollarSign,
  History,
  AlertCircle,
  Plus,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Eye,
  AlertTriangle,
  FileText,
  Boxes,
  Truck,
  RotateCcw,
  Scale,
} from 'lucide-react';
import {
  ProjectRecord,
  ProjectService,
  PROJECT_STATUS_CONFIG,
  ProjectStatus,
} from '../../services/projectService';
import {
  ProjectControlService,
  ProjectMetricsData,
  ProjectWorkforceItem,
  ProjectMaterialRequirementItem,
  ProjectMaterialRequestItem,
  ProjectMaterialDeliveryItem,
  ProjectMaterialUsageItem,
  ProjectMaterialReturnItem,
  ProjectMaterialLossItem,
  ProjectMaterialReconciliationItem,
  ProjectPurchaseOrderItem,
  ProjectActivityEntry,
} from '../../services/projectControlService';
import { formatNaira, formatDateNigerian } from '../../services/dashboardService';
import { EditProjectModal } from './EditProjectModal';
import { AssignWorkforceModal } from './AssignWorkforceModal';
import { WorkerDetailModal } from './WorkerDetailModal';
import { PurchaseOrderDetailModal } from './PurchaseOrderDetailModal';
import { DeliveryDetailModal } from './DeliveryDetailModal';

export type ProjectControlTab =
  | 'overview'
  | 'workforce'
  | 'materials'
  | 'procurement'
  | 'financials'
  | 'activity';

export type MaterialsSubTab =
  | 'requirements'
  | 'requests'
  | 'deliveries'
  | 'usage'
  | 'losses_returns'
  | 'reconciliation';

interface ProjectControlCentreProps {
  projectId: string;
  onBackToProjects: () => void;
}

export const ProjectControlCentre: React.FC<ProjectControlCentreProps> = ({
  projectId,
  onBackToProjects,
}) => {
  // Core Project State
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState<boolean>(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<ProjectControlTab>('overview');
  const [activeMaterialsSubTab, setActiveMaterialsSubTab] =
    useState<MaterialsSubTab>('requirements');

  // Overview Metrics
  const [metrics, setMetrics] = useState<ProjectMetricsData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Workforce Tab State
  const [workforceList, setWorkforceList] = useState<ProjectWorkforceItem[]>([]);
  const [loadingWorkforce, setLoadingWorkforce] = useState<boolean>(false);
  const [workforceError, setWorkforceError] = useState<string | null>(null);
  const [selectedWorkerAssignment, setSelectedWorkerAssignment] =
    useState<ProjectWorkforceItem | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);

  // Materials Tab State
  const [materialsData, setMaterialsData] = useState<{
    requirements: ProjectMaterialRequirementItem[];
    requests: ProjectMaterialRequestItem[];
    deliveries: ProjectMaterialDeliveryItem[];
    usage: ProjectMaterialUsageItem[];
    returns: ProjectMaterialReturnItem[];
    losses: ProjectMaterialLossItem[];
    reconciliations: ProjectMaterialReconciliationItem[];
  }>({
    requirements: [],
    requests: [],
    deliveries: [],
    usage: [],
    returns: [],
    losses: [],
    reconciliations: [],
  });
  const [loadingMaterials, setLoadingMaterials] = useState<boolean>(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] =
    useState<ProjectMaterialDeliveryItem | null>(null);

  // Procurement Tab State
  const [purchaseOrders, setPurchaseOrders] = useState<ProjectPurchaseOrderItem[]>([]);
  const [loadingProcurement, setLoadingProcurement] = useState<boolean>(false);
  const [procurementError, setProcurementError] = useState<string | null>(null);
  const [selectedPO, setSelectedPO] = useState<ProjectPurchaseOrderItem | null>(null);

  // Financial Control State
  const [financials, setFinancials] = useState<{
    contractValue: number | null;
    procurementCommitted: number;
    requirementsEstimate: number;
    usageExpenditure: number;
    hasAnyFinancialRecord: boolean;
  } | null>(null);
  const [loadingFinancials, setLoadingFinancials] = useState<boolean>(false);
  const [financialsError, setFinancialsError] = useState<string | null>(null);

  // Activity Tab State
  const [activities, setActivities] = useState<ProjectActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Primary Project
  const fetchProject = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoadingProject(true);
      setProjectError(null);

      const res = await ProjectService.getProjectById(projectId);
      if (res.error) {
        setProjectError(res.error);
      } else {
        setProject(res.data);
      }

      setIsLoadingProject(false);
      setIsRefreshing(false);
    },
    [projectId]
  );

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // 2. Load Section Specific Data on Tab Select or Project Load
  const fetchMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    setMetricsError(null);
    const res = await ProjectControlService.getProjectMetrics(projectId);
    if (res.error) setMetricsError(res.error);
    else setMetrics(res.data);
    setLoadingMetrics(false);
  }, [projectId]);

  const fetchWorkforce = useCallback(async () => {
    setLoadingWorkforce(true);
    setWorkforceError(null);
    const res = await ProjectControlService.getProjectWorkforce(projectId);
    if (res.error) setWorkforceError(res.error);
    else setWorkforceList(res.data);
    setLoadingWorkforce(false);
  }, [projectId]);

  const fetchMaterials = useCallback(async () => {
    setLoadingMaterials(true);
    setMaterialsError(null);
    const res = await ProjectControlService.getProjectMaterialsData(projectId);
    if (res.error) {
      setMaterialsError(res.error);
    } else {
      setMaterialsData(res);
    }
    setLoadingMaterials(false);
  }, [projectId]);

  const fetchProcurement = useCallback(async () => {
    setLoadingProcurement(true);
    setProcurementError(null);
    const res = await ProjectControlService.getProjectProcurementData(projectId);
    if (res.error) setProcurementError(res.error);
    else setPurchaseOrders(res.data);
    setLoadingProcurement(false);
  }, [projectId]);

  const fetchFinancials = useCallback(async () => {
    if (!project) return;
    setLoadingFinancials(true);
    setFinancialsError(null);
    const res = await ProjectControlService.getProjectFinancials(
      projectId,
      project.contract_value
    );
    if (res.error) setFinancialsError(res.error);
    else setFinancials(res.data);
    setLoadingFinancials(false);
  }, [projectId, project]);

  const fetchActivity = useCallback(async () => {
    if (!project) return;
    setLoadingActivity(true);
    setActivityError(null);
    const res = await ProjectControlService.getProjectActivities(project);
    if (res.error) setActivityError(res.error);
    else setActivities(res.data);
    setLoadingActivity(false);
  }, [project]);

  // Tab Activation Logic
  useEffect(() => {
    if (!project) return;
    if (activeTab === 'overview') {
      fetchMetrics();
    } else if (activeTab === 'workforce') {
      fetchWorkforce();
    } else if (activeTab === 'materials') {
      fetchMaterials();
    } else if (activeTab === 'procurement') {
      fetchProcurement();
    } else if (activeTab === 'financials') {
      fetchFinancials();
    } else if (activeTab === 'activity') {
      fetchActivity();
    }
  }, [
    activeTab,
    project,
    fetchMetrics,
    fetchWorkforce,
    fetchMaterials,
    fetchProcurement,
    fetchFinancials,
    fetchActivity,
  ]);

  // Comprehensive Refresh
  const handleFullRefresh = () => {
    fetchProject(true);
    if (activeTab === 'overview') fetchMetrics();
    if (activeTab === 'workforce') fetchWorkforce();
    if (activeTab === 'materials') fetchMaterials();
    if (activeTab === 'procurement') fetchProcurement();
    if (activeTab === 'financials') fetchFinancials();
    if (activeTab === 'activity') fetchActivity();
  };

  // Loading Skeleton State for Project Header
  if (isLoadingProject) {
    return (
      <div className="space-y-6 pb-12 max-w-7xl mx-auto">
        <div className="h-28 bg-white rounded-xl border border-slate-200/80 p-6 animate-pulse" />
        <div className="h-44 bg-white rounded-xl border border-slate-200/80 p-6 animate-pulse" />
        <div className="h-96 bg-white rounded-xl border border-slate-200/80 p-6 animate-pulse" />
      </div>
    );
  }

  // Error State or Not Found
  if (projectError || !project) {
    return (
      <div className="space-y-6 pb-12 max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/80">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {projectError ? 'Unable to load project' : 'Project not found'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            {projectError
              ? `A database error occurred: ${projectError}`
              : 'The requested project does not exist in the database or may have been deleted.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBackToProjects}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Projects</span>
            </button>
            {projectError && (
              <button
                type="button"
                onClick={() => fetchProject(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Derived Project Attributes
  const statusCfg = PROJECT_STATUS_CONFIG[project.status as ProjectStatus] || {
    label: project.status,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const clientName = project.clients?.name || 'No client information available.';
  const locationFormatted =
    [project.city, project.state, project.country].filter(Boolean).join(', ') || 'Not provided';

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#01875F]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 1. TOP NAVIGATION / BREADCRUMB                                                 */}
      {/* ============================================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBackToProjects}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span
              onClick={onBackToProjects}
              className="hover:text-slate-700 cursor-pointer"
            >
              Projects
            </span>
            <span>/</span>
            <span className="font-bold text-slate-800 truncate max-w-xs">{project.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            type="button"
            onClick={handleFullRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            title="Refresh database records"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Project</span>
          </button>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 2. PROJECT HEADER                                                              */}
      {/* ============================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-lg shrink-0 border border-[#01875F]/20">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {project.project_code}
                </span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.badgeClass}`}
                >
                  {statusCfg.label}
                </span>
                {project.project_type && (
                  <span className="text-xs text-slate-500 font-medium">
                    &bull; {project.project_type}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1.5">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 shrink-0 self-start lg:min-w-[220px]">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              CONTRACT VALUE
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tracking-tight text-[#01875F]">
              {project.contract_value != null ? formatNaira(project.contract_value) : 'Not provided'}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Currency: {project.currency || 'NGN'}
            </span>
          </div>
        </div>

        {/* Essential Meta Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
              CLIENT
            </span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block truncate">
              {clientName}
            </span>
          </div>

          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
              LOCATION
            </span>
            <span className="font-semibold text-slate-700 mt-0.5 block truncate">
              {locationFormatted}
            </span>
          </div>

          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
              START DATE
            </span>
            <span className="font-mono text-slate-700 mt-0.5 block">
              {project.start_date ? formatDateNigerian(project.start_date) : 'Not provided'}
            </span>
          </div>

          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
              EXPECTED COMPLETION
            </span>
            <span className="font-mono text-slate-700 mt-0.5 block">
              {project.expected_completion_date
                ? formatDateNigerian(project.expected_completion_date)
                : 'Not provided'}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 3. PROJECT NAVIGATION (TABS)                                                   */}
      {/* ============================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="flex border-b border-slate-200 px-3 sm:px-6 bg-slate-50/50 overflow-x-auto custom-scrollbar">
          {[
            { key: 'overview', label: 'Overview', icon: Building2 },
            { key: 'workforce', label: 'Workforce', icon: Users },
            { key: 'materials', label: 'Materials', icon: Package },
            { key: 'procurement', label: 'Procurement', icon: ShoppingBag },
            { key: 'financials', label: 'Financial Control', icon: CircleDollarSign },
            { key: 'activity', label: 'Activity', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as ProjectControlTab)}
                className={`flex items-center gap-2 py-3.5 px-3.5 sm:px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#01875F] text-[#01875F] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#01875F]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ============================================================================== */}
        {/* TAB 1: OVERVIEW                                                                */}
        {/* ============================================================================== */}
        {activeTab === 'overview' && (
          <div className="p-5 sm:p-8 space-y-8">
            {/* Real Project Metrics Row */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                PROJECT RECORD COUNTS
              </h3>
              {loadingMetrics ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 animate-pulse">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="h-20 bg-slate-50 rounded-xl border border-slate-100" />
                  ))}
                </div>
              ) : metricsError ? (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg flex items-center justify-between">
                  <span>Unable to load metrics: {metricsError}</span>
                  <button
                    type="button"
                    onClick={fetchMetrics}
                    className="text-xs font-bold underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                      Workforce
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {metrics?.assignedWorkforce ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Assigned</span>
                  </div>

                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                      Material Reqs
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {metrics?.materialRequests ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Requisitions</span>
                  </div>

                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                      Orders (PO)
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {metrics?.purchaseOrders ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Procurement</span>
                  </div>

                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                      Deliveries
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {metrics?.materialDeliveries ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Recorded</span>
                  </div>

                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                      Attendance
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {metrics?.attendanceRecords ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Logs</span>
                  </div>

                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                      Productivity
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {metrics?.productivityRecords ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Entries</span>
                  </div>

                  <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl">
                    <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                      Overtime
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {metrics?.overtimeRequests ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400">Requests</span>
                  </div>
                </div>
              )}
            </div>

            {/* Information Grid: Project Info & Client Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Project Information */}
              <div className="p-5 sm:p-6 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#01875F]" />
                  <span>Project Information</span>
                </h4>

                <div className="divide-y divide-slate-200/70 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Project Code:</span>
                    <span className="font-mono font-bold text-slate-800">{project.project_code}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Project Name:</span>
                    <span className="font-bold text-slate-900">{project.name}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Project Type:</span>
                    <span className="text-slate-800">{project.project_type || 'Not specified'}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.badgeClass}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Site Address:</span>
                    <span className="text-slate-800 text-right">{project.address || 'Not provided'}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">City &amp; State:</span>
                    <span className="text-slate-800">
                      {[project.city, project.state].filter(Boolean).join(', ') || 'Not provided'}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-500">Country:</span>
                    <span className="text-slate-800">{project.country || 'Nigeria'}</span>
                  </div>
                </div>
              </div>

              {/* Client Information */}
              <div className="p-5 sm:p-6 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#01875F]" />
                  <span>Client Information</span>
                </h4>

                {!project.clients ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No client information available.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200/70 text-xs">
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Client / Organization:</span>
                      <span className="font-bold text-slate-900">{project.clients.name}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Contact Person:</span>
                      <span className="text-slate-800">{project.clients.contact_person || '—'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Email Address:</span>
                      <span className="font-mono text-slate-800">{project.clients.email || '—'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Phone Number:</span>
                      <span className="font-mono text-slate-800">{project.clients.phone || '—'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">Office Address:</span>
                      <span className="text-slate-800 text-right">{project.clients.address || '—'}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="text-slate-500">City / State:</span>
                      <span className="text-slate-800">
                        {[project.clients.city, project.clients.state].filter(Boolean).join(', ') || '—'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Project Timeline & Milestone Section */}
            <div className="p-5 sm:p-6 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#01875F]" />
                <span>Project Timeline &amp; Dates</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase block">Start Date</span>
                  <span className="font-mono font-bold text-slate-800 text-sm mt-1 block">
                    {project.start_date ? formatDateNigerian(project.start_date) : 'Not provided'}
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                    Expected Completion
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-sm mt-1 block">
                    {project.expected_completion_date
                      ? formatDateNigerian(project.expected_completion_date)
                      : 'Not provided'}
                  </span>
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase block">
                    Actual Completion
                  </span>
                  <span className="font-mono font-bold text-slate-800 text-sm mt-1 block">
                    {project.actual_completion_date
                      ? formatDateNigerian(project.actual_completion_date)
                      : 'Not completed'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 2: WORKFORCE                                                               */}
        {/* ============================================================================== */}
        {activeTab === 'workforce' && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Assigned Workforce</h3>
                <p className="text-xs text-slate-500">
                  Active artisans and workers assigned to this project via project_workforce_assignments.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchWorkforce}
                  disabled={loadingWorkforce}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingWorkforce ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ Assign Workforce</span>
                </button>
              </div>
            </div>

            {loadingWorkforce ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
                ))}
              </div>
            ) : workforceError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-xs font-semibold text-red-700">Unable to load this section.</p>
                <p className="text-xs font-mono text-red-600 mt-1">{workforceError}</p>
                <button
                  type="button"
                  onClick={fetchWorkforce}
                  className="mt-3 px-3 py-1 bg-white border border-red-300 text-xs font-semibold text-red-700 rounded cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : workforceList.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">
                  No workforce assigned to this project yet.
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Assign site supervisors, lead artisans, or tradespeople to this site.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-bold rounded-lg shadow-sm hover:bg-[#016f4e] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Assign Workforce</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Worker</th>
                      <th className="py-3 px-3">Workforce Code</th>
                      <th className="py-3 px-3">Trade</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Assigned Dates</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workforceList.map((item) => {
                      const wf = item.workforce_members;
                      const prof = wf?.profiles;
                      const name =
                        prof?.display_name ||
                        (prof?.first_name || prof?.last_name
                          ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
                          : `Worker ${wf?.workforce_code || ''}`);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                          onClick={() => setSelectedWorkerAssignment(item)}
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 group-hover:text-[#01875F]">
                            {name}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
                              {wf?.workforce_code || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700">{wf?.trade || '—'}</td>
                          <td className="py-3 px-3 text-slate-600">{wf?.workforce_type || 'Artisan'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                              {wf?.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {item.start_date ? formatDateNigerian(item.start_date) : '—'}
                            {item.end_date ? ` to ${formatDateNigerian(item.end_date)}` : ''}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedWorkerAssignment(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-slate-500" />
                              <span>Details</span>
                            </button>
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

        {/* ============================================================================== */}
        {/* TAB 3: MATERIALS                                                               */}
        {/* ============================================================================== */}
        {activeTab === 'materials' && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Materials Management
                </h3>
                <p className="text-xs text-slate-500">
                  Project bill of requirements, requisitions, site deliveries, usage, and stock reconciliation.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchMaterials}
                disabled={loadingMaterials}
                className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingMaterials ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Materials Sub-Tab Navigation */}
            <div className="flex border-b border-slate-200 gap-2 overflow-x-auto custom-scrollbar text-xs">
              {[
                { key: 'requirements', label: 'Requirements', count: materialsData.requirements.length },
                { key: 'requests', label: 'Requests', count: materialsData.requests.length },
                { key: 'deliveries', label: 'Deliveries', count: materialsData.deliveries.length },
                { key: 'usage', label: 'Usage', count: materialsData.usage.length },
                {
                  key: 'losses_returns',
                  label: 'Losses & Returns',
                  count: materialsData.returns.length + materialsData.losses.length,
                },
                { key: 'reconciliation', label: 'Reconciliation', count: materialsData.reconciliations.length },
              ].map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setActiveMaterialsSubTab(sub.key as MaterialsSubTab)}
                  className={`py-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    activeMaterialsSubTab === sub.key
                      ? 'border-[#01875F] text-[#01875F]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {sub.label} ({sub.count})
                </button>
              ))}
            </div>

            {loadingMaterials ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
                ))}
              </div>
            ) : materialsError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-xs font-semibold text-red-700">Unable to load this section.</p>
                <p className="text-xs font-mono text-red-600 mt-1">{materialsError}</p>
                <button
                  type="button"
                  onClick={fetchMaterials}
                  className="mt-3 px-3 py-1 bg-white border border-red-300 text-xs font-semibold text-red-700 rounded cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : activeMaterialsSubTab === 'requirements' ? (
              /* Sub-Tab 1: Material Requirements */
              materialsData.requirements.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  No material requirements specified for this project yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Material</th>
                        <th className="py-3 px-3 text-right">Required Qty</th>
                        <th className="py-3 px-3 text-right">Approved Qty</th>
                        <th className="py-3 px-3 text-right">Estimated Unit Cost</th>
                        <th className="py-3 px-3 text-right">Estimated Total Cost</th>
                        <th className="py-3 px-4">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materialsData.requirements.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {req.materials?.name || 'Material Item'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                            {req.required_quantity}{' '}
                            {req.materials?.unit_of_measure ? req.materials.unit_of_measure : ''}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {req.approved_quantity != null ? req.approved_quantity : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {req.estimated_unit_cost != null ? formatNaira(req.estimated_unit_cost) : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {req.estimated_total_cost != null ? formatNaira(req.estimated_total_cost) : '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">{req.purpose || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeMaterialsSubTab === 'requests' ? (
              /* Sub-Tab 2: Material Requests */
              materialsData.requests.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  No material requests for this project yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Request Code</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Priority</th>
                        <th className="py-3 px-3">Requested Date</th>
                        <th className="py-3 px-3">Items</th>
                        <th className="py-3 px-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materialsData.requests.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {r.request_code || 'REQ'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600 capitalize">{r.priority || 'Normal'}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {r.requested_date ? formatDateNigerian(r.requested_date) : formatDateNigerian(r.created_at)}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {r.material_request_items?.length || 0} line item(s)
                          </td>
                          <td className="py-3 px-4 text-slate-500">{r.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeMaterialsSubTab === 'deliveries' ? (
              /* Sub-Tab 3: Deliveries */
              materialsData.deliveries.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  No deliveries recorded for this project yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Delivery Code</th>
                        <th className="py-3 px-3">Delivery Date</th>
                        <th className="py-3 px-3">Destination</th>
                        <th className="py-3 px-3">Delivered By</th>
                        <th className="py-3 px-3">Received By</th>
                        <th className="py-3 px-3">Ref</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materialsData.deliveries.map((del) => (
                        <tr
                          key={del.id}
                          className="hover:bg-slate-50/50 cursor-pointer"
                          onClick={() => setSelectedDelivery(del)}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {del.delivery_code || 'DEL'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700">
                            {del.delivery_date ? formatDateNigerian(del.delivery_date) : formatDateNigerian(del.created_at)}
                          </td>
                          <td className="py-3 px-3 text-slate-700">{del.destination || 'Site'}</td>
                          <td className="py-3 px-3 text-slate-600">{del.delivered_by || '—'}</td>
                          <td className="py-3 px-3 text-slate-600">{del.received_by || '—'}</td>
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {del.acknowledgement_reference || '—'}
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedDelivery(del)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeMaterialsSubTab === 'usage' ? (
              /* Sub-Tab 4: Usage */
              materialsData.usage.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  No material usage recorded for this project yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Material</th>
                        <th className="py-3 px-3 text-right">Quantity Used</th>
                        <th className="py-3 px-3 text-right">Unit Cost</th>
                        <th className="py-3 px-3">Usage Date</th>
                        <th className="py-3 px-3">Work Area</th>
                        <th className="py-3 px-4">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materialsData.usage.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {u.materials?.name || 'Material Item'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                            {u.quantity_used} {u.materials?.unit_of_measure ? u.materials.unit_of_measure : ''}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {u.unit_cost != null ? formatNaira(u.unit_cost) : '—'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600">
                            {u.usage_date ? formatDateNigerian(u.usage_date) : formatDateNigerian(u.created_at)}
                          </td>
                          <td className="py-3 px-3 text-slate-700">{u.work_area || '—'}</td>
                          <td className="py-3 px-4 text-slate-600">{u.purpose || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activeMaterialsSubTab === 'losses_returns' ? (
              /* Sub-Tab 5: Losses & Returns */
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                    Material Returns ({materialsData.returns.length})
                  </h4>
                  {materialsData.returns.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                      No material returns recorded for this project.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                          <tr>
                            <th className="py-2.5 px-3">Material</th>
                            <th className="py-2.5 px-3 text-right">Quantity Returned</th>
                            <th className="py-2.5 px-3">Condition</th>
                            <th className="py-2.5 px-3">Destination</th>
                            <th className="py-2.5 px-3">Received By</th>
                            <th className="py-2.5 px-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {materialsData.returns.map((ret) => (
                            <tr key={ret.id}>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {ret.materials?.name || 'Material Item'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                {ret.quantity_returned ?? '—'}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{ret.condition || '—'}</td>
                              <td className="py-2 px-3 text-slate-700">{ret.destination || 'Warehouse'}</td>
                              <td className="py-2 px-3 text-slate-600">{ret.received_by || '—'}</td>
                              <td className="py-2 px-3 font-mono text-slate-500">
                                {formatDateNigerian(ret.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                    Material Losses &amp; Wastage ({materialsData.losses.length})
                  </h4>
                  {materialsData.losses.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                      No material losses recorded for this project.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                          <tr>
                            <th className="py-2.5 px-3">Material</th>
                            <th className="py-2.5 px-3 text-right">Quantity Lost</th>
                            <th className="py-2.5 px-3">Reason</th>
                            <th className="py-2.5 px-3">Approved By</th>
                            <th className="py-2.5 px-3">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {materialsData.losses.map((loss) => (
                            <tr key={loss.id}>
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {loss.materials?.name || 'Material Item'}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-red-600">
                                {loss.quantity ?? '—'}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{loss.reason || '—'}</td>
                              <td className="py-2 px-3 text-slate-600">{loss.approved_by || '—'}</td>
                              <td className="py-2 px-3 font-mono text-slate-500">
                                {formatDateNigerian(loss.created_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Sub-Tab 6: Reconciliation */
              materialsData.reconciliations.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                  No material reconciliation records for this project yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Material</th>
                        <th className="py-3 px-2 text-right">Opening</th>
                        <th className="py-3 px-2 text-right">Delivered</th>
                        <th className="py-3 px-2 text-right">Consumed</th>
                        <th className="py-3 px-2 text-right">Closing</th>
                        <th className="py-3 px-2 text-right">Expected</th>
                        <th className="py-3 px-3 text-right">Variance</th>
                        <th className="py-3 px-3">Reconciled By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materialsData.reconciliations.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {rec.reconciliation_date
                              ? formatDateNigerian(rec.reconciliation_date)
                              : formatDateNigerian(rec.created_at)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {rec.materials?.name || 'Material Item'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {rec.opening_quantity ?? '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {rec.returned_quantity ?? '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {rec.consumed_quantity ?? '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-800 font-semibold">
                            {rec.closing_quantity ?? '—'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {rec.expected_closing_quantity ?? '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {rec.variance_quantity != null ? (
                              <span
                                className={
                                  Number(rec.variance_quantity) === 0
                                    ? 'text-emerald-700'
                                    : 'text-amber-600 font-extrabold'
                                }
                              >
                                {rec.variance_quantity > 0
                                  ? `+${rec.variance_quantity}`
                                  : rec.variance_quantity}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{rec.reconciled_by || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 4: PROCUREMENT                                                             */}
        {/* ============================================================================== */}
        {activeTab === 'procurement' && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Project Procurement
                </h3>
                <p className="text-xs text-slate-500">
                  Supplier purchase orders and procurement commits for this project from purchase_orders.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchProcurement}
                disabled={loadingProcurement}
                className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingProcurement ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingProcurement ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
                ))}
              </div>
            ) : procurementError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-xs font-semibold text-red-700">Unable to load this section.</p>
                <p className="text-xs font-mono text-red-600 mt-1">{procurementError}</p>
                <button
                  type="button"
                  onClick={fetchProcurement}
                  className="mt-3 px-3 py-1 bg-white border border-red-300 text-xs font-semibold text-red-700 rounded cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                No purchase orders for this project yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Purchase Order</th>
                      <th className="py-3 px-3">Supplier</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Purchase Date</th>
                      <th className="py-3 px-3 text-right">Subtotal</th>
                      <th className="py-3 px-3 text-right">Delivery Cost</th>
                      <th className="py-3 px-3 text-right">Total Cost</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseOrders.map((po) => (
                      <tr
                        key={po.id}
                        className="hover:bg-slate-50/50 cursor-pointer"
                        onClick={() => setSelectedPO(po)}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          PO-{po.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {po.suppliers?.name || 'Unassigned'}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                            {po.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          {po.purchase_date
                            ? formatDateNigerian(po.purchase_date)
                            : formatDateNigerian(po.created_at)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          {po.subtotal != null ? formatNaira(po.subtotal) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          {po.delivery_cost != null ? formatNaira(po.delivery_cost) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#01875F]">
                          {po.total_cost != null ? formatNaira(po.total_cost) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedPO(po)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 5: FINANCIAL CONTROL                                                       */}
        {/* ============================================================================== */}
        {activeTab === 'financials' && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Financial Control &amp; Commitments
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated exclusively from verified database records: contract value, purchase orders, and requirements.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchFinancials}
                disabled={loadingFinancials}
                className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFinancials ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingFinancials ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 bg-slate-50 rounded-xl border border-slate-100" />
                ))}
              </div>
            ) : financialsError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-xs font-semibold text-red-700">Unable to load this section.</p>
                <p className="text-xs font-mono text-red-600 mt-1">{financialsError}</p>
                <button
                  type="button"
                  onClick={fetchFinancials}
                  className="mt-3 px-3 py-1 bg-white border border-red-300 text-xs font-semibold text-red-700 rounded cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : !financials?.hasAnyFinancialRecord ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                No financial activity recorded for this project yet.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Contract Value */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                      CONTRACT VALUE
                    </span>
                    <div className="text-xl font-bold font-mono text-[#01875F] mt-1.5">
                      {financials.contractValue != null ? formatNaira(financials.contractValue) : 'Not provided'}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Agreed contract sum (NGN)
                    </span>
                  </div>

                  {/* Card 2: Procurement Committed */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                      PROCUREMENT COMMITTED
                    </span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
                      {formatNaira(financials.procurementCommitted)}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Total from purchase orders
                    </span>
                  </div>

                  {/* Card 3: Material Requirements Estimate */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                      REQUIREMENTS ESTIMATE
                    </span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
                      {formatNaira(financials.requirementsEstimate)}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      From material requirements BOQ
                    </span>
                  </div>

                  {/* Card 4: Material Usage Recorded */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-2xs">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                      MATERIAL USAGE RECORDED
                    </span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1.5">
                      {formatNaira(financials.usageExpenditure)}
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Quantity used &times; unit cost
                    </span>
                  </div>
                </div>

                {/* Clarification Notice */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
                  <strong>Accounting Clarification:</strong> In compliance with Davejoe data standards, Procurement Committed represents logged purchase orders, and does not substitute for actual certified expenditures until verified and closed.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================================== */}
        {/* TAB 6: ACTIVITY                                                                */}
        {/* ============================================================================== */}
        {activeTab === 'activity' && (
          <div className="p-5 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Project Activity Feed</h3>
                <p className="text-xs text-slate-500">
                  Chronological unified log of all verified events related to this project in Supabase.
                </p>
              </div>

              <button
                type="button"
                onClick={fetchActivity}
                disabled={loadingActivity}
                className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingActivity ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingActivity ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-lg border border-slate-100" />
                ))}
              </div>
            ) : activityError ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                <p className="text-xs font-semibold text-red-700">Unable to load this section.</p>
                <p className="text-xs font-mono text-red-600 mt-1">{activityError}</p>
                <button
                  type="button"
                  onClick={fetchActivity}
                  className="mt-3 px-3 py-1 bg-white border border-red-300 text-xs font-semibold text-red-700 rounded cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : activities.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                No project activity yet.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex items-start gap-3 text-xs">
                    <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-[#01875F] ring-4 ring-white" />
                    <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 w-full">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <span className="font-bold text-slate-900">{act.title}</span>
                        <span className="font-mono text-[11px] text-slate-400">{act.date}</span>
                      </div>
                      <p className="text-slate-500 text-[11.5px]">{act.subtitle}</p>
                      {act.reference && (
                        <span className="inline-block mt-2 font-mono text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                          Ref: {act.reference}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================================== */}
      {/* MODALS                                                                         */}
      {/* ============================================================================== */}
      {/* 1. Edit Project Modal */}
      <EditProjectModal
        project={project}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onProjectUpdated={(updatedProject) => {
          setProject(updatedProject);
          showToast(`Project "${updatedProject.project_code}" updated successfully.`);
          handleFullRefresh();
        }}
      />

      {/* 2. Assign Workforce Modal */}
      <AssignWorkforceModal
        projectId={projectId}
        projectName={project.name}
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onAssigned={() => {
          showToast('Workforce member assigned to project.');
          fetchWorkforce();
          fetchMetrics();
        }}
      />

      {/* 3. Worker Detail Modal */}
      <WorkerDetailModal
        projectId={projectId}
        assignment={selectedWorkerAssignment}
        isOpen={Boolean(selectedWorkerAssignment)}
        onClose={() => setSelectedWorkerAssignment(null)}
      />

      {/* 4. Purchase Order Detail Modal */}
      <PurchaseOrderDetailModal
        order={selectedPO}
        isOpen={Boolean(selectedPO)}
        onClose={() => setSelectedPO(null)}
      />

      {/* 5. Delivery Detail Modal */}
      <DeliveryDetailModal
        delivery={selectedDelivery}
        isOpen={Boolean(selectedDelivery)}
        onClose={() => setSelectedDelivery(null)}
      />
    </div>
  );
};

export default ProjectControlCentre;
