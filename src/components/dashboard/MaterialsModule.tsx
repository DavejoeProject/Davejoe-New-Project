import React, { useState, useEffect } from 'react';
import {
  Package,
  ArrowLeft,
  Plus,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatNaira } from '../../services/dashboardService';

interface MaterialsModuleProps {
  onBackToDashboard: () => void;
}

export const MaterialsModule: React.FC<MaterialsModuleProps> = ({ onBackToDashboard }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests'>('inventory');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [matRes, reqRes] = await Promise.all([
        supabase.from('materials').select('*').order('name'),
        supabase
          .from('material_requests')
          .select('*, project:projects(name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (matRes.data) setInventoryItems(matRes.data);
      if (reqRes.data) setPendingRequests(reqRes.data);
    } catch (err) {
      console.warn('[MaterialsModule] Error loading materials data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalStockValue = inventoryItems.reduce(
    (acc, item) => acc + (Number(item.current_stock || item.quantity || 0) * Number(item.unit_cost || item.unit_price || 0)),
    0
  );

  const lowStockCount = inventoryItems.filter(
    (item) => Number(item.current_stock || 0) <= Number(item.reorder_level || item.minimum_threshold || 10)
  ).length;

  const handleApprove = async (reqId: string) => {
    try {
      const { error } = await supabase
        .from('material_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', reqId);

      if (!error) {
        setActionNotice(`Material Request successfully approved. Procurement dispatched.`);
        setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
        setTimeout(() => setActionNotice(null), 4000);
      }
    } catch (err) {
      console.error('Error approving request:', err);
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="w-6 h-6 text-[#01875F]" />
            <span>Materials & Procurement Command</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time inventory levels, site material requisitions, and purchase orders.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Material Stock Value</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatNaira(totalStockValue)}</div>
          <span className="text-[11px] text-[#01875F] font-semibold mt-1 inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Audited physical stock
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Low Stock Alerts</span>
          <div className="text-xl font-bold text-amber-600 mt-1">{lowStockCount} items</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Below safety reorder threshold</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Pending Material Requests</span>
          <div className="text-xl font-bold text-slate-900 mt-1">{pendingRequests.length} requests</div>
          <span className="text-[11px] text-amber-600 font-semibold mt-1 block">Awaiting approval</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-4">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'inventory'
              ? 'border-[#01875F] text-[#01875F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Central Inventory Registry ({inventoryItems.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'requests'
              ? 'border-[#01875F] text-[#01875F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Awaiting Approval ({pendingRequests.length})
        </button>
      </div>

      {activeTab === 'inventory' ? (
        inventoryItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-2xs">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">No Inventory Items Recorded</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Materials registered in the central store or project inventories will appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Current Material Balances</h3>
              <span className="text-xs text-slate-400">All prices in NGN (₦)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/70">
                  <tr>
                    <th className="py-3 px-4">Material Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Stock on Hand</th>
                    <th className="py-3 px-4">Unit Cost</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryItems.map((item) => {
                    const stock = Number(item.current_stock || item.quantity || 0);
                    const min = Number(item.reorder_level || item.minimum_threshold || 10);
                    const isLow = stock <= min;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-3 px-4 text-slate-600">{item.category || 'General'}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {stock} {item.unit || 'units'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {formatNaira(item.unit_cost || item.unit_price || 0)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              !isLow
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {!isLow ? 'In Stock' : 'Low Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : pendingRequests.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No Pending Material Requests</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            All requisitions from site supervisors and project teams have been processed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-[#01875F] bg-[#01875F]/10 px-2 py-0.5 rounded">
                    REQ-{req.id.slice(0, 6)}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {req.project?.name || 'Site Requisition'}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    {req.urgency || 'Normal'} Priority
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{req.title || req.item_name || 'Material Request'}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Requested on {new Date(req.created_at).toLocaleDateString()}
                </p>
                {req.estimated_cost && (
                  <div className="mt-2 text-sm font-mono font-bold text-slate-900">
                    Estimated Value: <span className="text-[#01875F]">{formatNaira(req.estimated_cost)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleApprove(req.id)}
                  className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Authorize & Approve</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
