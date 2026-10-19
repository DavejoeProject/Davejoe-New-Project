import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AdminService, AdminUserListItem, AdminRoleItem } from '../../services/adminService';
import { UserControlCentre } from './UserControlCentre';
import { CreateUserModal } from './CreateUserModal';
import {
  Search,
  Filter,
  RefreshCw,
  Users,
  Shield,
  HardHat,
  Clock,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  SlidersHorizontal,
  Sliders,
  UserCheck,
  Edit,
  ArrowUpDown,
  ShieldAlert,
  Plus,
  X,
  Check,
  UserPlus,
} from 'lucide-react';

interface UserManagementViewProps {
  allRoles: AdminRoleItem[];
  onStatsRefresh?: () => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  allRoles,
  onStatsRefresh,
}) => {
  const { currentRoleKey } = useAuth();
  const isAuthorizedLeadership =
    currentRoleKey === 'management' || currentRoleKey === 'executive_director';

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Create User Modal state
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);

  // Quick Assign Role Modal state
  const [assignRoleModalOpen, setAssignRoleModalOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState('');
  const [targetRoleId, setTargetRoleId] = useState('');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<'created_at' | 'name' | 'status'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Selected User for Control Centre Drawer / Modal
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);

  const fetchUsers = useCallback(async () => {
    setError(null);
    try {
      const { users: fetchedUsers, totalCount: count } = await AdminService.getUsers({
        search: searchQuery.trim(),
        roleSlug: selectedRole,
        status: selectedStatus,
        page: currentPage,
        limit: pageSize,
      });

      // Client-side sorting for display consistency
      let sorted = [...fetchedUsers];
      if (sortField === 'name') {
        sorted.sort((a, b) => {
          const nameA = (a.display_name || `${a.first_name || ''} ${a.last_name || ''}`).trim().toLowerCase();
          const nameB = (b.display_name || `${b.first_name || ''} ${b.last_name || ''}`).trim().toLowerCase();
          return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
      } else if (sortField === 'status') {
        sorted.sort((a, b) => {
          return sortDirection === 'asc'
            ? a.status.localeCompare(b.status)
            : b.status.localeCompare(a.status);
        });
      }

      setUsers(sorted);
      setTotalCount(count);
    } catch (err: any) {
      console.error('[UserManagementView] Error fetching users:', err);
      setError(err?.message || 'Failed to load user directory from database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, selectedRole, selectedStatus, currentPage, sortField, sortDirection]);

  useEffect(() => {
    setIsLoading(true);
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUsers();
    if (onStatsRefresh) onStatsRefresh();
  };

  const handleUserUpdated = async () => {
    await fetchUsers();
    if (selectedUser) {
      try {
        const { profile } = await AdminService.getUserDetails(selectedUser.id);
        if (profile) setSelectedUser(profile);
      } catch {
        // Ignored
      }
    }
    if (onStatsRefresh) onStatsRefresh();
  };

  const [updatingStatusUserId, setUpdatingStatusUserId] = useState<string | null>(null);
  const [statusSuccessToast, setStatusSuccessToast] = useState<string | null>(null);

  const handleQuickStatusChange = async (
    userId: string,
    newStatus: 'active' | 'inactive' | 'suspended' | 'pending'
  ) => {
    setUpdatingStatusUserId(userId);
    setError(null);
    try {
      await AdminService.updateUserStatus(userId, newStatus);
      setStatusSuccessToast(`Account status updated to ${newStatus.toUpperCase()}`);
      setTimeout(() => setStatusSuccessToast(null), 3500);
      await fetchUsers();
      if (onStatsRefresh) onStatsRefresh();
    } catch (err: any) {
      console.error('[UserManagementView] Error updating status:', err);
      setError(err?.message || 'Failed to update account status.');
    } finally {
      setUpdatingStatusUserId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3" />
            Inactive
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
            <AlertCircle className="w-3 h-3" />
            Suspended
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const handleQuickAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !targetRoleId) {
      setAssignError('Please select both a person and a role to assign.');
      return;
    }

    setIsSubmittingRole(true);
    setAssignError(null);
    setAssignSuccess(null);

    try {
      await AdminService.assignUserRole(targetUserId, targetRoleId);
      setAssignSuccess('Role assigned successfully!');
      await fetchUsers();
      if (onStatsRefresh) onStatsRefresh();
      setTimeout(() => {
        setAssignRoleModalOpen(false);
        setTargetUserId('');
        setTargetRoleId('');
        setAssignSuccess(null);
      }, 1500);
    } catch (err: any) {
      setAssignError(err?.message || 'Failed to assign role.');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  if (!isAuthorizedLeadership) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-600 mx-auto" />
        <h3 className="text-base font-bold text-amber-900">Restricted Leadership Workspace</h3>
        <p className="text-xs text-amber-700 max-w-md mx-auto">
          User directory and personnel role assignments are strictly restricted to Management / CEO and Executive Director — Business Operations & Strategy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">User Management & Role Governance</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#01875F] border border-emerald-200">
              Leadership Access
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage user accounts, assign database roles, configure profile details, and govern system access.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateUserModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create User Account</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAssignRoleModalOpen(true);
              setAssignError(null);
              setAssignSuccess(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#01875F]" />
            <span>Assign Role to Person</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, job title, or email..."
              className="w-full pl-9 pr-3 h-9 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] transition-all cursor-pointer"
            >
              <option value="all">All Roles</option>
              {allRoles.map((r) => (
                <option key={r.id} value={r.slug}>
                  {r.name} ({r.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] transition-all cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Sort Controls */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="flex-1 h-9 px-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] transition-all cursor-pointer"
            >
              <option value="created_at">Date Created</option>
              <option value="name">Full Name</option>
              <option value="status">Status</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={`Sorting: ${sortDirection.toUpperCase()}`}
              className="h-9 w-9 bg-slate-50/60 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Summary Badges */}
        {(searchQuery || selectedRole !== 'all' || selectedStatus !== 'all') && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                Search: "{searchQuery}"
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-red-500 cursor-pointer ml-0.5"
                >
                  &times;
                </button>
              </span>
            )}
            {selectedRole !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                Role: {selectedRole}
                <button
                  type="button"
                  onClick={() => setSelectedRole('all')}
                  className="hover:text-red-500 cursor-pointer ml-0.5"
                >
                  &times;
                </button>
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                Status: {selectedStatus}
                <button
                  type="button"
                  onClick={() => setSelectedStatus('all')}
                  className="hover:text-red-500 cursor-pointer ml-0.5"
                >
                  &times;
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedRole('all');
                setSelectedStatus('all');
              }}
              className="text-[#01875F] hover:underline text-[11px] font-semibold ml-auto cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Status Success Notice */}
      {statusSuccessToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-[#01875F] font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#01875F] shrink-0" />
            <span>{statusSuccessToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchUsers}
            className="text-red-700 font-semibold underline hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* User Directory Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Loading user directory from Supabase...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No users found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery || selectedRole !== 'all' || selectedStatus !== 'all'
                ? 'No user records matched your filter criteria. Try adjusting or resetting filters.'
                : 'No users recorded yet in the profiles table.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Job Title / Email</th>
                    <th className="py-3 px-4">Assigned Roles</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Workforce</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const fullName =
                      u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User';
                    const initial = fullName[0].toUpperCase();

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedUser(u)}
                      >
                        {/* User Identity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#01875F]/10 text-[#01875F] flex items-center justify-center font-bold text-xs shrink-0 border border-[#01875F]/20">
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 block truncate group-hover:text-[#01875F] transition-colors">
                                {fullName}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 block truncate select-all">
                                {u.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Title & Email */}
                        <td className="py-3.5 px-4">
                          <div className="min-w-0">
                            <span className="font-medium text-slate-800 block truncate">
                              {u.job_title || 'No Job Title'}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {u.email || '—'}
                            </span>
                          </div>
                        </td>

                        {/* Roles */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                None assigned
                              </span>
                            ) : (
                              u.roles.map((r) => (
                                <span
                                  key={r.id}
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    r.slug === 'admin'
                                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                      : r.slug === 'management'
                                      ? 'bg-emerald-50 text-[#01875F] border border-emerald-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                  }`}
                                >
                                  {r.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        {/* Status with Quick Controls */}
                        <td
                          className="py-3.5 px-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col gap-1.5 items-start">
                            <div className="flex items-center gap-1.5">
                              {getStatusBadge(u.status)}
                              {updatingStatusUserId === u.id && (
                                <div className="w-3 h-3 border-2 border-[#01875F]/30 border-t-[#01875F] rounded-full animate-spin shrink-0" />
                              )}
                            </div>

                            {isAuthorizedLeadership && (
                              <div className="flex items-center gap-1">
                                {u.status !== 'active' ? (
                                  <button
                                    type="button"
                                    disabled={updatingStatusUserId === u.id}
                                    onClick={() => handleQuickStatusChange(u.id, 'active')}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#01875F] hover:bg-[#00704e] text-white text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                                    title="Activate account workspace access"
                                  >
                                    <Check className="w-2.5 h-2.5" />
                                    <span>{u.status === 'pending' ? 'Activate' : 'Reactivate'}</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={updatingStatusUserId === u.id}
                                      onClick={() => handleQuickStatusChange(u.id, 'suspended')}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                                      title="Suspend user account"
                                    >
                                      Suspend
                                    </button>
                                    <button
                                      type="button"
                                      disabled={updatingStatusUserId === u.id}
                                      onClick={() => handleQuickStatusChange(u.id, 'inactive')}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                                      title="Deactivate user account"
                                    >
                                      Inactive
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Workforce Link */}
                        <td className="py-3.5 px-4">
                          {u.workforce ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              <HardHat className="w-3 h-3" />
                              {u.workforce.trade}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedUser(u);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#01875F] hover:text-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Manage</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                Showing{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(totalCount, (currentPage - 1) * pageSize + 1)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(totalCount, currentPage * pageSize)}
                </span>{' '}
                of <span className="font-semibold text-slate-800">{totalCount}</span> users
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="px-2 py-1 text-xs font-semibold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* User Control Centre Drawer / Modal */}
      {selectedUser && (
        <UserControlCentre
          user={selectedUser}
          allRoles={allRoles}
          onClose={() => setSelectedUser(null)}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {/* Quick Assign Role Modal */}
      {assignRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Assign Role to Person</h3>
                  <p className="text-[11px] text-slate-500">Executive authorization for role delegation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {assignError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            {assignSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#01875F] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{assignSuccess}</span>
              </div>
            )}

            <form onSubmit={handleQuickAssignRole} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  1. Select Person / User Account
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  required
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] transition-all cursor-pointer"
                >
                  <option value="">Select a user account...</option>
                  {users.map((u) => {
                    const name = u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || u.id;
                    const existingRoles = u.roles.map((r) => r.slug).join(', ') || 'No role';
                    return (
                      <option key={u.id} value={u.id}>
                        {name} ({u.email || 'No email'}) — [Current: {existingRoles}]
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  2. Select Role to Assign
                </label>
                <select
                  value={targetRoleId}
                  onChange={(e) => setTargetRoleId(e.target.value)}
                  required
                  className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] transition-all cursor-pointer"
                >
                  <option value="">Select database role...</option>
                  {allRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Only Management / CEO and Executive Director are authorized to delegate roles.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssignRoleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole || !targetUserId || !targetRoleId}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmittingRole ? 'Assigning Role...' : 'Confirm Role Assignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createUserModalOpen && (
        <CreateUserModal
          allRoles={allRoles}
          onClose={() => setCreateUserModalOpen(false)}
          onUserCreated={handleRefresh}
        />
      )}
    </div>
  );
};
