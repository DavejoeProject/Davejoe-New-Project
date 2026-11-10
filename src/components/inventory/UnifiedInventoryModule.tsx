import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Boxes,
  Plus,
  Search,
  Filter,
  ShoppingCart,
  Send,
  ArrowRightLeft,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  RefreshCw,
  Building2,
  FileQuestion,
  Layers,
  Archive,
  Truck,
  ExternalLink,
  ChevronDown,
  X,
  User,
  Shield,
  FileText,
  Clock,
  Sparkles,
  PieChart,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  UnifiedInventoryService,
  UnifiedInventoryItem,
  InventoryTransactionRecord,
  InventoryIssuanceRecord,
  InventorySaleRecord,
  InventoryEnquiryRecord,
  InventoryOverviewMetrics,
  DEFAULT_INVENTORY_CATEGORIES,
  InventoryBusinessUnit,
  StockOwnership,
} from '../../services/unifiedInventoryService';
import { RehabGlobalService, RehabPaintProduct, RehabProductionRun } from '../../services/rehabGlobalService';
import { formatNaira } from '../../services/materialsService';

interface UnifiedInventoryModuleProps {
  onBackToDashboard?: () => void;
  initialTab?: 'overview' | 'items' | 'sales' | 'issuances' | 'enquiries' | 'partners' | 'rehab';
}

export const UnifiedInventoryModule: React.FC<UnifiedInventoryModuleProps> = ({
  onBackToDashboard,
  initialTab = 'overview',
}) => {
  const { user, profile, currentRoleKey, hasPermission } = useAuth();
  const isLeadership = currentRoleKey === 'management' || currentRoleKey === 'executive_director';
  const isAdmin = currentRoleKey === 'admin' || isLeadership;

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'sales' | 'issuances' | 'enquiries' | 'partners' | 'rehab'>(
    initialTab
  );

  // Data states
  const [items, setItems] = useState<UnifiedInventoryItem[]>([]);
  const [metrics, setMetrics] = useState<InventoryOverviewMetrics>({
    totalItems: 0,
    totalPhysicalQuantity: 0,
    totalStockValue: 0,
    totalQuantitySold: 0,
    totalSalesRevenue: 0,
    lowStockItemsCount: 0,
    outOfStockItemsCount: 0,
    itemsIssuedToProjects: 0,
    itemsIssuedToArtisans: 0,
    partnerSuppliedCount: 0,
    pendingEnquiriesCount: 0,
  });
  const [transactions, setTransactions] = useState<InventoryTransactionRecord[]>([]);
  const [issuances, setIssuances] = useState<InventoryIssuanceRecord[]>([]);
  const [sales, setSales] = useState<InventorySaleRecord[]>([]);
  const [enquiries, setEnquiries] = useState<InventoryEnquiryRecord[]>([]);
  const [rehabProducts, setRehabProducts] = useState<RehabPaintProduct[]>([]);
  const [rehabRuns, setRehabRuns] = useState<RehabProductionRun[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('all');
  const [selectedOwnership, setSelectedOwnership] = useState('all');

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isIssuanceModalOpen, setIsIssuanceModalOpen] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedItemForAction, setSelectedItemForAction] = useState<UnifiedInventoryItem | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Main loader
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [
        itemsRes,
        overviewRes,
        txRes,
        issRes,
        salesRes,
        enqRes,
        rProds,
        rRuns,
      ] = await Promise.all([
        UnifiedInventoryService.getItems({
          category: selectedCategory,
          businessUnit: selectedBusinessUnit,
          ownership: selectedOwnership,
          search: searchQuery,
        }),
        UnifiedInventoryService.getOverviewMetrics(),
        UnifiedInventoryService.getTransactions(25),
        UnifiedInventoryService.getIssuances(),
        UnifiedInventoryService.getSales(),
        UnifiedInventoryService.getEnquiries(),
        RehabGlobalService.getProducts(),
        RehabGlobalService.getProductionRuns(),
      ]);

      setItems(itemsRes.data || []);
      setMetrics(overviewRes);
      setTransactions(txRes);
      setIssuances(issRes);
      setSales(salesRes);
      setEnquiries(enqRes);
      setRehabProducts(rProds);
      setRehabRuns(rRuns);
    } catch (err) {
      console.warn('[UnifiedInventoryModule] Data sync warning:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCategory, selectedBusinessUnit, selectedOwnership, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#18b892]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Lockup Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#18b892] block mb-1">
            COMMERCIAL INVENTORY &amp; SALES ENGINE
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Boxes className="w-7 h-7 text-[#18b892]" />
            <span>Comprehensive Inventory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Physical stock tracking, sales checkout, issuances to site/artisans, Rehab Global paints, and partner consignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#18b892] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Sync Stock'}</span>
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setIsSaleModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>+ Record Sale</span>
              </button>

              <button
                type="button"
                onClick={() => setIsIssuanceModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>+ Issue Stock</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddItemOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Add Item</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto">
        {[
          { key: 'overview', label: 'Overview & Analytics', icon: PieChart },
          { key: 'items', label: `Stock Directory (${items.length})`, icon: Boxes },
          { key: 'sales', label: `Sales & Checkout (${sales.length})`, icon: ShoppingCart },
          { key: 'issuances', label: `Issuances & Accountability (${issuances.length})`, icon: Send },
          { key: 'enquiries', label: `Customer Enquiries (${enquiries.length})`, icon: FileQuestion },
          { key: 'partners', label: `Partner & Consignment (${metrics.partnerSuppliedCount})`, icon: Building2 },
          { key: 'rehab', label: `Rehab Global Paints (${rehabProducts.length})`, icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#18b892]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. OVERVIEW & ANALYTICS VIEW                                              */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                TOTAL INVENTORY VALUE
              </span>
              <span className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono tracking-tight mt-1 block">
                {formatNaira(metrics.totalStockValue)}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">
                {metrics.totalPhysicalQuantity} units in physical stock
              </span>
            </div>

            <div className="bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                TOTAL SALES REVENUE
              </span>
              <span className="text-3xl sm:text-4xl font-bold text-emerald-700 font-mono tracking-tight mt-1 block">
                {formatNaira(metrics.totalSalesRevenue)}
              </span>
              <span className="text-xs text-emerald-600 font-semibold mt-0.5 block">
                {metrics.totalQuantitySold} units sold to date
              </span>
            </div>

            <div className="bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                ISSUED TO SITES &amp; ARTISANS
              </span>
              <span className="text-3xl sm:text-4xl font-bold text-blue-700 font-mono tracking-tight mt-1 block">
                {metrics.itemsIssuedToProjects + metrics.itemsIssuedToArtisans}
              </span>
              <span className="text-xs text-blue-600 font-semibold mt-0.5 block">
                {metrics.itemsIssuedToProjects} on projects • {metrics.itemsIssuedToArtisans} with staff
              </span>
            </div>

            <div className="bg-white p-4.5 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                STOCK ATTENTION FLAGS
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-bold text-amber-600 font-mono tracking-tight">
                  {metrics.lowStockItemsCount}
                </span>
                <span className="text-xs text-slate-400 font-semibold">Low /</span>
                <span className="text-3xl sm:text-4xl font-bold text-rose-600 font-mono tracking-tight">
                  {metrics.outOfStockItemsCount}
                </span>
                <span className="text-xs text-slate-400 font-semibold">Empty</span>
              </div>
              <span className="text-xs text-slate-500 mt-0.5 block">Requires procurement reorder</span>
            </div>
          </div>

          {/* Categories Grid */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Product Categories Directory
              </h2>
              <span className="text-xs text-slate-400">Configurable Product Taxonomy</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DEFAULT_INVENTORY_CATEGORIES.map((cat) => {
                const count = items.filter((i) => i.category === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setActiveTab('items');
                    }}
                    className="p-3.5 rounded-xl border border-slate-200/70 hover:border-[#18b892] transition-colors cursor-pointer group bg-slate-50/50 hover:bg-white"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-[#18b892] transition-colors">
                        {cat.name}
                      </span>
                      <span className="text-[11px] font-bold font-mono px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-700">
                        {count}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                      {cat.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Stock Transactions Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Recent Stock Transactions Audit Trail</h2>
                <p className="text-xs text-slate-500">Every stock decrement, sale, or issuance is recorded immutably.</p>
              </div>
              <span className="text-xs font-mono text-slate-400">{transactions.length} Transactions</span>
            </div>

            {transactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No stock transactions logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Item</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Previous &rarr; New</th>
                      <th className="py-2.5 px-3">Recipient / Customer</th>
                      <th className="py-2.5 px-3">Ref Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500">{tx.created_at?.split('T')[0]}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {tx.transaction_type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">
                          {tx.item?.name || 'Stock Item'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{tx.quantity}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {tx.previous_stock} &rarr; <span className="font-bold text-[#18b892]">{tx.new_stock}</span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-700">
                          {tx.customer_name || tx.recipient_name || tx.project?.name || 'Internal'}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">{tx.reference_code || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. STOCK DIRECTORY VIEW                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
              <input
                type="text"
                placeholder="Search products by name, SKU, partner, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#18b892] transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
              >
                <option value="all">All Categories</option>
                {DEFAULT_INVENTORY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedBusinessUnit}
                onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
              >
                <option value="all">All Business Units</option>
                <option value="davejoe">Davejoe Interiors</option>
                <option value="rehab_global">Rehab Global (Paints)</option>
                <option value="partner">Partner Consignments</option>
              </select>

              <select
                value={selectedOwnership}
                onChange={(e) => setSelectedOwnership(e.target.value)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
              >
                <option value="all">All Stock Ownership</option>
                <option value="davejoe_owned">Davejoe-Owned</option>
                <option value="rehab_owned">Rehab-Owned</option>
                <option value="partner_owned">Partner-Owned</option>
                <option value="consignment">Consignment</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          {items.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center text-xs sm:text-sm text-slate-400 shadow-2xs">
              No inventory items match the current filters.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4 min-w-[200px]">Product Details</th>
                      <th className="py-3.5 px-3 min-w-[130px]">SKU</th>
                      <th className="py-3.5 px-3 min-w-[140px]">Category</th>
                      <th className="py-3.5 px-3 min-w-[140px]">Available Stock</th>
                      <th className="py-3.5 px-3 min-w-[130px]">Selling Price</th>
                      <th className="py-3.5 px-3 min-w-[160px]">Ownership / Partner</th>
                      <th className="py-3.5 px-3 min-w-[120px]">Location</th>
                      <th className="py-3.5 px-4 text-right min-w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const isLow = item.current_stock <= item.reorder_level && item.current_stock > 0;
                      const isEmpty = item.current_stock <= 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <div className="text-sm">{item.name}</div>
                            <div className="text-xs font-normal text-slate-400 font-sans mt-0.5">
                              {item.unit_of_measure}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/80 whitespace-nowrap">
                              {item.sku}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="capitalize font-medium text-slate-700 text-sm">
                              {item.category.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`font-mono font-bold text-sm tabular-nums ${
                                  isEmpty
                                    ? 'text-rose-600'
                                    : isLow
                                    ? 'text-amber-600'
                                    : 'text-slate-900'
                                }`}
                              >
                                {item.current_stock}
                              </span>
                              {isEmpty && (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-full whitespace-nowrap">
                                  Out of Stock
                                </span>
                              )}
                              {isLow && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full whitespace-nowrap">
                                  Low Stock
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-slate-900 tabular-nums text-sm">
                            {formatNaira(item.selling_price)}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="capitalize text-slate-700 font-medium text-sm">
                              {item.ownership.replace(/_/g, ' ')}
                            </span>
                            {item.partner_name && (
                              <div className="text-xs text-slate-400 font-medium mt-0.5">
                                ({item.partner_name})
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-slate-600 text-xs sm:text-sm">
                            {item.storage_location || 'Main Bay'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedItemForAction(item);
                                      setIsSaleModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                                    title="Sell this item"
                                  >
                                    Sell
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedItemForAction(item);
                                      setIsIssuanceModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold cursor-pointer transition-colors whitespace-nowrap"
                                    title="Issue to site / artisan"
                                  >
                                    Issue
                                  </button>
                                </>
                              )}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SALES & CHECKOUT VIEW                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Commercial Sales Register</h2>
              <p className="text-xs text-slate-500">
                Tracked sales of paints, diffusers, vases, tools, and decorative finishing items.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsSaleModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                + Record New Sale
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Qty</th>
                    <th className="py-3 px-3">Unit Price</th>
                    <th className="py-3 px-3">Total Value</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{s.sale_number}</td>
                      <td className="py-3 px-3 text-slate-500">{s.sale_date}</td>
                      <td className="py-3 px-3 font-sans font-semibold text-slate-800">
                        <div>{s.customer_name}</div>
                        {s.customer_phone && <div className="text-[10.5px] font-mono text-slate-400">{s.customer_phone}</div>}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{s.quantity}</td>
                      <td className="py-3 px-3">{formatNaira(s.unit_price)}</td>
                      <td className="py-3 px-3 font-bold text-[#18b892]">{formatNaira(s.total_price)}</td>
                      <td className="py-3 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {s.payment_method} • {s.payment_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500 text-[11px]">{s.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ISSUANCES & ACCOUNTABILITY REGISTER                                    */}
      {/* ========================================================================= */}
      {activeTab === 'issuances' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Staff &amp; Site Issuance Register</h2>
              <p className="text-xs text-slate-500">
                Full accountability: Who collected what, quantity, project assignment, authorization, and returns.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsIssuanceModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                + Issue Material / Tool
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 font-sans">
                    <th className="py-3 px-4">Issuance Code</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Collector / Recipient</th>
                    <th className="py-3 px-3">Quantity Issued</th>
                    <th className="py-3 px-3">Project / Site</th>
                    <th className="py-3 px-3">Return Status</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {issuances.map((iss) => (
                    <tr key={iss.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{iss.issuance_code}</td>
                      <td className="py-3 px-3 text-slate-500">{iss.issued_at?.split('T')[0]}</td>
                      <td className="py-3 px-3 font-sans font-bold text-slate-800">{iss.recipient_name}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{iss.quantity_issued}</td>
                      <td className="py-3 px-3 font-sans text-slate-700">{iss.project?.name || 'Artisan Workshop'}</td>
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            iss.status === 'fully_returned'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {iss.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500 text-[11px]">{iss.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CUSTOMER ENQUIRIES                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'enquiries' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Inventory Product Enquiries</h2>
              <p className="text-xs text-slate-500">
                Log customer requests for paints, screeding, diffusers, or vases before committing a sale.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsEnquiryModalOpen(true)}
              className="px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
            >
              + Log Customer Enquiry
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Enquiry Code</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Item Requested</th>
                    <th className="py-3 px-3">Quantity</th>
                    <th className="py-3 px-3">Quoted Price</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enquiries.map((enq) => (
                    <tr key={enq.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{enq.enquiry_number}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{enq.enquiry_date}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{enq.customer_name}</div>
                        <div className="text-[10.5px] font-mono text-slate-400">{enq.customer_phone}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{enq.item_name}</td>
                      <td className="py-3 px-3 font-mono font-bold">{enq.quantity_required}</td>
                      <td className="py-3 px-3 font-mono font-bold text-[#18b892]">
                        {enq.quoted_price ? formatNaira(enq.quoted_price) : 'Pending Quote'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200">
                          {enq.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">{enq.follow_up_notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PARTNER & CONSIGNMENT                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'partners' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900">Partner &amp; Vendor Consignment Portfolio</h2>
            <p className="text-xs text-slate-500">
              Clear distinction between Davejoe-owned inventory and third-party partner products (e.g. aroma diffusers, specialty tiles).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items
              .filter(
                (i) =>
                  i.business_unit === 'partner' ||
                  i.ownership === 'partner_owned' ||
                  i.ownership === 'consignment'
              )
              .map((pItem) => {
                const soldForThisItem = sales
                  .filter((s) => s.item_id === pItem.id)
                  .reduce((acc, s) => acc + Number(s.quantity), 0);
                const revenueForThisItem = sales
                  .filter((s) => s.item_id === pItem.id)
                  .reduce((acc, s) => acc + Number(s.total_price), 0);
                const commissionDue = (revenueForThisItem * (100 - (pItem.partner_commission_pct || 15))) / 100;

                return (
                  <div key={pItem.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase">
                          {pItem.partner_name || 'Partner Vendor'}
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 mt-1">{pItem.name}</h3>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-400">{pItem.sku}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">CURRENT STOCK</span>
                        <span className="font-bold text-slate-900">{pItem.current_stock}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">TOTAL SOLD</span>
                        <span className="font-bold text-emerald-700">{soldForThisItem}</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">COMMISSION</span>
                        <span className="font-bold text-blue-700">{pItem.partner_commission_pct}%</span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">PAYABLE DUE</span>
                        <span className="font-bold text-slate-900">{formatNaira(commissionDue)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. REHAB GLOBAL PAINTS INTEGRATION                                        */}
      {/* ========================================================================= */}
      {activeTab === 'rehab' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#18b892] block mb-1">
                MANUFACTURING &amp; FINISHED STOCK
              </span>
              <h2 className="text-base font-bold text-slate-900">Rehab Global Paint Production</h2>
              <p className="text-xs text-slate-500">
                Factory batches, finished paint inventory, and internal transfers to Davejoe Interiors sites.
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#18b892]" />
                <span>+ Internal Transfer to Davejoe</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {rehabProducts.map((p) => (
              <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">{p.sku}</span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {p.pack_size}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">{p.name}</h3>
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">FACTORY STOCK</span>
                    <span className="font-bold text-slate-900 text-base">{p.current_stock}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">SELLING RATE</span>
                    <span className="font-bold text-[#18b892]">{formatNaira(p.unit_selling_price)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE ACTION MODALS                                                 */}
      {/* ========================================================================= */}
      {isAddItemOpen && (
        <AddItemModal
          isOpen={isAddItemOpen}
          onClose={() => setIsAddItemOpen(false)}
          onCreated={(msg) => {
            showToast(msg);
            loadData(true);
          }}
        />
      )}

      {isSaleModalOpen && (
        <RecordSaleModal
          isOpen={isSaleModalOpen}
          initialItem={selectedItemForAction}
          items={items}
          onClose={() => {
            setIsSaleModalOpen(false);
            setSelectedItemForAction(null);
          }}
          onSaved={(msg) => {
            showToast(msg);
            loadData(true);
          }}
        />
      )}

      {isIssuanceModalOpen && (
        <RecordIssuanceModal
          isOpen={isIssuanceModalOpen}
          initialItem={selectedItemForAction}
          items={items}
          onClose={() => {
            setIsIssuanceModalOpen(false);
            setSelectedItemForAction(null);
          }}
          onSaved={(msg) => {
            showToast(msg);
            loadData(true);
          }}
        />
      )}

      {isEnquiryModalOpen && (
        <RecordEnquiryModal
          isOpen={isEnquiryModalOpen}
          items={items}
          onClose={() => setIsEnquiryModalOpen(false)}
          onSaved={(msg) => {
            showToast(msg);
            loadData(true);
          }}
        />
      )}

      {isTransferModalOpen && (
        <InternalTransferModal
          isOpen={isTransferModalOpen}
          rehabProducts={rehabProducts}
          onClose={() => setIsTransferModalOpen(false)}
          onSaved={(msg) => {
            showToast(msg);
            loadData(true);
          }}
        />
      )}
    </div>
  );
};

// ==============================================================================
// 1. ADD INVENTORY ITEM MODAL
// ==============================================================================
interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (msg: string) => void;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'paints',
    description: '',
    unit_of_measure: 'pcs',
    cost_price: 0,
    selling_price: 0,
    current_stock: 0,
    reorder_level: 5,
    business_unit: 'davejoe' as InventoryBusinessUnit,
    ownership: 'davejoe_owned' as StockOwnership,
    partner_name: '',
    partner_commission_pct: 0,
    supplier: '',
    storage_location: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError('Please enter product name.');
    const sku = formData.sku.trim() || 'SKU-' + Math.floor(100000 + Math.random() * 900000);

    setIsSubmitting(true);
    const res = await UnifiedInventoryService.createItem(
      {
        ...formData,
        sku,
        status: 'active',
        image_url: null,
        partner_name: formData.partner_name.trim() || null,
        supplier: formData.supplier.trim() || null,
        storage_location: formData.storage_location.trim() || null,
        description: formData.description.trim() || null,
      },
      user?.id
    );
    setIsSubmitting(false);

    if (res.data) {
      onCreated(`Inventory item "${res.data.name}" registered successfully.`);
      onClose();
    } else {
      setError(res.error || 'Failed to register item.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto select-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Register Inventory Product</h2>
            <p className="text-xs text-slate-500">Paints, screeding, tools, diffusers, vases, and partner merchandise.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Fluted Ceramic Vase (Tall Matte White)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              >
                {DEFAULT_INVENTORY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU / Code (Auto if empty)</label>
              <input
                type="text"
                placeholder="e.g. DJ-VAS-001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Initial Stock</label>
              <input
                type="number"
                min="0"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: Number(e.target.value) })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Cost Price (₦)</label>
              <input
                type="number"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Selling Price (₦)</label>
              <input
                type="number"
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Unit</label>
              <select
                value={formData.business_unit}
                onChange={(e) => setFormData({ ...formData, business_unit: e.target.value as any })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              >
                <option value="davejoe">Davejoe Interiors</option>
                <option value="rehab_global">Rehab Global</option>
                <option value="partner">Partner Vendor</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ownership Model</label>
              <select
                value={formData.ownership}
                onChange={(e) => setFormData({ ...formData, ownership: e.target.value as any })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              >
                <option value="davejoe_owned">Davejoe-Owned Stock</option>
                <option value="rehab_owned">Rehab-Owned Stock</option>
                <option value="partner_owned">Partner-Owned Stock</option>
                <option value="consignment">Consignment Stock</option>
              </select>
            </div>
          </div>

          {formData.business_unit === 'partner' && (
            <div className="grid grid-cols-2 gap-3 bg-purple-50 p-3 rounded-xl border border-purple-200">
              <div>
                <label className="block font-semibold text-purple-900 mb-1">Partner / Vendor Name</label>
                <input
                  type="text"
                  placeholder="e.g. AromaVibe Studio"
                  value={formData.partner_name}
                  onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                  className="w-full h-9 px-3 bg-white border border-purple-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-purple-900 mb-1">Partner Commission (%)</label>
                <input
                  type="number"
                  placeholder="20"
                  value={formData.partner_commission_pct}
                  onChange={(e) => setFormData({ ...formData, partner_commission_pct: Number(e.target.value) })}
                  className="w-full h-9 px-3 bg-white border border-purple-200 rounded-lg text-slate-900 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#18b892] text-white font-bold rounded-lg shadow-sm"
            >
              {isSubmitting ? 'Registering...' : 'Register Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// 2. RECORD SALE MODAL (ATOMIC DEDUCTION)
// ==============================================================================
interface RecordSaleModalProps {
  isOpen: boolean;
  initialItem?: UnifiedInventoryItem | null;
  items: UnifiedInventoryItem[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const RecordSaleModal: React.FC<RecordSaleModalProps> = ({
  isOpen,
  initialItem,
  items,
  onClose,
  onSaved,
}) => {
  const { user } = useAuth();
  const [selectedItemId, setSelectedItemId] = useState(initialItem?.id || (items[0]?.id || ''));
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(initialItem?.selling_price || 0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'cash' | 'pos' | 'cheque'>('transfer');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending' | 'partially_paid'>('paid');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialItem) {
      setSelectedItemId(initialItem.id);
      setUnitPrice(initialItem.selling_price);
    }
  }, [initialItem]);

  const activeItem = items.find((i) => i.id === selectedItemId);

  const handleItemChange = (id: string) => {
    setSelectedItemId(id);
    const found = items.find((i) => i.id === id);
    if (found) setUnitPrice(found.selling_price);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return setError('Please enter customer name.');
    if (!selectedItemId) return setError('Please select a product.');
    if (quantity <= 0) return setError('Quantity must be greater than 0.');

    setIsSubmitting(true);
    const res = await UnifiedInventoryService.recordSale({
      itemId: selectedItemId,
      quantity,
      unitPrice,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      paymentMethod,
      paymentStatus,
      notes: notes.trim() || undefined,
      salespersonId: user?.id,
    });
    setIsSubmitting(false);

    if (res.success) {
      onSaved(`Sale recorded successfully! Receipt #${res.saleNumber}.`);
      onClose();
    } else {
      setError(res.error || 'Sale checkout failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto select-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Record Commercial Sale</h2>
            <p className="text-xs text-slate-500">Atomic inventory deduction &amp; receipt issuance.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Product *</label>
            <select
              value={selectedItemId}
              onChange={(e) => handleItemChange(e.target.value)}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Available: {i.current_stock}) — {formatNaira(i.selling_price)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity Sold *</label>
              <input
                type="number"
                min="1"
                max={activeItem ? activeItem.current_stock : 9999}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit Selling Price (₦)</label>
              <input
                type="number"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between font-mono">
            <span className="text-emerald-900 font-sans font-semibold">Total Sale Price:</span>
            <span className="text-base font-bold text-emerald-800">{formatNaira(quantity * unitPrice)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Mrs. Funke Bakare"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Phone</label>
              <input
                type="tel"
                placeholder="0802 345 6789"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              >
                <option value="transfer">Bank Transfer</option>
                <option value="pos">POS Terminal</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              >
                <option value="paid">Paid in Full</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="pending">Payment Pending</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow-sm"
            >
              {isSubmitting ? 'Processing...' : 'Complete Sale & Deduct Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// 3. RECORD ISSUANCE MODAL
// ==============================================================================
interface RecordIssuanceModalProps {
  isOpen: boolean;
  initialItem?: UnifiedInventoryItem | null;
  items: UnifiedInventoryItem[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const RecordIssuanceModal: React.FC<RecordIssuanceModalProps> = ({
  isOpen,
  initialItem,
  items,
  onClose,
  onSaved,
}) => {
  const { user } = useAuth();
  const [selectedItemId, setSelectedItemId] = useState(initialItem?.id || (items[0]?.id || ''));
  const [quantity, setQuantity] = useState(1);
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim()) return setError('Please enter recipient / artisan name.');

    setIsSubmitting(true);
    const res = await UnifiedInventoryService.recordIssuance({
      itemId: selectedItemId,
      quantity,
      recipientName: recipientName.trim(),
      notes: notes.trim() || undefined,
      authorizedBy: user?.id,
    });
    setIsSubmitting(false);

    if (res.success) {
      onSaved(`Material issued successfully! Voucher #${res.issuanceCode}.`);
      onClose();
    } else {
      setError(res.error || 'Issuance failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 select-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Issue Inventory to Site / Artisan</h2>
            <p className="text-xs text-slate-500">Record recipient and maintain physical accountability.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} (Stock: {i.current_stock} {i.unit_of_measure})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity to Issue *</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recipient / Artisan Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tayo (Senior Painter)"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Issuance Notes / Project Purpose</label>
            <input
              type="text"
              placeholder="e.g. For living room primer coating at Lekki Site"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-sm"
            >
              {isSubmitting ? 'Issuing...' : 'Confirm Issuance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// 4. RECORD ENQUIRY MODAL
// ==============================================================================
interface RecordEnquiryModalProps {
  isOpen: boolean;
  items: UnifiedInventoryItem[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const RecordEnquiryModal: React.FC<RecordEnquiryModalProps> = ({ isOpen, items, onClose, onSaved }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemName, setItemName] = useState(items[0]?.name || 'Rehab Premium Emulsion');
  const [quantityRequired, setQuantityRequired] = useState(1);
  const [quotedPrice, setQuotedPrice] = useState(0);
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await UnifiedInventoryService.recordEnquiry({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      itemName: itemName.trim(),
      quantityRequired,
      quotedPrice: quotedPrice || undefined,
      followUpNotes: followUpNotes.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.success) {
      onSaved(`Enquiry #${res.enquiryNumber} logged.`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 select-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Record Product Enquiry</h2>
            <p className="text-xs text-slate-500">Log customer quotation request without deducting stock.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Inquired About *</label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantity Required</label>
              <input
                type="number"
                min="1"
                value={quantityRequired}
                onChange={(e) => setQuantityRequired(Number(e.target.value))}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quoted Price (₦)</label>
              <input
                type="number"
                min="0"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(Number(e.target.value))}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-[#18b892] text-white font-bold rounded-lg shadow-sm">
              {isSubmitting ? 'Logging...' : 'Save Enquiry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// 5. INTERNAL REHAB PAINT TRANSFER MODAL
// ==============================================================================
interface InternalTransferModalProps {
  isOpen: boolean;
  rehabProducts: RehabPaintProduct[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const InternalTransferModal: React.FC<InternalTransferModalProps> = ({
  isOpen,
  rehabProducts,
  onClose,
  onSaved,
}) => {
  const { user } = useAuth();
  const [selectedProductId, setSelectedProductId] = useState(rehabProducts[0]?.id || '');
  const [quantity, setQuantity] = useState(5);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const res = await UnifiedInventoryService.transferRehabPaintToDavejoe({
      rehabProductId: selectedProductId,
      quantity,
      notes: notes.trim() || undefined,
      authorizedBy: user?.id,
    });
    setIsSubmitting(false);

    if (res.success) {
      onSaved(`Internal transfer completed! Code #${res.transferCode}.`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 select-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Transfer Rehab Paint to Davejoe</h2>
            <p className="text-xs text-slate-500">Internal operational transfer between company entities.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Select Paint Product *</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none"
            >
              {rehabProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Factory Stock: {p.current_stock})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Quantity to Transfer (Buckets/Units) *</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Transfer Notes / Destination Site</label>
            <input
              type="text"
              placeholder="e.g. Dispatched to Victoria Island site project"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg shadow-sm">
              {isSubmitting ? 'Transferring...' : 'Execute Internal Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
