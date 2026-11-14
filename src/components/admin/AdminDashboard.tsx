import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { AdminService } from '../../services/adminService';
import { UserManagementView } from './UserManagementView';
import { RolesPermissionsView } from './RolesPermissionsView';
import { AuditLogsView } from './AuditLogsView';
import { SystemSettingsView } from './SystemSettingsView';
import { JobCompletionPhotoLibrary } from '../photos/JobCompletionPhotoLibrary';
import {
  LayoutDashboard,
  Users,
  HardHat,
  FolderKanban,
  Building2,
  Images,
  ShieldCheck,
  FileText,
  Settings,
  LogOut,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Menu,
  X,
  ShieldAlert,
  ArrowRight,
  Plus,
  RotateCcw,
  Wrench,
  ClipboardList,
  CalendarCheck,
  Boxes,
  Package,
  FileQuestion,
  Handshake,
} from 'lucide-react';
import { DailyAttendanceWidget } from '../attendance/DailyAttendanceWidget';
import { ProjectMaterialRemnantsModule } from '../remnants/ProjectMaterialRemnantsModule';
import { ToolsEquipmentModule } from '../tools/ToolsEquipmentModule';
import { TaskInstructionsPanel } from '../tasks/TaskInstructionsPanel';
import { ProjectsModule } from '../dashboard/ProjectsModule';
import { ProjectControlCentre } from '../dashboard/ProjectControlCentre';
import { AttendanceModule } from '../dashboard/AttendanceModule';
import { WorkforceModule } from '../dashboard/WorkforceModule';
import { WorkforceControlCentre } from '../dashboard/WorkforceControlCentre';
import { WorkforceService } from '../../services/workforceService';
import { ServiceRequestsModule } from './ServiceRequestsModule';
import { MaterialsDirectoryModule } from '../dashboard/MaterialsDirectoryModule';
import { AddMaterialModal } from '../dashboard/AddMaterialModal';
import { UnifiedInventoryModule } from '../inventory/UnifiedInventoryModule';
import { WorkforceDirectoryModule } from '../workforce/WorkforceDirectoryModule';
import { VendorsPartnersModule } from '../vendors/VendorsPartnersModule';
import { AccessDenied } from '../AccessDenied';

type AdminTab =
  | 'dashboard'
  | 'users'
  | 'workforce'
  | 'workforce-directory'
  | 'vendors-partners'
  | 'projects'
  | 'attendance'
  | 'clients'
  | 'roles'
  | 'audit-logs'
  | 'photos'
  | 'settings'
  | 'remnants'
  | 'tools'
  | 'tasks'
  | 'service-requests'
  | 'materials'
  | 'inventory';

export interface AdminDashboardProps {
  initialTab?: AdminTab | 'staff';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialTab }) => {
  const { user, profile, logout, hasAnyPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const canAccessWorkforceDirectory = hasAnyPermission([
    'View Workforce',
    'workforce.view',
    'Create Workforce',
    'workforce.create',
    'Update Workforce',
    'workforce.update',
    'Assign Workforce',
    'workforce.assign',
  ]);

  const canAccessVendorsPartners = hasAnyPermission([
    'View Vendors',
    'vendors.view',
    'Create Vendors',
    'vendors.create',
    'Update Vendors',
    'vendors.update',
  ]);

  // Resolve active tab from URL path
  const resolveTabFromPath = (path: string): AdminTab => {
    if (initialTab) {
      if (initialTab === 'staff') return 'workforce';
      return initialTab;
    }
    if (path.includes('/admin/users')) return 'users';
    if (path.includes('/admin/roles')) return 'roles';
    if (path.includes('/admin/audit-logs')) return 'audit-logs';
    if (path.includes('/admin/settings')) return 'settings';
    if (path.includes('/admin/workforce-directory')) return 'workforce-directory';
    if (path.includes('/admin/vendors-partners')) return 'vendors-partners';
    if (path.includes('/admin/workforce') || path.includes('/admin/staff') || path.includes('/staff')) return 'workforce';
    if (path.includes('/admin/attendance')) return 'attendance';
    if (path.includes('/admin/projects')) return 'projects';
    if (path.includes('/admin/clients')) return 'clients';
    if (path.includes('/admin/photos')) return 'photos';
    if (path.includes('/admin/remnants')) return 'remnants';
    if (path.includes('/admin/tools')) return 'tools';
    if (path.includes('/admin/tasks')) return 'tasks';
    if (path.includes('/admin/service-requests')) return 'service-requests';
    if (path.includes('/admin/materials') || path.includes('/materials')) return 'materials';
    if (path.includes('/admin/inventory') || path.includes('/inventory')) return 'inventory';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => resolveTabFromPath(location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);

  // Check if a project ID is present in the admin path e.g. /admin/projects/:projectId
  const routeProjectId = location.pathname.startsWith('/admin/projects/')
    ? location.pathname.split('/admin/projects/')[1]?.split('/')[0]?.split('?')[0] || null
    : null;

  // Check if a workforce ID is present in the admin path e.g. /admin/workforce/:workforceId
  const routeWorkforceId = location.pathname.startsWith('/admin/workforce/')
    ? location.pathname.split('/admin/workforce/')[1]?.split('/')[0]?.split('?')[0] || null
    : null;

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  // Sync tab state when URL changes
  useEffect(() => {
    const tabFromUrl = resolveTabFromPath(location.pathname);
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location.pathname]);

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
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
    contractWorkforceCount: 0,
    vendorsPartnersCount: 0,
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
        personnelRes,
        contractDirRes,
        vendorsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact' }).limit(10),
        supabase.from('workforce_members').select('*', { count: 'exact' }).limit(10),
        supabase.from('projects').select('*', { count: 'exact' }).limit(10),
        supabase.from('roles').select('*', { count: 'exact' }).limit(20),
        supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(6),
        WorkforceService.getCompletePersonnelDirectory().catch(() => null),
        canAccessWorkforceDirectory
          ? supabase.from('workforce_directory').select('id', { count: 'exact', head: true })
          : Promise.resolve({ count: 0, error: null }),
        canAccessVendorsPartners
          ? supabase.from('vendors_partners').select('id', { count: 'exact', head: true })
          : Promise.resolve({ count: 0, error: null }),
      ]);

      const totalStaff = personnelRes?.metrics?.totalPersonnel || uCount || (wData ? wData.length : 0);

      setMetrics({
        usersCount: uCount || (uData ? uData.length : 0),
        workforceCount: totalStaff,
        contractWorkforceCount: contractDirRes?.count || 0,
        vendorsPartnersCount: vendorsRes?.count || 0,
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

  const adminSections = [
    {
      title: 'OPERATIONS & SITES',
      items: [
        { key: 'dashboard' as AdminTab, label: 'Control Centre', icon: LayoutDashboard },
        { key: 'projects' as AdminTab, label: 'Projects', icon: FolderKanban, count: metrics.projectsCount },
        { key: 'tasks' as AdminTab, label: 'Task Specifications', icon: ClipboardList },
        { key: 'workforce' as AdminTab, label: 'Staff', icon: Users, count: metrics.workforceCount },
        ...(canAccessWorkforceDirectory
          ? [{ key: 'workforce-directory' as AdminTab, label: 'Workforce', icon: HardHat, count: metrics.contractWorkforceCount }]
          : []),
        ...(canAccessVendorsPartners
          ? [{ key: 'vendors-partners' as AdminTab, label: 'Vendors & Partners', icon: Handshake, count: metrics.vendorsPartnersCount }]
          : []),
        { key: 'attendance' as AdminTab, label: 'Attendance Muster', icon: CalendarCheck },
        { key: 'clients' as AdminTab, label: 'Clients', icon: Building2 },
      ],
    },
    {
      title: 'COMMERCIAL & INTAKE',
      items: [
        { key: 'service-requests' as AdminTab, label: 'Service Requests', icon: FileQuestion },
        { key: 'inventory' as AdminTab, label: 'Inventory & Sales', icon: Package },
      ],
    },
    {
      title: 'MATERIALS & LOGISTICS',
      items: [
        { key: 'materials' as AdminTab, label: 'Materials Directory', icon: Boxes },
        { key: 'remnants' as AdminTab, label: 'Material Remnants', icon: RotateCcw },
        { key: 'tools' as AdminTab, label: 'Tools & Equipment', icon: Wrench },
      ],
    },
    {
      title: 'MEDIA & ASSETS',
      items: [
        { key: 'photos' as AdminTab, label: 'Job Photos', icon: Images },
      ],
    },
    {
      title: 'GOVERNANCE & SYSTEM',
      items: [
        { key: 'users' as AdminTab, label: 'Users & Access', icon: Users, count: metrics.usersCount },
        { key: 'roles' as AdminTab, label: 'Roles & Permissions', icon: ShieldCheck, count: metrics.rolesCount },
        { key: 'audit-logs' as AdminTab, label: 'Audit Logs', icon: FileText, count: metrics.recentAuditCount },
        { key: 'settings' as AdminTab, label: 'System Settings', icon: Settings },
      ],
    },
  ];

  const adminDisplayName = profile?.display_name || user?.email?.split('@')[0] || 'Administrator';

  // Render navigation inside sidebar or mobile drawer
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between select-none">
      <div>
        {/* Brand Lockup */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-xs bg-white border border-slate-100 shrink-0">
              <img src="/brand/pwa-192x192.png" alt="Davejoe Interiors" className="w-full h-full object-contain" />
            </div>
            {(!sidebarCollapsed || isMobile) && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 tracking-tight text-[15px] leading-tight truncate">
                  Davejoe
                </span>
                <span className="text-[10px] font-semibold text-[#18b892] tracking-wider uppercase leading-tight truncate">
                  Administration
                </span>
              </div>
            )}
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 items-center justify-center transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Collapsible Navigation Menu */}
        <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(100vh-160px)]">
          {adminSections.map((section) => {
            const isSectionCollapsed = Boolean(collapsedSections[section.title]);
            return (
              <div key={section.title} className="space-y-1">
                {!sidebarCollapsed || isMobile ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span>{section.title}</span>
                    <div className="flex items-center text-slate-400">
                      {isSectionCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="my-2 border-t border-slate-100" />
                )}

                {(!isSectionCollapsed || sidebarCollapsed) && (
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleSelectTab(item.key)}
                          title={sidebarCollapsed && !isMobile ? item.label : undefined}
                          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${
                            isActive
                              ? 'bg-[#18b892] text-white shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          } ${sidebarCollapsed && !isMobile ? 'justify-center px-0' : ''}`}
                        >
                          <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                          {(!sidebarCollapsed || isMobile) && (
                            <div className="flex items-center justify-between flex-1 min-w-0">
                              <span className="truncate">{item.label}</span>
                              {item.count != null && (
                                <span
                                  className={`ml-2 text-xs font-mono px-2 py-0.5 rounded-full font-bold ${
                                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {item.count}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* User Account / Sign Out */}
      <div className="p-3.5 border-t border-slate-100 space-y-2 bg-slate-50/50">
        {!sidebarCollapsed || isMobile ? (
          <div className="px-3.5 py-2.5 bg-white rounded-xl border border-slate-200/90 flex items-center gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-full bg-[#18b892]/10 text-[#18b892] flex items-center justify-center text-sm font-bold shrink-0 border border-[#18b892]/20">
              {adminDisplayName[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                {adminDisplayName}
              </p>
              <p className="text-xs text-[#18b892] font-semibold truncate leading-tight mt-0.5">
                Admin Coordinator
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div className="w-8 h-8 rounded-full bg-[#18b892]/10 text-[#18b892] flex items-center justify-center text-sm font-bold border border-[#18b892]/20">
              {adminDisplayName[0].toUpperCase()}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => logout()}
          title="Sign Out"
          className={`w-full flex items-center ${
            sidebarCollapsed && !isMobile ? 'justify-center' : 'gap-2.5'
          } px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left`}
        >
          <LogOut className="w-4.5 h-4.5 text-red-500 shrink-0" />
          {(!sidebarCollapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7FAF9] flex flex-col md:flex-row text-slate-800 font-sans selection:bg-[#18b892]/20 selection:text-[#18b892]">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden md:flex ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-slate-200/90 flex-col shrink-0 transition-all duration-200 h-screen sticky top-0 z-30`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-in Drawer with Backdrop */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white z-50 flex flex-col h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 px-4 sm:px-8 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                {activeTab === 'dashboard' && 'Admin Dashboard'}
                {activeTab === 'users' && 'User Management'}
                {activeTab === 'roles' && 'Roles & Permissions'}
                {activeTab === 'audit-logs' && 'Audit Logs'}
                {activeTab === 'settings' && 'Administration Settings'}
                {activeTab === 'workforce' && 'Staff Directory'}
                {activeTab === 'workforce-directory' && 'Workforce Directory'}
                {activeTab === 'vendors-partners' && 'Vendors & Partners'}
                {activeTab === 'projects' && 'Enterprise Projects'}
                {activeTab === 'clients' && 'Client Management'}
                {activeTab === 'photos' && 'Job Completion Photos'}
                {activeTab === 'tasks' && 'Task Instructions & Specifications'}
                {activeTab === 'tools' && 'Company Tools & Equipment Register'}
                {activeTab === 'remnants' && 'Project Material Remnants & Recovery'}
                {activeTab === 'service-requests' && 'Customer Service Requests'}
                {activeTab === 'materials' && 'Materials Directory'}
                {activeTab === 'inventory' && 'Commercial Inventory & Sales'}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block truncate">
                {activeTab === 'dashboard' && 'Manage staff, projects, materials, commercial sales, and administrative operations.'}
                {activeTab === 'users' && 'Manage users, profiles, roles and system access.'}
                {activeTab === 'roles' && 'Role-Based Access Control configuration, permissions and security boundaries.'}
                {activeTab === 'audit-logs' && 'Read-only security logs and chronological operational history.'}
                {activeTab === 'settings' && 'System configuration, live Supabase connectivity and diagnostics.'}
                {activeTab === 'workforce' && 'All registered persons, roles, and profiles across Davejoe.'}
                {activeTab === 'workforce-directory' && 'Contract artisans and external field workforce assigned to projects without login accounts.'}
                {activeTab === 'vendors-partners' && 'Suppliers, trade partners, settlement banking details, and private CAC documents.'}
                {activeTab === 'projects' && 'Enterprise construction and civil engineering projects.'}
                {activeTab === 'clients' && 'Corporate and residential client accounts.'}
                {activeTab === 'tasks' && 'Issue mandatory specifications, PPE, deliverables, and verify task handovers.'}
                {activeTab === 'tools' && 'Track tool assignments, dispatch custody, returns, and damage condition audits.'}
                {activeTab === 'remnants' && 'Account for surplus materials on site, transfer custody, and verify store returns.'}
                {activeTab === 'service-requests' && 'Register and manage walk-in customer service requests, site visits, and project conversion.'}
                {activeTab === 'materials' && 'Comprehensive catalogue of construction materials, prices, specifications, and suppliers.'}
                {activeTab === 'inventory' && 'Commercial inventory, sales checkout, material issuance tracking, and Rehab Global paints.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddMaterialModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
              title="Add New Material to Master Directory"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span className="hidden sm:inline">Add Material</span>
              <span className="sm:hidden">Material</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Records"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isRefreshing ? 'animate-spin text-[#18b892]' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-[#18b892] border border-[#18b892]/25 whitespace-nowrap">
              Admin Active
            </span>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-w-7xl w-full">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Daily Attendance Timekeeping for Admin */}
              <DailyAttendanceWidget />

              {/* Metric KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => handleSelectTab('workforce')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#18b892]/60 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#18b892] transition-colors">
                      Registered Staff
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
                      <Users className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-mono tracking-tight text-slate-900">
                    {isLoading ? '...' : metrics.workforceCount}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>Staff roster across 9 roles</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#18b892] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>

                <div
                  onClick={() => handleSelectTab('roles')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#18b892]/60 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#18b892] transition-colors">
                      System Roles
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-200/60">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-mono tracking-tight text-slate-900">
                    {isLoading ? '...' : metrics.rolesCount}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>Configured RBAC roles</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#18b892] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>

                <div
                  onClick={() => handleSelectTab('audit-logs')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#18b892]/60 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#18b892] transition-colors">
                      Audit Logs
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-mono tracking-tight text-slate-900">
                    {isLoading ? '...' : metrics.recentAuditCount}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>Logged audit events</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#18b892] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>

                <div
                  onClick={() => handleSelectTab('settings')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#18b892]/60 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#18b892] transition-colors">
                      System Status
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
                      <Settings className="w-4.5 h-4.5" />
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-mono tracking-tight text-[#18b892]">
                    Online
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>Supabase RLS active</span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#18b892] group-hover:translate-x-0.5 transition-all" />
                  </p>
                </div>
              </div>

              {/* Commercial & Operational Fast-Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  onClick={() => handleSelectTab('service-requests')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#18b892]/60 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#18b892] transition-colors">
                        Walk-In Customer Intake
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
                        <FileQuestion className="w-4.5 h-4.5" />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#18b892] transition-colors">
                      Service Requests
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 mb-4 leading-relaxed">
                      Register walk-in client briefs, location, contact, budget, and route for Executive review and project conversion.
                    </p>
                  </div>
                  <div className="flex items-center text-sm font-semibold text-[#18b892] gap-1.5 group-hover:translate-x-1 transition-transform">
                    <span>Open Service Requests</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                <div
                  onClick={() => handleSelectTab('materials')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#18b892]/60 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#18b892] transition-colors">
                        Catalogue &amp; Specs
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
                        <Boxes className="w-4.5 h-4.5" />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#18b892] transition-colors">
                      Materials Directory
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 mb-4 leading-relaxed">
                      Management-assigned materials catalogue, base prices, specifications, and project allocation.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center text-sm font-semibold text-[#18b892] gap-1.5 group-hover:translate-x-1 transition-transform">
                      <span>Access Materials</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddMaterialModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                      title="Add new material directly"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Add Material</span>
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => handleSelectTab('inventory')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-[#18b892]/60 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#18b892] transition-colors">
                        Store &amp; Sales Point
                      </span>
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/60">
                        <Package className="w-4.5 h-4.5" />
                      </div>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Commercial Inventory &amp; Sales
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 mb-4 leading-relaxed">
                      Sell paint, tools, screeding, diffusers, and vases. Track sales checkout, stock levels, and partner items.
                    </p>
                  </div>
                  <div className="flex items-center text-sm font-semibold text-indigo-600 gap-1.5 group-hover:translate-x-1 transition-transform">
                    <span>Manage Inventory</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Administrative Overview Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Roles Quick View */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">
                      Configured System Roles
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('roles')}
                      className="text-sm font-semibold text-[#18b892] hover:underline cursor-pointer"
                    >
                      Manage RBAC &rarr;
                    </button>
                  </div>

                  {rolesList.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No system roles found in public.roles.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rolesList.slice(0, 5).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-semibold text-slate-800">{r.name}</span>
                            <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-200 text-slate-700 font-semibold">
                              {r.slug}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 hidden sm:inline">
                            {r.description || 'System access role'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Audit Logs Quick View */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">
                      Recent Audit Activities
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('audit-logs')}
                      className="text-sm font-semibold text-[#18b892] hover:underline cursor-pointer"
                    >
                      View All Logs &rarr;
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
{activeTab === 'photos' && (
  <JobCompletionPhotoLibrary canUpload={true} />
)}

          {/* TAB 5: 9.7D SETTINGS */}
          {activeTab === 'settings' && <SystemSettingsView />}

          {/* TAB 6: COMPLETE WORKFORCE DIRECTORY (ALL 9 ROLES) */}
          {activeTab === 'workforce' && (
            <div className="space-y-4">
              {routeWorkforceId ? (
                <WorkforceControlCentre
                  workforceId={routeWorkforceId}
                  onBackToWorkforce={() => navigate('/admin/workforce')}
                />
              ) : (
                <WorkforceModule onBackToDashboard={() => setActiveTab('dashboard')} />
              )}
            </div>
          )}

          {/* TAB: CONTRACT WORKFORCE DIRECTORY */}
          {activeTab === 'workforce-directory' && (
            <div className="space-y-4">
              {canAccessWorkforceDirectory ? (
                <WorkforceDirectoryModule onBackToDashboard={() => handleSelectTab('dashboard')} />
              ) : (
                <AccessDenied
                  isModuleRestricted
                  title="Workforce Directory Access Restricted"
                  message="You do not hold the required database permission (View Workforce) to access the Contract Workforce Directory."
                  onBack={() => handleSelectTab('dashboard')}
                />
              )}
            </div>
          )}

          {/* TAB: VENDORS & PARTNERS DIRECTORY */}
          {activeTab === 'vendors-partners' && (
            <div className="space-y-4">
              {canAccessVendorsPartners ? (
                <VendorsPartnersModule onBackToDashboard={() => handleSelectTab('dashboard')} />
              ) : (
                <AccessDenied
                  isModuleRestricted
                  title="Vendors & Partners Access Restricted"
                  message="You do not hold the required database permission (View Vendors) to access the Vendors & Partners Directory."
                  onBack={() => handleSelectTab('dashboard')}
                />
              )}
            </div>
          )}

          {/* TAB: WALK-IN SERVICE REQUESTS */}
          {activeTab === 'service-requests' && (
            <div className="space-y-4">
              <ServiceRequestsModule onBackToDashboard={() => setActiveTab('dashboard')} />
            </div>
          )}

          {/* TAB: MATERIALS DIRECTORY */}
          {activeTab === 'materials' && (
            <div className="space-y-4">
              <MaterialsDirectoryModule onBackToDashboard={() => setActiveTab('dashboard')} />
            </div>
          )}

          {/* TAB: UNIFIED COMMERCIAL INVENTORY & SALES */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <UnifiedInventoryModule onBackToDashboard={() => setActiveTab('dashboard')} />
            </div>
          )}

          {/* TAB 7: PROJECTS */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              {routeProjectId ? (
                <ProjectControlCentre
                  projectId={routeProjectId}
                  onBackToProjects={() => navigate('/admin/projects')}
                />
              ) : (
                <ProjectsModule onBackToDashboard={() => setActiveTab('dashboard')} />
              )}
            </div>
          )}

          {/* TAB: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <AttendanceModule onBackToDashboard={() => setActiveTab('dashboard')} />
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

          {/* TAB 9: TASK INSTRUCTIONS & HANDOVER */}
          {activeTab === 'tasks' && <TaskInstructionsPanel />}

          {/* TAB 10: COMPANY TOOLS & EQUIPMENT REGISTER */}
          {activeTab === 'tools' && <ToolsEquipmentModule />}

          {/* TAB 11: PROJECT MATERIAL REMNANTS & RECOVERY */}
          {activeTab === 'remnants' && <ProjectMaterialRemnantsModule />}
        </div>
      </main>

      {/* Admin Add Material Modal */}
      <AddMaterialModal
        isOpen={isAddMaterialModalOpen}
        onClose={() => setIsAddMaterialModalOpen(false)}
        onMaterialCreated={() => {
          setIsAddMaterialModalOpen(false);
          handleSelectTab('materials');
        }}
      />
    </div>
  );
};
