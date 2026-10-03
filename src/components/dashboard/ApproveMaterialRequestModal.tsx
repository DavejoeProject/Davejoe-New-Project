import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import {
  MaterialRequestRecord,
  MaterialRequestsService,
} from '../../services/materialRequestsService';
import { formatNaira } from '../../services/materialsService';

interface ApproveMaterialRequestModalProps {
  request: MaterialRequestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onApproved: (updatedRequest: MaterialRequestRecord) => void;
}

export const ApproveMaterialRequestModal: React.FC<ApproveMaterialRequestModalProps> = ({
  request,
  isOpen,
  onClose,
  onApproved,
}) => {
  const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (request && request.items) {
      const initial: Record<string, number> = {};
      request.items.forEach((item) => {
        // Default approved_quantity to existing approved_quantity or requested_quantity
        initial[item.id] =
          item.approved_quantity !== null && item.approved_quantity !== undefined
            ? Number(item.approved_quantity)
            : Number(item.requested_quantity);
      });
      setApprovedQuantities(initial);
      setNotes('');
      setErrorMessage(null);
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const handleQuantityChange = (itemId: string, val: string, maxQty: number) => {
    const num = parseFloat(val);
    setApprovedQuantities((prev) => ({
      ...prev,
      [itemId]: isNaN(num) ? 0 : Math.min(Math.max(0, num), maxQty),
    }));
  };

  const handleApproveAllFull = () => {
    if (!request.items) return;
    const full: Record<string, number> = {};
    request.items.forEach((item) => {
      full[item.id] = Number(item.requested_quantity);
    });
    setApprovedQuantities(full);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate quantities
    const items = request.items || [];
    for (const item of items) {
      const approved = approvedQuantities[item.id];
      if (approved === undefined || approved < 0) {
        setErrorMessage(`Approved quantity for ${item.material?.name || 'item'} cannot be negative.`);
        return;
      }
      if (approved > Number(item.requested_quantity)) {
        setErrorMessage(
          `Approved quantity for ${item.material?.name || 'item'} cannot exceed requested quantity (${item.requested_quantity}).`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const approvedItems = items.map((item) => ({
        itemId: item.id,
        approvedQuantity: approvedQuantities[item.id] ?? Number(item.requested_quantity),
      }));

      const res = await MaterialRequestsService.approveMaterialRequest(request.id, {
        approvedItems,
        notes: notes.trim() || undefined,
      });

      if (res.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      if (res.data) {
        onApproved(res.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Approval workflow failed.');
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
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#01875F] flex items-center justify-center shrink-0 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Approve Material Request</h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {request.request_code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Review and authorise quantities to proceed for procurement and site fulfilment.
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
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-2.5 text-slate-600 text-[11px]">
            <Info className="w-4 h-4 text-[#01875F] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800">
                Project: {request.projects?.project_code} • {request.projects?.name}
              </p>
              <p className="text-slate-500 mt-0.5">
                You can approve the exact requested quantities or specify adjusted authorized quantities per item. Approved quantities cannot exceed requested limits.
              </p>
            </div>
            <button
              type="button"
              onClick={handleApproveAllFull}
              className="text-[#01875F] font-semibold hover:underline text-[11px] shrink-0 cursor-pointer"
            >
              Approve 100%
            </button>
          </div>

          {/* Line items approval table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Review Quantities per Item
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {request.items?.map((item, idx) => {
                const requested = Number(item.requested_quantity);
                const approved = approvedQuantities[item.id] ?? requested;
                const unit = item.material?.unit_of_measure || 'units';

                return (
                  <div key={item.id} className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400 font-semibold">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-900 truncate">
                          {item.material?.name || 'Material Item'}
                        </span>
                        {item.material?.material_code && (
                          <span className="font-mono text-[10.5px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/70">
                            {item.material.material_code}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Requested: <strong>{requested} {unit}</strong></span>
                        <span>•</span>
                        <span>Unit Rate: {formatNaira(item.unit_cost)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Authorized:
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max={requested}
                          step="any"
                          required
                          value={approved}
                          onChange={(e) =>
                            handleQuantityChange(item.id, e.target.value, requested)
                          }
                          className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 text-right focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                        />
                        <span className="text-[11px] text-slate-400 w-10 truncate">{unit}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approval Notes */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">Approval Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Authorization instructions for procurement or site delivery teams..."
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
                  <span>Authorizing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Approval</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApproveMaterialRequestModal;
