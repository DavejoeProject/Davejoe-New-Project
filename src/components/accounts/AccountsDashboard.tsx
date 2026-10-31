import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
  FinancialControlService,
  FinancialControlExecutiveSummary,
} from '../../services/financialControlService';
import { formatNaira } from '../../services/dashboardService';
import {
  Receipt,
  CircleDollarSign,
  BarChart2,
  TrendingUp,
  RefreshCw,
  LogOut,
  FolderKanban,
  Building2,
  FileText,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { FinancialControlModule } from '../dashboard/FinancialControlModule';
import { DailyAttendanceWidget } from '../attendance/DailyAttendanceWidget';
import { ProjectMaterialRemnantsModule } from '../remnants/ProjectMaterialRemnantsModule';

export const AccountsDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const [financialSummary, setFinancialSummary] = useState<FinancialControlExecutiveSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'budget' | 'commitments' | 'remnants'>('overview');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [finRes, { data: poData }, { data: projData }] = await Promise.all([
        FinancialControlService.getExecutiveSummary(),
        supabase
          .from('purchase_orders')
          .select(`
            id,
            po_number,
            total_amount,
            status,
            created_at,
            supplier:suppliers(name),
            project:projects(name)
          `)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('projects').select('*').order('name'),
      ]);

      setFinancialSummary(finRes.data);
      setPurchaseOrders(poData || []);
      setProjects(projData || []);
    } catch (err) {
      console.warn('[AccountsDashboard] Error loading financial data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  const accountantName =
    profile?.display_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    user?.email?.split('@')[0] ||
    'Finance Officer';

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col text-slate-800 font-sans selection:bg-[#01875F]/20 selection:text-[#01875F]">
      {/* Top Header */}
      <header className="h-16 px-3 sm:px-8 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white border border-slate-100 shrink-0">
            <img src="/brand/pwa-192x192.png" alt="Davejoe Interiors" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-slate-900 tracking-tight text-xs sm:text-base block leading-tight truncate">
              Davejoe Accounts & Financial Control
            </span>
            <span className="text-[9.5px] sm:text-[10px] font-semibold text-[#01875F] tracking-wider uppercase block truncate">
              Financial Ledgers & Project Costing
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">{accountantName}</span>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 flex-1 overflow-x-hidden">
        {/* Daily Timekeeping for Accounts & Finance Officer */}
        <DailyAttendanceWidget />

        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <CircleDollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-[#01875F]" />
              <span>Accounts & Financial Command</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Project financial accounts, budgets vs actual disbursements, purchase commitments, and cost reporting.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-[#01875F] border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4" />
            <span>Fiscal Audit Stream Active</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar touch-pan-x flex-nowrap">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Financial Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('projects')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'projects' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Project Ledgers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'budget' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Budget vs Actual
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('commitments')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'commitments' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Purchase Commitments ({purchaseOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('remnants')}
            className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'remnants' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Remnants Reconciliation Value
          </button>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Enterprise Budget
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                    <CircleDollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : formatNaira(financialSummary?.totalContractValue || 0)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Contract value across all projects</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Actual Cost
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {isLoading ? '...' : formatNaira(financialSummary?.totalUsageExpenditure || 0)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Disbursed on labor, materials & ops</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Committed Orders
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-purple-700">
                  {isLoading ? '...' : formatNaira(financialSummary?.totalProcurementCommitted || 0)}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Approved purchase order value</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Fiscal Variance
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-[#01875F]">
                  {isLoading
                    ? '...'
                    : formatNaira(
                        (financialSummary?.totalContractValue || 0) -
                          (financialSummary?.totalProcurementCommitted || 0) -
                          (financialSummary?.totalUsageExpenditure || 0)
                      )}
                </div>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">Remaining contingency buffer</p>
              </div>
            </div>

            {/* Quick Commitments Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Recent Procurement Commitments</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('commitments')}
                  className="text-xs font-semibold text-[#01875F] hover:underline"
                >
                  View all commitments &rarr;
                </button>
              </div>

              {purchaseOrders.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  No purchase orders logged yet in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="py-2.5 px-3">PO Number</th>
                        <th className="py-2.5 px-3">Project</th>
                        <th className="py-2.5 px-3">Supplier</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purchaseOrders.slice(0, 6).map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{po.po_number || po.id.slice(0, 8)}</td>
                          <td className="py-3 px-3 font-semibold text-slate-800">{po.project?.name || 'Site'}</td>
                          <td className="py-3 px-3 text-slate-600">{po.supplier?.name || 'Vendor'}</td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">{formatNaira(po.total_amount)}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200 capitalize">
                              {po.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2 & 3: FINANCIAL CONTROL MODULE EMBED */}
        {activeTab === 'projects' && (
          <FinancialControlModule initialTab="projects" onBackToDashboard={() => setActiveTab('overview')} />
        )}

        {activeTab === 'budget' && (
          <FinancialControlModule initialTab="budget_vs_actual" onBackToDashboard={() => setActiveTab('overview')} />
        )}

        {/* TAB 4: COMMITMENTS */}
        {activeTab === 'commitments' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Procurement & Supplier Commitments</h2>
              <span className="text-xs text-slate-400">Total: {purchaseOrders.length}</span>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No purchase commitments recorded in database.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">PO Number</th>
                      <th className="py-2.5 px-3">Project Site</th>
                      <th className="py-2.5 px-3">Supplier Name</th>
                      <th className="py-2.5 px-3 text-right">Commitment Value</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{po.po_number || po.id.slice(0, 8)}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{po.project?.name || 'Site'}</td>
                        <td className="py-3 px-3 text-slate-600">{po.supplier?.name || 'Vendor'}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">{formatNaira(po.total_amount)}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200 capitalize">
                            {po.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{new Date(po.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: REMNANTS RECONCILIATION */}
        {activeTab === 'remnants' && <ProjectMaterialRemnantsModule />}
      </main>
    </div>
  );
};
