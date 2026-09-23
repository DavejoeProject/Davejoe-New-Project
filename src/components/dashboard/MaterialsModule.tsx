import React, { useState } from 'react';
import {
  Package,
  ArrowLeft,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Truck,
  FileCheck,
  TrendingUp,
} from 'lucide-react';

interface MaterialsModuleProps {
  onBackToDashboard: () => void;
}

export const MaterialsModule: React.FC<MaterialsModuleProps> = ({ onBackToDashboard }) => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'deliveries'>('inventory');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const inventoryItems = [
    { id: 'mat-01', name: 'Dangote Portland Cement 42.5N', category: 'Civil', stock: '1,450 bags', minLevel: '300 bags', unitCost: '₦9,800', value: '₦14,210,000', status: 'In Stock' },
    { id: 'mat-02', name: 'High-Tensile TMT Rebar (16mm)', category: 'Structural', stock: '28 tonnes', minLevel: '10 tonnes', unitCost: '₦1,250,000', value: '₦35,000,000', status: 'In Stock' },
    { id: 'mat-03', name: 'Italian Porcelain Floor Tiles 60x60', category: 'Finishing', stock: '420 sqm', minLevel: '600 sqm', unitCost: '₦18,500', value: '₦7,770,000', status: 'Low Stock' },
    { id: 'mat-04', name: 'Marine Plywood 18mm (Grade A)', category: 'Joinery', stock: '320 sheets', minLevel: '150 sheets', unitCost: '₦28,000', value: '₦8,960,000', status: 'In Stock' },
    { id: 'mat-05', name: 'Dulux Trade Emulsion Pure Brilliant White', category: 'Painting', stock: '45 drums', minLevel: '60 drums', unitCost: '₦46,000', value: '₦2,070,000', status: 'Low Stock' },
    { id: 'mat-06', name: 'Copper Core Electrical Cables 2.5mm', category: 'MEP', stock: '120 coils', minLevel: '40 coils', unitCost: '₦38,000', value: '₦4,560,000', status: 'In Stock' },
  ];

  const pendingRequests = [
    { id: 'MR-024', project: 'Riverside Apartments', requestedBy: 'Engr. Babatunde Lawal', item: 'Structural Steel Rebars (20mm, 15 tonnes)', cost: '₦18,750,000', date: 'Today, 08:45 AM', urgency: 'High' },
    { id: 'MR-025', project: 'Sunset Commercial', requestedBy: 'Arch. Fatima Aliyu', item: 'Curtain Wall Aluminum Mullions (Grade 6063)', cost: '₦24,300,000', date: 'Today, 09:12 AM', urgency: 'High' },
    { id: 'MR-026', project: 'Oakridge Villas', requestedBy: 'Engr. Chidi Okafor', item: 'Imported Hardwood Flooring (Teak 120sqm)', cost: '₦6,840,000', date: 'Yesterday, 04:30 PM', urgency: 'Normal' },
  ];

  const handleApprove = (reqId: string) => {
    setActionNotice(`Material Request ${reqId} successfully approved by CEO. Procurement notice dispatched.`);
    setTimeout(() => setActionNotice(null), 4000);
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

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Material Request</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Material Stock Value</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">₦284,650,000</div>
          <span className="text-[11px] text-[#01875F] font-semibold mt-1 inline-flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Audited physical stock
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Low Stock Alerts</span>
          <div className="text-xl font-bold text-amber-600 mt-1">8 items</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Below safety reorder threshold</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Pending Material Requests</span>
          <div className="text-xl font-bold text-slate-900 mt-1">14 requests</div>
          <span className="text-[11px] text-amber-600 font-semibold mt-1 block">3 await CEO approval</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Active Procurement Orders</span>
          <div className="text-xl font-bold text-slate-900 mt-1">6 in transit</div>
          <span className="text-[11px] text-[#01875F] font-semibold mt-1 block">2 arriving today</span>
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
          Central Inventory Registry
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-2.5 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer transition-colors ${
            activeTab === 'requests'
              ? 'border-[#01875F] text-[#01875F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Awaiting CEO Approval ({pendingRequests.length})
        </button>
      </div>

      {activeTab === 'inventory' ? (
        /* Inventory Table */
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
                  <th className="py-3 px-4">Reorder Level</th>
                  <th className="py-3 px-4">Unit Cost</th>
                  <th className="py-3 px-4">Total Value</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 text-slate-600">{item.category}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{item.stock}</td>
                    <td className="py-3 px-4 text-slate-500">{item.minLevel}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{item.unitCost}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.value}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === 'In Stock'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CEO Approval Queue */
        <div className="space-y-4">
          {pendingRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-xs font-bold text-[#01875F] bg-[#01875F]/10 px-2 py-0.5 rounded">
                    {req.id}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{req.project}</span>
                  <span className="text-[10px] uppercase font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                    {req.urgency} Priority
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900">{req.item}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Requested by: <strong className="text-slate-700">{req.requestedBy}</strong> • {req.date}
                </p>
                <div className="mt-2 text-sm font-mono font-bold text-slate-900">
                  Estimated Value: <span className="text-[#01875F]">{req.cost}</span>
                </div>
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
