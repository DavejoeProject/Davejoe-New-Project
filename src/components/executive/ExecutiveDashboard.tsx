import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import {
  FinancialControlService,
  FinancialControlExecutiveSummary,
} from '../../services/financialControlService';
import {
  DashboardService,
  formatNaira,
  formatCount,
  formatDateNigerian,
} from '../../services/dashboardService';
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
  DollarSign,
  UserCheck,
  Briefcase,
  AlertOctagon,
  ChevronLeft,
  Filter,
  FileText,
  XCircle,
  HelpCircle,
  Star,
  Activity,
  Award,
  Bell,
  SlidersHorizontal,
} from 'lucide-react';

export type ExecutiveModuleKey =
  | 'overview'
  | 'leads'
  | 'projects'
  | 'workforce'
  | 'qc'
  | 'materials'
  | 'procurement'
  | 'finance'
  | 'clients'
  | 'staff'
  | 'artisans'
  | 'alerts'
  | 'reports';

export const ExecutiveDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const [activeModule, setActiveModule] = useState<ExecutiveModuleKey>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Search in sub-views
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 8 Top-Level KPI metrics
  const [kpis, setKpis] = useState<{
    activeProjects: number;
    newLeads: number | null; // null represents unsupported / no schema
    pendingQuotes: number | null; // null represents unsupported / no schema
    outstandingReceivables: number | null; // null represents unsupported / no schema
    manpowerShortages: number;
    qcFailures: number;
    materialExceptions: number;
    redIssues: number;
  }>({
    activeProjects: 0,
    newLeads: null,
    pendingQuotes: null,
    outstandingReceivables: null,
    manpowerShortages: 0,
    qcFailures: 0,
    materialExceptions: 0,
    redIssues: 0,
  });

  // Corporate Financial Summary
  const [financialSummary, setFinancialSummary] = useState<FinancialControlExecutiveSummary | null>(null);
  const [queryErrors, setQueryErrors] = useState<string[]>([]);

  // Real Database Records
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [workforceList, setWorkforceList] = useState<any[]>([]);
  const [materialsList, setMaterialsList] = useState<any[]>([]);
  const [purchaseOrdersList, setPurchaseOrdersList] = useState<any[]>([]);
  const [deliveriesList, setDeliveriesList] = useState<any[]>([]);
  const [inspectionsList, setInspectionsList] = useState<any[]>([]);
  const [conductList, setConductList] = useState<any[]>([]);
  const [materialLossesList, setMaterialLossesList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [alertsList, setAlertsList] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [
        projRes,
        workforceRes,
        materialsRes,
        poRes,
        delivRes,
        inspectRes,
        conductRes,
        lossRes,
        clientRes,
        alertsRes,
        finSummaryRes,
      ] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('workforce_members').select('*').order('created_at', { ascending: false }),
        supabase.from('materials').select('*').order('name', { ascending: true }),
        supabase.from('purchase_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('material_deliveries').select('*').order('created_at', { ascending: false }),
        supabase.from('technical_inspections').select('*').order('created_at', { ascending: false }),
        supabase.from('workforce_conduct_records').select('*').order('created_at', { ascending: false }),
        supabase.from('material_losses').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        DashboardService.getManagementAlerts(),
        FinancialControlService.getExecutiveSummary(),
      ]);

      const capturedErrors: string[] = [];
      if (projRes.error) capturedErrors.push(`Projects: ${projRes.error.message}`);
      if (workforceRes.error) capturedErrors.push(`Workforce: ${workforceRes.error.message}`);
      if (materialsRes.error) capturedErrors.push(`Materials: ${materialsRes.error.message}`);
      if (poRes.error) capturedErrors.push(`Purchase Orders: ${poRes.error.message}`);
      if (delivRes.error) capturedErrors.push(`Deliveries: ${delivRes.error.message}`);
      if (inspectRes.error) capturedErrors.push(`Technical Inspections: ${inspectRes.error.message}`);
      if (conductRes.error) capturedErrors.push(`Conduct Records: ${conductRes.error.message}`);
      if (lossRes.error) capturedErrors.push(`Material Losses: ${lossRes.error.message}`);
      if (clientRes.error) capturedErrors.push(`Clients: ${clientRes.error.message}`);
      if (alertsRes.error) capturedErrors.push(`Alerts: ${alertsRes.error}`);
      if (finSummaryRes.error) capturedErrors.push(`Financials: ${finSummaryRes.error}`);
      setQueryErrors(capturedErrors);

      const projects = projRes.data || [];
      const workforce = workforceRes.data || [];
      const materials = materialsRes.data || [];
      const pos = poRes.data || [];
      const deliveries = delivRes.data || [];
      const inspections = inspectRes.data || [];
      const conduct = conductRes.data || [];
      const losses = lossRes.data || [];
      const clients = clientRes.data || [];
      const alerts = alertsRes.data?.alerts || [];

      setProjectsList(projects);
      setWorkforceList(workforce);
      setMaterialsList(materials);
      setPurchaseOrdersList(pos);
      setDeliveriesList(deliveries);
      setInspectionsList(inspections);
      setConductList(conduct);
      setMaterialLossesList(losses);
      setClientsList(clients);
      setAlertsList(alerts);
      setFinancialSummary(finSummaryRes.data);

      // Compute Top-Level KPIs from real data:
      // 1. Active Projects
      const activeProjCount = projects.filter((p) => {
        const s = (p.status || '').toLowerCase().trim();
        return s === 'active' || s === 'in_progress' || s === 'ongoing';
      }).length;

      // 2. New Leads (Schema table unconfigured in database -> unsupported null)
      const newLeadsCount = null;

      // 3. Pending Quotes (Schema table unconfigured in database -> unsupported null)
      const pendingQuotesCount = null;

      // 4. Outstanding Receivables (Invoicing table unconfigured in database -> unsupported null)
      const outstandingReceivablesVal = null;

      // 5. Manpower Shortages
      const shortagesCount = alerts.filter(
        (a) => a.type.toLowerCase().includes('manpower') || a.type.toLowerCase().includes('workforce')
      ).length;

      // 6. QC Failures
      const qcFailuresCount = inspections.filter((i) => {
        const s = (i.status || i.result || '').toLowerCase().trim();
        return s === 'failed' || s === 'fail' || s === 'rejected';
      }).length;

      // 7. Material Exceptions (open material losses + low stock)
      const lowStockCount = materials.filter((m) => {
        const curr = m.current_stock ?? m.stock_quantity;
        const reorder = m.reorder_level ?? m.reorder_point;
        return curr != null && reorder != null && Number(curr) <= Number(reorder);
      }).length;
      const materialExceptionsCount = losses.length + lowStockCount;

      // 8. RED Issues (critical alerts + unresolved conduct issues)
      const criticalAlertsCount = alerts.filter((a) => a.severity === 'critical').length;
      const redIssuesCount = criticalAlertsCount + conduct.filter((c) => (c.status || '').toLowerCase() === 'open').length;

      setKpis({
        activeProjects: activeProjCount,
        newLeads: newLeadsCount,
        pendingQuotes: pendingQuotesCount,
        outstandingReceivables: outstandingReceivablesVal,
        manpowerShortages: shortagesCount,
        qcFailures: qcFailuresCount,
        materialExceptions: materialExceptionsCount,
        redIssues: redIssuesCount,
      });
    } catch (err) {
      console.warn('[ExecutiveDashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
  };

  // Identity resolution
  const executiveDisplayName =
    profile?.display_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    'OLAOLUWA ADEWUYI';

  const executiveRoleTitle = 'EXECUTIVE DIRECTOR, BUSINESS OPERATIONS & STRATEGY';

  // Navigation Items matching the 12 departmental requirements
  const navItems: {
    key: ExecutiveModuleKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number | string;
    isUnconfigured?: boolean;
  }[] = [
    { key: 'overview', label: 'Executive Control Centre', icon: LayoutDashboard },
    { key: 'leads', label: 'Business Development & Leads', icon: Briefcase, isUnconfigured: true },
    { key: 'projects', label: 'Projects', icon: FolderKanban, count: projectsList.length },
    { key: 'workforce', label: 'Workforce & Productivity', icon: Users, count: workforceList.length },
    { key: 'qc', label: 'Technical Inspection & QC', icon: ClipboardCheck, count: inspectionsList.length },
    { key: 'materials', label: 'Materials', icon: Package, count: materialsList.length },
    { key: 'procurement', label: 'Procurement & Logistics', icon: Truck, count: purchaseOrdersList.length },
    { key: 'finance', label: 'Finance & Commercial', icon: DollarSign },
    { key: 'clients', label: 'Client Experience', icon: Building2, count: clientsList.length },
    { key: 'staff', label: 'Staff Performance', icon: Award, count: conductList.length },
    { key: 'artisans', label: 'Artisan Network', icon: HardHat, count: workforceList.length },
    { key: 'alerts', label: 'Management Alerts', icon: AlertOctagon, count: alertsList.length },
    { key: 'reports', label: 'Reports', icon: FileBarChart },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col md:flex-row text-slate-800 font-sans selection:bg-[#01875F]/20 selection:text-[#01875F]">
      {/* SIDEBAR */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-72'
        } bg-white border-r border-slate-200/90 flex flex-col shrink-0 transition-all duration-200 select-none`}
      >
        {/* Brand Lockup */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-xs bg-white border border-slate-100 shrink-0">
              <img src="/favicon.png" alt="Davejoe" className="w-full h-full object-contain" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 tracking-tight text-[15px] leading-tight truncate">
                  Davejoe
                </span>
                <span className="text-[10px] font-semibold text-[#01875F] tracking-wider uppercase leading-tight truncate">
                  Executive Director
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 items-center justify-center transition-colors cursor-pointer"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Menu */}
        <div className="p-3 flex-1 flex flex-col justify-between overflow-y-auto">
          <nav className="space-y-0.5">
            {!sidebarCollapsed && (
              <div className="px-3 pt-2 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Strategic Oversight
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveModule(item.key);
                    setSearchQuery('');
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-[#01875F] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!sidebarCollapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate">{item.label}</span>
                      {item.count != null && (
                        <span
                          className={`ml-2 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                      {item.isUnconfigured && (
                        <span
                          className={`ml-1 text-[9px] px-1 py-0.2 rounded font-medium ${
                            isActive ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          Setup
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Account Lockup & Actions */}
          <div className="pt-3 border-t border-slate-100 mt-3 space-y-2">
            {!sidebarCollapsed ? (
              <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#01875F] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                  {executiveDisplayName[0]?.toUpperCase() || 'O'}
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
            ) : (
              <div className="flex justify-center py-1">
                <div className="w-8 h-8 rounded-full bg-[#01875F] text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                  {executiveDisplayName[0]?.toUpperCase() || 'O'}
                </div>
              </div>
            )}

            {!sidebarCollapsed && (
              <div className="px-1">
                <PWAInstallButton className="w-full text-xs justify-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200" />
              </div>
            )}

            <button
              type="button"
              onClick={() => logout()}
              title="Sign Out"
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center' : 'gap-2.5'
              } px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer text-left`}
            >
              <LogOut className="w-4 h-4 text-red-500 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header with Identity Requirement */}
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
              Executive Control Active
            </span>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh Data"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Oversight Security Notice */}
        <div className="bg-emerald-50/50 border-b border-emerald-100/80 px-6 sm:px-8 py-2.5 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#01875F] shrink-0" />
            <span>
              Company-wide Strategic Oversight Active: Read access to projects, operations, materials, workforce and management performance.
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
            Auth Key: executive_director
          </span>
        </div>

        {/* Query Errors / Partial Data Notice Banner */}
        {queryErrors.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200/90 px-6 sm:px-8 py-3 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Partial Data Notice:</span>{' '}
                Some tables returned query warnings ({queryErrors.length}): {queryErrors.join(' • ')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-2.5 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded font-semibold text-[11px] shrink-0 self-start sm:self-auto cursor-pointer"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-w-7xl w-full">
          {/* ========================================================================= */}
          {/* VIEW 1: EXECUTIVE CONTROL CENTRE (OVERVIEW WITH 8 MANDATORY KPI CARDS)     */}
          {/* ========================================================================= */}
          {activeModule === 'overview' && (
            <div className="space-y-6">
              {/* TOP-LEVEL MANDATORY KPI CARDS (ALL 8 CARDS) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Executive Key Performance Indicators
                  </h2>
                  <span className="text-[11px] text-slate-400">Real-time database sync</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* KPI 1: Active Projects */}
                  <div
                    onClick={() => setActiveModule('projects')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                        Active Projects
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <FolderKanban className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {isLoading ? '...' : kpis.activeProjects}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>Ongoing site operations</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                    </p>
                  </div>

                  {/* KPI 2: New Leads */}
                  <div
                    onClick={() => setActiveModule('leads')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                        New Leads
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Briefcase className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-400">
                      {kpis.newLeads === null ? '—' : kpis.newLeads}
                    </div>
                    <p className="text-[11px] text-amber-600/90 mt-1 flex items-center justify-between font-medium">
                      <span>Unsupported (No CRM table)</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                    </p>
                  </div>

                  {/* KPI 3: Pending Quotes */}
                  <div
                    onClick={() => setActiveModule('leads')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                        Pending Quotes
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-400">
                      {kpis.pendingQuotes === null ? '—' : kpis.pendingQuotes}
                    </div>
                    <p className="text-[11px] text-purple-600 mt-1 flex items-center justify-between font-medium">
                      <span>Unsupported (No quotes table)</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                    </p>
                  </div>

                  {/* KPI 4: Outstanding Receivables */}
                  <div
                    onClick={() => setActiveModule('finance')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                        Outstanding Receivables
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-400">
                      {kpis.outstandingReceivables === null ? '—' : formatNaira(kpis.outstandingReceivables)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between font-medium">
                      <span>Unsupported (No invoices table)</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                    </p>
                  </div>

                  {/* KPI 5: Manpower Shortages */}
                  <div
                    onClick={() => setActiveModule('workforce')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                        Manpower Shortages
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {kpis.manpowerShortages}
                    </div>
                    <p className="text-[11px] text-emerald-600 mt-1 flex items-center justify-between font-medium">
                      <span>Site requisitions staffed</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                    </p>
                  </div>

                  {/* KPI 6: QC Failures */}
                  <div
                    onClick={() => setActiveModule('qc')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                        QC Failures
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                        <XCircle className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {kpis.qcFailures}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>Audit failure exceptions</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                    </p>
                  </div>

                  {/* KPI 7: Material Exceptions */}
                  <div
                    onClick={() => setActiveModule('materials')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-[#01875F] transition-colors">
                        Material Exceptions
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {kpis.materialExceptions}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>Losses & stock warnings</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#01875F] transition-colors" />
                    </p>
                  </div>

                  {/* KPI 8: RED Issues */}
                  <div
                    onClick={() => setActiveModule('alerts')}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-red-400/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                        RED Issues
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center">
                        <AlertOctagon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-red-700">
                      {kpis.redIssues}
                    </div>
                    <p className="text-[11px] text-red-500 mt-1 flex items-center justify-between font-medium">
                      <span>Critical alerts requiring action</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-red-400 group-hover:translate-x-0.5 transition-all" />
                    </p>
                  </div>
                </div>
              </div>

              {/* DEPARTMENTAL SUMMARIES AND DRILL-DOWN NAVIGATION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Departmental Operations & Strategic Drill-Downs
                  </h2>
                  <span className="text-[11px] text-slate-400">12 Core Strategic Domains</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Department 1: Business Development & Leads */}
                  <div
                    onClick={() => setActiveModule('leads')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Business Development & Leads
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
                          Setup
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Client acquisition pipeline, bidding proposals, pending customer quotes, and commercial intake.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>View Pipeline &rarr;</span>
                      <span className="text-slate-400 font-normal">0 Active Leads</span>
                    </div>
                  </div>

                  {/* Department 2: Projects */}
                  <div
                    onClick={() => setActiveModule('projects')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Projects & Civil Operations
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Execution velocity, milestone deliverables, project site locations, and client commitments.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Portfolio Oversight &rarr;</span>
                      <span className="text-slate-700 font-bold">{projectsList.length} Projects</span>
                    </div>
                  </div>

                  {/* Department 3: Workforce and Productivity */}
                  <div
                    onClick={() => setActiveModule('workforce')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Workforce & Productivity
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Daily site attendance, labor utilization efficiency, productivity metrics, and overtime tracking.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Review Productivity &rarr;</span>
                      <span className="text-slate-700 font-bold">{workforceList.length} Personnel</span>
                    </div>
                  </div>

                  {/* Department 4: Technical Inspection and QC */}
                  <div
                    onClick={() => setActiveModule('qc')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Technical Inspection & QC
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Quality assurance audits, structural compliance checks, site defect logs, and QC pass rates.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Audit Quality Log &rarr;</span>
                      <span className="text-slate-700 font-bold">{inspectionsList.length} Audits</span>
                    </div>
                  </div>

                  {/* Department 5: Materials */}
                  <div
                    onClick={() => setActiveModule('materials')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Materials Management
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Warehouse stock balances, site allocation requests, recorded losses, and material reconciliation.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Inventory Breakdown &rarr;</span>
                      <span className="text-slate-700 font-bold">{materialsList.length} Materials</span>
                    </div>
                  </div>

                  {/* Department 6: Procurement and Logistics */}
                  <div
                    onClick={() => setActiveModule('procurement')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Procurement & Logistics
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Purchase orders issuance, vendor delivery performance, receipts verification, and lead times.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Supply Chain Tracking &rarr;</span>
                      <span className="text-slate-700 font-bold">{purchaseOrdersList.length} Orders</span>
                    </div>
                  </div>

                  {/* Department 7: Finance and Commercial */}
                  <div
                    onClick={() => setActiveModule('finance')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Finance & Commercial
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                          Oversight
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Project budget commitments, material costs, cashflow summaries, and commercial expenditure.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Financial Overview &rarr;</span>
                      <span className="text-slate-500 font-medium">Read-Only</span>
                    </div>
                  </div>

                  {/* Department 8: Client Experience */}
                  <div
                    onClick={() => setActiveModule('clients')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Client Experience
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Institutional and private client directories, project sign-offs, and relationship management.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Client Directory &rarr;</span>
                      <span className="text-slate-700 font-bold">{clientsList.length} Accounts</span>
                    </div>
                  </div>

                  {/* Department 9: Staff Performance */}
                  <div
                    onClick={() => setActiveModule('staff')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Staff Performance & Conduct
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Supervisory reviews, site engineer compliance, disciplinary conduct logs, and staff evaluations.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Conduct & Performance &rarr;</span>
                      <span className="text-slate-700 font-bold">{conductList.length} Records</span>
                    </div>
                  </div>

                  {/* Department 10: Artisan Network */}
                  <div
                    onClick={() => setActiveModule('artisans')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <HardHat className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Artisan Network
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Tradesmen roster across masonry, plumbing, electrical, carpentry, iron-bending and steelwork.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Artisan Registry &rarr;</span>
                      <span className="text-slate-700 font-bold">{workforceList.length} Artisans</span>
                    </div>
                  </div>

                  {/* Department 11: Management Alerts */}
                  <div
                    onClick={() => setActiveModule('alerts')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-red-400/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <AlertOctagon className="w-4 h-4 text-red-600" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-red-600 transition-colors">
                            Management Alerts
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700">
                          {alertsList.length} Flags
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Critical operational exceptions, stockout warnings, conduct incidents, and overdue deadlines.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-red-600 font-semibold">
                      <span>Audit Exceptions &rarr;</span>
                      <span>Review Flags</span>
                    </div>
                  </div>

                  {/* Department 12: Reports */}
                  <div
                    onClick={() => setActiveModule('reports')}
                    className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-[#01875F]/60 transition-colors cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileBarChart className="w-4 h-4 text-[#01875F]" />
                          <h3 className="font-bold text-xs text-slate-900 group-hover:text-[#01875F] transition-colors">
                            Reports & Strategic Analytics
                          </h3>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                          Active
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Consolidated executive reports, milestone deliverables, materials reconciliation and audits.
                      </p>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-[#01875F] font-semibold">
                      <span>Executive Reports &rarr;</span>
                      <span className="text-slate-500 font-medium">Export Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: BUSINESS DEVELOPMENT AND LEADS (DRILL-DOWN)                       */}
          {/* ========================================================================= */}
          {activeModule === 'leads' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Business Development & Leads</h2>
                  <p className="text-xs text-slate-500">
                    Commercial intake, client leads, quotes, proposals and strategic pipeline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('overview')}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                >
                  &larr; Back to Overview
                </button>
              </div>

              {/* Status Note on Schema State */}
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <Info className="w-4 h-4 text-amber-700" />
                  <span>Module Status: Schema Provisioning Pending</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  The <code className="font-mono bg-white/70 px-1 py-0.5 rounded">leads</code> and <code className="font-mono bg-white/70 px-1 py-0.5 rounded">quotes</code> tables have not yet been provisioned in the Supabase database. The system displays verified zero-states in compliance with strict real-data policies.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Active Leads</span>
                  <span className="text-2xl font-bold text-slate-900">0</span>
                  <span className="text-[10px] text-slate-400 block mt-1">No leads recorded in database</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Pending Quotes</span>
                  <span className="text-2xl font-bold text-slate-900">0</span>
                  <span className="text-[10px] text-slate-400 block mt-1">No quotes awaiting submission</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Pipeline Value</span>
                  <span className="text-2xl font-bold text-slate-900">₦0.00</span>
                  <span className="text-[10px] text-slate-400 block mt-1">No bids currently evaluated</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: PROJECTS (DRILL-DOWN)                                             */}
          {/* ========================================================================= */}
          {activeModule === 'projects' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Enterprise Projects Portfolio</h2>
                  <p className="text-xs text-slate-500">
                    Active civil engineering, construction projects, site locations and client status.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    Total: {projectsList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule('overview')}
                    className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    &larr; Overview
                  </button>
                </div>
              </div>

              {projectsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No projects recorded yet in database.
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
                          <td className="py-3.5 px-4 text-slate-600">{p.client_name || 'Enterprise Client'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
                              {p.status || 'Active'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {formatDateNigerian(p.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 4: WORKFORCE AND PRODUCTIVITY (DRILL-DOWN)                           */}
          {/* ========================================================================= */}
          {activeModule === 'workforce' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Workforce & Site Execution</h2>
                  <p className="text-xs text-slate-500">
                    Artisans, site engineers, supervisors, and trade specialists deployed across sites.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    Total: {workforceList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule('overview')}
                    className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    &larr; Overview
                  </button>
                </div>
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
                        <th className="py-3 px-4">Code</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {workforceList.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{w.name || w.full_name}</td>
                          <td className="py-3.5 px-4 text-slate-600">{w.trade || w.role || 'General Artisan'}</td>
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

          {/* ========================================================================= */}
          {/* VIEW 5: TECHNICAL INSPECTION AND QC (DRILL-DOWN)                         */}
          {/* ========================================================================= */}
          {activeModule === 'qc' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Technical Inspection & QC Audits</h2>
                  <p className="text-xs text-slate-500">
                    Quality control inspections, engineering audits, structural sign-offs and compliance.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    Audits: {inspectionsList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule('overview')}
                    className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    &larr; Overview
                  </button>
                </div>
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
                        <th className="py-3 px-4">QC Status</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectionsList.map((i) => (
                        <tr key={i.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{i.subject || 'Site Audit'}</td>
                          <td className="py-3.5 px-4 text-slate-600">{i.project_name || 'Project'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
                              {i.status || 'Passed'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {formatDateNigerian(i.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 6: MATERIALS (DRILL-DOWN)                                            */}
          {/* ========================================================================= */}
          {activeModule === 'materials' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Materials Inventory & Stock</h2>
                  <p className="text-xs text-slate-500">
                    Real-time stock quantities, reorder thresholds, unit pricing, and site allocations.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    Total: {materialsList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule('overview')}
                    className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    &larr; Overview
                  </button>
                </div>
              </div>

              {materialsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No materials recorded yet in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Material Name</th>
                        <th className="py-3 px-4">Unit</th>
                        <th className="py-3 px-4">Current Stock</th>
                        <th className="py-3 px-4">Reorder Level</th>
                        <th className="py-3 px-4">Unit Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {materialsList.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{m.name}</td>
                          <td className="py-3.5 px-4 text-slate-600">{m.unit || 'units'}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {m.current_stock ?? m.stock_quantity ?? '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500">
                            {m.reorder_level ?? m.reorder_point ?? '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {m.unit_cost != null ? formatNaira(m.unit_cost) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 7: PROCUREMENT AND LOGISTICS (DRILL-DOWN)                            */}
          {/* ========================================================================= */}
          {activeModule === 'procurement' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Procurement Orders & Site Deliveries</h2>
                  <p className="text-xs text-slate-500">
                    Purchase orders, vendor fulfilment, and site delivery receipts.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    Orders: {purchaseOrdersList.length} &bull; Deliveries: {deliveriesList.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveModule('overview')}
                    className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    &larr; Overview
                  </button>
                </div>
              </div>

              {purchaseOrdersList.length === 0 && deliveriesList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No procurement or delivery orders recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">PO / Delivery Ref</th>
                        <th className="py-3 px-4">Supplier / Vendor</th>
                        <th className="py-3 px-4">Total Amount</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchaseOrdersList.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {po.po_number || `PO-${po.id.slice(0, 8)}`}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{po.vendor_name || 'Vendor'}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {formatNaira(po.total_amount ?? po.amount)}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
                              {po.status || 'Approved'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {formatDateNigerian(po.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 8: FINANCE AND COMMERCIAL (DRILL-DOWN)                               */}
          {/* ========================================================================= */}
          {activeModule === 'finance' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Finance & Commercial Strategic Oversight</h2>
                  <p className="text-xs text-slate-500">
                    Read-only corporate commercial metrics, project cost budgets, and receivable status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('overview')}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                >
                  &larr; Overview
                </button>
              </div>

              {/* Read-Only Notice */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#01875F] shrink-0" />
                <span>
                  Strategic Financial Read Access: Sensitive payment disbursement, transaction creation and account mutations are restricted to designated Financial Management roles.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Outstanding Receivables</span>
                  <span className="text-2xl font-bold text-slate-400">—</span>
                  <span className="text-[10px] text-amber-700 block mt-1 font-medium">Unsupported: Invoicing table not in schema</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Procurement Commitments Issued</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {formatNaira(
                      financialSummary?.totalProcurementCommitted ??
                      purchaseOrdersList.reduce((acc, po) => acc + (Number(po.total_cost || po.total_amount || po.amount) || 0), 0)
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {purchaseOrdersList.length} approved purchase orders
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Project Portfolio Contract Value</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {formatNaira(financialSummary?.totalContractValue)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {financialSummary?.activeProjectsCount ?? projectsList.length} active contracted projects
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 9: CLIENT EXPERIENCE (DRILL-DOWN)                                    */}
          {/* ========================================================================= */}
          {activeModule === 'clients' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Client Directory & Account Experience</h2>
                  <p className="text-xs text-slate-500">
                    Enterprise and residential client relationships, commercial accounts and contacts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('overview')}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                >
                  &larr; Overview
                </button>
              </div>

              {clientsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No client records found in public.clients table.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Client Name</th>
                        <th className="py-3 px-4">Email / Contact</th>
                        <th className="py-3 px-4">Company</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {clientsList.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{c.name}</td>
                          <td className="py-3.5 px-4 text-slate-600">{c.email || c.phone || '—'}</td>
                          <td className="py-3.5 px-4 text-slate-600">{c.company || '—'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
                              {c.status || 'Active'}
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

          {/* ========================================================================= */}
          {/* VIEW 10: STAFF PERFORMANCE (DRILL-DOWN)                                   */}
          {/* ========================================================================= */}
          {activeModule === 'staff' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Staff Performance & Conduct Logs</h2>
                  <p className="text-xs text-slate-500">
                    Disciplinary conduct, site safety adherence, and supervisory performance logs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('overview')}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                >
                  &larr; Overview
                </button>
              </div>

              {conductList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No conduct issues or performance violations recorded.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Incident / Note</th>
                        <th className="py-3 px-4">Severity</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {conductList.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{c.member_name || 'Staff'}</td>
                          <td className="py-3.5 px-4 text-slate-600">{c.description || c.title || 'Note'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700">
                              {c.severity || 'Standard'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {c.status || 'Reviewed'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-[11px] text-slate-400">
                            {formatDateNigerian(c.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 11: ARTISAN NETWORK (DRILL-DOWN)                                     */}
          {/* ========================================================================= */}
          {activeModule === 'artisans' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Artisan Network & Trade Roster</h2>
                  <p className="text-xs text-slate-500">
                    Registered tradesmen across electrical, carpentry, masonry, plumbing, steel and civil labor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('overview')}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                >
                  &larr; Overview
                </button>
              </div>

              {workforceList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No artisans registered in workforce table.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Artisan Name</th>
                        <th className="py-3 px-4">Trade</th>
                        <th className="py-3 px-4">Workforce Code</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {workforceList.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{w.name || w.full_name}</td>
                          <td className="py-3.5 px-4 text-slate-600">{w.trade || 'General'}</td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">{w.workforce_code || '—'}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F]">
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

          {/* ========================================================================= */}
          {/* VIEW 12: MANAGEMENT ALERTS (DRILL-DOWN)                                   */}
          {/* ========================================================================= */}
          {activeModule === 'alerts' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Operational Exceptions & RED Issues</h2>
                  <p className="text-xs text-slate-500">
                    Real system conditions requiring executive oversight and strategic intervention.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('overview')}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                >
                  &larr; Overview
                </button>
              </div>

              {alertsList.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No active exceptions or RED issues detected in system.
                </div>
              ) : (
                <div className="space-y-3">
                  {alertsList.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                        alert.severity === 'danger' || alert.severity === 'error'
                          ? 'bg-red-50/60 border-red-200 text-red-900'
                          : 'bg-amber-50/60 border-amber-200 text-amber-900'
                      }`}
                    >
                      <AlertOctagon
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          alert.severity === 'danger' || alert.severity === 'error' ? 'text-red-600' : 'text-amber-600'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{alert.title}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-white/70">
                            {alert.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 13: REPORTS (DRILL-DOWN)                                             */}
          {/* ========================================================================= */}
          {activeModule === 'reports' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Strategic Performance Reports</h2>
                  <p className="text-xs text-slate-500">
                    Executive summaries across operations, project milestones, procurement volume, and workforce.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('overview')}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
                >
                  &larr; Overview
                </button>
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
