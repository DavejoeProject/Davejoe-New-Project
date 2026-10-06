import React, { useState } from 'react';
import { X, LogOut, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { AttendanceService, AttendanceRecordItem, formatTimeFromIso } from '../../services/attendanceService';

interface ClockOutWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  todayAttendance: AttendanceRecordItem[];
}

export const ClockOutWorkerModal: React.FC<ClockOutWorkerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  todayAttendance,
}) => {
  // Workers currently on site (status present or late, not clocked out)
  const onSiteWorkers = todayAttendance.filter(
    (a) => (a.status === 'present' || a.status === 'late') && !a.is_clocked_out
  );

  const [selectedRecordId, setSelectedRecordId] = useState<string>(
    onSiteWorkers[0]?.id || ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClockOut = async (recordId: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await AttendanceService.clockOutWorker(recordId);
    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessMessage('Worker successfully clocked out.');
      setTimeout(() => {
        setSuccessMessage(null);
        onSuccess();
        onClose();
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Clock Out Worker</h3>
              <p className="text-xs text-slate-500">Record gate exit &amp; end-of-shift departure</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {onSiteWorkers.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <User className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Workers Currently On Site</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                All clocked-in workers have either already departed or no arrivals were logged today.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Select a worker currently on site to record their clock-out:
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {onSiteWorkers.map((att) => {
                  const prof = att.workforce_members?.profiles;
                  const name =
                    prof?.display_name ||
                    `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
                    `Artisan ${att.workforce_members?.workforce_code || '---'}`;
                  const isSelected = selectedRecordId === att.id;

                  return (
                    <div
                      key={att.id}
                      onClick={() => setSelectedRecordId(att.id)}
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#01875F] bg-[#E6F4EA]/40 ring-1 ring-[#01875F]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {name[0] || 'A'}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900">{name}</h5>
                          <p className="text-[11px] text-slate-500">
                            [{att.workforce_members?.workforce_code}] &bull; {att.workforce_members?.trade} &bull; {att.projects?.name}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-mono text-slate-600 block">
                          In: {formatTimeFromIso(att.clock_in_time)}
                        </span>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          On Site
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {onSiteWorkers.length > 0 && (
              <button
                type="button"
                onClick={() => handleClockOut(selectedRecordId || onSiteWorkers[0]?.id)}
                disabled={isSubmitting || !selectedRecordId}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{isSubmitting ? 'Recording Clock-Out...' : 'Confirm Clock-Out'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
