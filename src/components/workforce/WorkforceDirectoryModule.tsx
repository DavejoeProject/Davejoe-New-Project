import React, { useState, useEffect, useCallback } from 'react';
import {
  HardHat,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit3,
  FolderKanban,
  UserX,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Phone,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  WorkforceDirectoryRecord,
  WorkforceDirectoryMetrics,
  WorkforceDirectoryService,
  maskBankAccountNumber,
  ContractWorkforceStatus,
} from '../../services/workforceDirectoryService';
import { WorkforceDirectoryFormModal } from './WorkforceDirectoryFormModal';
import { AssignContractWorkerModal } from './AssignContractWorkerModal';
import { WorkforceDirectoryProfile } from './WorkforceDirectoryProfile';

interface WorkforceDirectoryModuleProps {
  onBackToDashboard?: () => void;
}

export const WorkforceDirectoryModule: React.FC<WorkforceDirectoryModuleProps> = ({
  onBackToDashboard,
}) => {
  const { user, currentRoleKey, hasPermission } = useAuth();

  const canManage =
    currentRoleKey === 'admin' ||
    currentRoleKey === 'management' ||
    hasPermission('workforce_directory.manage');

  const canView =
    canManage ||
    currentRoleKey === 'executive_director' ||
    hasPermission('workforce_directory.view');

  const [records, setRecords] = useState<WorkforceDirectoryRecord[]>([]);
  const [metrics, setMetrics] = useState<WorkforceDirectoryMetrics>({
    totalRegistered: 0,
    activeCount: 0,
    inactiveCount: 0,
    suspendedCount: 0,
    assignedCount: 0,
    unassignedCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Sub-views & Modals
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkforceDirectoryRecord | null>(null);
  const [assigningMember, setAssigningMember] = useState<WorkforceDirectoryRecord | null>(null);
  const [profileRefreshTick, setProfileRefreshTick] = useState(0);

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

      if (res.error) setErrorMsg(res.error);
      else {
        setRecords(res.data);
        setMetrics(res.metrics);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [searchQuery, statusFilter, assignmentFilter]
  );

  useEffect(() => {
    if (canView) {
      fetchDirectory();
    } else {
      setIsLoading(false);
    }
  }, [fetchDirectory, canView]);

  const handleToggleStatus = async (
    worker: WorkforceDirectoryRecord,
    nextStatus: ContractWorkforceStatus
  ) => {
    const res = await WorkforceDirectoryService.updateStatus(
      worker.id,
      nextStatus,
      user?.id,
      worker.status
    );
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    showToast(`${worker.full_name} status changed to ${nextStatus}.`);
    fetchDirectory(true);
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          You do not hold the required authorization to access the Contract Workforce Directory.
        </p>
      </div>
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
          canManage={canManage}
          actorUserId={user?.id}
          refreshTrigger={profileRefreshTick}
          onBack={() => {
            setSelectedMemberId(null);
            fetchDirectory(true);
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
                  Contract Workforce Directory
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                External contract artisans and field personnel engaged on projects without system login accounts.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => fetchDirectory(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin text-[#18b892]' : ''}`} />
                <span>Refresh</span>
              </button>

              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMember(null);
                    setIsFormOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Register Workforce</span>
                </button>
              )}
            </div>
          </div>

          {/* 5 KPI Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Total Registered</div>
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
              <div className="text-xs font-semibold text-[#18b892]">Assigned to Projects</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.assignedCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
              <div className="text-xs font-semibold text-amber-700">Unassigned Workforce</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
                {metrics.unassignedCount}
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
                onChange={(e) => setAssignmentFilter(e.target.value as 'all' | 'assigned' | 'unassigned')}
                aria-label="Filter by assignment status"
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#18b892] cursor-pointer"
              >
                <option value="all">All Assignments</option>
                <option value="assigned">Assigned to Project</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Directory Table / Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-xl" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-3">
                <HardHat className="w-9 h-9 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    No contract workforce records match your filter
                  </p>
                  <p className="text-xs text-slate-500">
                    Register external artisans here to track contact details, next of kin, banking info, and project deployments.
                  </p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMember(null);
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl cursor-pointer"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Register First Workforce Member</span>
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
                        <th className="py-3 px-4">Full Name</th>
                        <th className="py-3 px-4">Phone Number</th>
                        <th className="py-3 px-4">Project Assignments</th>
                        <th className="py-3 px-4">Bank Account</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((w) => {
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
                                onClick={() => setSelectedMemberId(w.id)}
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
                                  <span className="font-semibold text-slate-900">
                                    {activeAssignments.length} active
                                  </span>
                                  <div className="text-slate-500 truncate max-w-[210px]">
                                    {activeAssignments
                                      .map((a) => a.project?.name || 'Project')
                                      .join(', ')}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {w.bank_name ? (
                                <div>
                                  <div className="font-medium text-slate-800">{w.bank_name}</div>
                                  <div className="font-mono tabular-nums text-slate-500">
                                    {maskBankAccountNumber(w.account_number)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">Not set</span>
                              )}
                            </td>
                            <td className={`py-3.5 px-4 text-xs font-semibold capitalize whitespace-nowrap ${statusTextClass}`}>
                              {w.status}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMemberId(w.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                  <span>Profile</span>
                                </button>
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setAssigningMember(w)}
                                      disabled={w.status !== 'active'}
                                      title="Assign to Project"
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#18b892] bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer disabled:opacity-40 transition-colors"
                                    >
                                      <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                                      <span>Assign</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingMember(w);
                                        setIsFormOpen(true);
                                      }}
                                      title="Edit"
                                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    {w.status === 'active' ? (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStatus(w, 'inactive')}
                                        title="Deactivate"
                                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                      >
                                        <UserX className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStatus(w, 'active')}
                                        title="Reactivate"
                                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
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
                  {records.map((w) => {
                    const activeCount = w.activeAssignmentsCount || 0;
                    return (
                      <div key={w.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedMemberId(w.id)}
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
                          <span>{activeCount > 0 ? `${activeCount} active project(s)` : 'Unassigned'}</span>
                          {w.bank_name && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {w.bank_name} ({maskBankAccountNumber(w.account_number)})
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedMemberId(w.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Profile</span>
                          </button>
                          {canManage && (
                            <>
                              <button
                                type="button"
                                disabled={w.status !== 'active'}
                                onClick={() => setAssigningMember(w)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18b892] bg-emerald-50 rounded-lg cursor-pointer disabled:opacity-40"
                              >
                                <FolderKanban className="w-3.5 h-3.5" />
                                <span>Assign</span>
                              </button>
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
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
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
        actorUserId={user?.id}
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
        actorUserId={user?.id}
        onAssigned={(msg) => {
          showToast(msg);
          setProfileRefreshTick((t) => t + 1);
          fetchDirectory(true);
        }}
      />
    </div>
  );
};
