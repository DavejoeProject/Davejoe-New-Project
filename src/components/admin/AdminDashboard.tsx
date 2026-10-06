import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { AdminService } from '../../services/adminService';
import { UserManagementView } from './UserManagementView';
import { RolesPermissionsView } from './RolesPermissionsView';
import { AuditLogsView } from './AuditLogsView';
import { SystemSettingsView } from './SystemSettingsView';
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
  ArrowRight,
  Plus,
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
  const location = useLocation();
  const navigate = useNavigate();

  // Resolve active tab from URL path
  const resolveTabFromPath = (path: string): AdminTab => {
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/roles')) return 'roles';
    if (path.includes('/admin/audit-logs')) return 'audit-logs';
    if (path.includes('/admin/settings')) return 'settings';
    if (path.includes('/admin/workforce')) return 'workforce';
    if (path.includes('/admin/projects')) return 'projects';
    if (path.includes('/admin/clients')) return 'clients';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => resolveTabFromPath(location.pathname));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync tab state when URL changes
  useEffect(() => {
    const tabFromUrl = resolveTabFromPath(location.pathname);
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location.pathname]);

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    if (tab === 'dashboard') {
      navigate('/admin');
    } else {
      navigate(`/admin/${tab}`);
    }
  };

  // Real Database Counts
  const [metrics, setMetrics] = useState({
    usersCount: 0,
    workforceCount: 0,
    projectsCount: 0,
    rolesCount: 0,
    recentAuditCount: 0,
  });

  // Real Database Records
  const [usersList, setUsersList] = useState<any[]>([]);
  const [workforceList, setWorkforceList] = useState<any[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);

  const fetchAdminData = async () => {
    try {
      // Fetch counts & records concurrently from real Supabase tables
      const [
        { count: uCount, data: uData },
        { count: wCount, data: wData },
        { count: pCount, data: pData },
        { count: rCount, data: rData },
        { count: aCount, data: aData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact' }).limit(10),
        supabase.from('workforce_members').select('*', { count: 'exact' }).limit(10),
        supabase.from('projects').select('*', { count: 'exact' }).limit(10),
        supabase.from('roles').select('*', { count: 'exact' }).limit(20),
        supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(6),
      ]);

      setMetrics({
        usersCount: uCount || (uData ? uData.length : 0),
        workforceCount: wCount || (wData ? wData.length : 0),
        projectsCount: pCount || (pData ? pData.length : 0),
        rolesCount: rCount || (rData ? rData.length : 0),
        recentAuditCount: aCount || (aData ? aData.length : 0),
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
    { key: 'roles', label: 'Roles & Permissions', icon: ShieldCheck },
    { key: 'audit-logs', label: 'Audit Logs', icon: FileText },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'workforce', label: 'Workforce', icon: HardHat },
    { key: 'projects', label: 'Projects', icon: FolderKanban },
    { key: 'clients', label: 'Clients', icon: Building2 },
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
              System Control Centre
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectTab(item.key)}
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

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 px-6 sm:px-8 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'Admin Dashboard'}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'roles' && 'Roles & Permissions'}
              {activeTab === 'audit-logs' && 'Audit Logs'}
              {activeTab === 'settings' && 'Administration Settings'}
              {activeTab === 'workforce' && 'Workforce Registry'}
              {activeTab === 'projects' && 'Enterprise Projects'}
              {activeTab === 'clients' && 'Client Management'}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              {activeTab === 'dashboard' && 'Manage users, access, system configuration and administrative operations.'}
              {activeTab === 'users' && 'Manage users, profiles, roles and system access.'}
              {activeTab === 'roles' && 'Role-Based Access Control configuration, permissions and security boundaries.'}
              {activeTab === 'audit-logs' && 'Read-only security logs and chronological operational history.'}
              {activeTab === 'settings' && 'System configuration, live Supabase connectivity and diagnostics.'}
              {activeTab === 'workforce' && 'Artisans and workforce members configured in Davejoe.'}
              {activeTab === 'projects' && 'Enterprise construction and civil engineering projects.'}
              {activeTab === 'clients' && 'Corporate and residential client accounts.'}
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
                <div
                  onClick={() => handleSelectTab('users')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      User Accounts
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.usersCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Authenticated profiles</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>

                <div
                  onClick={() => handleSelectTab('roles')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      System Roles
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.rolesCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Configured RBAC roles</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>

                <div
                  onClick={() => handleSelectTab('audit-logs')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      Audit Logs
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.recentAuditCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Logged audit events</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>

                <div
                  onClick={() => handleSelectTab('settings')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      System Status
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-[#01875F]">
                    Online
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Supabase RLS active</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>
              </div>

              {/* Administrative Overview Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Roles Quick View */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Configured System Roles
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('roles')}
                      className="text-xs font-semibold text-[#01875F] hover:underline"
                    >
                      Manage RBAC &rarr;
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
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700 font-semibold">
                              {r.slug}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {r.description || 'System access role'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Audit Logs Quick View */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      Recent Audit Activities
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('audit-logs')}
                      className="text-xs font-semibold text-[#01875F] hover:underline"
                    >
                      View all logs &rarr;
                    </button>
                  </div>

                  {auditLogsList.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No audit activities logged yet in database.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogsList.slice(0, 5).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-semibold text-slate-800 block truncate">
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              Module: {log.module}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 9.7A USER MANAGEMENT */}
          {activeTab === 'users' && (
            <UserManagementView
              allRoles={rolesList}
              onStatsRefresh={fetchAdminData}
            />
          )}

          {/* TAB 3: 9.7B ROLES & PERMISSIONS */}
          {activeTab === 'roles' && (
            <RolesPermissionsView
              initialRoles={rolesList}
              onStatsRefresh={fetchAdminData}
            />
          )}

          {/* TAB 4: 9.7C AUDIT LOGS */}
          {activeTab === 'audit-logs' && <AuditLogsView />}

          {/* TAB 5: 9.7D SETTINGS */}
          {activeTab === 'settings' && <SystemSettingsView />}

          {/* TAB 6: WORKFORCE */}
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

          {/* TAB 7: PROJECTS */}
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

          {/* TAB 8: CLIENTS */}
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
        </div>
      </main>
    </div>
  );
};
