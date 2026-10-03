import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Calendar,
  Building,
  Truck,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import {
  MaterialDeliveriesService,
  CreateReceiptInput,
  CreateReceiptItemInput,
} from '../../services/materialDeliveriesService';
import {
  ProcurementService,
  PurchaseOrderRecord,
  SupplierRecord,
} from '../../services/procurementService';
import { MaterialRequestsService } from '../../services/materialRequestsService';
import { MaterialRecord, formatNaira } from '../../services/materialsService';

interface ReceiptLineDraft {
  id: string;
  material_id: string;
  purchase_order_item_id: string | null;
  quantity_received: number | '';
  accepted_quantity: number | '';
  rejected_quantity: number | '';
  rejection_reason: string;
  unit_cost: number | '';
  batch_reference: string;
  notes: string;
}

interface RecordReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptCreated: (newReceipt: any) => void;
  preselectedPurchaseOrderId?: string;
}

export const RecordReceiptModal: React.FC<RecordReceiptModalProps> = ({
  isOpen,
  onClose,
  onReceiptCreated,
  preselectedPurchaseOrderId,
}) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState<boolean>(true);

  // Form
  const [purchaseOrderId, setPurchaseOrderId] = useState<string>(
    preselectedPurchaseOrderId || ''
  );
  const [supplierId, setSupplierId] = useState<string>('');
  const [receivedDate, setReceivedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [deliveryReference, setDeliveryReference] = useState<string>('');
  const [conditionNotes, setConditionNotes] = useState<string>('');
  const [discrepancyNotes, setDiscrepancyNotes] = useState<string>('');

  const [items, setItems] = useState<ReceiptLineDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingDropdowns(true);
      setErrorMessage(null);

      Promise.all([
        ProcurementService.getPurchaseOrders(),
        ProcurementService.getSuppliersForDropdown(),
        MaterialRequestsService.getMaterialsForDropdown(),
      ])
        .then(([poRes, supRes, matRes]) => {
          setPurchaseOrders(poRes.data);
          setSuppliers(supRes.data);
          setMaterials(matRes.data);

          if (preselectedPurchaseOrderId) {
            handlePoSelect(preselectedPurchaseOrderId, poRes.data);
          } else if (poRes.data.length > 0 && !purchaseOrderId) {
            handlePoSelect(poRes.data[0].id, poRes.data);
          }
        })
        .finally(() => {
          setIsLoadingDropdowns(false);
        });
    }
  }, [isOpen, preselectedPurchaseOrderId]);

  const handlePoSelect = (poId: string, availablePos: PurchaseOrderRecord[] = purchaseOrders) => {
    setPurchaseOrderId(poId);
    const selectedPo = availablePos.find((p) => p.id === poId);
    if (selectedPo) {
      if (selectedPo.supplier_id) {
        setSupplierId(selectedPo.supplier_id);
      }
      if (selectedPo.items && selectedPo.items.length > 0) {
        const poLines: ReceiptLineDraft[] = selectedPo.items.map((it, idx) => {
          const outstanding = Math.max(0, Number(it.ordered_quantity) - Number(it.received_quantity || 0));
          return {
            id: `line-${idx}-${it.id}`,
            material_id: it.material_id,
            purchase_order_item_id: it.id,
            quantity_received: outstanding > 0 ? outstanding : Number(it.ordered_quantity),
            accepted_quantity: outstanding > 0 ? outstanding : Number(it.ordered_quantity),
            rejected_quantity: 0,
            rejection_reason: '',
            unit_cost: Number(it.unit_cost) || 0,
            batch_reference: '',
            notes: '',
          };
        });
        setItems(poLines);
      }
    }
  };

  if (!isOpen) return null;

  const handleItemChange = (id: string, field: keyof ReceiptLineDraft, val: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: val };

        if (field === 'quantity_received') {
          const num = Number(val) || 0;
          updated.accepted_quantity = num;
          updated.rejected_quantity = 0;
        }

        return updated;
      })
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `manual-item-${Date.now()}`,
        material_id: '',
        purchase_order_item_id: null,
        quantity_received: '',
        accepted_quantity: '',
        rejected_quantity: 0,
        rejection_reason: '',
        unit_cost: '',
        batch_reference: '',
        notes: '',
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (items.length === 0) {
      setErrorMessage('At least one receipt line item is required.');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.material_id) {
        setErrorMessage(`Line #${i + 1}: Please select a material.`);
        return;
      }
      const rec = Number(it.quantity_received) || 0;
      const acc = Number(it.accepted_quantity) || 0;
      const rej = Number(it.rejected_quantity) || 0;

      if (rec <= 0) {
        setErrorMessage(`Line #${i + 1}: Received quantity must be greater than zero.`);
        return;
      }
      if (acc + rej > rec) {
        setErrorMessage(
          `Line #${i + 1}: Accepted (${acc}) + Rejected (${rej}) cannot exceed total received (${rec}).`
        );
        return;
      }
      if (rej > 0 && !it.rejection_reason.trim()) {
        setErrorMessage(`Line #${i + 1}: Rejection reason is required for rejected quantities.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: CreateReceiptInput = {
        purchase_order_id: purchaseOrderId || null,
        supplier_id: supplierId || null,
        received_date: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
        delivery_reference: deliveryReference.trim() || null,
        condition_notes: conditionNotes.trim() || null,
        discrepancy_notes: discrepancyNotes.trim() || null,
        items: items.map((it) => ({
          material_id: it.material_id,
          purchase_order_item_id: it.purchase_order_item_id || null,
          quantity_received: Number(it.quantity_received),
          accepted_quantity: Number(it.accepted_quantity),
          rejected_quantity: Number(it.rejected_quantity) || 0,
          rejection_reason: it.rejection_reason.trim() || null,
          unit_cost: it.unit_cost !== '' ? Number(it.unit_cost) : null,
          batch_reference: it.batch_reference.trim() || null,
          notes: it.notes.trim() || null,
        })),
      };

      const result = await MaterialDeliveriesService.createMaterialReceipt(payload);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        onReceiptCreated(result.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to record receipt.'
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
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Record Material Receipt</h2>
              <p className="text-xs text-slate-500">
                Log physical vendor delivery, inspect accepted/rejected quantities, and record stock intake.
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
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Associated Purchase Order</span>
                </label>
                <select
                  value={purchaseOrderId}
                  onChange={(e) => handlePoSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                >
                  <option value="">Direct Vendor Intake (No PO)</option>
                  {purchaseOrders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.purchase_code} • {p.projects?.name || 'Project'} ({p.suppliers?.name || 'Vendor'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Supplier / Vendor</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplier_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Received Date</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Vendor Delivery Ref / Waybill #</span>
                </label>
                <input
                  type="text"
                  value={deliveryReference}
                  onChange={(e) => setDeliveryReference(e.target.value)}
                  placeholder="e.g. WB-449102 / Invoice Ref"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                />
              </div>
            </div>
          </div>

          {/* Line items inspection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Material Quality & Quantity Verification
                </h3>
                <p className="text-[11px] text-slate-400">
                  Inspect received vs accepted vs rejected units.
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

            <div className="space-y-3">
              {items.map((it, idx) => {
                const selectedMat = materials.find((m) => m.id === it.material_id);
                return (
                  <div
                    key={it.id}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">
                        Line #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-5 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Material <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={it.material_id}
                          onChange={(e) => handleItemChange(it.id, 'material_id', e.target.value)}
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

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-slate-600 block">
                          Arrived Qty <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={it.quantity_received}
                          onChange={(e) => handleItemChange(it.id, 'quantity_received', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-semibold text-emerald-700 block">
                          Accepted Qty <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={it.accepted_quantity}
                          onChange={(e) => handleItemChange(it.id, 'accepted_quantity', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs font-mono font-bold text-emerald-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                        />
                      </div>

                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[11px] font-semibold text-rose-700 block">
                          Rejected Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.rejected_quantity}
                          onChange={(e) => handleItemChange(it.id, 'rejected_quantity', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-rose-50/50 border border-rose-200 rounded-lg text-xs font-mono font-bold text-rose-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    {Number(it.rejected_quantity) > 0 && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                        <input
                          type="text"
                          required
                          value={it.rejection_reason}
                          onChange={(e) => handleItemChange(it.id, 'rejection_reason', e.target.value)}
                          placeholder="Reason for rejection (e.g. cracked during transit, off-spec dimensions, damp packaging)..."
                          className="w-full px-2.5 py-1 bg-white border border-rose-300 rounded text-[11px] text-rose-800 placeholder:text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={it.batch_reference}
                        onChange={(e) => handleItemChange(it.id, 'batch_reference', e.target.value)}
                        placeholder="Batch / Heat / Lot # (optional)..."
                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                      />
                      <input
                        type="text"
                        value={it.notes}
                        onChange={(e) => handleItemChange(it.id, 'notes', e.target.value)}
                        placeholder="Line comments (optional)..."
                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Condition Notes</label>
              <textarea
                rows={2}
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                placeholder="Overall physical state upon offloading..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Discrepancy Notes</label>
              <textarea
                rows={2}
                value={discrepancyNotes}
                onChange={(e) => setDiscrepancyNotes(e.target.value)}
                placeholder="Variance notes against purchase order or invoice..."
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-900 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#01875F] shrink-0" />
            <span>
              Accepted material quantities will be recorded directly into the auditable inventory ledger.
            </span>
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
                  <span>Saving Receipt...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Confirm Receipt & Intake</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordReceiptModal;
