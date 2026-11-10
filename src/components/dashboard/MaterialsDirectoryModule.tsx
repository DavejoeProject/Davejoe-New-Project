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
  getMaterialCategoryLabel,
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
      {/* 1. Header & Breadcrumbs */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
              <Package className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#18b892]">
                  MATERIALS
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Materials Directory
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl leading-relaxed">
                Manage the organization&apos;s material master catalog and inventory reference information.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 h-10 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              title="Refresh materials from database"
            >
              <RefreshCw
                className={`w-4 h-4 text-[#18b892] shrink-0 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
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
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            TOTAL MATERIALS
          </span>
          <span className="text-3xl sm:text-4xl font-bold text-slate-900 mt-1 block font-mono tracking-tight">
            {isLoading && !executiveSummary
              ? '...'
              : (executiveSummary?.totalMaterials ?? totalUnfilteredCount)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">Master catalog records</span>
        </div>

        {/* Card 2: LOW STOCK */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            LOW STOCK
          </span>
          <span
            className={`text-3xl sm:text-4xl font-bold mt-1 block font-mono tracking-tight ${
              (executiveSummary?.lowStockCount ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !executiveSummary ? '...' : (executiveSummary?.lowStockCount ?? 0)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">At or below reorder level</span>
        </div>

        {/* Card 3: ACTIVE MATERIALS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            ACTIVE MATERIALS
          </span>
          <span className="text-3xl sm:text-4xl font-bold text-slate-900 mt-1 block font-mono tracking-tight">
            {isLoading && !executiveSummary ? '...' : (executiveSummary?.activeCount ?? 0)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">Available for requisition</span>
        </div>

        {/* Card 4: INACTIVE MATERIALS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            INACTIVE MATERIALS
          </span>
          <span className="text-3xl sm:text-4xl font-bold text-slate-900 mt-1 block font-mono tracking-tight">
            {isLoading && !executiveSummary ? '...' : (executiveSummary?.inactiveCount ?? 0)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 block">Archived / discontinued</span>
        </div>
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search materials by name, code, brand or specification..."
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#18b892] transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-[#18b892] transition-all capitalize font-medium"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>
                  {getMaterialCategoryLabel(c)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-[#18b892] transition-all font-medium"
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
              className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-[#18b892] transition-all font-medium"
            >
              <option value="all">All Stock</option>
              <option value="low">Low Stock</option>
              <option value="adequate">Adequate Stock</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs sm:text-sm text-slate-500">
            <span>
              Showing {materials.length} matching material{materials.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-[#18b892] font-semibold hover:underline cursor-pointer"
            >
              <X className="w-4 h-4 shrink-0" />
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
              <div key={i} className="h-14 bg-slate-50 rounded border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-2xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load materials.</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : materials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center mx-auto mb-3 border border-[#18b892]/20">
            <Boxes className="w-7 h-7 shrink-0" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {hasActiveFilters ? 'No materials match your current filters.' : 'No materials yet'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try adjusting your search keywords, category, or stock condition filters.'
              : 'Materials created in the system will appear here.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 bg-[#18b892] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-2xs hover:bg-[#139c7b] transition-colors cursor-pointer"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#18b892] text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs hover:bg-[#139c7b] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span>+ Add Material</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Desktop & Tablet Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-xs tracking-wider">
                  <th className="py-3.5 px-4 min-w-[200px]">Material</th>
                  <th className="py-3.5 px-3 min-w-[120px]">Code</th>
                  <th className="py-3.5 px-3 min-w-[130px]">Category</th>
                  <th className="py-3.5 px-3 min-w-[90px]">Unit</th>
                  <th className="py-3.5 px-3 text-right min-w-[120px]">Current Stock</th>
                  <th className="py-3.5 px-3 text-right min-w-[120px]">Reorder Level</th>
                  <th className="py-3.5 px-3 text-right min-w-[130px]">Standard Cost</th>
                  <th className="py-3.5 px-3 text-center min-w-[130px]">Stock Status</th>
                  <th className="py-3.5 px-3 text-center min-w-[110px]">Status</th>
                  <th className="py-3.5 px-4 text-right min-w-[160px]">Actions</th>
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
                        <div className="font-bold text-slate-900 group-hover:text-[#18b892] transition-colors text-sm">
                          {m.name}
                        </div>
                        {(m.brand || m.specification) && (
                          <div className="text-xs text-slate-400 font-normal truncate max-w-xs mt-0.5">
                            {m.brand && <span>{m.brand}</span>}
                            {m.brand && m.specification && <span> • </span>}
                            {m.specification && <span>{m.specification}</span>}
                          </div>
                        )}
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-3 font-mono text-slate-700">
                        <span className="bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/80 text-xs font-bold whitespace-nowrap">
                          {m.material_code}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 text-slate-700 font-medium">
                        {getMaterialCategoryLabel(m.category)}
                      </td>

                      {/* Unit */}
                      <td className="py-3.5 px-3 text-slate-500 font-mono text-xs">
                        {m.unit_of_measure}
                      </td>

                      {/* Current Stock */}
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                        <span
                          className={`font-bold ${
                            isLow ? 'text-amber-600' : 'text-slate-900'
                          }`}
                        >
                          {m.current_stock.toLocaleString()}
                        </span>{' '}
                        <span className="text-xs text-slate-400 font-normal">
                          {m.unit_of_measure}
                        </span>
                      </td>

                      {/* Reorder Level */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                        {m.reorder_level !== null ? m.reorder_level.toLocaleString() : '0'}{' '}
                        <span className="text-xs text-slate-400 font-normal">
                          {m.unit_of_measure}
                        </span>
                      </td>

                      {/* Standard Unit Cost */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatNaira(m.standard_unit_cost)}
                      </td>

                      {/* Stock Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${
                            isLow
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isLow ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#18b892] shrink-0" />
                          )}
                          {stockCondition}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${statusCfg.badgeClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dotClasses}`} />
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
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                            title="View Material Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Details</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedEditMaterial(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[#18b892] bg-[#18b892]/10 hover:bg-[#18b892]/20 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                            title="Edit Material"
                          >
                            <Edit2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Edit</span>
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
          <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-200 text-xs sm:text-sm text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Showing <strong className="text-slate-800">{materials.length}</strong> of {totalUnfilteredCount} total material{totalUnfilteredCount === 1 ? '' : 's'}
            </span>
            <span className="text-xs text-slate-400 font-mono font-medium">
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
