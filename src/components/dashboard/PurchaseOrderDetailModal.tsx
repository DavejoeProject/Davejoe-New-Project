import React from 'react';
import { X, ShoppingBag, Truck, Calendar, Building2, User, Receipt } from 'lucide-react';
import { ProjectPurchaseOrderItem } from '../../services/projectControlService';
import { formatNaira, formatDateNigerian } from '../../services/dashboardService';

interface PurchaseOrderDetailModalProps {
  order: ProjectPurchaseOrderItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseOrderDetailModal: React.FC<PurchaseOrderDetailModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  PO-{order.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                  {order.status}
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight mt-0.5">
                Purchase Order Details
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {/* Supplier Info */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Supplier</span>
              <span className="font-bold text-slate-900 text-sm">
                {order.suppliers?.name || 'Unassigned Supplier'}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Contact</span>
              <span className="text-slate-700">
                {order.suppliers?.contact_person || order.suppliers?.phone || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Purchase Date</span>
              <span className="font-mono text-slate-700">
                {order.purchase_date ? formatDateNigerian(order.purchase_date) : formatDateNigerian(order.created_at)}
              </span>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-2">
              Order Line Items ({order.purchase_order_items?.length || 0})
            </h3>
            {!order.purchase_order_items || order.purchase_order_items.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg text-slate-400 text-center">
                No individual item records attached to this purchase order.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Material</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.purchase_order_items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {item.materials?.name || 'Material Item'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {item.ordered_quantity ?? '—'}{' '}
                          {item.materials?.unit_of_measure ? item.materials.unit_of_measure : ''}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {item.unit_cost != null ? formatNaira(item.unit_cost) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {item.total_cost != null ? formatNaira(item.total_cost) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cost Summary Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono">{order.subtotal != null ? formatNaira(order.subtotal) : '—'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery Cost:</span>
              <span className="font-mono">{order.delivery_cost != null ? formatNaira(order.delivery_cost) : '—'}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Other Costs:</span>
              <span className="font-mono">{order.other_cost != null ? formatNaira(order.other_cost) : '—'}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 text-sm">
              <span>Total Cost:</span>
              <span className="font-mono text-[#01875F]">
                {order.total_cost != null ? formatNaira(order.total_cost) : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
