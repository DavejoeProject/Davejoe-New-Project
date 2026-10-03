import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  Eye,
  Edit2,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  MaterialsService,
  MaterialRecord,
  DirectoryExecutiveSummary,
  MATERIAL_STATUS_CONFIG,
  ALL_MATERIAL_STATUSES,
  formatNaira,
  getStockStatus,
} from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { MaterialDetailModal } from './MaterialDetailModal';
import { AddMaterialModal } from './AddMaterialModal';
import { EditMaterialModal } from './EditMaterialModal';

interface MaterialsDirectoryModuleProps {
  onBackToDashboard?: () => void;
}

export const MaterialsDirectoryModule: React.FC<MaterialsDirectoryModuleProps> = () => {
  const navigate = useNavigate();

  // Data states
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [totalUnfilteredCount, setTotalUnfilteredCount] = useState<number>(0);
  const [uniqueCategories, setUniqueCategories] = useState<string[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<DirectoryExecutiveSummary | null>(null);

  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stockConditionFilter, setStockConditionFilter] = useState<'all' | 'low' | 'adequate'>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedViewMaterial, setSelectedViewMaterial] = useState<MaterialRecord | null>(null);
  const [selectedEditMaterial, setSelectedEditMaterial] = useState<MaterialRecord | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Executive Summary & Materials
  const fetchData = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const [summaryRes, materialsRes] = await Promise.all([
          MaterialsService.getDirectoryExecutiveSummary(),
          MaterialsService.getMaterials({
            search: debouncedSearch,
            category: categoryFilter,
            status: statusFilter,
            stockCondition: stockConditionFilter,
          }),
        ]);

        if (summaryRes.error) {
          console.error('[MaterialsDirectory] Executive summary error:', summaryRes.error);
        } else {
          setExecutiveSummary(summaryRes.data);
        }

        if (materialsRes.error) {
          setErrorMessage(materialsRes.error);
        } else {
          setMaterials(materialsRes.data);
          setTotalUnfilteredCount(materialsRes.totalUnfilteredCount);
          setUniqueCategories(materialsRes.uniqueCategories);
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Unable to connect to database.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, categoryFilter, statusFilter, stockConditionFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setStockConditionFilter('all');
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    categoryFilter !== 'all' ||
    statusFilter !== 'all' ||
    stockConditionFilter !== 'all';

  const handleMaterialCreated = (newMaterial: MaterialRecord) => {
    fetchData(true);
    setSelectedViewMaterial(newMaterial);
  };

  const handleMaterialUpdated = (updatedMaterial: MaterialRecord) => {
    fetchData(true);
    setSelectedViewMaterial(updatedMaterial);
  };

  const handleOpenEditFromView = (material: MaterialRecord) => {
    setSelectedViewMaterial(null);
    setSelectedEditMaterial(material);
  };

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header & Breadcrumbs */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                MATERIALS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Package className="w-7 h-7 text-[#01875F]" />
              <span>Materials Directory</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Manage the organization&apos;s material master catalog and inventory reference information.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh materials from database"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="directory" />

      {/* 3. Executive Summary KPI Cards (Restrained Enterprise Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: TOTAL MATERIALS */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL MATERIALS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !executiveSummary
              ? '...'
              : (executiveSummary?.totalMaterials ?? totalUnfilteredCount)}
          </span>
          <span className="text-[11px] text-slate-500">Master catalog records</span>
        </div>

        {/* Card 2: LOW STOCK */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            LOW STOCK
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (executiveSummary?.lowStockCount ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !executiveSummary ? '...' : (executiveSummary?.lowStockCount ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">At or below reorder level</span>
        </div>

        {/* Card 3: ACTIVE MATERIALS */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            ACTIVE MATERIALS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !executiveSummary ? '...' : (executiveSummary?.activeCount ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Available for requisition</span>
        </div>

        {/* Card 4: INACTIVE MATERIALS */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            INACTIVE MATERIALS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !executiveSummary ? '...' : (executiveSummary?.inactiveCount ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Archived / discontinued</span>
        </div>
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials by name, code, brand or specification..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all capitalize"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Statuses</option>
              {ALL_MATERIAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {MATERIAL_STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Condition Filter */}
          <div className="sm:col-span-2">
            <select
              value={stockConditionFilter}
              onChange={(e) => setStockConditionFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Stock</option>
              <option value="low">Low Stock</option>
              <option value="adequate">Adequate Stock</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {materials.length} matching material{materials.length === 1 ? '' : 's'}
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

      {/* 5. Main Content: Table / Loading / Error / Empty States */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load materials.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {hasActiveFilters ? 'No materials match your current filters.' : 'No materials yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try adjusting your search keywords, category, or stock condition filters.'
              : 'Materials created in the system will appear here.'}
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
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Material</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Desktop & Tablet Table */}
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
                  <th className="py-3.5 px-3 text-right">Standard Cost</th>
                  <th className="py-3.5 px-3 text-center">Stock Status</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.map((m) => {
                  const statusCfg = MATERIAL_STATUS_CONFIG[m.status] || {
                    label: m.status,
                    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
                    dotClasses: 'bg-slate-400',
                  };

                  const stockCondition = getStockStatus(m.current_stock, m.reorder_level);
                  const isLow = stockCondition === 'LOW STOCK';

                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedViewMaterial(m)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Material Name & Brand/Spec */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-[#01875F] transition-colors">
                          {m.name}
                        </div>
                        {(m.brand || m.specification) && (
                          <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                            {m.brand && <span>{m.brand}</span>}
                            {m.brand && m.specification && <span> • </span>}
                            {m.specification && <span>{m.specification}</span>}
                          </div>
                        )}
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-3 font-mono text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 text-[11px] font-semibold">
                          {m.material_code}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 text-slate-700 font-medium">
                        {m.category || 'General'}
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-3 text-slate-500 font-mono">
                        {m.unit_of_measure}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-3 text-right font-mono">
                        <span
                          className={`font-bold ${
                            isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}
                        >
                          {m.current_stock.toLocaleString()}
                        </span>{' '}
                        <span className="text-[11px] text-slate-400 font-normal">
                          {m.unit_of_measure}
                        </span>
                      </td>

                      {/* Reorder Level */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                        {m.reorder_level !== null ? m.reorder_level.toLocaleString() : '0'}{' '}
                        <span className="text-[11px] text-slate-400 font-normal">
                          {m.unit_of_measure}
                        </span>
                      </td>

                      {/* Standard Unit Cost */}
                      <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-900">
                        {formatNaira(m.standard_unit_cost)}
                      </td>

                      {/* Stock Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                            isLow
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isLow ? (
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-[#01875F]" />
                          )}
                          {stockCondition}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${statusCfg.badgeClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClasses}`} />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedViewMaterial(m)}
                            className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Material Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedEditMaterial(m)}
                            className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Material"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Showing {materials.length} of {totalUnfilteredCount} total material{totalUnfilteredCount === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Live Database Active
            </span>
          </div>
        </div>
      )}

      {/* 6. Modals */}
      <AddMaterialModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onMaterialCreated={handleMaterialCreated}
        existingCategories={uniqueCategories}
      />

      <EditMaterialModal
        material={selectedEditMaterial}
        isOpen={Boolean(selectedEditMaterial)}
        onClose={() => setSelectedEditMaterial(null)}
        onMaterialUpdated={handleMaterialUpdated}
        existingCategories={uniqueCategories}
      />

      <MaterialDetailModal
        material={selectedViewMaterial}
        isOpen={Boolean(selectedViewMaterial)}
        onClose={() => setSelectedViewMaterial(null)}
        onEdit={handleOpenEditFromView}
      />
    </div>
  );
};

export default MaterialsDirectoryModule;
