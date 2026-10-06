import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Scale,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  Eye,
  Building,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Calendar,
  User,
  Boxes,
  Layers,
} from 'lucide-react';
import {
  MaterialReconciliationService,
  MaterialReconciliationRecord,
  ReconciliationSummary,
} from '../../services/materialReconciliationService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { formatNigerianDate } from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { RecordReconciliationModal } from './RecordReconciliationModal';

interface ReconciliationModuleProps {
  onBackToDashboard?: () => void;
}

export const ReconciliationModule: React.FC<ReconciliationModuleProps> = () => {
  const navigate = useNavigate();

  // Data states
  const [reconciliations, setReconciliations] = useState<MaterialReconciliationRecord[]>([]);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [totalUnfilteredCount, setTotalUnfilteredCount] = useState<number>(0);

  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'balanced' | 'variance'>('all');

  // Modals & Detail Drawer
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);
  const [selectedReconciliation, setSelectedReconciliation] =
    useState<MaterialReconciliationRecord | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load dropdown projects once
  useEffect(() => {
    MaterialRequestsService.getProjectsForDropdown().then((res) => {
      setProjects(res.data);
    });
  }, []);

  // Fetch data
  const fetchData = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const hasVarianceParam =
          varianceFilter === 'balanced'
            ? false
            : varianceFilter === 'variance'
            ? true
            : 'all';

        const [sumRes, listRes] = await Promise.all([
          MaterialReconciliationService.getReconciliationSummary(),
          MaterialReconciliationService.getMaterialReconciliations({
            search: debouncedSearch,
            projectId: projectFilter,
            hasVariance: hasVarianceParam,
          }),
        ]);

        if (sumRes.error) {
          console.error('[Reconciliation] Summary error:', sumRes.error);
        } else {
          setSummary(sumRes.data);
        }

        if (listRes.error) {
          setErrorMessage(listRes.error);
        } else {
          setReconciliations(listRes.data);
          setTotalUnfilteredCount(listRes.totalUnfilteredCount);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to load reconciliation data from database.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, projectFilter, varianceFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setProjectFilter('all');
    setVarianceFilter('all');
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    projectFilter !== 'all' ||
    varianceFilter !== 'all';

  const handleReconciliationRecorded = () => {
    fetchData(true);
  };

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                MATERIALS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Scale className="w-7 h-7 text-[#01875F]" />
              <span>Reconciliation</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Audit physical site inventories against recorded stock, deliveries, usage, and variance logs.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Reconciliation</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="reconciliation" />

      {/* 3. Executive Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL AUDITS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalReconciliations ?? totalUnfilteredCount)}
          </span>
          <span className="text-[11px] text-slate-500">Site reconciliations logged</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            BALANCED POSITIONS
          </span>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.balancedCount ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Zero variance confirmed</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            DISCREPANCIES IDENTIFIED
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.varianceCount ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !summary ? '...' : (summary?.varianceCount ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Audits with variance</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            NET VARIANCE QUANTITY
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.totalVarianceQuantity ?? 0) < 0
                ? 'text-rose-600'
                : (summary?.totalVarianceQuantity ?? 0) > 0
                ? 'text-blue-600'
                : 'text-slate-900'
            }`}
          >
            {isLoading && !summary
              ? '...'
              : (summary?.totalVarianceQuantity ?? 0) > 0
              ? `+${(summary?.totalVarianceQuantity ?? 0).toLocaleString()}`
              : (summary?.totalVarianceQuantity ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500">Cumulative stock discrepancy</span>
        </div>
      </div>

      {/* 4. Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by material name, project, or audit notes..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            />
          </div>

          {/* Project filter */}
          <div className="sm:col-span-3">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Project Sites</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Variance filter */}
          <div className="sm:col-span-3">
            <select
              value={varianceFilter}
              onChange={(e) => setVarianceFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Audits</option>
              <option value="balanced">Balanced Positions Only (Variance = 0)</option>
              <option value="variance">Discrepancies Only (Variance ≠ 0)</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {reconciliations.length} matching reconciliation audit
              {reconciliations.length === 1 ? '' : 's'}
            </span>
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

      {/* 5. Main Table & Empty States */}
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
          <h2 className="text-base font-bold text-slate-900">Unable to load reconciliations</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : reconciliations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
            <Scale className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {hasActiveFilters
              ? 'No reconciliation records match your current filters'
              : 'No reconciliation records yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try clearing or modifying your project site or variance filters.'
              : 'Reconciliation audits conducted across project sites will appear here.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Record Reconciliation</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Material</th>
                  <th className="py-3.5 px-3">Project Site</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3 text-right">Expected Stock</th>
                  <th className="py-3.5 px-3 text-right">Physical Count</th>
                  <th className="py-3.5 px-3 text-center">Variance</th>
                  <th className="py-3.5 px-3">Auditor</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliations.map((rec) => {
                  const variance = Number(rec.variance_quantity) || 0;
                  const isBalanced = Math.abs(variance) < 0.0001;
                  const isShortage = variance < -0.0001;
                  const unit = rec.material?.unit_of_measure || 'units';

                  const auditorName = rec.reconciler
                    ? `${rec.reconciler.first_name || ''} ${rec.reconciler.last_name || ''}`.trim() ||
                      rec.reconciler.display_name ||
                      'Executive User'
                    : 'System Auditor';

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedReconciliation(rec)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Material */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-[#01875F] transition-colors">
                          {rec.material?.name || 'Material Item'}
                        </div>
                        <div className="text-[10.5px] font-mono text-slate-400">
                          {rec.material?.material_code || '—'} • {rec.material?.category || 'General'}
                        </div>
                      </td>

                      {/* Project Site */}
                      <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                        {rec.projects ? (
                          <Link
                            to={`/management/projects/${rec.project_id}`}
                            className="font-medium text-slate-800 hover:text-[#01875F] hover:underline"
                          >
                            <span className="font-mono text-[11px] text-slate-500 mr-1">
                              {rec.projects.project_code}
                            </span>
                            <span>{rec.projects.name}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">Not recorded</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {formatNigerianDate(rec.reconciliation_date)}
                      </td>

                      {/* Expected Stock */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-700">
                        {Number(rec.expected_closing_quantity ?? 0).toLocaleString()} {unit}
                      </td>

                      {/* Physical Count */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        {Number(rec.closing_quantity ?? 0).toLocaleString()} {unit}
                      </td>

                      {/* Variance */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                            isBalanced
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isShortage
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isBalanced
                                ? 'bg-[#01875F]'
                                : isShortage
                                ? 'bg-rose-500'
                                : 'bg-blue-500'
                            }`}
                          />
                          {isBalanced
                            ? 'Balanced (0)'
                            : `${variance > 0 ? `+${variance.toLocaleString()}` : variance.toLocaleString()} ${unit}`}
                        </span>
                      </td>

                      {/* Auditor */}
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {auditorName}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedReconciliation(rec)}
                          className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Inspect Reconciliation Audit"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Showing {reconciliations.length} of {totalUnfilteredCount} total reconciliation record
              {totalUnfilteredCount === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Live Database Connected
            </span>
          </div>
        </div>
      )}

      {/* 6. Reconciliation Detail Drawer / Modal */}
      {selectedReconciliation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div
            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#01875F] flex items-center justify-center shrink-0 border border-emerald-200">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Reconciliation Audit Detail
                  </h2>
                  <p className="text-xs text-slate-500">
                    {formatNigerianDate(selectedReconciliation.reconciliation_date)} • Site Inventory Verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReconciliation(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar text-xs">
              {/* Material & Project Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Material Item
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedReconciliation.material?.name || 'Material Item'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between">
                    <span>Code: {selectedReconciliation.material?.material_code || '—'}</span>
                    <Link
                      to="/management/materials/directory"
                      className="text-[#01875F] hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Catalog</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Project Location
                  </span>
                  <div className="font-bold text-slate-900 text-sm">
                    {selectedReconciliation.projects?.name || 'Site Project'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 flex items-center justify-between">
                    <span>Code: {selectedReconciliation.projects?.project_code || '—'}</span>
                    {selectedReconciliation.project_id && (
                      <Link
                        to={`/management/projects/${selectedReconciliation.project_id}`}
                        className="text-[#01875F] hover:underline inline-flex items-center gap-0.5"
                      >
                        <span>Project</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* Inventory Movement Formula Breakdown */}
              <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-5 space-y-3 font-mono">
                <span className="font-sans font-bold text-xs uppercase tracking-wider text-slate-700 block">
                  Inventory Movement Ledger Verification
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Opening Count:</span>
                    <span>{Number(selectedReconciliation.opening_quantity ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>(+) Site Deliveries Inward:</span>
                    <span>+{Number(selectedReconciliation.delivered_quantity ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-teal-700">
                    <span>(+) Site Returns Inward:</span>
                    <span>+{Number(selectedReconciliation.returned_quantity ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>(-) Site Usage & Consumption:</span>
                    <span>-{Number(selectedReconciliation.consumed_quantity ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>(-) Damaged Goods:</span>
                    <span>-{Number(selectedReconciliation.damaged_quantity ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>(-) Construction Wastage:</span>
                    <span>-{Number(selectedReconciliation.wasted_quantity ?? 0).toLocaleString()}</span>
                  </div>

                  <div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-slate-900">
                    <span>Expected Theoretical Closing:</span>
                    <span>{Number(selectedReconciliation.expected_closing_quantity ?? 0).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between font-bold text-slate-900">
                    <span>Physical Stocktaking Count:</span>
                    <span className="text-[#01875F]">
                      {Number(selectedReconciliation.closing_quantity ?? 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-bold">
                    <span>Net Audit Variance:</span>
                    <span
                      className={
                        Number(selectedReconciliation.variance_quantity ?? 0) === 0
                          ? 'text-emerald-700'
                          : Number(selectedReconciliation.variance_quantity ?? 0) < 0
                          ? 'text-rose-700'
                          : 'text-blue-700'
                      }
                    >
                      {Number(selectedReconciliation.variance_quantity ?? 0) > 0
                        ? `+${Number(selectedReconciliation.variance_quantity).toLocaleString()}`
                        : Number(selectedReconciliation.variance_quantity ?? 0).toLocaleString()}{' '}
                      {selectedReconciliation.material?.unit_of_measure || 'units'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold">
                    <User className="w-3.5 h-3.5" />
                    <span>Auditor Sign-off</span>
                  </div>
                  <div className="font-semibold text-slate-800">
                    {selectedReconciliation.reconciler
                      ? `${selectedReconciliation.reconciler.first_name || ''} ${selectedReconciliation.reconciler.last_name || ''}`.trim() ||
                        selectedReconciliation.reconciler.display_name
                      : 'Executive Auditor'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Logged: {formatNigerianDate(selectedReconciliation.created_at)}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-xl border border-slate-200/80 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Discrepancy Notes & Audit Remarks
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
                    {selectedReconciliation.notes || 'No discrepancy notes provided for this audit.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedReconciliation(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Modal */}
      <RecordReconciliationModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onReconciliationRecorded={handleReconciliationRecorded}
      />
    </div>
  );
};

export default ReconciliationModule;
