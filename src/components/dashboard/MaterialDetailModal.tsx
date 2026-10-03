import React, { useEffect, useState } from 'react';
import {
  X,
  Package,
  Edit2,
  Calendar,
  User,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Clock,
} from 'lucide-react';
import {
  MaterialRecord,
  MaterialRelatedActivity,
  MaterialsService,
  MATERIAL_STATUS_CONFIG,
  formatNaira,
  formatNigerianDate,
  getStockStatus,
} from '../../services/materialsService';

interface MaterialDetailModalProps {
  material: MaterialRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (material: MaterialRecord) => void;
}

export const MaterialDetailModal: React.FC<MaterialDetailModalProps> = ({
  material,
  isOpen,
  onClose,
  onEdit,
}) => {
  const [activities, setActivities] = useState<MaterialRelatedActivity[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState<boolean>(false);

  useEffect(() => {
    if (material && isOpen) {
      setIsLoadingActivity(true);
      MaterialsService.getRelatedActivity(material.id)
        .then((res) => {
          setActivities(res.data);
        })
        .finally(() => {
          setIsLoadingActivity(false);
        });
    }
  }, [material, isOpen]);

  if (!isOpen || !material) return null;

  const statusConfig = MATERIAL_STATUS_CONFIG[material.status] || {
    label: material.status,
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  };

  const stockCondition = getStockStatus(material.current_stock, material.reorder_level);
  const isLowStock = stockCondition === 'LOW STOCK';

  const creatorName = material.profiles
    ? `${material.profiles.first_name || ''} ${material.profiles.last_name || ''}`.trim() ||
      material.profiles.display_name ||
      'Executive User'
    : 'System Administrator';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20 mt-0.5">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {material.material_code}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.badgeClasses}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClasses}`} />
                  {statusConfig.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    isLowStock
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isLowStock ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#01875F]" />
                  )}
                  {stockCondition}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">{material.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Category: <span className="font-medium text-slate-700">{material.category}</span>
                {material.brand && (
                  <>
                    {' '}• Brand: <span className="font-medium text-slate-700">{material.brand}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(material)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01875F] text-white hover:bg-[#016f4e] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {/* Section: Operational Information */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#01875F]" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Operational Information
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="bg-white p-3 rounded-lg border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Current Stock
                </span>
                <span
                  className={`text-lg font-bold block font-mono mt-0.5 ${
                    isLowStock ? 'text-amber-600' : 'text-slate-900'
                  }`}
                >
                  {material.current_stock.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500 font-sans">
                    {material.unit_of_measure}
                  </span>
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Reorder Level
                </span>
                <span className="text-lg font-bold block font-mono mt-0.5 text-slate-800">
                  {material.reorder_level !== null ? material.reorder_level.toLocaleString() : '0'}{' '}
                  <span className="text-xs font-normal text-slate-500 font-sans">
                    {material.unit_of_measure}
                  </span>
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Stock Status
                </span>
                <span
                  className={`text-sm font-bold block mt-1 ${
                    isLowStock ? 'text-amber-600' : 'text-emerald-700'
                  }`}
                >
                  {stockCondition}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200/70 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Standard Unit Cost
                </span>
                <span className="text-base font-bold block font-mono mt-0.5 text-slate-900">
                  {formatNaira(material.standard_unit_cost)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-slate-600 text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>
                <strong className="font-semibold text-slate-700">Storage Location:</strong>{' '}
                {material.storage_location || 'Not provided'}
              </span>
            </div>
          </div>

          {/* Section: Specifications & Catalog Details */}
          <div className="space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
              Catalog & Technical Specifications
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 block">Specification</span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-800 font-mono text-[11px] leading-relaxed">
                  {material.specification || 'Not provided'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 block">Description</span>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-800 leading-relaxed">
                  {material.description || 'Not provided'}
                </div>
              </div>
            </div>

            {material.notes && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 block">Operational Notes</span>
                <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60 text-slate-800 leading-relaxed flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{material.notes}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Related Activity */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Related Activity
              </h3>
              <span className="text-[11px] text-slate-400">Operational Log</span>
            </div>

            {isLoadingActivity ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-center animate-pulse text-xs text-slate-400">
                Loading material activity...
              </div>
            ) : activities.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 text-center text-xs text-slate-500">
                No material activity recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {activities.map((act) => (
                  <div key={act.id} className="p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-800">{act.type}</span>
                      {act.reference_number && (
                        <span className="font-mono text-slate-500 ml-2">
                          #{act.reference_number}
                        </span>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5">{act.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-medium capitalize text-slate-600">{act.status}</span>
                      <span className="block text-[10px] text-slate-400">
                        {formatNigerianDate(act.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Metadata & Auditability */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>
                <strong>Created By:</strong> {creatorName}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                <strong>Created:</strong> {formatNigerianDate(material.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                <strong>Updated:</strong> {formatNigerianDate(material.updated_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onEdit(material)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white hover:bg-[#016f4e] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Material</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialDetailModal;
