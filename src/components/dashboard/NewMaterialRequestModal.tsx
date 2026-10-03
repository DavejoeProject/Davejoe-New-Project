import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  AlertTriangle,
} from 'lucide-react';
import {
  MaterialRequestsService,
  CreateMaterialRequestInput,
  MaterialRequestPriority,
  ProjectDropdownOption,
  ALL_REQUEST_PRIORITIES,
  REQUEST_PRIORITY_CONFIG,
} from '../../services/materialRequestsService';
import { MaterialRecord, formatNaira } from '../../services/materialsService';

interface LineItemDraft {
  id: string;
  material_id: string;
  requested_quantity: number | '';
  unit_cost: number | '';
  notes: string;
}

interface NewMaterialRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: (newRequest: any) => void;
  preselectedProjectId?: string;
}

export const NewMaterialRequestModal: React.FC<NewMaterialRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated,
  preselectedProjectId,
}) => {
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);

  // Form states
  const [projectId, setProjectId] = useState<string>(preselectedProjectId || '');
  const [priority, setPriority] = useState<MaterialRequestPriority>('normal');
  const [requiredByDate, setRequiredByDate] = useState<string>('');
  const [justification, setJustification] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Line items
  const [items, setItems] = useState<LineItemDraft[]>([
    {
      id: 'item-1',
      material_id: '',
      requested_quantity: '',
      unit_cost: '',
      notes: '',
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load projects and materials for dropdowns
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
        })
        .finally(() => {
          setIsLoadingDropdowns(false);
        });
    }
  }, [isOpen, preselectedProjectId]);

  if (!isOpen) return null;

  // Add line item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        material_id: '',
        requested_quantity: '',
        unit_cost: '',
        notes: '',
      },
    ]);
  };

  // Remove line item
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update item field
  const handleItemChange = (id: string, field: keyof LineItemDraft, value: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };

        // When material changes, auto-populate standard unit cost
        if (field === 'material_id') {
          const selectedMat = materials.find((m) => m.id === value);
          if (selectedMat && selectedMat.standard_unit_cost !== null) {
            updated.unit_cost = Number(selectedMat.standard_unit_cost);
          }
        }

        return updated;
      })
    );
  };

  // Total estimated value calculation
  const totalEstimatedValue = items.reduce((sum, item) => {
    const qty = Number(item.requested_quantity) || 0;
    const cost = Number(item.unit_cost) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!projectId) {
      setErrorMessage('Please select a project for this requisition.');
      return;
    }

    if (!requiredByDate) {
      setErrorMessage('Please specify the date this material is required on-site.');
      return;
    }

    if (!justification.trim()) {
      setErrorMessage('Please provide a justification for this material request.');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('At least one material item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.material_id) {
        setErrorMessage(`Item #${i + 1}: Please select a material.`);
        return;
      }
      const qty = Number(it.requested_quantity);
      if (isNaN(qty) || qty <= 0) {
        setErrorMessage(`Item #${i + 1}: Requested quantity must be greater than zero.`);
        return;
      }
      const cost = Number(it.unit_cost);
      if (isNaN(cost) || cost < 0) {
        setErrorMessage(`Item #${i + 1}: Unit cost cannot be negative.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: CreateMaterialRequestInput = {
        project_id: projectId,
        priority,
        required_by_date: new Date(requiredByDate).toISOString(),
        justification: justification.trim(),
        notes: notes.trim() || null,
        status: 'submitted',
        items: items.map((it) => {
          const qty = Number(it.requested_quantity);
          const cost = Number(it.unit_cost) || 0;
          return {
            material_id: it.material_id,
            requested_quantity: qty,
            unit_cost: cost,
            estimated_total: qty * cost,
            notes: it.notes.trim() || null,
          };
        }),
      };

      const result = await MaterialRequestsService.createMaterialRequest(payload);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        onRequestCreated(result.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to submit material request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">New Material Request</h2>
              <p className="text-xs text-slate-500">
                Author and submit a formal site material requisition for management review and approval.
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Project & Request Logistics */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Requisition Logistics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Project Selection */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Associated Project</span> <span className="text-red-500">*</span>
                </label>
                {isLoadingDropdowns ? (
                  <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
                ) : projects.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                    No active projects found. Please create a project first in the Projects module.
                  </div>
                ) : (
                  <select
                    required
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                  >
                    <option value="">Select Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code} • {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Priority</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as MaterialRequestPriority)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                >
                  {ALL_REQUEST_PRIORITIES.map((pr) => (
                    <option key={pr} value={pr}>
                      {REQUEST_PRIORITY_CONFIG[pr].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Required By Date */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Required on Site By</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={requiredByDate}
                  onChange={(e) => setRequiredByDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                />
              </div>

              {/* Justification */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Requisition Justification <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="e.g. Ground floor slab casting stage 1"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Material Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Requested Material Items
                </h3>
                <p className="text-[11px] text-slate-400">
                  Add line items from the verified materials catalog.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#01875F] font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {materials.length === 0 && !isLoadingDropdowns && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                No materials registered in the master catalog yet. Please add materials in the Materials Directory first.
              </div>
            )}

            {/* Line items list */}
            <div className="space-y-3">
              {items.map((item, index) => {
                const selectedMaterial = materials.find((m) => m.id === item.material_id);
                const lineTotal =
                  (Number(item.requested_quantity) || 0) * (Number(item.unit_cost) || 0);

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Item #{index + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* Material selection */}
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Material <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={item.material_id}
                          onChange={(e) => handleItemChange(item.id, 'material_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                        >
                          <option value="">Select Material</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.material_code} • {m.name} ({m.unit_of_measure})
                            </option>
                          ))}
                        </select>
                        {selectedMaterial && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>
                              Stock: <strong>{selectedMaterial.current_stock} {selectedMaterial.unit_of_measure}</strong>
                            </span>
                            <span>•</span>
                            <span>Std Cost: {formatNaira(selectedMaterial.standard_unit_cost)}</span>
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={item.requested_quantity}
                          onChange={(e) =>
                            handleItemChange(item.id, 'requested_quantity', e.target.value)
                          }
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                        />
                        <span className="text-[10px] text-slate-400 truncate block">
                          {selectedMaterial?.unit_of_measure || 'units'}
                        </span>
                      </div>

                      {/* Unit Cost */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Unit Cost (₦)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unit_cost}
                          onChange={(e) => handleItemChange(item.id, 'unit_cost', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                        />
                      </div>

                      {/* Line Estimated Total */}
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block text-right">
                          Estimated Total
                        </label>
                        <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 text-right">
                          {formatNaira(lineTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Item Notes */}
                    <div className="pt-1">
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                        placeholder="Item notes, specific dimensions or delivery instructions (optional)..."
                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Estimated Value Summary */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Total Estimated Requisition Value</span>
                <p className="text-[10px] text-slate-500">
                  Calculated dynamically from requested quantities and unit rates.
                </p>
              </div>
              <span className="text-xl font-bold font-mono text-slate-900">
                {formatNaira(totalEstimatedValue)}
              </span>
            </div>
          </div>

          {/* Section 3: Requisition Notes */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">General Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional delivery milestones, site contact details, or supervisor instructions..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
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
                  <span>Submitting Requisition...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Submit Material Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewMaterialRequestModal;
