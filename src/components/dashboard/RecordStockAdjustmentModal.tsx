import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  AlertCircle,
  Loader2,
  Building,
  Package,
} from 'lucide-react';
import {
  MaterialStockService,
  CreateStockAdjustmentInput,
  StockMovementType,
  ALL_STOCK_MOVEMENT_TYPES,
  MOVEMENT_TYPE_CONFIG,
} from '../../services/materialStockService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { MaterialRecord, formatNaira } from '../../services/materialsService';

interface RecordStockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdjustmentRecorded: () => void;
  preselectedMaterialId?: string;
}

export const RecordStockAdjustmentModal: React.FC<RecordStockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onAdjustmentRecorded,
  preselectedMaterialId,
}) => {
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);

  // Form states
  const [materialId, setMaterialId] = useState<string>(preselectedMaterialId || '');
  const [projectId, setProjectId] = useState<string>('');
  const [movementType, setMovementType] = useState<StockMovementType>('adjustment');
  const [quantity, setQuantity] = useState<string>('');
  const [unitCost, setUnitCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingDropdowns(true);
      setErrorMessage(null);

      Promise.all([
        MaterialRequestsService.getMaterialsForDropdown(),
        MaterialRequestsService.getProjectsForDropdown(),
      ])
        .then(([matRes, projRes]) => {
          setMaterials(matRes.data);
          setProjects(projRes.data);
          if (preselectedMaterialId) {
            setMaterialId(preselectedMaterialId);
          } else if (matRes.data.length > 0 && !materialId) {
            setMaterialId(matRes.data[0].id);
          }
        })
        .finally(() => {
          setIsLoadingDropdowns(false);
        });
    }
  }, [isOpen, preselectedMaterialId]);

  if (!isOpen) return null;

  const selectedMaterial = materials.find((m) => m.id === materialId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!materialId) {
      setErrorMessage('Please select a material.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMessage('Adjustment quantity must be greater than zero.');
      return;
    }

    if (!notes.trim()) {
      setErrorMessage('An operational reason / audit justification is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateStockAdjustmentInput = {
        material_id: materialId,
        project_id: projectId || null,
        movement_type: movementType,
        quantity: numQty,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        notes: notes.trim(),
      };

      const result = await MaterialStockService.recordStockAdjustment(payload);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      onAdjustmentRecorded();
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to record stock adjustment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Adjust Stock Position</h2>
              <p className="text-xs text-slate-500">
                Record an authorized inventory adjustment or audit count variance.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Material <span className="text-red-500">*</span>
            </label>
            {isLoadingDropdowns ? (
              <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
            ) : (
              <select
                required
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              >
                <option value="">Select Material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.material_code} • {m.name} ({m.unit_of_measure}) — Current: {m.current_stock}
                  </option>
                ))}
              </select>
            )}
            {selectedMaterial && (
              <div className="text-[11px] text-slate-500 mt-1 flex justify-between bg-slate-50 p-2 rounded">
                <span>Current Recorded Stock:</span>
                <strong className="font-mono text-slate-900">
                  {selectedMaterial.current_stock} {selectedMaterial.unit_of_measure}
                </strong>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Movement Action <span className="text-red-500">*</span>
              </label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as StockMovementType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              >
                <option value="adjustment">Stock Adjustment (Audit Count)</option>
                <option value="damage">Damage / Loss Write-Off</option>
                <option value="return">Return to Store</option>
                <option value="transfer">Project Transfer</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Quantity Units <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
                <span className="text-[11px] text-slate-400 shrink-0">
                  {selectedMaterial?.unit_of_measure || 'units'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Associated Project (Optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
            >
              <option value="">Central Warehouse / Unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} • {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Reason & Audit Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Physical inventory cycle count adjustment, reconciliation surplus, batch audit variance..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white hover:bg-[#016f4e] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adjusting...</span>
                </>
              ) : (
                <span>Post Adjustment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordStockAdjustmentModal;
