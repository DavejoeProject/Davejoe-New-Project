import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Search,
  Filter,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import {
  WorkforcePerformanceService,
  ProductivityItem,
  FilterOptions,
} from '../../services/workforcePerformanceService';
import { formatDateNigerian } from '../../services/dashboardService';
import { WorkforceNavTabs } from './WorkforceNavTabs';

interface ProductivityModuleProps {
  onBackToDashboard?: () => void;
}

export const ProductivityModule: React.FC<ProductivityModuleProps> = ({ onBackToDashboard }) => {
  const navigate = useNavigate();

  const [records, setRecords] = useState<ProductivityItem[]>([]);
  const [metrics, setMetrics] = useState<{
    totalRecords: number;
    uniqueWorkersCount: number;
    uniqueProjectsCount: number;
    unitsSummary: Array<{ unit: string; totalOutput: number; recordCount: number }>;
  }>({
    totalRecords: 0,
    uniqueWorkersCount: 0,
    uniqueProjectsCount: 0,
    unitsSummary: [],
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    projects: [],
    workers: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load filter options
  useEffect(() => {
    async function loadOptions() {
      const res = await WorkforcePerformanceService.getFilterOptions();
      if (res.data) {
        setFilterOptions(res.data);
      }
    }
    loadOptions();
  }, []);

  // Fetch Productivity Records
  const fetchProductivity = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const res = await WorkforcePerformanceService.getProductivityData({
        date: dateFilter,
        projectId: projectFilter,
        workforceId: workerFilter,
        search: searchQuery,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setRecords(res.records);
        setMetrics(res.metrics);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [dateFilter, projectFilter, workerFilter, searchQuery]
  );

  useEffect(() => {
    fetchProductivity();
  }, [fetchProductivity]);

  const handleClearFilters = () => {
    setDateFilter('');
    setProjectFilter('all');
    setWorkerFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Top Header & Breadcrumb */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                WORKFORCE CONTROL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Activity className="w-7 h-7 text-[#01875F]" />
              <span>Productivity</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Monitor recorded workforce output across projects.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchProductivity(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh productivity records from database"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <WorkforceNavTabs activeTab="productivity" />

      {/* Summary KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL RECORDS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {metrics.totalRecords}
          </span>
          <span className="text-[11px] text-slate-500">Recorded output logs</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            ARTISANS LOGGED
          </span>
          <span className="text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {metrics.uniqueWorkersCount}
          </span>
          <span className="text-[11px] text-slate-500">With documented output</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            ACTIVE SITES
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {metrics.uniqueProjectsCount}
          </span>
          <span className="text-[11px] text-slate-500">Projects with output</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
            UNIT SPECIALTIES
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {metrics.unitsSummary.length}
          </span>
          <span className="text-[11px] text-slate-500">Distinct craft units</span>
        </div>
      </div>

      {/* Verified Craft Unit Breakdown (No combined fake score) */}
      {metrics.unitsSummary.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#01875F]" />
            <span>Output Volumes by Craft Measurement Unit</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {metrics.unitsSummary.map((u) => (
              <div
                key={u.unit}
                className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70 text-center"
              >
                <span className="text-[10.5px] font-bold text-slate-500 uppercase block truncate">
                  {u.unit}
                </span>
                <span className="text-lg font-bold font-mono text-slate-900 mt-0.5 block">
                  {u.totalOutput.toLocaleString()}
                </span>
                <span className="text-[10.5px] text-slate-400 block mt-0.5">
                  Across {u.recordCount} logs
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by worker name, code, trade, notes, or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F] transition-all"
            />
          </div>

          {/* Quick Clear */}
          {(dateFilter || projectFilter !== 'all' || workerFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer self-start md:self-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Date:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#01875F]"
            />
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Project:</span>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Projects</option>
              {filterOptions.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Worker Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Worker:</span>
            <select
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              className="h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer max-w-[200px] truncate"
            >
              <option value="all">All Workers</option>
              {filterOptions.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  [{w.code}] {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area: Table / Empty / Error / Loading */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        /* Database Error State with Retry */
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load productivity records.</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            A database communication error occurred while querying productivity records.
          </p>
          <p className="text-xs font-mono text-red-600 bg-red-50 p-2.5 rounded-lg mt-3 border border-red-100">
            {errorMessage}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fetchProductivity(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      ) : records.length === 0 ? (
        /* Exact Zero-Demo-Data Empty State */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-4 border border-[#01875F]/20">
            <Activity className="w-7 h-7" strokeWidth={1.8} />
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">No productivity records</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Productivity records created in the system will appear here.
          </p>
        </div>
      ) : (
        /* Real Productivity Table */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 font-bold">Worker</th>
                  <th className="py-3.5 px-3 font-bold">Workforce Code</th>
                  <th className="py-3.5 px-3 font-bold">Project</th>
                  <th className="py-3.5 px-3 font-bold">Work Date</th>
                  <th className="py-3.5 px-3 font-bold">Output / Count</th>
                  <th className="py-3.5 px-3 font-bold">Unit of Measure</th>
                  <th className="py-3.5 px-4 font-bold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec) => {
                  const worker = rec.workforce_members;
                  const prof = worker?.profiles;
                  const workerName =
                    prof?.display_name ||
                    (prof?.first_name || prof?.last_name
                      ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
                      : worker ? `Artisan ${worker.workforce_code}` : 'Unknown Worker');

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Worker with Link */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/management/workforce/${rec.workforce_member_id}`)}
                          className="font-bold text-slate-900 hover:text-[#01875F] flex items-center gap-1.5 transition-colors cursor-pointer text-left"
                          title="Open Workforce Control Centre"
                        >
                          <span>{workerName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>
                        {worker?.trade && (
                          <div className="text-[11px] text-slate-400">{worker.trade}</div>
                        )}
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/management/workforce/${rec.workforce_member_id}`)}
                          className="font-mono text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                        >
                          {worker?.workforce_code || '—'}
                        </button>
                      </td>

                      {/* Project with Link */}
                      <td className="py-3.5 px-3">
                        {rec.projects ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/management/projects/${rec.project_id}`)}
                            className="font-bold text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer text-left"
                            title="Open Project Control Centre"
                          >
                            <span>{rec.projects.name}</span>
                            <span className="font-mono text-slate-400 text-[11px]">
                              [{rec.projects.project_code}]
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Work Date */}
                      <td className="py-3.5 px-3 font-mono font-semibold text-slate-800">
                        {rec.work_date
                          ? formatDateNigerian(rec.work_date)
                          : formatDateNigerian(rec.created_at)}
                      </td>

                      {/* Count / Quantity */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900 text-sm">
                        {rec.count != null ? rec.count.toLocaleString() : '—'}
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-3 text-slate-700">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px]">
                          {rec.unit_of_measure || 'units'}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-slate-500 max-w-[240px] truncate">
                        {rec.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Count */}
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Showing {records.length} productivity records
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductivityModule;
