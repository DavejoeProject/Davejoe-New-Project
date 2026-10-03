import React, { useState, useEffect } from 'react';
import {
  X,
  Boxes,
  SlidersHorizontal,
  RefreshCw,
  Building,
  Calendar,
  Layers,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import {
  MaterialStockService,
  MaterialStockMovementRecord,
  StockPositionItem,
  MOVEMENT_TYPE_CONFIG,
} from '../../services/materialStockService';
import { formatNigerianDate, formatNaira } from '../../services/materialsService';
import { RecordStockAdjustmentModal } from './RecordStockAdjustmentModal';

interface StockDetailModalProps {
  item: StockPositionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onStockUpdated: () => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onStockUpdated,
}) => {
  const [movements, setMovements] = useState<MaterialStockMovementRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdjustOpen, setIsAdjustOpen] = useState<boolean>(false);

  const fetchMovements = async () => {
    if (!item) return;
    setIsLoading(true);
    const res = await MaterialStockService.getStockMovements({ materialId: item.id });
    setMovements(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen && item) {
      fetchMovements();
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{item.name}</h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {item.material_code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Auditable inventory ledger and physical stock movement history.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Top Position Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Stock</span>
              <span className="text-xl font-bold font-mono text-slate-900 block mt-0.5">
                {item.current_stock} {item.unit_of_measure}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Reorder Level</span>
              <span className="text-xl font-bold font-mono text-slate-900 block mt-0.5">
                {item.reorder_level || 0} {item.unit_of_measure}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Storage Location</span>
              <span className="text-xs font-semibold text-slate-800 block mt-1">
                {item.storage_location || 'Central Store'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Standard Rate</span>
              <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                {formatNaira(item.standard_unit_cost)}
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Stock Movement History
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchMovements}
                className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh ledger"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsAdjustOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-lg border border-amber-200 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Adjust Stock</span>
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          {isLoading ? (
            <div className="h-32 bg-slate-50 rounded-xl animate-pulse" />
          ) : movements.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No stock movements recorded yet for this material.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-center">Movement</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3">Project</th>
                      <th className="py-2.5 px-3">Reference / Notes</th>
                      <th className="py-2.5 px-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movements.map((m) => {
                      const cfg = MOVEMENT_TYPE_CONFIG[m.movement_type] || {
                        label: m.movement_type,
                        badgeClasses: 'bg-slate-100 text-slate-600 border-slate-200',
                        isPositive: true,
                      };
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {formatNigerianDate(m.movement_date)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${cfg.badgeClasses}`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span className={cfg.isPositive ? 'text-emerald-700' : 'text-rose-600'}>
                              {cfg.isPositive ? '+' : '-'}{Number(m.quantity).toLocaleString()}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {m.projects ? m.projects.name : 'Central Warehouse'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {m.reference_code ? (
                              <span className="font-mono font-semibold text-slate-700 mr-1">
                                {m.reference_code}
                              </span>
                            ) : null}
                            <span>{m.notes || '—'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {m.recorder
                              ? `${m.recorder.first_name || ''} ${m.recorder.last_name || ''}`.trim() ||
                                m.recorder.display_name
                              : 'System'}
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

        <RecordStockAdjustmentModal
          isOpen={isAdjustOpen}
          onClose={() => setIsAdjustOpen(false)}
          preselectedMaterialId={item.id}
          onAdjustmentRecorded={() => {
            fetchMovements();
            onStockUpdated();
          }}
        />
      </div>
    </div>
  );
};

export default StockDetailModal;
