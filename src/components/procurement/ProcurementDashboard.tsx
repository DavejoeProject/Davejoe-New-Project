import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { formatNaira } from '../../services/dashboardService';
import {
  Truck,
  ShoppingCart,
  Package,
  Boxes,
  RefreshCw,
  LogOut,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Building2,
  Plus,
  Send,
  AlertTriangle,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { DailyAttendanceWidget } from '../attendance/DailyAttendanceWidget';
import { ProjectMaterialRemnantsModule } from '../remnants/ProjectMaterialRemnantsModule';
import { ToolsEquipmentModule } from '../tools/ToolsEquipmentModule';
import { CreatePurchaseOrderModal } from '../dashboard/CreatePurchaseOrderModal';
import { NewMaterialRequestModal } from '../dashboard/NewMaterialRequestModal';
import { RecordDeliveryModal } from '../dashboard/RecordDeliveryModal';

export const ProcurementDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'requests' | 'deliveries' | 'suppliers' | 'remnants' | 'tools'>('orders');

  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [createReqOpen, setCreateReqOpen] = useState(false);
  const [recordDeliveryOpen, setRecordDeliveryOpen] = useState(false);

  const fetchProcurementData = async () => {
    try {
      const [poRes, reqRes, delivRes, suppRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select(`
            *,
            supplier:suppliers(name),
            project:projects(name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_requests')
          .select(`
            *,
            project:projects(name)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('material_deliveries')
          .select(`
            *,
            project:projects(name),
            supplier:suppliers(name)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
      ]);

      setPurchaseOrders(poRes.data || []);
      setMaterialRequests(reqRes.data || []);
      setDeliveries(delivRes.data || []);
      setSuppliers(suppRes.data || []);
    } catch (err) {
      console.warn('[ProcurementDashboard] Error loading data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProcurementData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchProcurementData();
  };

  // KPI Calculations
  const pendingRequestsCount = materialRequests.filter((r) => (r.status || '').toLowerCase() === 'pending').length;
  const activeOrdersCount = purchaseOrders.filter((p) => {
    const s = (p.status || '').toLowerCase();
    return s === 'pending' || s === 'approved' || s === 'ordered';
  }).length;
  const totalSpend = purchaseOrders.reduce((acc, po) => acc + Number(po.total_amount || 0), 0);
  const pendingDeliveriesCount = deliveries.filter((d) => (d.status || '').toLowerCase() === 'pending').length;

  const procurementOfficerName =
    profile?.display_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    user?.email?.split('@')[0] ||
    'Procurement Lead';

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col text-slate-800 font-sans selection:bg-[#01875F]/20 selection:text-[#01875F]">
      {/* Top Header */}
      <header className="h-16 px-6 sm:px-8 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white border border-slate-100 shrink-0">
            <img src="/brand/pwa-192x192.png" alt="Davejoe Interiors" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base block leading-tight">
              Davejoe Procurement & Logistics
            </span>
            <span className="text-[10px] font-semibold text-[#01875F] tracking-wider uppercase block">
              Supply Chain & Logistics Management
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">{procurementOfficerName}</span>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 sm:p-8 max-w-7xl w-full mx-auto space-y-6 flex-1">
        {/* Daily Timekeeping for Procurement & Logistics */}
        <DailyAttendanceWidget />

        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Truck className="w-6 h-6 text-[#01875F]" />
              <span>Procurement & Supply Chain Command</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Material requests, purchase orders, vendor contracts, delivery schedules, and jobsite fulfillment.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setCreatePoOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
            <button
              type="button"
              onClick={() => setRecordDeliveryOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4 text-[#01875F]" />
              <span>Record Delivery</span>
            </button>
          </div>
        </div>

        {/* Real KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Site Requests Pending
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '...' : pendingRequestsCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Pending validation & quote matching</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Purchase Orders
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {isLoading ? '...' : activeOrdersCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Orders placed with verified suppliers</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Committed PO Value
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '...' : formatNaira(totalSpend)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total procurement commitment volume</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Inbound Deliveries
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-purple-700">
              {isLoading ? '...' : deliveries.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Site delivery records</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'orders' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'requests' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Site Material Requests ({materialRequests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deliveries')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'deliveries' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Site Deliveries ({deliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'suppliers' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Supplier Directory ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('remnants')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'remnants' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Material Remnants & Recovery
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tools')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'tools' ? 'bg-[#01875F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tools & Equipment Register
          </button>
        </div>

        {/* TAB 1: PURCHASE ORDERS */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Purchase Order Commitments</h2>
              <span className="text-xs text-slate-400">Total: {purchaseOrders.length}</span>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
                <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600 text-sm">No purchase orders recorded yet in database</p>
                <p className="text-slate-400">Click "+ Create Purchase Order" to generate commitments.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">PO Number</th>
                      <th className="py-2.5 px-3">Project Site</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{po.po_number || po.id.slice(0, 8)}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{po.project?.name || 'Project Site'}</td>
                        <td className="py-3 px-3 text-slate-600">{po.supplier?.name || po.supplier_name || 'Vendor'}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">{formatNaira(po.total_amount)}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200 capitalize">
                            {po.status || 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{new Date(po.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SITE MATERIAL REQUESTS */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Site Material Requisitions</h2>
              <span className="text-xs text-slate-400">Total: {materialRequests.length}</span>
            </div>

            {materialRequests.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
                <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600 text-sm">No site material requests pending</p>
                <p className="text-slate-400">Site supervisors submit requests from their operational dashboard.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Request Number</th>
                      <th className="py-2.5 px-3">Project Site</th>
                      <th className="py-2.5 px-3">Requested By</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materialRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{req.request_number || req.id.slice(0, 8)}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{req.project?.name || 'Project Site'}</td>
                        <td className="py-3 px-3 text-slate-600">{req.requested_by_name || 'Site Supervisor'}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 capitalize">
                            {req.status || 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{new Date(req.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SITE DELIVERIES */}
        {activeTab === 'deliveries' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Delivery Receipts & Waybills</h2>
              <span className="text-xs text-slate-400">Total: {deliveries.length}</span>
            </div>

            {deliveries.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
                <Truck className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600 text-sm">No delivery records found</p>
                <p className="text-slate-400">Deliveries can be recorded upon arrival at job sites.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Waybill / Note</th>
                      <th className="py-2.5 px-3">Destination Project</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{del.waybill_number || del.delivery_note_number || del.id.slice(0, 8)}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{del.project?.name || 'Site'}</td>
                        <td className="py-3 px-3 text-slate-600">{del.supplier?.name || del.supplier_name || 'Vendor'}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200 capitalize">
                            {del.status || 'Received'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400">{new Date(del.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SUPPLIERS */}
        {activeTab === 'suppliers' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Approved Material Suppliers & Vendors</h2>
              <span className="text-xs text-slate-400">Total: {suppliers.length}</span>
            </div>

            {suppliers.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-600 text-sm">No suppliers registered in database</p>
                <p className="text-slate-400">Add suppliers when generating purchase orders.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Supplier Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Contact Person</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {suppliers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold text-slate-900">{s.name}</td>
                        <td className="py-3 px-3 text-slate-600">{s.category || 'General Materials'}</td>
                        <td className="py-3 px-3 text-slate-600">{s.contact_person || '—'}</td>
                        <td className="py-3 px-3 text-slate-500 font-mono">{s.phone || '—'}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-[#01875F] border border-emerald-200">
                            {s.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MATERIAL REMNANTS & RECOVERY */}
        {activeTab === 'remnants' && <ProjectMaterialRemnantsModule />}

        {/* TAB 6: TOOLS & EQUIPMENT LOGISTICS */}
        {activeTab === 'tools' && <ToolsEquipmentModule />}
      </main>

      {/* Modals */}
      {createPoOpen && (
        <CreatePurchaseOrderModal
          isOpen={createPoOpen}
          onClose={() => setCreatePoOpen(false)}
          onOrderCreated={() => {
            setCreatePoOpen(false);
            handleRefresh();
          }}
        />
      )}

      {recordDeliveryOpen && (
        <RecordDeliveryModal
          isOpen={recordDeliveryOpen}
          onClose={() => setRecordDeliveryOpen(false)}
          onDeliveryCreated={() => {
            setRecordDeliveryOpen(false);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
};
