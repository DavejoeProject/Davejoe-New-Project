import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AdminService, AdminUserListItem, AdminRoleItem, AuditLogEntry } from '../../services/adminService';
import {
  X,
  User,
  Shield,
  ShieldAlert,
  HardHat,
  Clock,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
} from 'lucide-react';

interface UserControlCentreProps {
  user: AdminUserListItem;
  allRoles: AdminRoleItem[];
  onClose: () => void;
  onUserUpdated: () => void;
}

export const UserControlCentre: React.FC<UserControlCentreProps> = ({
  user,
  allRoles,
  onClose,
  onUserUpdated,
}) => {
  const { currentRoleKey } = useAuth();
  const canAssignRoles = currentRoleKey === 'management' || currentRoleKey === 'executive_director';

  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'status' | 'audit'>('profile');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);

  // Profile Form State
  const [firstName, setFirstName] = useState(user.first_name || '');
  const [lastName, setLastName] = useState(user.last_name || '');
  const [displayName, setDisplayName] = useState(user.display_name || '');
  const [jobTitle, setJobTitle] = useState(user.job_title || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Status State
  const [currentStatus, setCurrentStatus] = useState(user.status);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Role Assignment State
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<string>('');
  const [isModifyingRole, setIsModifyingRole] = useState(false);
  const [roleActionError, setRoleActionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetails() {
      setIsLoadingDetails(true);
      try {
        const { recentAuditLogs } = await AdminService.getUserDetails(user.id);
        setRecentLogs(recentAuditLogs);
      } catch (err) {
        console.warn('Error loading user audit history:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    }
    loadDetails();
  }, [user.id]);

  // Handle Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSaveSuccess(false);

    try {
      await AdminService.updateUserProfile(user.id, {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        job_title: jobTitle,
      });
      setProfileSaveSuccess(true);
      onUserUpdated();
      setTimeout(() => setProfileSaveSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update user profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const [statusSuccessMessage, setStatusSuccessMessage] = useState<string | null>(null);

  // Handle Status Change
  const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'suspended' | 'pending') => {
    if (newStatus === currentStatus) return;

    setIsChangingStatus(true);
    setStatusError(null);
    setStatusSuccessMessage(null);

    try {
      await AdminService.updateUserStatus(user.id, newStatus);
      setCurrentStatus(newStatus);
      user.status = newStatus;
      setStatusSuccessMessage(`Account status updated to "${newStatus.toUpperCase()}" successfully.`);
      onUserUpdated();
      setTimeout(() => setStatusSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('[UserControlCentre] Error updating user status:', err);
      setStatusError(err?.message || 'Failed to update user status.');
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Handle Assign Role
  const handleAssignRole = async () => {
    if (!selectedRoleToAssign) return;
    if (!canAssignRoles) {
      setRoleActionError('Unauthorized: Only Management / CEO and Executive Director are permitted to assign roles.');
      return;
    }

    setIsModifyingRole(true);
    setRoleActionError(null);

    try {
      await AdminService.assignUserRole(user.id, selectedRoleToAssign);
      setSelectedRoleToAssign('');
      onUserUpdated();
    } catch (err: any) {
      setRoleActionError(err?.message || 'Failed to assign role.');
    } finally {
      setIsModifyingRole(false);
    }
  };

  // Handle Remove Role
  const handleRemoveRole = async (roleId: string, roleSlug: string) => {
    if (!canAssignRoles) {
      setRoleActionError('Unauthorized: Only Management / CEO and Executive Director are permitted to remove roles.');
      return;
    }

    setIsModifyingRole(true);
    setRoleActionError(null);

    try {
      await AdminService.removeUserRole(user.id, roleId, roleSlug);
      onUserUpdated();
    } catch (err: any) {
      setRoleActionError(err?.message || 'Failed to remove role.');
    } finally {
      setIsModifyingRole(false);
    }
  };

  // Available roles not yet assigned to user
  const assignedRoleIds = new Set(user.roles.map((r) => r.id));
  const availableRolesToAssign = allRoles.filter((r) => !assignedRoleIds.has(r.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-control-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-10 h-10 rounded-xl bg-[#01875F] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
              {(user.display_name || user.first_name || user.email || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 id="user-control-title" className="text-base font-bold text-slate-900 truncate tracking-tight">
                {user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User Profile'}
              </h2>
              <p className="text-xs text-slate-500 truncate">{user.email || 'No email registered'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 border-b border-slate-100 flex gap-2 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-[#01875F] text-[#01875F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`py-3 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'roles'
                ? 'border-[#01875F] text-[#01875F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Assigned Roles ({user.roles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'border-[#01875F] text-[#01875F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Status Control</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-[#01875F] text-[#01875F]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>User Audit Log</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: PROFILE DETAILS */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSaveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-[#01875F] rounded-xl flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Profile updated and audit event recorded successfully.</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Mayowa Adewuyi"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Title / Designation
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Project Manager, Site Engineer"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-medium block">User ID</span>
                  <span className="font-mono text-[11px] text-slate-700 select-all">{user.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Account Created</span>
                  <span className="text-slate-700">
                    {user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
                  </span>
                </div>
              </div>

              {user.workforce && (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-[#01875F]" />
                    <span className="font-semibold text-slate-800">Linked to Workforce Registry</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-[#01875F]">
                    {user.workforce.trade} ({user.workforce.workforce_code || 'No code'})
                  </span>
                </div>
              )}

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: ROLES & ACCESS */}
          {activeTab === 'roles' && (
            <div className="space-y-5">
              {roleActionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{roleActionError}</span>
                </div>
              )}

              {/* Current Roles */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Currently Assigned Roles
                </h3>
                {user.roles.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>No database roles assigned to this account. The user will encounter "Access not assigned yet" upon login.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {user.roles.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center font-bold">
                            <Shield className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{r.name}</span>
                            <span className="font-mono text-[10px] text-slate-400 font-medium">slug: {r.slug}</span>
                          </div>
                        </div>

                        {canAssignRoles && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRole(r.id, r.slug)}
                            disabled={isModifyingRole}
                            title="Remove Role"
                            className="px-2.5 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign New Role */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Assign Another Role
                </h3>
                {!canAssignRoles ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    Role assignments and modifications are restricted to Management / CEO and Executive Director — Business Operations & Strategy.
                  </div>
                ) : availableRolesToAssign.length === 0 ? (
                  <p className="text-xs text-slate-400">All system roles are already assigned to this account.</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedRoleToAssign}
                      onChange={(e) => setSelectedRoleToAssign(e.target.value)}
                      className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-[#01875F]"
                    >
                      <option value="">Select a role to assign...</option>
                      {availableRolesToAssign.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.slug})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleAssignRole}
                      disabled={!selectedRoleToAssign || isModifyingRole}
                      className="h-9 px-3.5 bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: STATUS CONTROL */}
          {activeTab === 'status' && (
            <div className="space-y-4">
              {statusError && (
                <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{statusError}</span>
                </div>
              )}

              {statusSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-[#01875F] rounded-xl flex items-center gap-2 font-semibold animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusSuccessMessage}</span>
                </div>
              )}

              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Current Account Status</span>
                  <span className="font-bold uppercase tracking-wider text-slate-800 text-xs">
                    {currentStatus}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border ${
                  currentStatus === 'active'
                    ? 'bg-emerald-50 text-[#01875F] border-emerald-200'
                    : currentStatus === 'suspended'
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : currentStatus === 'pending'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {currentStatus}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Authorized administrators (Management / CEO and Executive Director) can update account statuses. Setting an account to Active removes Auth bans and allows dashboard access; Suspend and Inactive enforce immediate server-side restrictions and revoke workspace access.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. ACTIVE */}
                <div
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                    currentStatus === 'active'
                      ? 'border-[#01875F] bg-emerald-50/40 ring-2 ring-[#01875F]/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        Active
                      </span>
                      {currentStatus === 'active' && (
                        <span className="text-[10px] font-bold text-[#01875F] bg-emerald-100 px-2 py-0.5 rounded-full">
                          Current Status
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Authorizes full access to assigned role workspaces. Removes any Supabase Auth ban so the user can log in normally.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isChangingStatus || currentStatus === 'active'}
                    onClick={() => handleStatusChange('active')}
                    className="w-full py-2 px-3 bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                  >
                    {currentStatus === 'active' ? 'Currently Active' : 'Set to Active'}
                  </button>
                </div>

                {/* 2. SUSPENDED */}
                <div
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                    currentStatus === 'suspended'
                      ? 'border-red-500 bg-red-50/40 ring-2 ring-red-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                        Suspended
                      </span>
                      {currentStatus === 'suspended' && (
                        <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                          Current Status
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Temporarily halts workspace access and applies server-side restrictions. Preserves profile and operational records for future reactivation.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isChangingStatus || currentStatus === 'suspended'}
                    onClick={() => handleStatusChange('suspended')}
                    className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                  >
                    {currentStatus === 'suspended' ? 'Currently Suspended' : 'Suspend Account'}
                  </button>
                </div>

                {/* 3. INACTIVE */}
                <div
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                    currentStatus === 'inactive'
                      ? 'border-slate-500 bg-slate-100/50 ring-2 ring-slate-400/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                        Inactive
                      </span>
                      {currentStatus === 'inactive' && (
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                          Current Status
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Deactivates account. Prevents normal logins and rejects session operations while keeping historical project records intact.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isChangingStatus || currentStatus === 'inactive'}
                    onClick={() => handleStatusChange('inactive')}
                    className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                  >
                    {currentStatus === 'inactive' ? 'Currently Inactive' : 'Set to Inactive'}
                  </button>
                </div>

                {/* 4. PENDING */}
                <div
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                    currentStatus === 'pending'
                      ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                        Pending
                      </span>
                      {currentStatus === 'pending' && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Current Status
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Awaiting verification. Access to role dashboards remains paused until an administrator activates the profile.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isChangingStatus || currentStatus === 'pending'}
                    onClick={() => handleStatusChange('pending')}
                    className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                  >
                    {currentStatus === 'pending' ? 'Currently Pending' : 'Set to Pending'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Recent security and administrative actions concerning this user account:
              </p>

              {isLoadingDetails ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading audit trail...</div>
              ) : recentLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No audit log entries recorded for this account yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{log.action}</span>
                        <span className="text-[10px] text-slate-400">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Module: {log.module}</span>
                        {log.table_name && <span>&bull; Table: {log.table_name}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
