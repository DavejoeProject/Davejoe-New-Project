import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  Users,
  HardHat,
  FolderKanban,
  Building2,
  ShieldCheck,
  FileText,
  Settings,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

type AdminTab =
  | 'dashboard'
  | 'users'
  | 'workforce'
  | 'projects'
  | 'clients'
  | 'roles'
  | 'audit-logs'
  | 'settings';

export const AdminDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real Database Counts
  const [metrics, setMetrics] = useState({
    usersCount: 0,
    workforceCount: 0,
    projectsCount: 0,
    rolesCount: 0,
  });

  // Real Database Records
  const [usersList, setUsersList] = useState<any[]>([]);
  const [workforceList, setWorkforceList] = useState<any[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);

  const fetchAdminData = async () => {
    try {
      // 1. Fetch counts & records concurrently from real Supabase tables
      const [
        { count: uCount, data: uData },
        { count: wCount, data: wData },
        { count: pCount, data: pData },
        { count: rCount, data: rData },
        { data: aData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact' }).limit(10),
        supabase.from('workforce_members').select('*', { count: 'exact' }).limit(10),
        supabase.from('projects').select('*', { count: 'exact' }).limit(10),
        supabase.from('roles').select('*', { count: 'exact' }).limit(15),
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      setMetrics({
        usersCount: uCount || (uData ? uData.length : 0),
        workforceCount: wCount || (wData ? wData.length : 0),
        projectsCount: pCount || (pData ? pData.length : 0),
        rolesCount: rCount || (rData ? rData.length : 0),
      });

      setUsersList(uData || []);
      setWorkforceList(wData || []);
      setProjectsList(pData || []);
      setRolesList(rData || []);
      setAuditLogsList(aData || []);
    } catch (err) {
      console.warn('[AdminDashboard] Error loading administrative records:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAdminData();
  };

  const navItems: { key: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'workforce', label: 'Workforce', icon: HardHat },
    { key: 'projects', label: 'Projects', icon: FolderKanban },
    { key: 'clients', label: 'Clients', icon: Building2 },
    { key: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
    { key: 'audit-logs', label: 'Audit Logs', icon: FileText },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  const adminDisplayName = profile?.display_name || user?.email?.split('@')[0] || 'Administrator';

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col md:flex-row text-slate-800 font-sans selection:bg-[#01875F]/20 selection:text-[#01875F]">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200/90 flex flex-col shrink-0">
        {/* Brand Lockup */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-xs bg-white border border-slate-100 shrink-0">
              <img src="/favicon.png" alt="Davejoe" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-[15px] leading-tight">
                Davejoe
              </span>
              <span className="text-[10px] font-semibold text-[#01875F] tracking-wider uppercase leading-tight">
                Administration
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="p-3.5 flex-1 flex flex-col justify-between overflow-y-auto">
          <nav className="space-y-1">
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Administration
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#01875F] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Account / Sign Out */}
          <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#01875F]/10 text-[#01875F] flex items-center justify-center text-xs font-bold shrink-0">
                {adminDisplayName[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                  {adminDisplayName}
                </p>
                <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => logout()}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left"
            >
              <LogOut className="w-4 h-4 text-red-500 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 px-6 sm:px-8 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              Manage users, access, system configuration and administrative operations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Records"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
              <span>Refresh</span>
            </button>

            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
              Admin Active
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-w-7xl w-full">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Metric KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      User Accounts
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.usersCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Authenticated user profiles
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Workforce
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                      <HardHat className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.workforceCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Registered workforce members
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Projects
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <FolderKanban className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.projectsCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Active enterprise projects
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      System Roles
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.rolesCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Configured RBAC roles
                  </p>
                </div>
              </div>

              {/* Administrative Overview Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Roles Quick View */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Configured System Roles
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('roles')}
                      className="text-xs font-semibold text-[#01875F] hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  {rolesList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No system roles found in public.roles.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rolesList.slice(0, 5).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{r.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700">
                              {r.slug}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {r.description || 'System role'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Projects Quick View */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Recent Projects
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('projects')}
                      className="text-xs font-semibold text-[#01875F] hover:underline"
                    >
                      View all
                    </button>
                  </div>

                  {projectsList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No projects currently logged in database.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {projectsList.slice(0, 5).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <span className="font-semibold text-slate-800">{p.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                            {p.status || 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">User Accounts</h2>
                  <p className="text-xs text-slate-500">
                    Accounts registered in Supabase user profiles and roles.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total: {metrics.usersCount}
                </span>
              </div>

              {usersList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No users recorded yet in the profiles table.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email / Title</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {u.email || u.job_title || '—'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              {u.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                            {u.id.slice(0, 8)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WORKFORCE */}
          {activeTab === 'workforce' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Workforce Registry</h2>
                  <p className="text-xs text-slate-500">
                    Artisans and workforce members configured in Davejoe.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total: {metrics.workforceCount}
                </span>
              </div>

              {workforceList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No workforce members registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Trade / Role</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {workforceList.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800">{w.name || w.full_name}</td>
                          <td className="py-3 px-3 text-slate-600">{w.trade || w.role || 'General'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                              {w.status || 'Available'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PROJECTS */}
          {activeTab === 'projects' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Enterprise Projects</h2>
                  <p className="text-xs text-slate-500">
                    Construction and project records in Davejoe.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total: {metrics.projectsCount}
                </span>
              </div>

              {projectsList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No projects recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Project</th>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectsList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-800">{p.name}</td>
                          <td className="py-3 px-3 text-slate-600">{p.location || '—'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                              {p.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CLIENTS */}
          {activeTab === 'clients' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Client Management</h2>
                <p className="text-xs text-slate-500">
                  Corporate and residential client accounts.
                </p>
              </div>
              <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No client records configured yet in the database.
              </div>
            </div>
          )}

          {/* TAB 6: ROLES & PERMISSIONS */}
          {activeTab === 'roles' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Roles & Permissions (RBAC)</h2>
                <p className="text-xs text-slate-500">
                  Role-based access control structures defined in Supabase public.roles.
                </p>
              </div>

              {rolesList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No roles found in public.roles table.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Role Name</th>
                        <th className="py-2.5 px-3">Slug</th>
                        <th className="py-2.5 px-3">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rolesList.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-bold text-slate-800">{r.name}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 font-semibold">
                              {r.slug}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">{r.description || 'System access role'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: AUDIT LOGS */}
          {activeTab === 'audit-logs' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">System Audit Logs</h2>
                <p className="text-xs text-slate-500">
                  Security logs and access events recorded across operations.
                </p>
              </div>

              {auditLogsList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No audit logs currently recorded.
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogsList.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">{log.action}</span>
                        <span className="text-slate-400 ml-2">({log.module || 'auth'})</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 8: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">System Configuration</h2>
                <p className="text-xs text-slate-500">
                  Global parameters for Davejoe Management Tool.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Application Identity</span>
                  <span className="font-semibold text-slate-800">Davejoe Management Tool</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                  <span className="text-slate-500">Primary Color Theme</span>
                  <span className="font-semibold text-[#01875F]">#01875F (Emerald)</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Security Boundary</span>
                  <span className="font-semibold text-slate-800">Supabase Row-Level Security (RLS)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
