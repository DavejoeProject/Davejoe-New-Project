import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { ProjectControlService } from '../../services/projectControlService';

interface AssignWorkforceModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignWorkforceModal: React.FC<AssignWorkforceModalProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const [workers, setWorkers] = useState<
    Array<{ id: string; workforce_code: string; trade: string; status: string; displayName: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setNotes('');

    async function loadWorkers() {
      setLoading(true);
      setError(null);
      const res = await ProjectControlService.getAvailableWorkforceMembers();
      if (res.error) {
        setError(res.error);
      } else {
        setWorkers(res.data);
        if (res.data.length > 0) {
          setSelectedWorkerId(res.data[0].id);
        }
      }
      setLoading(false);
    }

    loadWorkers();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedWorkerId) {
      setFormError('Please select a workforce member.');
      return;
    }

    setIsSubmitting(true);
    const res = await ProjectControlService.assignWorkforce({
      projectId,
      workforceMemberId: selectedWorkerId,
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes.trim() || null,
    });
    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      onAssigned();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Assign Workforce Member
              </h2>
              <p className="text-xs text-slate-500 truncate max-w-xs">{projectName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Workforce Member <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <div className="text-xs text-slate-400 py-2">Loading available workers...</div>
            ) : error ? (
              <div className="text-xs text-red-600 font-medium">{error}</div>
            ) : workers.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                No registered workforce members found in database.
              </div>
            ) : (
              <select
                required
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              >
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.displayName} ({w.workforce_code}) • {w.trade}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Assignment Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Expected End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Assignment Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Lead structural carpenter for roof framing stage..."
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loading || workers.length === 0}
              className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
