import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Check,
  X,
} from 'lucide-react';
import {
  WorkforcePerformanceService,
  OvertimeItem,
  FilterOptions,
  OVERTIME_STATUS_CONFIG,
  OvertimeStatus,
} from '../../services/workforcePerformanceService';
import { formatDateNigerian } from '../../services/dashboardService';
import { WorkforceNavTabs } from './WorkforceNavTabs';

interface OvertimeModuleProps {
  onBackToDashboard?: () => void;
}

export const OvertimeModule: React.FC<OvertimeModuleProps> = ({ onBackToDashboard }) => {
  const navigate = useNavigate();

  const [records, setRecords] = useState<OvertimeItem[]>([]);
  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalRequestedHours: 0,
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    projects: [],
    workers: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [projectFilter, setProjectFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [actionItem, setActionItem] = useState<{ item: OvertimeItem; action: 'approve' | 'reject' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Load filter options
  useEffect(() => {
    async function loadOptions() {
      const res = await WorkforcePerformanceService.getFilterOptions();
      if (res.data) {
        setFilterOptions(res.data);
      }
    }
    loadOptions();
  }, []);

  // Fetch Overtime Requests
  const fetchOvertime = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const res = await WorkforcePerformanceService.getOvertimeData({
        projectId: projectFilter,
        workforceId: workerFilter,
        status: statusFilter,
        search: searchQuery,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setRecords(res.records);
        setMetrics(res.metrics);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [projectFilter, workerFilter, statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchOvertime();
  }, [fetchOvertime]);

  const handleClearFilters = () => {
    setProjectFilter('all');
    setWorkerFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  const handleConfirmAction = async () => {
    if (!actionItem) return;
    setIsProcessingAction(true);

    if (actionItem.action === 'approve') {
      const res = await WorkforcePerformanceService.approveOvertime(actionItem.item.id, actionNotes);
      setIsProcessingAction(false);
      if (res.error) {
        showToast(`Approval error: ${res.error}`);
      } else {
        showToast(`Overtime request for ${actionItem.item.requested_hours} hrs approved successfully.`);
        setActionItem(null);
        setActionNotes('');
        fetchOvertime(true);
      }
    } else {
      const res = await WorkforcePerformanceService.rejectOvertime(actionItem.item.id, actionNotes);
      setIsProcessingAction(false);
      if (res.error) {
        showToast(`Rejection error: ${res.error}`);
      } else {
        showToast(`Overtime request rejected.`);
        setActionItem(null);
        setActionNotes('');
        fetchOvertime(true);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#01875F]" />
          <span>{toastMessage}</span>
        </div>
      )}

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
              <Clock className="w-7 h-7 text-[#01875F]" />
              <span>Overtime</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Review and manage workforce overtime requests across projects.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchOvertime(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh overtime records from database"
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
      <WorkforceNavTabs activeTab="overtime" />

      {/* Summary KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            PENDING OVERTIME
          </span>
          <span className="text-2xl font-bold text-amber-700 mt-1 block font-mono">
            {metrics.pendingRequests}
          </span>
          <span className="text-[11px] text-amber-600 font-medium">Awaiting management approval</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            APPROVED OVERTIME
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block font-mono">
            {metrics.approvedRequests}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Approved requisitions</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            REJECTED OVERTIME
          </span>
          <span className="text-2xl font-bold text-rose-700 mt-1 block font-mono">
            {metrics.rejectedRequests}
          </span>
          <span className="text-[11px] text-rose-600 font-medium">Declined requisitions</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL REQUESTED HOURS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {metrics.totalRequestedHours.toLocaleString()} hrs
          </span>
          <span className="text-[11px] text-slate-500">Across {metrics.totalRequests} requests</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by worker, code, reason, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F] transition-all"
            />
          </div>

          {/* Quick Clear */}
          {(projectFilter !== 'all' || workerFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer self-start md:self-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Project Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Project:</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Projects</option>
              {filterOptions.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Worker Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Worker:</span>
            <select
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Workers</option>
              {filterOptions.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.code}] {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="requested">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area: Table / Empty / Error / Loading */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        /* Database Error State with Retry */
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load overtime records.</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            A database communication error occurred while querying overtime requests.
          </p>
          <p className="text-xs font-mono text-red-600 bg-red-50 p-2.5 rounded-lg mt-3 border border-red-100">
            {errorMessage}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fetchOvertime(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : records.length === 0 ? (
        /* Exact Zero-Demo-Data Empty State */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-4 border border-[#01875F]/20">
            <Clock className="w-7 h-7" strokeWidth={1.8} />
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">No overtime requests</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Overtime requests created in the system will appear here.
          </p>
        </div>
      ) : (
        /* Real Overtime Table */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 font-bold">Worker</th>
                  <th className="py-3.5 px-3 font-bold">Workforce Code</th>
                  <th className="py-3.5 px-3 font-bold">Project</th>
                  <th className="py-3.5 px-3 font-bold">Requested Hours</th>
                  <th className="py-3.5 px-3 font-bold">Reason</th>
                  <th className="py-3.5 px-3 font-bold">Status</th>
                  <th className="py-3.5 px-3 font-bold">Date Logged</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((ot) => {
                  const worker = ot.workforce_members;
                  const prof = worker?.profiles;
                  const workerName =
                    prof?.display_name ||
                    (prof?.first_name || prof?.last_name
                      ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
                      : worker ? `Artisan ${worker.workforce_code}` : 'Unknown Worker');

                  const statusConfig = OVERTIME_STATUS_CONFIG[ot.status] || {
                    label: ot.status,
                    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  const isPending = ot.status === 'requested';

                  return (
                    <tr key={ot.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Worker Name with Link */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/management/workforce/${ot.workforce_member_id}`)}
                          className="font-bold text-slate-900 hover:text-[#01875F] flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                          title="Open Workforce Control Centre"
                        >
                          <span>{workerName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                        {worker?.trade && (
                          <div className="text-[11px] text-slate-400">{worker.trade}</div>
                        )}
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/management/workforce/${ot.workforce_member_id}`)}
                          className="font-mono text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                        >
                          {worker?.workforce_code || '—'}
                        </button>
                      </td>

                      {/* Project with Link */}
                      <td className="py-3.5 px-3">
                        {ot.projects ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/management/projects/${ot.project_id}`)}
                            className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer text-left"
                            title="Open Project Control Centre"
                          >
                            <span>{ot.projects.name}</span>
                            <span className="font-mono text-slate-400 text-[11px]">
                              [{ot.projects.project_code}]
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Requested Hours */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-sm">
                        {ot.requested_hours} hrs
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-3 text-slate-600 max-w-[200px] truncate" title={ot.reason || ''}>
                        {ot.reason || '—'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase border ${statusConfig.badgeClasses}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 font-mono text-slate-500 text-[11px]">
                        {formatDateNigerian(ot.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActionItem({ item: ot, action: 'approve' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-bold transition-colors cursor-pointer"
                              title="Approve overtime"
                            >
                              <Check className="w-3 h-3" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActionItem({ item: ot, action: 'reject' })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-bold transition-colors cursor-pointer"
                              title="Reject overtime"
                            >
                              <X className="w-3 h-3" />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Count */}
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Showing {records.length} overtime requests
            </span>
          </div>
        </div>
      )}

      {/* Action Confirmation Dialog */}
      {actionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  actionItem.action === 'approve'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {actionItem.action === 'approve' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {actionItem.action === 'approve'
                    ? 'Approve Overtime Request?'
                    : 'Reject Overtime Request?'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Requested {actionItem.item.requested_hours} hours for{' '}
                  {actionItem.item.projects?.name || 'Project'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-semibold text-slate-700">
                {actionItem.action === 'approve' ? 'Approval Notes (Optional):' : 'Rejection Reason:'}
              </label>
              <textarea
                rows={2}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionItem.action === 'approve'
                    ? 'Optional authorization remarks...'
                    : 'Please state reason for declining request...'
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F] resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setActionItem(null);
                  setActionNotes('');
                }}
                disabled={isProcessingAction}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={isProcessingAction}
                className={`px-4 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5 ${
                  actionItem.action === 'approve'
                    ? 'bg-[#01875F] hover:bg-[#016f4e]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isProcessingAction ? (
                  <span>Processing...</span>
                ) : (
                  <span>{actionItem.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OvertimeModule;
