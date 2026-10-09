import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Package,
  ClipboardCheck,
  FileBarChart,
  RefreshCw,
  LogOut,
  Building2,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ExternalLink,
  ChevronRight,
  HardHat,
  Truck,
  Layers,
  ArrowUpRight,
  Info,
} from 'lucide-react';

type ExecutiveTab =
  | 'overview'
  | 'projects'
  | 'workforce'
  | 'materials'
  | 'inspections'
  | 'reports';

export const ExecutiveDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ExecutiveTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Real Database Records & Metrics
  const [metrics, setMetrics] = useState({
    activeProjects: 0,
    totalWorkforce: 0,
    materialRequests: 0,
    deliveriesCount: 0,
    inspectionsCount: 0,
  });

  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [workforceList, setWorkforceList] = useState<any[]>([]);
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [deliveriesList, setDeliveriesList] = useState<any[]>([]);
  const [inspectionsList, setInspectionsList] = useState<any[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchExecutiveData = useCallback(async () => {
    try {
      const [
        { data: pData, count: pCount },
        { data: wData, count: wCount },
        { data: mData, count: mCount },
        { data: dData, count: dCount },
        { data: iData, count: iCount },
      ] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact' }).limit(10),
        supabase.from('workforce_members').select('*', { count: 'exact' }).limit(10),
        supabase.from('material_requests').select('*', { count: 'exact' }).limit(10),
        supabase.from('deliveries').select('*', { count: 'exact' }).limit(10),
        supabase.from('technical_inspections').select('*', { count: 'exact' }).limit(10),
      ]);

      setMetrics({
        activeProjects: pCount || (pData ? pData.length : 0),
        totalWorkforce: wCount || (wData ? wData.length : 0),
        materialRequests: mCount || (mData ? mData.length : 0),
        deliveriesCount: dCount || (dData ? dData.length : 0),
        inspectionsCount: iCount || (iData ? iData.length : 0),
      });

      setProjectsList(pData || []);
      setWorkforceList(wData || []);
      setMaterialsList(mData || []);
      setDeliveriesList(dData || []);
      setInspectionsList(iData || []);
    } catch (err) {
      console.warn('[ExecutiveDashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutiveData();
  }, [fetchExecutiveData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchExecutiveData();
  };

  // Derive executive name from authenticated profile or user identity
  const executiveDisplayName =
    profile?.display_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    (user?.email?.toLowerCase().includes('olaoluwa') ? 'OLAOLUWA ADEWUYI' : 'OLAOLUWA ADEWUYI');

  const executiveRoleTitle = 'EXECUTIVE DIRECTOR, BUSINESS OPERATIONS & STRATEGY';

  const navItems: { key: ExecutiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'overview', label: 'Strategic Overview', icon: LayoutDashboard },
    { key: 'projects', label: 'Projects Oversight', icon: FolderKanban },
    { key: 'workforce', label: 'Workforce & Operations', icon: Users },
    { key: 'materials', label: 'Materials & Supply Velocity', icon: Package },
    { key: 'inspections', label: 'Quality & Inspections', icon: ClipboardCheck },
    { key: 'reports', label: 'Strategic Reports', icon: FileBarChart },
  ];

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
                Executive Portal
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="p-3.5 flex-1 flex flex-col justify-between overflow-y-auto">
          <nav className="space-y-1">
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Executive Oversight
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

          {/* Account Lockup & Actions */}
          <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
            <div className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#01875F] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                {executiveDisplayName[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight uppercase tracking-tight">
                  {executiveDisplayName}
                </p>
                <p className="text-[10px] text-[#01875F] font-semibold truncate leading-tight mt-0.5">
                  Executive Director
                </p>
              </div>
            </div>

            <div className="px-1">
              <PWAInstallButton className="w-full text-xs justify-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200" />
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

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-20 px-6 sm:px-8 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-4">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight uppercase">
              {executiveDisplayName}
            </h1>
            <p className="text-xs font-semibold text-[#01875F] tracking-wide uppercase mt-0.5 truncate">
              {executiveRoleTitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-[#01875F]" />
              Strategic Read Access
            </span>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Records"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Oversight Privilege Notice */}
        <div className="bg-emerald-50/50 border-b border-emerald-100/80 px-6 sm:px-8 py-2.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#01875F] shrink-0" />
            <span>
              Executive Oversight Portal: Real-time strategic visibility across projects, workforce, procurement, and technical performance.
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-400 hidden lg:inline">
            Role: executive_director
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-w-7xl w-full">
          {/* TAB 1: STRATEGIC OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  onClick={() => setActiveTab('projects')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      Active Projects
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <FolderKanban className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.activeProjects}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Portfolio engagements</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('workforce')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      Total Workforce
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.totalWorkforce}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Deployed team strength</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('materials')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      Supply Velocity
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Truck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.deliveriesCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Recorded site deliveries</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('inspections')}
                  className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                      Quality Inspections
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : metrics.inspectionsCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Technical QC audits</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                  </p>
                </div>
              </div>

              {/* Two Column Strategic Review */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Projects Portfolio */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-[#01875F]" />
                      <span>Enterprise Project Portfolio</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('projects')}
                      className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                    >
                      View all &rarr;
                    </button>
                  </div>

                  {projectsList.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No active projects found in database.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {projectsList.slice(0, 5).map((project) => (
                        <div
                          key={project.id}
                          className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-slate-900 block truncate">
                              {project.name}
                            </span>
                            <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                              Location: {project.location || 'Site Location'} &bull; Client: {project.client_name || 'Enterprise'}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-[#01875F] shrink-0">
                            {project.status || 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Operations & Supply Chain Status */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#01875F]" />
                      <span>Operations & Resource Allocation</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('materials')}
                      className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                    >
                      View supply chain &rarr;
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800 block">Workforce Utilization</span>
                        <span className="text-[11px] text-slate-400">Deployments across active sites</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {metrics.totalWorkforce} Active Personnel
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800 block">Pending Material Requests</span>
                        <span className="text-[11px] text-slate-400">Site requests awaiting processing</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {metrics.materialRequests} Requests
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800 block">Technical Quality Audits</span>
                        <span className="text-[11px] text-slate-400">QC compliance inspections completed</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        {metrics.inspectionsCount} Audits
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECTS OVERSIGHT */}
          {activeTab === 'projects' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Enterprise Projects Portfolio</h2>
                  <p className="text-xs text-slate-500">
                    Strategic oversight of civil construction, commercial contracts, and site execution.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total: {metrics.activeProjects} projects
                </span>
              </div>

              {projectsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No projects recorded in database yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Project Name</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Client</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectsList.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{p.name}</td>
                          <td className="py-3.5 px-4 text-slate-600">{p.location || '—'}</td>
                          <td className="py-3.5 px-4 text-slate-600">{p.client_name || 'Enterprise'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
                              {p.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WORKFORCE & OPERATIONS */}
          {activeTab === 'workforce' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Workforce & Site Execution</h2>
                  <p className="text-xs text-slate-500">
                    Artisans, site engineers, supervisors, and trade specialists registered across operations.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total: {metrics.totalWorkforce} members
                </span>
              </div>

              {workforceList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No workforce members registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Name</th>
                        <th className="py-3 px-4">Trade / Specialization</th>
                        <th className="py-3 px-4">Workforce Code</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {workforceList.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{w.name || w.full_name}</td>
                          <td className="py-3.5 px-4 text-slate-600">{w.trade || w.role || 'General'}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                            {w.workforce_code || '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {w.status || 'Active'}
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

          {/* TAB 4: MATERIALS & SUPPLY VELOCITY */}
          {activeTab === 'materials' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Materials & Procurement Deliveries</h2>
                  <p className="text-xs text-slate-500">
                    Oversight of site delivery receipts, materials fulfillment, and supply chain logistics.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total Deliveries: {metrics.deliveriesCount}
                </span>
              </div>

              {deliveriesList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No delivery records logged yet in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Delivery Ref</th>
                        <th className="py-3 px-4">Supplier / Source</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {deliveriesList.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {d.delivery_number || d.id.slice(0, 8)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{d.supplier_name || 'Vendor'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                              {d.status || 'Received'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {d.created_at ? new Date(d.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: QUALITY & INSPECTIONS */}
          {activeTab === 'inspections' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Technical QC & Inspections</h2>
                  <p className="text-xs text-slate-500">
                    Quality control audits, structural reviews, and compliance records across project sites.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Total: {metrics.inspectionsCount} audits
                </span>
              </div>

              {inspectionsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No technical inspection records logged yet in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Inspection Subject</th>
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Result</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectionsList.map((i) => (
                        <tr key={i.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{i.subject || 'Site Audit'}</td>
                          <td className="py-3.5 px-4 text-slate-600">{i.project_name || 'Project'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                              {i.status || 'Passed'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {i.created_at ? new Date(i.created_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: STRATEGIC REPORTS */}
          {activeTab === 'reports' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Strategic Performance Reports</h2>
                <p className="text-xs text-slate-500">
                  Comprehensive executive digests on company operations, project milestones, and resource efficiency.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#01875F]" />
                    <span className="font-bold text-slate-900">Project Delivery Milestones</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Portfolio schedule analysis and critical path execution tracking across all regional sites.
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-[#01875F] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Real-time Data Stream Active
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#01875F]" />
                    <span className="font-bold text-slate-900">Workforce Productivity Index</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Productivity rates, attendance compliance, and labor allocation efficiency across contracting teams.
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                    Field Registry Active
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ExecutiveDashboard;
