import React, { useState, useEffect } from 'react';
import {
  X,
  Hammer,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  User,
  MapPin,
} from 'lucide-react';
import {
  MaterialStockService,
  CreateMaterialUsageInput,
} from '../../services/materialStockService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { MaterialRecord } from '../../services/materialsService';

interface RecordMaterialUsageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsageRecorded: () => void;
  preselectedProjectId?: string;
  preselectedMaterialId?: string;
}

export const RecordMaterialUsageModal: React.FC<RecordMaterialUsageModalProps> = ({
  isOpen,
  onClose,
  onUsageRecorded,
  preselectedProjectId,
  preselectedMaterialId,
}) => {
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [workforceMembers, setWorkforceMembers] = useState<
    Array<{ id: string; name: string; trade: string }>
  >([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);

  // Form states
  const [projectId, setProjectId] = useState<string>(preselectedProjectId || '');
  const [materialId, setMaterialId] = useState<string>(preselectedMaterialId || '');
  const [workforceMemberId, setWorkforceMemberId] = useState<string>('');
  const [usageDate, setUsageDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [quantityUsed, setQuantityUsed] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [workArea, setWorkArea] = useState<string>('');
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
        MaterialStockService.getWorkforceMembersForDropdown(),
      ])
        .then(([projRes, matRes, wfRes]) => {
          setProjects(projRes.data);
          setMaterials(matRes.data);
          setWorkforceMembers(wfRes.data);

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

  const selectedMaterial = materials.find((m) => m.id === materialId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!projectId) {
      setErrorMessage('Please select a project.');
      return;
    }
    if (!materialId) {
      setErrorMessage('Please select a material.');
      return;
    }

    const qty = parseFloat(quantityUsed);
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('Quantity used must be greater than zero.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateMaterialUsageInput = {
        project_id: projectId,
        material_id: materialId,
        workforce_member_id: workforceMemberId || null,
        usage_date: usageDate ? new Date(usageDate).toISOString() : new Date().toISOString(),
        quantity_used: qty,
        unit_cost: selectedMaterial?.standard_unit_cost !== null ? Number(selectedMaterial?.standard_unit_cost) : null,
        purpose: purpose.trim() || null,
        work_area: workArea.trim() || null,
        notes: notes.trim() || null,
      };

      const result = await MaterialStockService.recordMaterialUsage(payload);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      onUsageRecorded();
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to record material usage.'
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
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-200">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Record Material Usage</h2>
              <p className="text-xs text-slate-500">
                Log physical material consumption against a specific project milestone.
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
            <label className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Project Site</span> <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
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
            <label className="font-semibold text-slate-700 block">
              Material Consumed <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
            >
              <option value="">Select Material</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.material_code} • {m.name} ({m.unit_of_measure}) — Stock: {m.current_stock}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Quantity Used <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={quantityUsed}
                  onChange={(e) => setQuantityUsed(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
                <span className="text-[11px] text-slate-400 shrink-0">
                  {selectedMaterial?.unit_of_measure || 'units'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Usage Date</span> <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={usageDate}
                onChange={(e) => setUsageDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Assigned Worker / Tradesperson (Optional)</span>
            </label>
            <select
              value={workforceMemberId}
              onChange={(e) => setWorkforceMemberId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
            >
              <option value="">Site Team / Unassigned</option>
              {workforceMembers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.trade})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. 1st Floor Slab casting"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Work Area</span>
              </label>
              <input
                type="text"
                value={workArea}
                onChange={(e) => setWorkArea(e.target.value)}
                placeholder="e.g. Grid Line A-D, Sector 2"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Batch quality notes or execution conditions..."
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
                  <span>Recording Usage...</span>
                </>
              ) : (
                <span>Post Usage</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordMaterialUsageModal;
