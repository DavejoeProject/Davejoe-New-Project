import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Eye,
  Edit3,
  UserPlus,
  CheckCircle2,
  FolderKanban,
  Phone,
  Briefcase,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  WorkforceService,
  WorkforceMemberRecord,
  WorkforceSummaryMetrics,
  WORKFORCE_STATUS_CONFIG,
  ALL_WORKFORCE_STATUSES,
} from '../../services/workforceService';
import { AddWorkforceModal } from './AddWorkforceModal';
import { EditWorkforceModal } from './EditWorkforceModal';
import { WorkforceDetailModal } from './WorkforceDetailModal';
import { AssignWorkerModal } from './AssignWorkerModal';
import { WorkforceNavTabs } from './WorkforceNavTabs';

interface WorkforceModuleProps {
  onBackToDashboard?: () => void;
}

export const WorkforceModule: React.FC<WorkforceModuleProps> = ({ onBackToDashboard }) => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<WorkforceMemberRecord[]>([]);
  const [metrics, setMetrics] = useState<WorkforceSummaryMetrics>({
    totalWorkforce: 0,
    activeWorkforce: 0,
    assignedWorkforce: 0,
    availableWorkforce: 0,
  });
  const [uniqueTrades, setUniqueTrades] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'available'>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<WorkforceMemberRecord | null>(null);
  const [viewingMember, setViewingMember] = useState<WorkforceMemberRecord | null>(null);
  const [assigningMember, setAssigningMember] = useState<WorkforceMemberRecord | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Live database fetch
  const fetchWorkforce = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const res = await WorkforceService.getWorkforceDirectory({
        search: searchQuery,
        status: statusFilter,
        trade: tradeFilter,
        assignmentStatus: assignmentFilter,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setMembers(res.data);
        setMetrics(res.metrics);
        setUniqueTrades(res.uniqueTrades);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [searchQuery, statusFilter, tradeFilter, assignmentFilter]
  );

  useEffect(() => {
    fetchWorkforce();
  }, [fetchWorkforce]);

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
                WORKFORCE MANAGEMENT
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-[#01875F]" />
              <span>Workforce</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage and monitor the organization&apos;s workforce.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchWorkforce(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh workforce from database"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Add Workforce</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <WorkforceNavTabs activeTab="directory" />

      {/* Summary KPI Cards Row strictly based on real database data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL WORKFORCE
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {metrics.totalWorkforce}
          </span>
          <span className="text-[11px] text-slate-500">Registered in system</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            ACTIVE WORKFORCE
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block font-mono">
            {metrics.activeWorkforce}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Status active</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            ASSIGNED WORKFORCE
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {metrics.assignedWorkforce}
          </span>
          <span className="text-[11px] text-slate-500">On active project site</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            AVAILABLE WORKFORCE
          </span>
          <span className="text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {metrics.availableWorkforce}
          </span>
          <span className="text-[11px] text-slate-500">Ready for deployment</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by code, trade, phone, name, or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F] transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              {ALL_WORKFORCE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {WORKFORCE_STATUS_CONFIG[st].label}
                </option>
              ))}
            </select>
          </div>

          {/* Trade Filter */}
          {uniqueTrades.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Trade:</span>
              <select
                value={tradeFilter}
                onChange={(e) => setTradeFilter(e.target.value)}
                className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
              >
                <option value="all">All Trades</option>
                {uniqueTrades.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Deployment Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Deployment:</span>
            <select
              value={assignmentFilter}
              onChange={(e) =>
                setAssignmentFilter(e.target.value as 'all' | 'assigned' | 'available')
              }
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
            >
              <option value="all">All Workforce</option>
              <option value="assigned">Assigned to Project</option>
              <option value="available">Available (Unassigned)</option>
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
          <h2 className="text-base font-bold text-slate-900">Unable to load workforce records.</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            A database communication error occurred while querying workforce tables.
          </p>
          <p className="text-xs font-mono text-red-600 bg-red-50 p-2.5 rounded-lg mt-3 border border-red-100">
            {errorMessage}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fetchWorkforce(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      ) : members.length === 0 ? (
        /* Exact Zero-Demo-Data Empty State */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-4 border border-[#01875F]/20">
            <Users className="w-7 h-7" strokeWidth={1.8} />
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">No workforce records</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Workforce members created in the system will appear here.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Add Workforce</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Workforce Table */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 font-bold">Worker</th>
                  <th className="py-3.5 px-3 font-bold">Code</th>
                  <th className="py-3.5 px-3 font-bold">Trade / Craft</th>
                  <th className="py-3.5 px-3 font-bold">Status</th>
                  <th className="py-3.5 px-3 font-bold">Current Deployment</th>
                  <th className="py-3.5 px-3 font-bold">Contact</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const prof = member.profiles;
                  const workerName =
                    prof?.display_name ||
                    (prof?.first_name || prof?.last_name
                      ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
                      : member.workforce_code);

                  const statusCfg = WORKFORCE_STATUS_CONFIG[member.status] || {
                    label: member.status,
                    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
                    dotClasses: 'bg-slate-400',
                  };

                  const activeAssign = member.active_assignment;

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/management/workforce/${member.id}`)}
                    >
                      {/* Worker Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-xs shrink-0 border border-[#01875F]/20">
                            {prof?.avatar_url ? (
                              <img
                                src={prof.avatar_url}
                                alt={workerName}
                                className="w-full h-full object-cover rounded-full"
                              />
                            ) : (
                              workerName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-[#01875F] transition-colors">
                              {workerName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {prof?.job_title ? prof.job_title : member.phone || 'No phone'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                          {member.workforce_code}
                        </span>
                      </td>

                      {/* Trade */}
                      <td className="py-3.5 px-3">
                        <span className="font-medium text-slate-800">{member.trade}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.badgeClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClasses}`} />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Current Deployment */}
                      <td className="py-3.5 px-3">
                        {activeAssign ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-slate-700 bg-emerald-50 border border-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">
                              {activeAssign.projects?.project_code || 'PRJ'}
                            </span>
                            <span className="font-medium text-slate-900 truncate max-w-[160px]">
                              {activeAssign.projects?.name || 'Assigned Project'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Available
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5">
                          <div className="font-mono text-slate-700">{member.phone || '—'}</div>
                          {member.emergency_contact_name && (
                            <div className="text-[10.5px] text-slate-400 truncate max-w-[140px]">
                              ICE: {member.emergency_contact_name}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Control Centre action */}
                          <button
                            type="button"
                            onClick={() => navigate(`/management/workforce/${member.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#E6F4EA] hover:bg-[#d2edd9] text-[#01875F] text-[11px] font-bold transition-colors cursor-pointer border border-[#01875F]/20"
                            title="Open Workforce Control Centre"
                          >
                            <span>Control Centre</span>
                          </button>

                          {/* Assign to project */}
                          <button
                            type="button"
                            onClick={() => setAssigningMember(member)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-[#01875F] hover:text-[#016f4e] transition-colors cursor-pointer"
                            title="Assign to project"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit member */}
                          <button
                            type="button"
                            onClick={() => setEditingMember(member)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                            title="Edit member"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
              Showing {members.length} of {metrics.totalWorkforce} workforce records
            </span>
          </div>
        </div>
      )}

      {/* Interactive Modals */}
      <AddWorkforceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreated={(msg) => {
          showToast(msg);
          fetchWorkforce(true);
        }}
      />

      <EditWorkforceModal
        member={editingMember}
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        onUpdated={(msg) => {
          showToast(msg);
          fetchWorkforce(true);
        }}
      />

      <WorkforceDetailModal
        member={viewingMember}
        isOpen={Boolean(viewingMember)}
        onClose={() => setViewingMember(null)}
        onOpenEdit={(m) => setEditingMember(m)}
        onOpenAssign={(m) => setAssigningMember(m)}
      />

      <AssignWorkerModal
        member={assigningMember}
        isOpen={Boolean(assigningMember)}
        onClose={() => setAssigningMember(null)}
        onAssigned={(msg) => {
          showToast(msg);
          fetchWorkforce(true);
        }}
      />
    </div>
  );
};

export default WorkforceModule;
