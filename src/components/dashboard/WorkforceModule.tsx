import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Shield,
  Mail,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  WorkforceService,
  PersonnelRecord,
  PersonnelDirectoryMetrics,
  ALL_NINE_ROLES,
  WorkforceMemberRecord,
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
  const location = useLocation();

  const isManagementRoute = location.pathname.startsWith('/management');
  const isExecutiveRoute = location.pathname.startsWith('/executive');
  const baseStaffPath = isManagementRoute
    ? '/management/workforce'
    : isExecutiveRoute
    ? '/executive/workforce'
    : '/admin/workforce';

  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [metrics, setMetrics] = useState<PersonnelDirectoryMetrics>({
    totalPersonnel: 0,
    activePersonnel: 0,
    suspendedPersonnel: 0,
    assignedPersonnel: 0,
    availablePersonnel: 0,
    byRoleCount: {
      management: 0,
      executive_director: 0,
      admin: 0,
      technical: 0,
      supervisor: 0,
      procurement: 0,
      accounts: 0,
      artisan: 0,
      social_media_manager: 0,
    },
  });
  const [uniqueTrades, setUniqueTrades] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
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

  // Complete personnel fetch
  const fetchPersonnel = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const res = await WorkforceService.getCompletePersonnelDirectory({
        search: searchQuery,
        role: roleFilter,
        status: statusFilter,
        trade: tradeFilter,
        assignmentStatus: assignmentFilter,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setPersonnel(res.data);
        setMetrics(res.metrics);
        setUniqueTrades(res.uniqueTrades);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [searchQuery, roleFilter, statusFilter, tradeFilter, assignmentFilter]
  );

  useEffect(() => {
    fetchPersonnel();
  }, [fetchPersonnel]);

  // Role badge helper
  const getRoleConfig = (slug: string) => {
    return (
      ALL_NINE_ROLES.find((r) => r.slug === slug) || {
        slug,
        name: slug.replace(/_/g, ' '),
        department: 'General',
        badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
      }
    );
  };

  const statusBadge = (st: string) => {
    switch (st.toLowerCase()) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'suspended':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'inactive':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#18b892]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18b892] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#18b892]">
                ENTERPRISE STAFF &amp; PERSONNEL ROSTER
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Users className="w-7 h-7 text-[#18b892]" />
              <span>Staff Directory</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Complete visibility across all nine roles, administrative staff, site supervisors, artisans, and deployment records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchPersonnel(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh personnel from database"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#18b892] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Register Staff</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <WorkforceNavTabs activeTab="directory" />

      {/* Summary KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL STAFF
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {metrics.totalPersonnel}
          </span>
          <span className="text-[11px] text-slate-500">Across all 9 roles</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            ACTIVE STAFF
          </span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block font-mono">
            {metrics.activePersonnel}
          </span>
          <span className="text-[11px] text-emerald-600 font-medium">Verified active</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            ON SITE DEPLOYED
          </span>
          <span className="text-2xl font-bold text-blue-700 mt-1 block font-mono">
            {metrics.assignedPersonnel}
          </span>
          <span className="text-[11px] text-blue-600 font-medium">Assigned to projects</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            AVAILABLE
          </span>
          <span className="text-2xl font-bold text-[#18b892] mt-1 block font-mono">
            {metrics.availablePersonnel}
          </span>
          <span className="text-[11px] text-slate-500">Ready for assignment</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            SUSPENDED
          </span>
          <span className="text-2xl font-bold text-rose-600 mt-1 block font-mono">
            {metrics.suspendedPersonnel}
          </span>
          <span className="text-[11px] text-rose-500">Access revoked</span>
        </div>
      </div>

      {/* Role Distribution Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
          Role Breakdown ({ALL_NINE_ROLES.length} System Roles)
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All Roles ({metrics.totalPersonnel})
          </button>
          {ALL_NINE_ROLES.map((r) => {
            const count = metrics.byRoleCount[r.slug] || 0;
            const isSelected = roleFilter === r.slug;
            return (
              <button
                key={r.slug}
                type="button"
                onClick={() => setRoleFilter(r.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#18b892] text-white border-[#18b892] shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <span>{r.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, phone, trade, role, code or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#18b892] transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Status Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('suspended')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                statusFilter === 'suspended' ? 'bg-rose-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Suspended
            </button>
          </div>

          {/* Trade Filter */}
          {uniqueTrades.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Trade:</span>
              <select
                value={tradeFilter}
                onChange={(e) => setTradeFilter(e.target.value)}
                className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
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
              className="h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
            >
              <option value="all">All Staff</option>
              <option value="assigned">Assigned to Project</option>
              <option value="available">Available (Unassigned)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load staff records.</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            {errorMessage}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fetchPersonnel(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      ) : personnel.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#18b892] flex items-center justify-center mx-auto mb-4 border border-[#18b892]/20">
            <Users className="w-7 h-7" strokeWidth={1.8} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">No staff match current filters</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Try adjusting your role or status filter to see other staff across Davejoe Interiors.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                setRoleFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
                setAssignmentFilter('all');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 font-bold">Personnel</th>
                  <th className="py-3.5 px-3 font-bold">Role &amp; Department</th>
                  <th className="py-3.5 px-3 font-bold">Contact Details</th>
                  <th className="py-3.5 px-3 font-bold">Status</th>
                  <th className="py-3.5 px-3 font-bold">Current Deployment</th>
                  <th className="py-3.5 px-3 font-bold">Staff ID / Code</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {personnel.map((person) => {
                  const roleCfg = getRoleConfig(person.primaryRoleSlug);
                  const activeAssign = person.activeAssignment;

                  return (
                    <tr
                      key={person.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        if (person.workforceId) {
                          navigate(`${baseStaffPath}/${person.workforceId}`);
                        }
                      }}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 text-[#18b892] flex items-center justify-center font-bold text-xs shrink-0 border border-[#18b892]/20">
                            {person.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 group-hover:text-[#18b892] transition-colors truncate">
                              {person.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                              {person.email ? (
                                <span className="flex items-center gap-1 truncate text-slate-500">
                                  <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                  {person.email}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">No email record</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Department */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleCfg.badgeClasses}`}
                          >
                            <Shield className="w-3 h-3 shrink-0" />
                            {roleCfg.name}
                          </span>
                          <div className="text-[10.5px] text-slate-400 font-medium">
                            {person.department} • {person.trade}
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-3">
                        <div className="space-y-0.5 font-mono text-[11px] text-slate-700">
                          {person.phone ? (
                            <div className="flex items-center gap-1 text-slate-700">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{person.phone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic font-sans">No phone</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border capitalize ${statusBadge(
                            person.status
                          )}`}
                        >
                          {person.status}
                        </span>
                      </td>

                      {/* Current Deployment */}
                      <td className="py-3.5 px-3">
                        {activeAssign ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              {activeAssign.projects?.project_code || 'PRJ'}
                            </span>
                            <span className="font-medium text-slate-900 truncate max-w-[150px]">
                              {activeAssign.projects?.name || 'Assigned Site'}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Available
                          </span>
                        )}
                      </td>

                      {/* Workforce Code */}
                      <td className="py-3.5 px-3">
                        {person.workforceCode ? (
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                            {person.workforceCode}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Office Account</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {person.workforceId ? (
                            <button
                              type="button"
                              onClick={() => navigate(`${baseStaffPath}/${person.workforceId}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#18b892]/10 hover:bg-[#18b892]/20 text-[#18b892] text-[11px] font-bold transition-colors cursor-pointer border border-[#18b892]/20"
                              title="Open Staff Control Centre"
                            >
                              <span>Control Centre</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium px-2 py-1 bg-slate-50 rounded">
                              System User
                            </span>
                          )}
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
              Showing {personnel.length} of {metrics.totalPersonnel} total staff records
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
          fetchPersonnel(true);
        }}
      />

      <EditWorkforceModal
        member={editingMember}
        isOpen={Boolean(editingMember)}
        onClose={() => setEditingMember(null)}
        onUpdated={(msg) => {
          showToast(msg);
          fetchPersonnel(true);
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
          fetchPersonnel(true);
        }}
      />
    </div>
  );
};

export default WorkforceModule;
