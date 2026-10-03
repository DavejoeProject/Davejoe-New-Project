import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Building,
  Truck,
  X,
  Boxes,
} from 'lucide-react';
import {
  ProcurementService,
  PurchaseOrderRecord,
  ProcurementSummary,
  SupplierRecord,
  ALL_PURCHASE_ORDER_STATUSES,
  PURCHASE_ORDER_STATUS_CONFIG,
} from '../../services/procurementService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import {
  formatNaira,
  formatNigerianDate,
} from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { ApprovePurchaseOrderModal } from './ApprovePurchaseOrderModal';
import { RejectPurchaseOrderModal } from './RejectPurchaseOrderModal';

interface ProcurementModuleProps {
  onBackToDashboard?: () => void;
}

export const ProcurementModule: React.FC<ProcurementModuleProps> = () => {
  const navigate = useNavigate();

  // Data states
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [summary, setSummary] = useState<ProcurementSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [totalUnfilteredCount, setTotalUnfilteredCount] = useState<number>(0);

  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedApproveOrder, setSelectedApproveOrder] =
    useState<PurchaseOrderRecord | null>(null);
  const [selectedRejectOrder, setSelectedRejectOrder] =
    useState<PurchaseOrderRecord | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load dropdown projects and suppliers once
  useEffect(() => {
    Promise.all([
      MaterialRequestsService.getProjectsForDropdown(),
      ProcurementService.getSuppliersForDropdown(),
    ]).then(([projRes, supRes]) => {
      setProjects(projRes.data);
      setSuppliers(supRes.data);
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
        const [sumRes, listRes] = await Promise.all([
          ProcurementService.getProcurementSummary(),
          ProcurementService.getPurchaseOrders({
            search: debouncedSearch,
            status: statusFilter,
            projectId: projectFilter,
            supplierId: supplierFilter,
          }),
        ]);

        if (sumRes.error) {
          console.error('[Procurement] Summary error:', sumRes.error);
        } else {
          setSummary(sumRes.data);
        }

        if (listRes.error) {
          setErrorMessage(listRes.error);
        } else {
          setOrders(listRes.data);
          setTotalUnfilteredCount(listRes.totalUnfilteredCount);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load procurement data from database.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, statusFilter, projectFilter, supplierFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setProjectFilter('all');
    setSupplierFilter('all');
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    statusFilter !== 'all' ||
    projectFilter !== 'all' ||
    supplierFilter !== 'all';

  const handleOrderCreated = (newOrder: PurchaseOrderRecord) => {
    fetchData(true);
    navigate(`/management/materials/procurement/${newOrder.id}`);
  };

  const handleApproved = () => {
    fetchData(true);
  };

  const handleRejected = () => {
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
              <ShoppingCart className="w-7 h-7 text-[#01875F]" />
              <span>Procurement</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Manage purchase orders, supplier commitments and procurement activity across projects.
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
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="procurement" />

      {/* 3. Executive Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL ORDERS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalPurchaseOrders ?? totalUnfilteredCount)}
          </span>
          <span className="text-[11px] text-slate-500">Orders logged in system</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            PENDING APPROVAL
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.pendingApproval ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !summary ? '...' : (summary?.pendingApproval ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Awaiting management sign-off</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            COMMITTED VALUE
          </span>
          <span className="text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {isLoading && !summary ? '...' : formatNaira(summary?.procurementCommitted ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Total active commitments</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            EXPECTED DELIVERIES
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.expectedDeliveries ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Upcoming site dispatches</span>
        </div>
      </div>

      {/* 4. Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code, supplier, or project..."
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
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier filter */}
          <div className="sm:col-span-3">
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.supplier_code})
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] transition-all"
            >
              <option value="all">All Statuses</option>
              {ALL_PURCHASE_ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {PURCHASE_ORDER_STATUS_CONFIG[st].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {orders.length} matching purchase order{orders.length === 1 ? '' : 's'}
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
          <h2 className="text-base font-bold text-slate-900">Unable to load procurement.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {hasActiveFilters ? 'No procurement records match your current filters.' : 'No procurement records yet'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
            {hasActiveFilters
              ? 'Try adjusting your search query, status, project, or vendor filters.'
              : 'Purchase orders created in the system will appear here.'}
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
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Purchase Order</span>
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
                  <th className="py-3.5 px-4">Purchase Order</th>
                  <th className="py-3.5 px-3">Project</th>
                  <th className="py-3.5 px-3">Supplier</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3">Purchase Date</th>
                  <th className="py-3.5 px-3">Expected Delivery</th>
                  <th className="py-3.5 px-3 text-right">Total</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((po) => {
                  const statusCfg = PURCHASE_ORDER_STATUS_CONFIG[po.status] || {
                    label: po.status,
                    badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
                    dotClasses: 'bg-slate-400',
                  };

                  const isPending = po.status === 'submitted' || po.status === 'draft';

                  return (
                    <tr
                      key={po.id}
                      onClick={() => navigate(`/management/materials/procurement/${po.id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Purchase Order Code */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 group-hover:text-[#01875F] transition-colors">
                          {po.purchase_code}
                        </div>
                        {po.items && (
                          <div className="text-[10.5px] text-slate-400">
                            {po.items.length} line item{po.items.length === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>

                      {/* Project */}
                      <td
                        className="py-3.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {po.projects ? (
                          <Link
                            to={`/management/projects/${po.project_id}`}
                            className="font-medium text-slate-800 hover:text-[#01875F] hover:underline"
                          >
                            <span className="font-mono text-[11px] text-slate-500 mr-1">
                              {po.projects.project_code}
                            </span>
                            <span>{po.projects.name}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">Not linked</span>
                        )}
                      </td>

                      {/* Supplier */}
                      <td className="py-3.5 px-3 text-slate-700 font-medium">
                        {po.suppliers ? po.suppliers.name : 'Vendor'}
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

                      {/* Purchase Date */}
                      <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatNigerianDate(po.purchase_date)}
                      </td>

                      {/* Expected Delivery */}
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap font-medium">
                        {po.expected_delivery_date
                          ? formatNigerianDate(po.expected_delivery_date)
                          : '—'}
                      </td>

                      {/* Total Cost */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatNaira(po.total_cost)}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => setSelectedApproveOrder(po)}
                                className="p-1.5 text-[#01875F] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Approve Purchase Order"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRejectOrder(po)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Reject Purchase Order"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => navigate(`/management/materials/procurement/${po.id}`)}
                            className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Open Procurement Control Centre"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Showing {orders.length} of {totalUnfilteredCount} total purchase order{totalUnfilteredCount === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Live Database Connected
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreatePurchaseOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onOrderCreated={handleOrderCreated}
      />

      <ApprovePurchaseOrderModal
        order={selectedApproveOrder}
        isOpen={Boolean(selectedApproveOrder)}
        onClose={() => setSelectedApproveOrder(null)}
        onApproved={handleApproved}
      />

      <RejectPurchaseOrderModal
        order={selectedRejectOrder}
        isOpen={Boolean(selectedRejectOrder)}
        onClose={() => setSelectedRejectOrder(null)}
        onRejected={handleRejected}
      />
    </div>
  );
};

export default ProcurementModule;
