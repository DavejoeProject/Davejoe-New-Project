import React, { useState, useEffect } from 'react';
import {
  X,
  ShoppingCart,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  Truck,
  FileText,
} from 'lucide-react';
import {
  ProcurementService,
  CreatePurchaseOrderInput,
  SupplierRecord,
} from '../../services/procurementService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
  MaterialRequestRecord,
} from '../../services/materialRequestsService';
import { MaterialRecord, formatNaira } from '../../services/materialsService';

interface LineItemDraft {
  id: string;
  material_id: string;
  ordered_quantity: number | '';
  unit_cost: number | '';
  notes: string;
}

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (newOrder: any) => void;
  preselectedProjectId?: string;
}

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  preselectedProjectId,
}) => {
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequestRecord[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);

  // Form fields
  const [projectId, setProjectId] = useState<string>(preselectedProjectId || '');
  const [supplierId, setSupplierId] = useState<string>('');
  const [materialRequestId, setMaterialRequestId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [deliveryCost, setDeliveryCost] = useState<string>('0');
  const [otherCost, setOtherCost] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');

  // Line items
  const [items, setItems] = useState<LineItemDraft[]>([
    {
      id: 'item-1',
      material_id: '',
      ordered_quantity: '',
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
        ProcurementService.getSuppliersForDropdown(),
        MaterialRequestsService.getMaterialsForDropdown(),
        MaterialRequestsService.getMaterialRequests({ status: 'approved' }),
      ])
        .then(([projRes, supRes, matRes, reqRes]) => {
          setProjects(projRes.data);
          setSuppliers(supRes.data);
          setMaterials(matRes.data);
          setMaterialRequests(reqRes.data);

          if (preselectedProjectId) {
            setProjectId(preselectedProjectId);
          } else if (projRes.data.length > 0 && !projectId) {
            setProjectId(projRes.data[0].id);
          }

          if (supRes.data.length > 0 && !supplierId) {
            setSupplierId(supRes.data[0].id);
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
        ordered_quantity: '',
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

  // Pre-fill items from selected Material Request if user chooses one
  const handleMaterialRequestSelect = (reqId: string) => {
    setMaterialRequestId(reqId);
    if (!reqId) return;

    const req = materialRequests.find((r) => r.id === reqId);
    if (req) {
      if (req.project_id) setProjectId(req.project_id);
      if (req.items && req.items.length > 0) {
        setItems(
          req.items.map((it, idx) => ({
            id: `item-from-req-${idx}`,
            material_id: it.material_id,
            ordered_quantity:
              it.approved_quantity !== null && it.approved_quantity !== undefined
                ? Number(it.approved_quantity)
                : Number(it.requested_quantity),
            unit_cost: Number(it.unit_cost) || 0,
            notes: it.notes || '',
          }))
        );
      }
    }
  };

  // Financial calculations
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.ordered_quantity) || 0;
    const cost = Number(item.unit_cost) || 0;
    return sum + qty * cost;
  }, 0);

  const numDelivery = Math.max(0, parseFloat(deliveryCost) || 0);
  const numOther = Math.max(0, parseFloat(otherCost) || 0);
  const grandTotal = subtotal + numDelivery + numOther;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!projectId) {
      setErrorMessage('Please select an associated project.');
      return;
    }
    if (!supplierId) {
      setErrorMessage('Please select a supplier.');
      return;
    }
    if (items.length === 0) {
      setErrorMessage('At least one purchase order item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.material_id) {
        setErrorMessage(`Item #${i + 1}: Please select a material.`);
        return;
      }
      const qty = Number(it.ordered_quantity);
      if (isNaN(qty) || qty <= 0) {
        setErrorMessage(`Item #${i + 1}: Ordered quantity must be greater than zero.`);
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
      const payload: CreatePurchaseOrderInput = {
        project_id: projectId,
        supplier_id: supplierId,
        material_request_id: materialRequestId || null,
        purchase_date: purchaseDate ? new Date(purchaseDate).toISOString() : new Date().toISOString(),
        expected_delivery_date: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : null,
        delivery_cost: numDelivery,
        other_cost: numOther,
        notes: notes.trim() || null,
        status: 'submitted',
        items: items.map((it) => ({
          material_id: it.material_id,
          ordered_quantity: Number(it.ordered_quantity),
          unit_cost: Number(it.unit_cost) || 0,
          notes: it.notes.trim() || null,
        })),
      };

      const result = await ProcurementService.createPurchaseOrder(payload);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        onOrderCreated(result.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to author purchase order.'
      );
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
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create Purchase Order</h2>
              <p className="text-xs text-slate-500">
                Author and issue a formal purchase order to a registered vendor or supplier.
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

          {/* Section 1: Vendor & Project Logistics */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Vendor & Project Association
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Project Selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>Associated Project</span> <span className="text-red-500">*</span>
                </label>
                {isLoadingDropdowns ? (
                  <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
                ) : projects.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                    No active projects found.
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

              {/* Supplier Selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Supplier / Vendor</span> <span className="text-red-500">*</span>
                </label>
                {isLoadingDropdowns ? (
                  <div className="h-9 bg-slate-100 rounded-lg animate-pulse" />
                ) : suppliers.length === 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px]">
                    No suppliers registered yet in the system.
                  </div>
                ) : (
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplier_code})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Linked Material Request */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Linked Requisition (Optional)</span>
                </label>
                <select
                  value={materialRequestId}
                  onChange={(e) => handleMaterialRequestSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                >
                  <option value="">No linked requisition</option>
                  {materialRequests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.request_code} • {r.justification || 'Request'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purchase Date */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Purchase Date</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                />
              </div>

              {/* Expected Delivery Date */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Expected Delivery</span>
                </label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Order Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Procurement Line Items
                </h3>
                <p className="text-[11px] text-slate-400">
                  Select catalog materials and define agreed vendor pricing.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#01875F] font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Material</span>
              </button>
            </div>

            {/* Line items list */}
            <div className="space-y-3">
              {items.map((item, index) => {
                const selectedMaterial = materials.find((m) => m.id === item.material_id);
                const lineTotal =
                  (Number(item.ordered_quantity) || 0) * (Number(item.unit_cost) || 0);

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Line #{index + 1}
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
                          value={item.ordered_quantity}
                          onChange={(e) =>
                            handleItemChange(item.id, 'ordered_quantity', e.target.value)
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
                          Unit Cost (₦) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={item.unit_cost}
                          onChange={(e) => handleItemChange(item.id, 'unit_cost', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                        />
                      </div>

                      {/* Line Total */}
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block text-right">
                          Line Total
                        </label>
                        <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 text-right">
                          {formatNaira(lineTotal)}
                        </div>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                        placeholder="Item notes, specific dimensions or packaging terms (optional)..."
                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Cost Summary & Logistics Fees */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Procurement Commitment Calculation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  Delivery / Freight Cost (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-600 block">
                  Other Logistics / Handling Costs (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={otherCost}
                  onChange={(e) => setOtherCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-500">
                <span>Items Subtotal:</span>
                <span>{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery:</span>
                <span>{formatNaira(numDelivery)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Other Costs:</span>
                <span>{formatNaira(numOther)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-slate-300">
                <span>TOTAL COMMITMENT:</span>
                <span>{formatNaira(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Payment Terms & Commercial Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms (e.g. 30% advance, balance on delivery), warehouse gate pass, or unloading terms..."
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
                  <span>Creating Purchase Order...</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Issue Purchase Order</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePurchaseOrderModal;
