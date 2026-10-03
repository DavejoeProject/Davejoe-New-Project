import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Building,
  Calendar,
  X,
  Boxes,
} from 'lucide-react';
import {
  MaterialRequestsService,
  MaterialRequestRecord,
  MaterialRequestSummary,
  ProjectDropdownOption,
  ALL_REQUEST_STATUSES,
  ALL_REQUEST_PRIORITIES,
  REQUEST_STATUS_CONFIG,
  REQUEST_PRIORITY_CONFIG,
} from '../../services/materialRequestsService';
import {
  formatNaira,
  formatNigerianDate,
} from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { NewMaterialRequestModal } from './NewMaterialRequestModal';
import { ApproveMaterialRequestModal } from './ApproveMaterialRequestModal';
import { RejectMaterialRequestModal } from './RejectMaterialRequestModal';

interface MaterialRequestsModuleProps {
  onBackToDashboard?: () => void;
}

export const MaterialRequestsModule: React.FC<MaterialRequestsModuleProps> = () => {
  const navigate = useNavigate();

  // Data states
  const [requests, setRequests] = useState<MaterialRequestRecord[]>([]);
  const [summary, setSummary] = useState<MaterialRequestSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [totalUnfilteredCount, setTotalUnfilteredCount] = useState<number>(0);

  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [selectedApproveRequest, setSelectedApproveRequest] =
    useState<MaterialRequestRecord | null>(null);
  const [selectedRejectRequest, setSelectedRejectRequest] =
    useState<MaterialRequestRecord | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load dropdown projects once
  useEffect(() => {
    MaterialRequestsService.getProjectsForDropdown().then((res) => {
      setProjects(res.data);
    });
  }, []);

  // Fetch data
  const fetchData = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const [sumRes, listRes] = await Promise.all([
          MaterialRequestsService.getMaterialRequestSummary(),
          MaterialRequestsService.getMaterialRequests({
            search: debouncedSearch,
            status: statusFilter,
            priority: priorityFilter,
            projectId: projectFilter,
          }),
        ]);

        if (sumRes.error) {
          console.error('[MaterialRequests] Summary error:', sumRes.error);
        } else {
          setSummary(sumRes.data);
        }

        if (listRes.error) {
          setErrorMessage(listRes.error);
        } else {
          setRequests(listRes.data);
          setTotalUnfilteredCount(listRes.totalUnfilteredCount);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load material requests from database.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter, priorityFilter, projectFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setProjectFilter('all');
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    projectFilter !== 'all';

  const handleRequestCreated = (newReq: MaterialRequestRecord) => {
    fetchData(true);
    navigate(`/management/materials/requests/${newReq.id}`);
  };

  const handleApproved = (updated: MaterialRequestRecord) => {
    fetchData(true);
  };

  const handleRejected = (updated: MaterialRequestRecord) => {
    fetchData(true);
  };

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                MATERIALS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <FileText className="w-7 h-7 text-[#01875F]" />
              <span>Material Requests</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Review, approve and monitor material requisitions across the organization.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Material Request</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="requests" />

      {/* 3. Executive Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL REQUESTS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalRequests ?? totalUnfilteredCount)}
          </span>
          <span className="text-[11px] text-slate-500">All requisitions logged</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            PENDING REVIEW
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.pendingReview ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !summary ? '...' : (summary?.pendingReview ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Awaiting management action</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            APPROVED
          </span>
          <span className="text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.approved ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Authorized for procurement</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            FULFILLED
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.fulfilled ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Completely received on site</span>
        </div>
      </div>

      {/* 4. Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requests by code, project, or requester..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            />
          </div>

          {/* Project filter */}
          <div className="sm:col-span-3">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Statuses</option>
              {ALL_REQUEST_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {REQUEST_STATUS_CONFIG[st].label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority filter */}
          <div className="sm:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Priorities</option>
              {ALL_REQUEST_PRIORITIES.map((pr) => (
                <option key={pr} value={pr}>
                  {REQUEST_PRIORITY_CONFIG[pr].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {requests.length} matching request{requests.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-[#01875F] font-semibold hover:underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Main Content: Table / Loading / Error / Empty States */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load material requests.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {hasActiveFilters ? 'No material requests match your current filters.' : 'No material requests yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try adjusting your search query, status, priority, or project filters.'
              : 'Material requests created in the system will appear here.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ New Material Request</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Request</th>
                  <th className="py-3.5 px-3">Project</th>
                  <th className="py-3.5 px-3">Requested By</th>
                  <th className="py-3.5 px-3">Requested Date</th>
                  <th className="py-3.5 px-3">Required By</th>
                  <th className="py-3.5 px-3 text-center">Priority</th>
                  <th className="py-3.5 px-3 text-right">Est. Value</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const statusCfg = REQUEST_STATUS_CONFIG[req.status] || {
                    label: req.status,
                    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
                    dotClasses: 'bg-slate-400',
                  };

                  const priorityCfg = REQUEST_PRIORITY_CONFIG[req.priority] || {
                    label: req.priority,
                    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
                  };

                  const reqName = req.requester
                    ? `${req.requester.first_name || ''} ${req.requester.last_name || ''}`.trim() ||
                      req.requester.display_name ||
                      'Executive User'
                    : 'System';

                  const isPending = ['submitted', 'under_review', 'draft'].includes(req.status);

                  return (
                    <tr
                      key={req.id}
                      onClick={() => navigate(`/management/materials/requests/${req.id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Request code */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-[#01875F] transition-colors">
                          {req.request_code}
                        </div>
                        {req.itemCount !== undefined && (
                          <div className="text-[10.5px] text-slate-400">
                            {req.itemCount} line item{req.itemCount === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>

                      {/* Project */}
                      <td
                        className="py-3.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {req.projects ? (
                          <Link
                            to={`/management/projects/${req.project_id}`}
                            className="font-medium text-slate-800 hover:text-[#01875F] hover:underline"
                          >
                            <span className="font-mono text-[11px] text-slate-500 mr-1">
                              {req.projects.project_code}
                            </span>
                            <span>{req.projects.name}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">Not linked</span>
                        )}
                      </td>

                      {/* Requested By */}
                      <td className="py-3.5 px-3 text-slate-700 font-medium">
                        {reqName}
                      </td>

                      {/* Requested Date */}
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatNigerianDate(req.requested_date || req.created_at)}
                      </td>

                      {/* Required By */}
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap font-medium">
                        {formatNigerianDate(req.required_by_date)}
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold border ${priorityCfg.badgeClasses}`}
                        >
                          {priorityCfg.label}
                        </span>
                      </td>

                      {/* Estimated Value */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatNaira(req.totalEstimatedValue)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${statusCfg.badgeClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClasses}`} />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedApproveRequest(req)}
                                className="p-1.5 text-[#01875F] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Approve Request"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRejectRequest(req)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Reject Request"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/management/materials/requests/${req.id}`)}
                            className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Requisition Control Centre"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Showing {requests.length} of {totalUnfilteredCount} total requisition{totalUnfilteredCount === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Live Database Connected
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      <NewMaterialRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onRequestCreated={handleRequestCreated}
      />

      <ApproveMaterialRequestModal
        request={selectedApproveRequest}
        isOpen={Boolean(selectedApproveRequest)}
        onClose={() => setSelectedApproveRequest(null)}
        onApproved={handleApproved}
      />

      <RejectMaterialRequestModal
        request={selectedRejectRequest}
        isOpen={Boolean(selectedRejectRequest)}
        onClose={() => setSelectedRejectRequest(null)}
        onRejected={handleRejected}
      />
    </div>
  );
};

export default MaterialRequestsModule;
