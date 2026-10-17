import React, { useState, useEffect } from 'react';
import {
  Paintbrush,
  ArrowLeft,
  RefreshCw,
  Plus,
  Boxes,
  Truck,
  ArrowUpRight,
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  ShoppingBag,
  Send,
  AlertCircle,
} from 'lucide-react';
import {
  RehabGlobalService,
  RehabPaintProduct,
  RehabProductionRun,
  RehabStockMovement,
} from '../../services/rehabGlobalService';
import { formatNaira } from '../../services/dashboardService';
import { supabase } from '../../lib/supabase';

interface RehabGlobalModuleProps {
  onBackToDashboard: () => void;
}

export const RehabGlobalModule: React.FC<RehabGlobalModuleProps> = ({ onBackToDashboard }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'production' | 'movements'>('inventory');
  const [products, setProducts] = useState<RehabPaintProduct[]>([]);
  const [productionRuns, setProductionRuns] = useState<RehabProductionRun[]>([]);
  const [movements, setMovements] = useState<RehabStockMovement[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal forms
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [prodBatch, setProdBatch] = useState('');
  const [prodQty, setProdQty] = useState('');
  const [transferType, setTransferType] = useState<'internal_transfer_davejoe' | 'third_party_sale'>('internal_transfer_davejoe');
  const [transferQty, setTransferQty] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [prods, runs, movs, { data: projs }] = await Promise.all([
        RehabGlobalService.getProducts(),
        RehabGlobalService.getProductionRuns(),
        RehabGlobalService.getStockMovements(),
        supabase.from('projects').select('id, name').order('name'),
      ]);
      setProducts(prods);
      setProductionRuns(runs);
      setMovements(movs);
      setProjects(projs || []);
    } catch (err) {
      console.warn('[RehabGlobalModule] Error loading records:', err);
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

  // KPI Calculations
  const totalStockUnits = products.reduce((acc, p) => acc + Number(p.current_stock || 0), 0);
  const totalStockValue = products.reduce(
    (acc, p) => acc + Number(p.current_stock || 0) * Number(p.unit_cost_price || 0),
    0
  );
  const internalTransfersCount = movements.filter(
    (m) => m.movement_type === 'internal_transfer_davejoe'
  ).length;
  const thirdPartySalesValue = movements
    .filter((m) => m.movement_type === 'third_party_sale')
    .reduce((acc, m) => acc + Number(m.total_price || 0), 0);

  const handleRecordProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedProductId || !prodBatch || !prodQty || Number(prodQty) <= 0) {
      setFormError('Please fill in all production batch details.');
      return;
    }

    setSubmitting(true);
    try {
      await RehabGlobalService.recordProductionRun({
        productId: selectedProductId,
        batchNumber: prodBatch.trim(),
        quantityProduced: Number(prodQty),
      });
      setProdModalOpen(false);
      setProdBatch('');
      setProdQty('');
      await fetchData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record production batch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedProductId || !transferQty || Number(transferQty) <= 0) {
      setFormError('Please select product and valid quantity.');
      return;
    }

    setSubmitting(true);
    try {
      await RehabGlobalService.recordStockMovement({
        productId: selectedProductId,
        movementType: transferType,
        quantity: Number(transferQty),
        destinationProjectId: transferType === 'internal_transfer_davejoe' ? selectedProject || undefined : undefined,
        customerName: transferType === 'third_party_sale' ? customerName || undefined : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
      });
      setTransferModalOpen(false);
      setTransferQty('');
      setCustomerName('');
      setUnitPrice('');
      await fetchData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record movement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Paintbrush className="w-6 h-6 text-[#01875F]" />
              <span>Rehab Global Resources — Paint Production & Distribution</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#01875F] border border-emerald-200">
              Sister Company
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Finished paint inventory, batch production runs, site deliveries to Davejoe, and third-party sales.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setProdModalOpen(true);
              setFormError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Production Run</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTransferModalOpen(true);
              setFormError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#01875F]" />
            <span>Issue Stock / Transfer</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Stock Volume
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : `${totalStockUnits.toLocaleString()} units`}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Finished paint drums in factory warehouse</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inventory Valuation
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : formatNaira(totalStockValue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cost valuation of ready paint stock</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Transfers to Davejoe
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : `${internalTransfersCount} transfers`}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Direct paint supply to Davejoe project sites</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              3rd-Party Sales Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {isLoading ? '...' : formatNaira(thirdPartySalesValue)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">External commercial client distribution</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-[#01875F] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Finished Paint Inventory ({products.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('production')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'production'
              ? 'bg-[#01875F] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Batch Production Runs ({productionRuns.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('movements')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'movements'
              ? 'bg-[#01875F] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Stock Movements & Transfers ({movements.length})
        </button>
      </div>

      {/* TAB 1: FINISHED PAINT INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Rehab Paint Catalogue & Factory Stock</h3>
            <span className="text-xs text-slate-400">Total Products: {products.length}</span>
          </div>

          {products.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Boxes className="w-8 h-8 text-slate-300 mx-auto" />
              <p>No paint products registered yet in Rehab Global database.</p>
              <p className="text-[11px] text-slate-400">
                Products will appear once production runs or inventory records are configured.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">SKU / Code</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Pack Size</th>
                    <th className="py-2.5 px-3 text-right">In Stock</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const isLow = Number(p.current_stock) <= Number(p.reorder_level);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-700">{p.sku}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{p.name}</td>
                        <td className="py-3 px-3 text-slate-600">{p.category}</td>
                        <td className="py-3 px-3 text-slate-500">{p.pack_size}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          {Number(p.current_stock).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600">
                          {formatNaira(p.unit_cost_price)}
                        </td>
                        <td className="py-3 px-3 text-right text-[#01875F] font-semibold">
                          {formatNaira(p.unit_selling_price)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isLow
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-[#01875F] border border-emerald-200'
                            }`}
                          >
                            {isLow ? 'Low Stock' : 'Available'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BATCH PRODUCTION RUNS */}
      {activeTab === 'production' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Batch Production Output Logs</h3>
            <span className="text-xs text-slate-400">Total Runs: {productionRuns.length}</span>
          </div>

          {productionRuns.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Layers className="w-8 h-8 text-slate-300 mx-auto" />
              <p>No production batches recorded yet in the database.</p>
              <button
                type="button"
                onClick={() => setProdModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#01875F] text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record First Batch</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3">Paint Product</th>
                    <th className="py-2.5 px-3 text-right">Quantity Produced</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionRuns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{r.batch_number}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {r.product?.name || 'Standard Batch'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        +{Number(r.quantity_produced).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Paint Transfers to Davejoe & Third-Party Sales
            </h3>
            <span className="text-xs text-slate-400">Total Entries: {movements.length}</span>
          </div>

          {movements.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
              <Truck className="w-8 h-8 text-slate-300 mx-auto" />
              <p>No inventory movements or distribution records yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3">Destination / Customer</th>
                    <th className="py-2.5 px-3 text-right">Total Amount</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => {
                    const isTransfer = m.movement_type === 'internal_transfer_davejoe';
                    const isSale = m.movement_type === 'third_party_sale';
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isTransfer
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : isSale
                                  ? 'bg-emerald-50 text-[#01875F] border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {isTransfer
                              ? 'Transfer to Davejoe'
                              : isSale
                                ? '3rd-Party Sale'
                                : m.movement_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {m.product?.name || 'Paint Product'}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold ${
                            Number(m.quantity) > 0 ? 'text-emerald-700' : 'text-slate-800'
                          }`}
                        >
                          {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {isTransfer ? (
                            <span className="font-semibold text-purple-900">
                              Site: {m.project?.name || 'Davejoe Site'}
                            </span>
                          ) : (
                            <span>{m.customer_name || 'Commercial Client'}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-slate-900">
                          {m.total_price ? formatNaira(m.total_price) : '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {new Date(m.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Production Modal */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Record Paint Production Batch</h3>
              <button
                type="button"
                onClick={() => setProdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRecordProduction} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Paint Product *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Choose product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Batch Number *</label>
                <input
                  type="text"
                  required
                  value={prodBatch}
                  onChange={(e) => setProdBatch(e.target.value)}
                  placeholder="e.g. BATCH-2026-088"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity Produced (Units) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={prodQty}
                  onChange={(e) => setProdQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProdModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#01875F] text-white rounded-xl font-semibold disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Save Output'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer / Sale Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Issue Paint / Transfer Stock</h3>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRecordTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Movement Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferType('internal_transfer_davejoe')}
                    className={`py-2 px-3 rounded-xl border font-semibold ${
                      transferType === 'internal_transfer_davejoe'
                        ? 'bg-purple-50 border-purple-500 text-purple-900'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Transfer to Davejoe
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferType('third_party_sale')}
                    className={`py-2 px-3 rounded-xl border font-semibold ${
                      transferType === 'third_party_sale'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    3rd-Party Sale
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Paint Product *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Choose product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.current_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {transferType === 'internal_transfer_davejoe' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination Davejoe Project *</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    required
                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="">Select project site...</option>
                    {projects.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Customer / Client Name *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Primrose Estates Ltd"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Unit Selling Price (₦)</label>
                    <input
                      type="number"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="Unit price in Naira"
                      className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#01875F] text-white rounded-xl font-semibold disabled:opacity-60"
                >
                  {submitting ? 'Processing...' : 'Confirm Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
