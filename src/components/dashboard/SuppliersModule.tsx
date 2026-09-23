import React from 'react';
import { Truck, ArrowLeft, Plus, Star, MapPin, Phone, CheckCircle2 } from 'lucide-react';

interface SuppliersModuleProps {
  onBackToDashboard: () => void;
}

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({ onBackToDashboard }) => {
  const suppliers = [
    { name: 'Dangote Cement Distributors Nigeria Ltd', category: 'Cement & Civil', rating: 4.8, orders: 34, location: 'Ikeja, Lagos', contact: '+234 802 345 6789', status: 'Preferred' },
    { name: 'African Steel Mills Ltd', category: 'High-Tensile Rebar & Mesh', rating: 4.6, orders: 19, location: 'Oregun, Lagos', contact: '+234 803 111 2233', status: 'Preferred' },
    { name: 'PureStone Quarries & Aggregates', category: 'Granite & Sharp Sand', rating: 4.4, orders: 28, location: 'Sagamu / Ikorodu', contact: '+234 805 777 8899', status: 'Active' },
    { name: 'Alumaco Nigeria Plc', category: 'Aluminum Extrusions & Mullions', rating: 4.7, orders: 12, location: 'Apapa, Lagos', contact: '+234 807 444 5566', status: 'Preferred' },
    { name: 'Berger Paints Nigeria Plc', category: 'Coatings & Waterproofing', rating: 4.5, orders: 22, location: 'Ikeja Industrial Estate', contact: '+234 809 333 4455', status: 'Active' },
  ];

  return (
    <div className="space-y-6 pb-12">
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
            <Truck className="w-6 h-6 text-[#01875F]" />
            <span>Suppliers & Vendor Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Approved vendor directory, SLA delivery performance, and active procurement accounts.
          </p>
        </div>

        <button className="px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-colors">
          <Plus className="w-4 h-4" />
          <span>Add Approved Supplier</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((sup) => (
          <div key={sup.name} className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#01875F] bg-[#01875F]/10 px-2 py-0.5 rounded">
                    {sup.category}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">{sup.name}</h3>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{sup.rating}</span>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{sup.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{sup.contact}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">{sup.orders} completed purchase orders</span>
              <button className="text-[#01875F] font-semibold hover:underline cursor-pointer">
                Issue Purchase Order →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
