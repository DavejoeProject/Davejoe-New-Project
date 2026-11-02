import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Search, CheckCircle2, UserCheck } from 'lucide-react';
import { ProjectControlService } from '../../services/projectControlService';
import { supabase } from '../../lib/supabase';

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
  const [activeAssignedWorkerIds, setActiveAssignedWorkerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [workersRes, activeRes] = await Promise.all([
        ProjectControlService.getAvailableWorkforceMembers(),
        supabase
          .from('project_workforce_assignments')
          .select('workforce_member_id')
          .eq('project_id', projectId)
          .eq('is_active', true),
      ]);

      if (workersRes.error) {
        setError(workersRes.error);
      } else {
        setWorkers(workersRes.data);
        const assignedSet = new Set<string>(
          (activeRes.data || []).map((a: any) => a.workforce_member_id)
        );
        setActiveAssignedWorkerIds(assignedSet);

        // Select first unassigned worker
        const firstAvailable = workersRes.data.find((w) => !assignedSet.has(w.id));
        if (firstAvailable) {
          setSelectedWorkerId(firstAvailable.id);
        } else if (workersRes.data.length > 0) {
          setSelectedWorkerId(workersRes.data[0].id);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load workforce list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setSuccessToast(null);
    setSearchFilter('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setNotes('');

    loadData();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  // Filtered workers
  const filteredWorkers = workers.filter((w) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase().trim();
    return (
      w.displayName.toLowerCase().includes(term) ||
      w.workforce_code.toLowerCase().includes(term) ||
      (w.trade || '').toLowerCase().includes(term)
    );
  });

  const performAssignment = async (keepOpen: boolean): Promise<boolean> => {
    setFormError(null);
    setSuccessToast(null);

    if (!selectedWorkerId) {
      setFormError('Please select a workforce member.');
      return false;
    }

    if (activeAssignedWorkerIds.has(selectedWorkerId)) {
      setFormError('This worker is already actively assigned to this project. Duplicate active assignment is prevented.');
      return false;
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
      return false;
    }

    // Success
    const assignedWorker = workers.find((w) => w.id === selectedWorkerId);
    const workerName = assignedWorker?.displayName || 'Worker';

    onAssigned();

    if (keepOpen) {
      // Mark as assigned locally
      const updatedSet = new Set(activeAssignedWorkerIds);
      updatedSet.add(selectedWorkerId);
      setActiveAssignedWorkerIds(updatedSet);

      setSuccessToast(`Successfully assigned ${workerName} to ${projectName}.`);
      setNotes('');

      // Auto select next unassigned worker
      const nextUnassigned = workers.find((w) => !updatedSet.has(w.id));
      if (nextUnassigned) {
        setSelectedWorkerId(nextUnassigned.id);
      }
      return true;
    } else {
      onClose();
      return true;
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
                Assign Workforce to Project
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

        <div className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {successToast && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#01875F] shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Search Filter for Workers */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Filter Available Personnel
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by worker name, code, or trade..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-9 pl-8 pr-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Workforce Member <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">
                {activeAssignedWorkerIds.size} already assigned
              </span>
            </label>
            {loading ? (
              <div className="text-xs text-slate-400 py-2">Loading available personnel...</div>
            ) : error ? (
              <div className="text-xs text-red-600 font-medium">{error}</div>
            ) : filteredWorkers.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                {searchFilter ? 'No personnel match your search filter.' : 'No registered workforce members found in database.'}
              </div>
            ) : (
              <select
                required
                value={selectedWorkerId}
                onChange={(e) => setSelectedWorkerId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              >
                {filteredWorkers.map((w) => {
                  const isAssigned = activeAssignedWorkerIds.has(w.id);
                  return (
                    <option key={w.id} value={w.id} disabled={isAssigned}>
                      {w.displayName} ({w.workforce_code}) • {w.trade} {isAssigned ? '— [Already Assigned]' : ''}
                    </option>
                  );
                })}
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
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
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
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Assignment Notes / Role Specification</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Lead structural carpenter for roof framing stage..."
              className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || loading || workers.length === 0 || activeAssignedWorkerIds.has(selectedWorkerId)}
              onClick={() => performAssignment(true)}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#01875F] border border-emerald-200 text-xs font-bold rounded-xl shadow-2xs transition-colors disabled:opacity-60 cursor-pointer text-center"
            >
              {isSubmitting ? 'Assigning...' : 'Assign & Add Another'}
            </button>
            <button
              type="button"
              disabled={isSubmitting || loading || workers.length === 0 || activeAssignedWorkerIds.has(selectedWorkerId)}
              onClick={() => performAssignment(false)}
              className="px-4 py-2 bg-[#01875F] hover:bg-[#00704e] text-white text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-60 cursor-pointer text-center"
            >
              {isSubmitting ? 'Assigning...' : 'Assign & Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
