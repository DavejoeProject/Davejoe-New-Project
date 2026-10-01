import React from 'react';
import { X, Truck, Calendar, MapPin, User, PackageCheck } from 'lucide-react';
import { ProjectMaterialDeliveryItem } from '../../services/projectControlService';
import { formatDateNigerian } from '../../services/dashboardService';

interface DeliveryDetailModalProps {
  delivery: ProjectMaterialDeliveryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DeliveryDetailModal: React.FC<DeliveryDetailModalProps> = ({
  delivery,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !delivery) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {delivery.delivery_code || 'DELIVERY'}
                </span>
                {delivery.acknowledgement_reference && (
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    Ref: {delivery.acknowledgement_reference}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight mt-0.5">
                Material Delivery Details
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
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/70 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Delivery Date</span>
              <span className="font-mono text-slate-800">
                {delivery.delivery_date ? formatDateNigerian(delivery.delivery_date) : formatDateNigerian(delivery.created_at)}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Destination</span>
              <span className="text-slate-800 truncate block">
                {delivery.destination || 'Project Site'}
              </span>
            </div>
            <div>
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Delivered By</span>
              <span className="text-slate-800">{delivery.delivered_by || '—'}</span>
            </div>
            <div>
              <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Received By</span>
              <span className="text-slate-800">{delivery.received_by || '—'}</span>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider mb-2">
              Delivered Items ({delivery.material_delivery_items?.length || 0})
            </h3>
            {!delivery.material_delivery_items || delivery.material_delivery_items.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-lg text-slate-400 text-center">
                No items recorded on this delivery note.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Material</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {delivery.material_delivery_items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {item.materials?.name || 'Material Item'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {item.quantity ?? '—'}{' '}
                          {item.materials?.unit_of_measure ? item.materials.unit_of_measure : ''}
                        </td>
                        <td className="py-2 px-3 text-slate-500">
                          {item.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
