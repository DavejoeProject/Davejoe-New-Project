import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CircleDollarSign,
  BarChart2,
  Receipt,
  Building,
  RefreshCw,
  Search,
  ExternalLink,
  Eye,
  AlertCircle,
  Truck,
  Boxes,
  X,
  FileText,
  Info,
} from 'lucide-react';
import {
  FinancialControlService,
  FinancialControlExecutiveSummary,
  ProjectFinancialSummaryItem,
  SupplierFinancialCommitment,
} from '../../services/financialControlService';
import { formatNaira, formatNigerianDate } from '../../services/materialsService';
import { PROJECT_STATUS_CONFIG, ProjectStatus } from '../../services/projectService';

export type FinancialTab = 'projects' | 'budget_vs_actual' | 'procurement';

interface FinancialControlModuleProps {
  initialTab?: FinancialTab;
  onBackToDashboard?: () => void;
}

export const FinancialControlModule: React.FC<FinancialControlModuleProps> = ({
  initialTab = 'projects',
}) => {
  const navigate = useNavigate();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<FinancialTab>(initialTab);

  // Data states
  const [summary, setSummary] = useState<FinancialControlExecutiveSummary | null>(null);
  const [projectsList, setProjectsList] = useState<ProjectFinancialSummaryItem[]>([]);
  const [supplierList, setSupplierList] = useState<SupplierFinancialCommitment[]>([]);

  // Flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail Drawer/Modal
  const [selectedProject, setSelectedProject] = useState<ProjectFinancialSummaryItem | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchData = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      try {
        const [sumRes, projRes, supRes] = await Promise.all([
          FinancialControlService.getExecutiveSummary(),
          FinancialControlService.getProjectFinancialsList({
            search: debouncedSearch,
            status: statusFilter,
          }),
          FinancialControlService.getSupplierCommitments(),
        ]);

        if (sumRes.error) {
          console.error('[FinancialControl] Summary error:', sumRes.error);
        } else {
          setSummary(sumRes.data);
        }

        if (projRes.error) {
          setErrorMessage(projRes.error);
        } else {
          setProjectsList(projRes.data);
        }

        if (!supRes.error && supRes.data) {
          setSupplierList(supRes.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to load financial control records from database.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
  };

  const hasActiveFilters = debouncedSearch.trim() !== '' || statusFilter !== 'all';

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                FINANCIAL CONTROL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <CircleDollarSign className="w-7 h-7 text-[#01875F]" />
              <span>Project Costs & Financial Control</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Monitor project financial commitments, commercial procurement orders, and expenditure records across the organization.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-center disabled:opacity-60"
            title="Refresh Financials"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Executive KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL CONTRACT VALUE
          </span>
          <span className="text-xl sm:text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {isLoading && !summary ? '...' : formatNaira(summary?.totalContractValue ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Agreed project contract sums</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            PROCUREMENT COMMITTED
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : formatNaira(summary?.totalProcurementCommitted ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Commercial PO commitments</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            REQUIREMENTS ESTIMATE
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : formatNaira(summary?.totalRequirementsEstimate ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Material BOQ baseline target</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            MATERIAL USAGE RECORDED
          </span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : formatNaira(summary?.totalUsageExpenditure ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Recorded site consumption</span>
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-1.5 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {[
          { key: 'projects', label: 'Project Costs', icon: Building },
          { key: 'budget_vs_actual', label: 'Budget vs Actual (Target vs Commitment)', icon: BarChart2 },
          { key: 'procurement', label: 'Procurement Costs & Suppliers', icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as FinancialTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#01875F] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Accounting Standard Notification */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
        <Info className="w-4 h-4 text-[#01875F] shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-900">Accounting & Audit Integrity Notice:</strong> All figures are strictly derived from verified Supabase records. Agreed contract values and BOQ material estimates are recorded baseline figures; procurement commitments represent authorized purchase orders. When separate budget line items are not defined, unrecorded figures are transparently noted rather than manufactured.
        </div>
      </div>

      {/* 5. Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project code or project name..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Project Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="approved">Approved</option>
              <option value="quotation">Quotation</option>
              <option value="enquiry">Enquiry</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Showing {projectsList.length} matching project financial records</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-[#01875F] font-semibold hover:underline cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. Main Tab Content */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load financial records</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : projectsList.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {hasActiveFilters ? 'No projects match your filter criteria' : 'No projects yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try clearing your search query or selecting a different status filter.'
              : 'Registered construction projects and their financial commitments will appear here.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* TAB: PROJECT COSTS */}
          {activeTab === 'projects' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4">Project</th>
                      <th className="py-3.5 px-3">Status</th>
                      <th className="py-3.5 px-3 text-right">Contract Value</th>
                      <th className="py-3.5 px-3 text-right">Procurement Committed</th>
                      <th className="py-3.5 px-3 text-right">Requirements BOQ</th>
                      <th className="py-3.5 px-3 text-right">Material Usage</th>
                      <th className="py-3.5 px-3 text-center">Purchase Orders</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectsList.map((p) => {
                      const statusCfg =
                        PROJECT_STATUS_CONFIG[p.status as ProjectStatus] || {
                          label: p.status,
                          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                        };

                      return (
                        <tr
                          key={p.projectId}
                          onClick={() => setSelectedProject(p)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 group-hover:text-[#01875F] transition-colors">
                              {p.projectName}
                            </div>
                            <div className="font-mono text-[10.5px] text-slate-400">
                              {p.projectCode}
                            </div>
                          </td>

                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${statusCfg.badgeClass}`}
                            >
                              {statusCfg.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-bold text-[#01875F]">
                            {p.contractValue != null ? formatNaira(p.contractValue) : 'Not recorded'}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatNaira(p.procurementCommitted)}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                            {formatNaira(p.requirementsEstimate)}
                          </td>

                          <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                            {formatNaira(p.usageRecordedValue)}
                          </td>

                          <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {p.purchaseOrdersCount}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedProject(p)}
                                className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Inspect Project Financial Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <Link
                                to={`/management/projects/${p.projectId}`}
                                className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors inline-block"
                                title="Open Project Control Centre"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: BUDGET VS ACTUAL (TARGET BENCHMARKS VS COMMITMENTS) */}
          {activeTab === 'budget_vs_actual' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3.5 px-4">Project</th>
                        <th className="py-3.5 px-3 text-right">Contract Value</th>
                        <th className="py-3.5 px-3 text-right">Procurement Committed</th>
                        <th className="py-3.5 px-3 text-right">Commitment % of Contract</th>
                        <th className="py-3.5 px-3 text-right">Requirements BOQ</th>
                        <th className="py-3.5 px-3 text-right">Actual Material Usage</th>
                        <th className="py-3.5 px-3 text-right">Usage % of BOQ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectsList.map((p) => {
                        const cv = p.contractValue;
                        const poPct =
                          cv && cv > 0
                            ? Math.round((p.procurementCommitted / cv) * 100)
                            : null;
                        const req = p.requirementsEstimate;
                        const usePct =
                          req && req > 0
                            ? Math.round((p.usageRecordedValue / req) * 100)
                            : null;

                        return (
                          <tr
                            key={p.projectId}
                            onClick={() => setSelectedProject(p)}
                            className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                          >
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 block">
                                {p.projectName}
                              </span>
                              <span className="font-mono text-[10.5px] text-slate-400">
                                {p.projectCode}
                              </span>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono font-bold text-[#01875F]">
                              {cv != null ? formatNaira(cv) : 'Not recorded'}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-800">
                              {formatNaira(p.procurementCommitted)}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono">
                              {poPct != null ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    poPct > 100
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {poPct}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                              {formatNaira(p.requirementsEstimate)}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatNaira(p.usageRecordedValue)}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono">
                              {usePct != null ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    usePct > 100
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                  }`}
                                >
                                  {usePct}%
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROCUREMENT COSTS & SUPPLIER BREAKDOWN */}
          {activeTab === 'procurement' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      Supplier Commercial Commitments
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Total procurement liabilities grouped by registered vendor.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {supplierList.length} Registered Vendors
                  </span>
                </div>

                {supplierList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No supplier commitments recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    {supplierList.map((s) => (
                      <div
                        key={s.supplierId}
                        className="p-3.5 bg-white flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{s.supplierName}</span>
                          <span className="font-mono text-[11px] text-slate-400 ml-2">
                            ({s.supplierCode}) • {s.ordersCount} Purchase Order
                            {s.ordersCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-[#01875F] text-sm">
                          {formatNaira(s.totalCommitted)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* 7. Financial Detail Drawer / Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#01875F] flex items-center justify-center shrink-0 border border-emerald-200">
                  <CircleDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {selectedProject.projectName}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    Project Code: {selectedProject.projectCode} • Status: {selectedProject.status}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Agreed Contract Value
                  </span>
                  <div className="text-lg font-bold font-mono text-[#01875F] mt-1">
                    {selectedProject.contractValue != null
                      ? formatNaira(selectedProject.contractValue)
                      : 'Not recorded in database'}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Procurement Committed
                  </span>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                    {formatNaira(selectedProject.procurementCommitted)}
                  </div>
                  <span className="text-[10.5px] text-slate-400 font-mono mt-0.5 block">
                    {selectedProject.purchaseOrdersCount} purchase order(s)
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Material Requirements BOQ Target
                  </span>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                    {formatNaira(selectedProject.requirementsEstimate)}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Material Usage Recorded
                  </span>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-1">
                    {formatNaira(selectedProject.usageRecordedValue)}
                  </div>
                </div>
              </div>

              {/* Direct drilldown links */}
              <div className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-2.5">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700 block">
                  Operational Control Drilldown
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    to={`/management/projects/${selectedProject.projectId}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#01875F] text-white rounded-lg text-xs font-semibold hover:bg-[#016f4e] transition-colors"
                  >
                    <span>Open Project Control Centre</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    to="/management/materials/procurement"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
                  >
                    <span>View Procurement Orders</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialControlModule;
