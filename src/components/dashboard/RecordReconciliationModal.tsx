import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  MaterialReconciliationService,
  CreateReconciliationInput,
} from '../../services/materialReconciliationService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { MaterialRecord } from '../../services/materialsService';

interface RecordReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconciliationRecorded: (newRecord: any) => void;
  preselectedProjectId?: string;
  preselectedMaterialId?: string;
}

export const RecordReconciliationModal: React.FC<RecordReconciliationModalProps> = ({
  isOpen,
  onClose,
  onReconciliationRecorded,
  preselectedProjectId,
  preselectedMaterialId,
}) => {
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);

  // Form states
  const [projectId, setProjectId] = useState<string>(preselectedProjectId || '');
  const [materialId, setMaterialId] = useState<string>(preselectedMaterialId || '');
  const [reconciliationDate, setReconciliationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [openingQuantity, setOpeningQuantity] = useState<string>('0');
  const [deliveredQuantity, setDeliveredQuantity] = useState<string>('0');
  const [returnedQuantity, setReturnedQuantity] = useState<string>('0');
  const [consumedQuantity, setConsumedQuantity] = useState<string>('0');
  const [damagedQuantity, setDamagedQuantity] = useState<string>('0');
  const [wastedQuantity, setWastedQuantity] = useState<string>('0');
  const [closingQuantity, setClosingQuantity] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingDropdowns(true);
      setErrorMessage(null);

      Promise.all([
        MaterialRequestsService.getProjectsForDropdown(),
        MaterialRequestsService.getMaterialsForDropdown(),
      ])
        .then(([projRes, matRes]) => {
          setProjects(projRes.data);
          setMaterials(matRes.data);
          if (preselectedProjectId) {
            setProjectId(preselectedProjectId);
          } else if (projRes.data.length > 0 && !projectId) {
            setProjectId(projRes.data[0].id);
          }
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
  }, [isOpen, preselectedProjectId, preselectedMaterialId]);

  if (!isOpen) return null;

  const selectedMat = materials.find((m) => m.id === materialId);
  const unit = selectedMat?.unit_of_measure || 'units';

  // Dynamic formula calculation
  const open = Number(openingQuantity) || 0;
  const deliv = Number(deliveredQuantity) || 0;
  const ret = Number(returnedQuantity) || 0;
  const cons = Number(consumedQuantity) || 0;
  const dam = Number(damagedQuantity) || 0;
  const wast = Number(wastedQuantity) || 0;
  const actualClosing = Number(closingQuantity) || 0;

  const expectedClosing = open + deliv + ret - cons - dam - wast;
  const variance = actualClosing - expectedClosing;
  const isBalanced = Math.abs(variance) < 0.0001;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!projectId) {
      setErrorMessage('Please select a project site.');
      return;
    }
    if (!materialId) {
      setErrorMessage('Please select a material.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateReconciliationInput = {
        project_id: projectId,
        material_id: materialId,
        reconciliation_date: reconciliationDate
          ? new Date(reconciliationDate).toISOString()
          : new Date().toISOString(),
        opening_quantity: open,
        delivered_quantity: deliv,
        returned_quantity: ret,
        consumed_quantity: cons,
        damaged_quantity: dam,
        wasted_quantity: wast,
        closing_quantity: actualClosing,
        notes: notes.trim() || null,
      };

      const result = await MaterialReconciliationService.createMaterialReconciliation(payload);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        onReconciliationRecorded(result.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to record reconciliation.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Record Material Reconciliation</h2>
              <p className="text-xs text-slate-500">
                Execute physical count audit, verify expected closing balance and calculate stock variance.
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

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Association */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Project Site</span> <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.project_code} • {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Audit Date</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={reconciliationDate}
                  onChange={(e) => setReconciliationDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Material Audited <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              >
                <option value="">Select Material</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.material_code} • {m.name} ({m.unit_of_measure})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reconciliation Balance Sheet Matrix */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Audit Balance Quantities ({unit})
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Opening Quantity
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={openingQuantity}
                  onChange={(e) => setOpeningQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                  + Delivered Qty
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={deliveredQuantity}
                  onChange={(e) => setDeliveredQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-teal-700 block">
                  + Returned Qty
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={returnedQuantity}
                  onChange={(e) => setReturnedQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-amber-700 block">
                  - Consumed Qty
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={consumedQuantity}
                  onChange={(e) => setConsumedQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-700 block">
                  - Damaged Qty
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={damagedQuantity}
                  onChange={(e) => setDamagedQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-700 block">
                  - Wasted Qty
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={wastedQuantity}
                  onChange={(e) => setWastedQuantity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            {/* Physical Actual Count Input */}
            <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Physical Closing Stock Count (Actual On Site) <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Physical stock verified during warehouse audit.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={closingQuantity}
                    onChange={(e) => setClosingQuantity(e.target.value)}
                    className="w-32 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                  />
                  <span className="text-xs text-slate-600 font-mono">{unit}</span>
                </div>
              </div>
            </div>

            {/* Live Calculation Display */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Expected Closing Balance:</span>
                <span className="font-mono font-bold text-slate-900">
                  {expectedClosing.toLocaleString()} {unit}
                </span>
              </div>

              <div className="flex justify-between items-center pt-0.5">
                <span className="font-semibold text-slate-700">Reconciliation Variance:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold">
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Zero Variance (Balanced)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>
                        {variance > 0 ? `+${variance.toLocaleString()}` : variance.toLocaleString()} {unit} discrepancy
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">Audit Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Investigation findings for variance, cycle count methodology..."
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
                  <span>Recording Audit...</span>
                </>
              ) : (
                <span>Post Reconciliation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordReconciliationModal;
