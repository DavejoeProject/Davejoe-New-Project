import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminService,
  AdminRoleItem,
  AdminPermissionItem,
} from '../../services/adminService';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  AlertTriangle,
  Info,
  CheckCircle2,
  Users,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface RolesPermissionsViewProps {
  initialRoles?: AdminRoleItem[];
  onStatsRefresh?: () => void;
}

export const RolesPermissionsView: React.FC<RolesPermissionsViewProps> = ({
  initialRoles,
  onStatsRefresh,
}) => {
  const [roles, setRoles] = useState<AdminRoleItem[]>(initialRoles || []);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [allPermissions, setAllPermissions] = useState<AdminPermissionItem[]>([]);
  const [permissionsByModule, setPermissionsByModule] = useState<Record<string, AdminPermissionItem[]>>({});
  const [assignedPermissionNames, setAssignedPermissionNames] = useState<Set<string>>(new Set());

  const [isLoadingRoles, setIsLoadingRoles] = useState<boolean>(true);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState<boolean>(false);
  const [isModifyingPermission, setIsModifyingPermission] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search filter for permissions
  const [permissionSearch, setPermissionSearch] = useState<string>('');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>('all');

  // 1. Fetch Roles and System Permissions
  const loadRolesAndPermissions = useCallback(async () => {
    setIsLoadingRoles(true);
    setErrorMessage(null);
    try {
      const [fetchedRoles, fetchedPerms] = await Promise.all([
        AdminService.getRoles(),
        AdminService.getAllPermissions(),
      ]);

      setRoles(fetchedRoles);
      setAllPermissions(fetchedPerms.all);
      setPermissionsByModule(fetchedPerms.byModule);

      // Default select admin or first role
      if (fetchedRoles.length > 0 && !selectedRoleId) {
        const adminRole = fetchedRoles.find((r) => r.slug === 'admin') || fetchedRoles[0];
        setSelectedRoleId(adminRole.id);
      }
    } catch (err: any) {
      console.error('[RolesPermissionsView] Error loading data:', err);
      setErrorMessage(err?.message || 'Failed to load roles and permissions from database.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadRolesAndPermissions();
  }, [loadRolesAndPermissions]);

  // 2. Fetch assigned permissions whenever selectedRoleId changes
  useEffect(() => {
    if (!selectedRoleId) return;

    let isMounted = true;
    async function fetchRolePerms() {
      setIsLoadingPermissions(true);
      setErrorMessage(null);
      try {
        const perms = await AdminService.getRolePermissions(selectedRoleId);
        if (isMounted) {
          setAssignedPermissionNames(new Set(perms));
        }
      } catch (err: any) {
        console.warn('Error fetching role permissions:', err);
        if (isMounted) {
          setErrorMessage(err?.message || 'Could not load permissions for selected role.');
        }
      } finally {
        if (isMounted) setIsLoadingPermissions(false);
      }
    }

    fetchRolePerms();
    return () => {
      isMounted = false;
    };
  }, [selectedRoleId]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  // 3. Handle Permission Toggle
  const handleTogglePermission = async (perm: AdminPermissionItem) => {
    if (!selectedRole || isModifyingPermission) return;

    const isAssigned = assignedPermissionNames.has(perm.name);
    setIsModifyingPermission(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isAssigned) {
        // Remove permission
        await AdminService.removeRolePermission(
          selectedRole.id,
          perm.id,
          selectedRole.slug,
          perm.name
        );
        const updated = new Set(assignedPermissionNames);
        updated.delete(perm.name);
        setAssignedPermissionNames(updated);
        setSuccessMessage(`Permission "${perm.name}" revoked from ${selectedRole.name}.`);
      } else {
        // Assign permission
        await AdminService.assignRolePermission(
          selectedRole.id,
          perm.id,
          selectedRole.slug,
          perm.name
        );
        const updated = new Set(assignedPermissionNames);
        updated.add(perm.name);
        setAssignedPermissionNames(updated);
        setSuccessMessage(`Permission "${perm.name}" assigned to ${selectedRole.name}.`);
      }

      setTimeout(() => setSuccessMessage(null), 3000);
      if (onStatsRefresh) onStatsRefresh();
    } catch (err: any) {
      console.error('[RolesPermissionsView] Toggle error:', err);
      setErrorMessage(err?.message || 'Failed to update permission assignment.');
    } finally {
      setIsModifyingPermission(false);
    }
  };

  const modules = Object.keys(permissionsByModule);

  // Filter modules and permissions by search
  const filteredModules = modules.filter((mod) => {
    if (selectedModuleFilter !== 'all' && selectedModuleFilter !== mod) return false;
    if (!permissionSearch.trim()) return true;

    const term = permissionSearch.toLowerCase();
    const permsInMod = permissionsByModule[mod] || [];
    return permsInMod.some(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Roles & Permissions (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Role-Based Access Control configuration, system permission matrices, and security policies.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRolesAndPermissions}
          disabled={isLoadingRoles}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoles ? 'animate-spin text-[#01875F]' : ''}`} />
          <span>Refresh Matrix</span>
        </button>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-[#01875F] flex items-center gap-2.5 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#01875F] shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grid: Left Column = Roles List, Right Column = Permission Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: ROLES LIST (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#01875F]" />
                <span>Configured Roles ({roles.length})</span>
              </h3>
              <span className="text-[10px] font-semibold text-slate-400">public.roles</span>
            </div>

            {isLoadingRoles ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading roles...</div>
            ) : roles.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No roles found in public.roles.
              </div>
            ) : (
              <div className="space-y-2">
                {roles.map((r) => {
                  const isSelected = selectedRoleId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoleId(r.id)}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-[#01875F] bg-emerald-50/40 shadow-xs ring-1 ring-[#01875F]/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-xs truncate ${
                              isSelected ? 'text-[#01875F]' : 'text-slate-800'
                            }`}
                          >
                            {r.name}
                          </span>
                          {r.is_system_role && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                              System
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] text-slate-400">
                            slug: {r.slug}
                          </span>
                          <span className="text-[10px] text-slate-400">&bull;</span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {r.assigned_users_count} {r.assigned_users_count === 1 ? 'user' : 'users'}
                          </span>
                        </div>

                        {r.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-1">
                            {r.description}
                          </p>
                        )}
                      </div>

                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isSelected ? 'text-[#01875F] translate-x-0.5' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Authoritative Security Architecture Notice */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <Info className="w-4 h-4 text-[#01875F]" />
              <span>Authoritative Role Model</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Davejoe authorization strictly resolves through database foreign keys:
            </p>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-[10px] text-slate-700 space-y-0.5">
              <div>auth.users (id)</div>
              <div className="text-slate-400 pl-3">&darr; public.user_roles</div>
              <div>public.roles (id, slug)</div>
              <div className="text-[#01875F] font-bold pl-3">&rArr; role.slug = 'admin'</div>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Human-readable titles are for presentation only. Permission checking relies on stable slugs.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: PERMISSION MATRIX (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            {/* Selected Role Header */}
            {selectedRole ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {selectedRole.name}
                    </h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                      {selectedRole.slug}
                    </span>
                    {selectedRole.slug === 'admin' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                        Primary System Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedRole.description || 'Configured role within Davejoe Management Tool.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                    {assignedPermissionNames.size} of {allPermissions.length} permissions
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Select a role on the left to configure permissions.
              </div>
            )}

            {/* Filter / Search within permissions */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
              <div className="sm:col-span-8 relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Filter permissions by name or description..."
                  className="w-full pl-8 pr-3 h-8.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-[#01875F]"
                />
              </div>

              <div className="sm:col-span-4">
                <select
                  value={selectedModuleFilter}
                  onChange={(e) => setSelectedModuleFilter(e.target.value)}
                  className="w-full h-8.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] cursor-pointer"
                >
                  <option value="all">All Modules ({modules.length})</option>
                  {modules.map((m) => (
                    <option key={m} value={m}>
                      {m.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Permissions List grouped by module */}
            {isLoadingPermissions ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin" />
                <span>Loading assigned permissions...</span>
              </div>
            ) : allPermissions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No permissions registered in public.permissions table.
              </div>
            ) : filteredModules.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No permissions matched your filter "{permissionSearch}".
              </div>
            ) : (
              <div className="space-y-6 pt-2">
                {filteredModules.map((mod) => {
                  const perms = permissionsByModule[mod] || [];
                  const activeInMod = perms.filter((p) => assignedPermissionNames.has(p.name)).length;

                  return (
                    <div
                      key={mod}
                      className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs"
                    >
                      {/* Module Header */}
                      <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-[#01875F]" />
                          <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                            {mod}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {activeInMod} / {perms.length} granted
                        </span>
                      </div>

                      {/* Permissions in Module */}
                      <div className="divide-y divide-slate-100">
                        {perms.map((perm) => {
                          const isAssigned = assignedPermissionNames.has(perm.name);
                          const isProtectedAdminPerm =
                            selectedRole?.slug === 'admin' &&
                            ['roles.manage', 'users.manage', 'users.view', 'audit.view'].includes(perm.name);

                          return (
                            <div
                              key={perm.id}
                              className={`p-3.5 flex items-center justify-between gap-4 transition-colors ${
                                isAssigned ? 'bg-emerald-50/20' : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-900">
                                    {perm.name}
                                  </span>
                                  {isAssigned && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100 text-[#01875F]">
                                      <Check className="w-3 h-3" />
                                      Granted
                                    </span>
                                  )}
                                  {isProtectedAdminPerm && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                                      Core Protection
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {perm.description || `Grants access to ${perm.name} operations.`}
                                </p>
                              </div>

                              {/* Toggle Checkbox / Button */}
                              <button
                                type="button"
                                disabled={isModifyingPermission}
                                onClick={() => handleTogglePermission(perm)}
                                title={
                                  isProtectedAdminPerm
                                    ? 'Core Admin permission protected against removal'
                                    : isAssigned
                                    ? 'Click to Revoke'
                                    : 'Click to Grant'
                                }
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                  isAssigned ? 'bg-[#01875F]' : 'bg-slate-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                    isAssigned ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
