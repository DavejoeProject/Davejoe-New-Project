import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HardHat,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit3,
  FolderKanban,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Phone,
  History,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  WorkforceDirectoryRecord,
  WorkforceDirectoryMetrics,
  WorkforceProjectAssignmentRecord,
  WorkforceDirectoryService,
  ContractWorkforceStatus,
} from '../../services/workforceDirectoryService';
import { formatDateNigerian } from '../../services/dashboardService';
import { WorkforceDirectoryFormModal } from './WorkforceDirectoryFormModal';
import { AssignContractWorkerModal } from './AssignContractWorkerModal';
import { WorkforceDirectoryProfile } from './WorkforceDirectoryProfile';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import { AccessDenied } from '../AccessDenied';

interface WorkforceDirectoryModuleProps {
  onBackToDashboard?: () => void;
}

type SortField = 'full_name' | 'created_at' | 'status' | 'assignments';

export const WorkforceDirectoryModule: React.FC<WorkforceDirectoryModuleProps> = ({
  onBackToDashboard,
}) => {
  const { hasAnyPermission } = useAuth();

  const canCreate = hasAnyPermission(['Create Workforce', 'workforce.create']);
  const canUpdate = hasAnyPermission(['Update Workforce', 'workforce.update']);
  const canAssign = hasAnyPermission(['Assign Workforce', 'workforce.assign']);
  const canViewBanking =
    canCreate ||
    canUpdate ||
    hasAnyPermission(['View Workforce Banking', 'workforce.banking.view']);
  const canView =
    canCreate ||
    canUpdate ||
    canAssign ||
    hasAnyPermission(['View Workforce', 'workforce.view']);

  const [activeViewTab, setActiveViewTab] = useState<'directory' | 'history'>('directory');

  // Directory State
  const [records, setRecords] = useState<WorkforceDirectoryRecord[]>([]);
  const [metrics, setMetrics] = useState<WorkforceDirectoryMetrics>({
    totalRegistered: 0,
    activeCount: 0,
    inactiveCount: 0,
    suspendedCount: 0,
    assignedCount: 0,
    unassignedCount: 0,
  });

  // Global Assignment History State
  const [allAssignments, setAllAssignments] = useState<WorkforceProjectAssignmentRecord[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'all' | 'active' | 'completed' | 'cancelled'
  >('all');
  const [historyPage, setHistoryPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Search, Filters, Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>(
    'all'
  );
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>(
    'all'
  );
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sub-views & Modals
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [profileInitialFocus, setProfileInitialFocus] = useState<'profile' | 'history'>('profile');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkforceDirectoryRecord | null>(null);
  const [assigningMember, setAssigningMember] = useState<WorkforceDirectoryRecord | null>(null);
  const [profileRefreshTick, setProfileRefreshTick] = useState(0);

  // Confirmation Dialog
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchDirectory = useCallback(
    async (manual = false) => {
      if (manual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg(null);

      const res = await WorkforceDirectoryService.listDirectory({
        search: searchQuery,
        status: statusFilter,
        assignmentFilter,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setRecords(res.data);
        setMetrics(res.metrics);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [searchQuery, statusFilter, assignmentFilter]
  );

  const fetchAssignmentHistory = useCallback(
    async (manual = false) => {
      if (manual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg(null);

      const res = await WorkforceDirectoryService.listAllAssignments({
        search: historySearch,
        assignmentStatus: historyStatusFilter,
      });

      if (res.error) setErrorMsg(res.error);
      else setAllAssignments(res.data);

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [historySearch, historyStatusFilter]
  );

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    if (activeViewTab === 'directory') {
      fetchDirectory();
    } else {
      fetchAssignmentHistory();
    }
  }, [canView, activeViewTab, fetchDirectory, fetchAssignmentHistory]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, assignmentFilter, sortField, sortDir, pageSize]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyStatusFilter, pageSize]);

  const sortedRecords = useMemo(() => {
    const copy = [...records];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'full_name') {
        cmp = a.full_name.localeCompare(b.full_name);
      } else if (sortField === 'status') {
        cmp = (a.status || '').localeCompare(b.status || '');
      } else if (sortField === 'assignments') {
        cmp = (a.activeAssignmentsCount || 0) - (b.activeAssignmentsCount || 0);
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [records, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = sortedRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  const historyTotalPages = Math.max(1, Math.ceil(allAssignments.length / pageSize));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = allAssignments.slice(
    (safeHistoryPage - 1) * pageSize,
    safeHistoryPage * pageSize
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const requestStatusChange = (
    worker: WorkforceDirectoryRecord,
    nextStatus: ContractWorkforceStatus
  ) => {
    if (worker.status === nextStatus) return;
    const variant =
      nextStatus === 'suspended' ? 'danger' : nextStatus === 'inactive' ? 'warning' : 'primary';
    const verb =
      nextStatus === 'active'
        ? 'Activate'
        : nextStatus === 'suspended'
        ? 'Suspend'
        : 'Deactivate';

    setConfirmState({
      title: `${verb} Workforce Member`,
      message: `Confirm changing ${worker.full_name}'s status from "${worker.status}" to "${nextStatus}"? Historical assignment records remain intact.`,
      confirmLabel: verb,
      variant,
      onConfirm: async () => {
        setIsConfirmBusy(true);
        const res = await WorkforceDirectoryService.updateStatus(
          worker.id,
          nextStatus,
          worker.status
        );
        setIsConfirmBusy(false);
        setConfirmState(null);
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        showToast(`${worker.full_name} status changed to ${nextStatus}.`);
        fetchDirectory(true);
      },
    });
  };

  const requestAssignmentStatusChange = (
    row: WorkforceProjectAssignmentRecord,
    nextStatus: 'completed' | 'cancelled'
  ) => {
    setConfirmState({
      title:
        nextStatus === 'completed' ? 'Complete Project Assignment' : 'Cancel Project Assignment',
      message: `Mark ${row.worker?.full_name || 'this worker'}'s assignment on "${
        row.project?.name || 'Project'
      }" as ${nextStatus}?`,
      confirmLabel: nextStatus === 'completed' ? 'Mark Completed' : 'Cancel Assignment',
      variant: nextStatus === 'cancelled' ? 'warning' : 'primary',
      onConfirm: async () => {
        setIsConfirmBusy(true);
        const res = await WorkforceDirectoryService.updateAssignmentStatus(row.id, nextStatus);
        setIsConfirmBusy(false);
        setConfirmState(null);
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        showToast(`Assignment marked as ${nextStatus}.`);
        fetchAssignmentHistory(true);
      },
    });
  };

  if (!canView) {
    return (
      <AccessDenied
        isModuleRestricted
        title="Workforce Directory Access Restricted"
        message="You do not hold the required database permission (View Workforce) to access the Contract Workforce Directory."
        onBack={onBackToDashboard}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#18b892] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {selectedMemberId ? (
        <WorkforceDirectoryProfile
          memberId={selectedMemberId}
          canUpdate={canUpdate}
          canAssign={canAssign}
          canViewBanking={canViewBanking}
          initialFocus={profileInitialFocus}
          refreshTrigger={profileRefreshTick}
          onBack={() => {
            setSelectedMemberId(null);
            if (activeViewTab === 'directory') fetchDirectory(true);
            else fetchAssignmentHistory(true);
          }}
          onEdit={(member) => {
            setEditingMember(member);
            setIsFormOpen(true);
          }}
          onAssignProject={(member) => setAssigningMember(member)}
          onStatusUpdated={(msg) => {
            showToast(msg);
            setProfileRefreshTick((t) => t + 1);
            fetchDirectory(true);
          }}
        />
      ) : (
        <>
          {/* Header */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {onBackToDashboard && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18b892] hover:underline cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Back to Dashboard</span>
                </button>
              )}
              <div className="flex items-center gap-2.5">
                <HardHat className="w-6 h-6 text-[#18b892] shrink-0" />
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                  Workforce Directory
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                External contract artisans and field personnel engaged on projects without system login accounts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveViewTab('directory')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeViewTab === 'directory'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <HardHat className="w-3.5 h-3.5 shrink-0" />
                  <span>Directory</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewTab('history')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    activeViewTab === 'history'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-3.5 h-3.5 shrink-0" />
                  <span>Assignment History</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  activeViewTab === 'directory' ? fetchDirectory(true) : fetchAssignmentHistory(true)
                }
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin text-[#18b892]' : ''}`}
                />
                <span>Refresh</span>
              </button>

              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMember(null);
                    setIsFormOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Add Workforce</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Total Workforce</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.totalRegistered}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-emerald-700">Active Workforce</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {metrics.activeCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Inactive Workforce</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-700 mt-1">
                {metrics.inactiveCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-red-700">Suspended Workforce</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
                {metrics.suspendedCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
              <div className="text-xs font-semibold text-[#18b892]">Assigned to Projects</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.assignedCount}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeViewTab === 'directory' ? (
            <>
              {/* Search, Filter & Sort Toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by full name or phone number..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
                    {(['all', 'active', 'inactive', 'suspended'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                          statusFilter === st
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <select
                    value={assignmentFilter}
                    onChange={(e) =>
                      setAssignmentFilter(e.target.value as 'all' | 'assigned' | 'unassigned')
                    }
                    aria-label="Filter by assignment status"
                    className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#18b892] cursor-pointer"
                  >
                    <option value="all">All Assignments</option>
                    <option value="assigned">Assigned to Project</option>
                    <option value="unassigned">Unassigned</option>
                  </select>

                  <div className="inline-flex items-center gap-1.5">
                    <select
                      value={sortField}
                      onChange={(e) => setSortField(e.target.value as SortField)}
                      aria-label="Sort workforce records"
                      className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#18b892] cursor-pointer"
                    >
                      <option value="created_at">Sort: Date Registered</option>
                      <option value="full_name">Sort: Full Name</option>
                      <option value="status">Sort: Status</option>
                      <option value="assignments">Sort: Active Projects</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                      title={sortDir === 'asc' ? 'Ascending order' : 'Descending order'}
                      className="px-2.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      <span className="uppercase">{sortDir}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Directory Table / Cards */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {isLoading ? (
                  <div className="p-6 space-y-3 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-12 bg-slate-100 rounded-xl" />
                    ))}
                  </div>
                ) : sortedRecords.length === 0 ? (
                  <div className="py-14 px-6 text-center space-y-3">
                    <HardHat className="w-9 h-9 text-slate-300 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800">
                        No workforce records match your filter
                      </p>
                      <p className="text-xs text-slate-500">
                        Register external artisans here to track contact details, next of kin, banking info, and project deployments.
                      </p>
                    </div>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMember(null);
                          setIsFormOpen(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>Add First Workforce Member</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <th className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => toggleSort('full_name')}
                                className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                              >
                                <span>Full Name</span>
                                <ArrowUpDown className="w-3 h-3" />
                              </button>
                            </th>
                            <th className="py-3 px-4">Phone Number</th>
                            <th className="py-3 px-4">Project Assignments</th>
                            <th className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => toggleSort('created_at')}
                                className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                              >
                                <span>Registered</span>
                                <ArrowUpDown className="w-3 h-3" />
                              </button>
                            </th>
                            <th className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => toggleSort('status')}
                                className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                              >
                                <span>Status</span>
                                <ArrowUpDown className="w-3 h-3" />
                              </button>
                            </th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedRecords.map((w) => {
                            const activeAssignments = (w.assignments || []).filter(
                              (a) => (a.assignment_status || '').toLowerCase() === 'active'
                            );
                            const statusTextClass =
                              w.status === 'active'
                                ? 'text-emerald-700'
                                : w.status === 'suspended'
                                ? 'text-red-700'
                                : 'text-slate-500';

                            return (
                              <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-4">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProfileInitialFocus('profile');
                                      setSelectedMemberId(w.id);
                                    }}
                                    className="font-bold text-slate-900 hover:text-[#18b892] text-left cursor-pointer"
                                  >
                                    {w.full_name}
                                  </button>
                                  {w.address && (
                                    <div className="text-xs text-slate-500 truncate max-w-[220px]">
                                      {w.address}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                                  {w.phone_number}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-700">
                                  {activeAssignments.length > 0 ? (
                                    <div>
                                      <span className="font-semibold text-slate-900 tabular-nums">
                                        {activeAssignments.length} active
                                      </span>
                                      <div className="text-slate-500 truncate max-w-[200px]">
                                        {activeAssignments
                                          .map((a) => a.project?.name || 'Project')
                                          .join(', ')}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">Unassigned</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                                  {formatDateNigerian(w.created_at)}
                                </td>
                                <td
                                  className={`py-3.5 px-4 text-xs font-semibold capitalize whitespace-nowrap ${statusTextClass}`}
                                >
                                  {canUpdate ? (
                                    <select
                                      aria-label={`Change status for ${w.full_name}`}
                                      value={w.status}
                                      onChange={(e) =>
                                        requestStatusChange(
                                          w,
                                          e.target.value as ContractWorkforceStatus
                                        )
                                      }
                                      className={`px-2 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg capitalize cursor-pointer ${statusTextClass}`}
                                    >
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                      <option value="suspended">Suspended</option>
                                    </select>
                                  ) : (
                                    w.status
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProfileInitialFocus('profile');
                                        setSelectedMemberId(w.id);
                                      }}
                                      title="View Details"
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <Eye className="w-3.5 h-3.5 shrink-0" />
                                      <span>Details</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setProfileInitialFocus('history');
                                        setSelectedMemberId(w.id);
                                      }}
                                      title="View Assignment History"
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <History className="w-3.5 h-3.5 shrink-0" />
                                      <span>History</span>
                                    </button>
                                    {canAssign && (
                                      <button
                                        type="button"
                                        onClick={() => setAssigningMember(w)}
                                        disabled={w.status !== 'active'}
                                        title={
                                          w.status !== 'active'
                                            ? 'Only active workforce can be assigned'
                                            : 'Assign to Project'
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#18b892] bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer disabled:opacity-40 transition-colors"
                                      >
                                        <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                                        <span>Assign</span>
                                      </button>
                                    )}
                                    {canUpdate && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMember(w);
                                          setIsFormOpen(true);
                                        }}
                                        title="Edit Workforce Details"
                                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Responsive Cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {paginatedRecords.map((w) => {
                        const activeCount = w.activeAssignmentsCount || 0;
                        return (
                          <div key={w.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProfileInitialFocus('profile');
                                    setSelectedMemberId(w.id);
                                  }}
                                  className="font-bold text-slate-900 hover:text-[#18b892] text-left cursor-pointer"
                                >
                                  {w.full_name}
                                </button>
                                <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-600 mt-0.5">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{w.phone_number}</span>
                                </div>
                              </div>
                              <span
                                className={`text-xs font-semibold capitalize shrink-0 ${
                                  w.status === 'active'
                                    ? 'text-emerald-700'
                                    : w.status === 'suspended'
                                    ? 'text-red-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {w.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>
                                {activeCount > 0 ? `${activeCount} active project(s)` : 'Unassigned'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                Registered {formatDateNigerian(w.created_at)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setProfileInitialFocus('profile');
                                  setSelectedMemberId(w.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Details</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setProfileInitialFocus('history');
                                  setSelectedMemberId(w.id);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>History</span>
                              </button>
                              {canAssign && (
                                <button
                                  type="button"
                                  disabled={w.status !== 'active'}
                                  onClick={() => setAssigningMember(w)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18b892] bg-emerald-50 rounded-lg cursor-pointer disabled:opacity-40"
                                >
                                  <FolderKanban className="w-3.5 h-3.5" />
                                  <span>Assign</span>
                                </button>
                              )}
                              {canUpdate && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMember(w);
                                    setIsFormOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums">
                          Showing {(safePage - 1) * pageSize + 1}–
                          {Math.min(safePage * pageSize, sortedRecords.length)} of{' '}
                          {sortedRecords.length} records
                        </span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          aria-label="Rows per page"
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          <option value={10}>10 / page</option>
                          <option value={25}>25 / page</option>
                          <option value={50}>50 / page</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={safePage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <span className="px-2 font-mono tabular-nums font-semibold">
                          Page {safePage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={safePage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            /* GLOBAL ASSIGNMENT HISTORY TAB */
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search by workforce name, project name, or notes..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                  />
                </div>

                <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
                  {(['all', 'active', 'completed', 'cancelled'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setHistoryStatusFilter(st)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                        historyStatusFilter === st
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {isLoading ? (
                  <div className="p-6 space-y-3 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-12 bg-slate-100 rounded-xl" />
                    ))}
                  </div>
                ) : allAssignments.length === 0 ? (
                  <div className="py-14 px-6 text-center space-y-2">
                    <History className="w-9 h-9 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-800">
                      No project assignment records found
                    </p>
                    <p className="text-xs text-slate-500">
                      Historical and active deployments across all projects appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <th className="py-3 px-4">Workforce Member</th>
                            <th className="py-3 px-4">Project</th>
                            <th className="py-3 px-4">Assigned</th>
                            <th className="py-3 px-4">Expected End</th>
                            <th className="py-3 px-4">Actual End</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Notes</th>
                            {canAssign && <th className="py-3 px-4 text-right">Actions</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedHistory.map((row) => {
                            const stColor =
                              row.assignment_status === 'active'
                                ? 'text-emerald-700'
                                : row.assignment_status === 'completed'
                                ? 'text-slate-800'
                                : 'text-red-700';

                            return (
                              <tr key={row.id} className="hover:bg-slate-50/70">
                                <td className="py-3.5 px-4">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setProfileInitialFocus('history');
                                      setSelectedMemberId(row.workforce_id);
                                    }}
                                    className="font-bold text-slate-900 hover:text-[#18b892] text-left cursor-pointer"
                                  >
                                    {row.worker?.full_name || 'Contract Worker'}
                                  </button>
                                  {row.worker?.phone_number && (
                                    <div className="text-xs font-mono tabular-nums text-slate-500">
                                      {row.worker.phone_number}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-slate-800">
                                    {row.project?.name || 'Project'}
                                  </div>
                                  {row.project?.project_code && (
                                    <div className="text-xs font-mono text-slate-400">
                                      {row.project.project_code}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                                  {formatDateNigerian(row.assigned_at)}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                                  {row.expected_end_date
                                    ? formatDateNigerian(row.expected_end_date)
                                    : 'Open-ended'}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                                  {row.actual_end_date ? formatDateNigerian(row.actual_end_date) : '—'}
                                </td>
                                <td
                                  className={`py-3.5 px-4 text-xs font-semibold capitalize whitespace-nowrap ${stColor}`}
                                >
                                  {row.assignment_status}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                                  {row.assignment_notes || '—'}
                                </td>
                                {canAssign && (
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    {row.assignment_status === 'active' ? (
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            requestAssignmentStatusChange(row, 'completed')
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                          <span>Complete</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            requestAssignmentStatusChange(row, 'cancelled')
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                                        >
                                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                                          <span>Cancel</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-slate-400">Archived</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
                      <span className="tabular-nums">
                        Showing {(safeHistoryPage - 1) * pageSize + 1}–
                        {Math.min(safeHistoryPage * pageSize, allAssignments.length)} of{' '}
                        {allAssignments.length} assignments
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={safeHistoryPage <= 1}
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev</span>
                        </button>
                        <span className="px-2 font-mono tabular-nums font-semibold">
                          Page {safeHistoryPage} of {historyTotalPages}
                        </span>
                        <button
                          type="button"
                          disabled={safeHistoryPage >= historyTotalPages}
                          onClick={() =>
                            setHistoryPage((p) => Math.min(historyTotalPages, p + 1))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <span>Next</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Registration / Edit Modal */}
      <WorkforceDirectoryFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingMember(null);
        }}
        editingMember={editingMember}
        onSaved={(msg) => {
          showToast(msg);
          setProfileRefreshTick((t) => t + 1);
          fetchDirectory(true);
        }}
      />

      {/* Project Assignment Modal */}
      <AssignContractWorkerModal
        isOpen={Boolean(assigningMember)}
        onClose={() => setAssigningMember(null)}
        member={assigningMember}
        onAssigned={(msg) => {
          showToast(msg);
          setProfileRefreshTick((t) => t + 1);
          fetchDirectory(true);
        }}
      />

      {/* Confirmation Dialog */}
      <ConfirmActionModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant || 'warning'}
        isBusy={isConfirmBusy}
        onConfirm={() => {
          if (confirmState) confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};
