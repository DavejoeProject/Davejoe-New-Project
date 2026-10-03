import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  MapPin,
  FileText,
} from 'lucide-react';
import {
  MaterialDeliveriesService,
  CreateDeliveryInput,
} from '../../services/materialDeliveriesService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { MaterialRecord, formatNaira } from '../../services/materialsService';

interface LineItemDraft {
  id: string;
  material_id: string;
  quantity: number | '';
  unit_cost: number | '';
  notes: string;
}

interface RecordDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeliveryCreated: (newDelivery: any) => void;
  preselectedProjectId?: string;
}

export const RecordDeliveryModal: React.FC<RecordDeliveryModalProps> = ({
  isOpen,
  onClose,
  onDeliveryCreated,
  preselectedProjectId,
}) => {
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);

  // Form
  const [projectId, setProjectId] = useState<string>(preselectedProjectId || '');
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [destination, setDestination] = useState<string>('');
  const [acknowledgementReference, setAcknowledgementReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [items, setItems] = useState<LineItemDraft[]>([
    {
      id: 'item-1',
      material_id: '',
      quantity: '',
      unit_cost: '',
      notes: '',
    },
  ]);

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
        })
        .finally(() => {
          setIsLoadingDropdowns(false);
        });
    }
  }, [isOpen, preselectedProjectId]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        material_id: '',
        quantity: '',
        unit_cost: '',
        notes: '',
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleItemChange = (id: string, field: keyof LineItemDraft, val: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: val };

        if (field === 'material_id') {
          const selectedMat = materials.find((m) => m.id === val);
          if (selectedMat && selectedMat.standard_unit_cost !== null) {
            updated.unit_cost = Number(selectedMat.standard_unit_cost);
          }
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!projectId) {
      setErrorMessage('Please select a destination project.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('At least one delivery item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.material_id) {
        setErrorMessage(`Item #${i + 1}: Please select a material.`);
        return;
      }
      const qty = Number(it.quantity);
      if (isNaN(qty) || qty <= 0) {
        setErrorMessage(`Item #${i + 1}: Quantity delivered must be greater than zero.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: CreateDeliveryInput = {
        project_id: projectId,
        delivery_date: deliveryDate ? new Date(deliveryDate).toISOString() : new Date().toISOString(),
        destination: destination.trim() || null,
        acknowledgement_reference: acknowledgementReference.trim() || null,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          material_id: it.material_id,
          quantity: Number(it.quantity),
          unit_cost: it.unit_cost !== '' ? Number(it.unit_cost) : null,
          notes: it.notes.trim() || null,
        })),
      };

      const result = await MaterialDeliveriesService.createMaterialDelivery(payload);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        onDeliveryCreated(result.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to record site delivery.'
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
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Record Site Delivery</h2>
              <p className="text-xs text-slate-500">
                Log physical delivery of materials to a project site.
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

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Destination Project</span> <span className="text-red-500">*</span>
                </label>
                {isLoadingDropdowns ? (
                  <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
                ) : (
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
                )}
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Delivery Date</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Delivery Destination / Gate</span>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Block A Store / Gate 2 Offloading Bay"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Waybill / Acknowledgement Ref</span>
                </label>
                <input
                  type="text"
                  value={acknowledgementReference}
                  onChange={(e) => setAcknowledgementReference(e.target.value)}
                  placeholder="e.g. WB-88291 / Signed Gate Pass"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Delivered Items
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#01875F] font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const selectedMat = materials.find((m) => m.id === item.material_id);
                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">
                        Item #{idx + 1}
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
                      <div className="sm:col-span-7 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Material <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={item.material_id}
                          onChange={(e) => handleItemChange(item.id, 'material_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                        >
                          <option value="">Select Material</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.material_code} • {m.name} ({m.unit_of_measure})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Quantity <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                          />
                          <span className="text-[11px] text-slate-400 shrink-0">
                            {selectedMat?.unit_of_measure || 'units'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                      placeholder="Line notes or batch remarks (optional)..."
                      className="w-full px-2.5 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">Delivery Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Driver details, vehicle plate number, site inspection comments..."
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
                  <span>Recording Delivery...</span>
                </>
              ) : (
                <>
                  <Truck className="w-3.5 h-3.5" />
                  <span>Save Delivery Record</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordDeliveryModal;
