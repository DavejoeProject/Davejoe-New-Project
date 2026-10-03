import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Boxes,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  SlidersHorizontal,
  Hammer,
  Eye,
  Building,
  Calendar,
  Layers,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  MaterialStockService,
  StockPositionItem,
  MaterialStockMovementRecord,
  MaterialUsageRecord,
  StockSummary,
  MOVEMENT_TYPE_CONFIG,
} from '../../services/materialStockService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { formatNigerianDate, formatNaira } from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { RecordStockAdjustmentModal } from './RecordStockAdjustmentModal';
import { RecordMaterialUsageModal } from './RecordMaterialUsageModal';
import { StockDetailModal } from './StockDetailModal';

interface StockModuleProps {
  onBackToDashboard?: () => void;
}

export const StockModule: React.FC<StockModuleProps> = () => {
  const navigate = useNavigate();

  // Section switcher: 'positions' | 'movements' | 'usage'
  const [activeSection, setActiveSection] = useState<'positions' | 'movements' | 'usage'>('positions');

  // Data states
  const [positions, setPositions] = useState<StockPositionItem[]>([]);
  const [movements, setMovements] = useState<MaterialStockMovementRecord[]>([]);
  const [usages, setUsages] = useState<MaterialUsageRecord[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);

  // Flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Modals
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState<boolean>(false);
  const [selectedStockDetail, setSelectedStockDetail] = useState<StockPositionItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    MaterialRequestsService.getProjectsForDropdown().then((res) => {
      setProjects(res.data);
    });
  }, []);

  const fetchData = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      try {
        const [sumRes, posRes, movRes, usgRes] = await Promise.all([
          MaterialStockService.getStockSummary(),
          MaterialStockService.getStockPositions({
            search: debouncedSearch,
            status: statusFilter,
          }),
          MaterialStockService.getStockMovements({
            search: debouncedSearch,
            projectId: projectFilter,
          }),
          MaterialStockService.getMaterialUsageRecords({
            search: debouncedSearch,
            projectId: projectFilter,
          }),
        ]);

        if (sumRes.error) {
          console.error('[Stock] Summary error:', sumRes.error);
        } else {
          setSummary(sumRes.data);
        }

        if (posRes.error) {
          setErrorMessage(posRes.error);
        } else {
          setPositions(posRes.data);
        }

        if (movRes.data) {
          setMovements(movRes.data);
        }
        if (usgRes.data) {
          setUsages(usgRes.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load stock inventory data.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter, projectFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setProjectFilter('all');
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' || statusFilter !== 'all' || projectFilter !== 'all';

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
              <Boxes className="w-7 h-7 text-[#01875F]" />
              <span>Stock & Inventory Control</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Monitor physical stock positions, warehouse movements and operational site usage.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdjustmentModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-600" />
              <span>Adjust Stock</span>
            </button>

            <button
              type="button"
              onClick={() => setIsUsageModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Usage</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="stock" />

      {/* 3. Executive Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL MATERIALS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalMaterials ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Catalog SKUs registered</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL STOCK UNITS
          </span>
          <span className="text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalStockPositions ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500">Total units on hand</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            LOW STOCK ITEMS
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.lowStockItems ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !summary ? '...' : (summary?.lowStockItems ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">At or below reorder level</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            OUT OF STOCK
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.outOfStockItems ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !summary ? '...' : (summary?.outOfStockItems ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Zero recorded balance</span>
        </div>
      </div>

      {/* 4. Sub-Section Switcher & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveSection('positions')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'positions'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock Positions ({positions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('movements')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'movements'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Movement Ledger ({movements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('usage')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'usage'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Site Usage Records ({usages.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search materials, projects, or movements..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>

            {activeSection === 'positions' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              >
                <option value="all">All Positions</option>
                <option value="healthy">Healthy</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            )}

            {(activeSection === 'movements' || activeSection === 'usage') && (
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} • {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filters active</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-[#01875F] font-semibold hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* 5. Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 animate-pulse space-y-3">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-24 bg-slate-50 rounded" />
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200 p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load stock.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activeSection === 'positions' ? (
        /* Stock Positions Table */
        positions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No stock records yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Materials added in the Materials Directory will show their inventory balances here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Material</th>
                    <th className="py-3.5 px-3">Code</th>
                    <th className="py-3.5 px-3">Category</th>
                    <th className="py-3.5 px-3">Unit</th>
                    <th className="py-3.5 px-3 text-right">Current Stock</th>
                    <th className="py-3.5 px-3 text-right">Reorder Level</th>
                    <th className="py-3.5 px-3 text-center">Stock Status</th>
                    <th className="py-3.5 px-3">Location</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {positions.map((pos) => {
                    const isOut = pos.stockStatus === 'out_of_stock';
                    const isLow = pos.stockStatus === 'low_stock';
                    return (
                      <tr
                        key={pos.id}
                        onClick={() => setSelectedStockDetail(pos)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 group-hover:text-[#01875F]">
                            {pos.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono font-semibold text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 text-[11px]">
                            {pos.material_code}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 capitalize text-slate-600">
                          {pos.category || 'General'}
                        </td>
                        <td className="py-3.5 px-3 text-slate-500 font-mono">
                          {pos.unit_of_measure}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                          {pos.current_stock.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono text-slate-500">
                          {pos.reorder_level || 0}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {isOut ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Healthy
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">
                          {pos.storage_location || 'Central Store'}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedStockDetail(pos)}
                            className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Inspect Stock Ledger"
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
          </div>
        )
      ) : activeSection === 'movements' ? (
        /* Movement Ledger Table */
        movements.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No stock movements recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Receipts, transfers, site usage and inventory adjustments will generate auditable ledger entries here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-3">Material</th>
                    <th className="py-3.5 px-3 text-center">Movement</th>
                    <th className="py-3.5 px-3 text-right">Quantity</th>
                    <th className="py-3.5 px-3">Project / Destination</th>
                    <th className="py-3.5 px-3">Reference / Notes</th>
                    <th className="py-3.5 px-4">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => {
                    const cfg = MOVEMENT_TYPE_CONFIG[m.movement_type] || {
                      label: m.movement_type,
                      badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
                      isPositive: true,
                    };
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {formatNigerianDate(m.movement_date)}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-bold text-slate-900">
                            {m.material?.name || 'Material Item'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {m.material?.material_code}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold border ${cfg.badgeClasses}`}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <span className={cfg.isPositive ? 'text-emerald-700' : 'text-rose-600'}>
                            {cfg.isPositive ? '+' : '-'}{Number(m.quantity).toLocaleString()} {m.material?.unit_of_measure}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700">
                          {m.projects ? (
                            <Link
                              to={`/management/projects/${m.project_id}`}
                              className="hover:text-[#01875F] hover:underline"
                            >
                              {m.projects.name}
                            </Link>
                          ) : (
                            'Central Warehouse'
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                          {m.reference_code && (
                            <span className="font-mono font-semibold text-slate-700 mr-1">
                              {m.reference_code}
                            </span>
                          )}
                          <span>{m.notes || '—'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {m.recorder
                            ? `${m.recorder.first_name || ''} ${m.recorder.last_name || ''}`.trim() ||
                              m.recorder.display_name
                            : 'System'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Usage Records Table */
        usages.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
              <Hammer className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No material usage recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Material consumed on project sites will be logged here.
            </p>
            <button
              type="button"
              onClick={() => setIsUsageModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Record Usage</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Usage Date</th>
                    <th className="py-3.5 px-3">Project</th>
                    <th className="py-3.5 px-3">Material</th>
                    <th className="py-3.5 px-3 text-right">Quantity Used</th>
                    <th className="py-3.5 px-3">Assigned Worker</th>
                    <th className="py-3.5 px-3">Purpose</th>
                    <th className="py-3.5 px-3">Work Area</th>
                    <th className="py-3.5 px-4">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usages.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatNigerianDate(u.usage_date)}
                      </td>
                      <td className="py-3.5 px-3">
                        {u.projects ? (
                          <Link
                            to={`/management/projects/${u.project_id}`}
                            className="font-medium text-slate-800 hover:text-[#01875F] hover:underline"
                          >
                            {u.projects.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Site</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {u.material?.name || 'Material'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {Number(u.quantity_used).toLocaleString()} {u.material?.unit_of_measure}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {u.workforce?.profiles
                          ? `${u.workforce.profiles.first_name || ''} ${u.workforce.profiles.last_name || ''}`.trim() ||
                            u.workforce.profiles.display_name
                          : 'Site Team'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {u.purpose || 'Work Execution'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                        {u.work_area || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {u.recorder
                          ? `${u.recorder.first_name || ''} ${u.recorder.last_name || ''}`.trim() ||
                            u.recorder.display_name
                          : 'System'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modals */}
      <RecordStockAdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        onAdjustmentRecorded={() => fetchData(true)}
      />

      <RecordMaterialUsageModal
        isOpen={isUsageModalOpen}
        onClose={() => setIsUsageModalOpen(false)}
        onUsageRecorded={() => fetchData(true)}
      />

      <StockDetailModal
        item={selectedStockDetail}
        isOpen={Boolean(selectedStockDetail)}
        onClose={() => setSelectedStockDetail(null)}
        onStockUpdated={() => fetchData(true)}
      />
    </div>
  );
};

export default StockModule;
