import React, { useState, useEffect } from 'react';
import { X, FolderKanban, Calendar, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import {
  WorkforceDirectoryRecord,
  WorkforceDirectoryService,
  ProjectSummary,
} from '../../services/workforceDirectoryService';

interface AssignContractWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: WorkforceDirectoryRecord | null;
  actorUserId?: string;
  onAssigned: (message: string) => void;
}

export const AssignContractWorkerModal: React.FC<AssignContractWorkerModalProps> = ({
  isOpen,
  onClose,
  member,
  actorUserId,
  onAssigned,
}) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [assignedAt, setAssignedAt] = useState(() => new Date().toISOString().split('T')[0]);
  const [expectedEndDate, setExpectedEndDate] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedProjectId('');
      setAssignedAt(new Date().toISOString().split('T')[0]);
      setExpectedEndDate('');
      setAssignmentNotes('');
      setErrorMsg(null);
      setIsLoadingProjects(true);
      WorkforceDirectoryService.listProjects().then((res) => {
        setProjects(res.data);
        if (res.error) setErrorMsg(res.error);
        setIsLoadingProjects(false);
      });
    }
  }, [isOpen]);

  if (!isOpen || !member) return null;

  const activeProjectIds = new Set(
    (member.assignments || [])
      .filter((a) => (a.assignment_status || '').toLowerCase() === 'active')
      .map((a) => a.project_id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProjectId) {
      setErrorMsg('Please select a project.');
      return;
    }

    if (activeProjectIds.has(selectedProjectId)) {
      setErrorMsg('This workforce member already has an active assignment on this project.');
      return;
    }

    if (expectedEndDate && assignedAt && expectedEndDate < assignedAt) {
      setErrorMsg('Expected completion date cannot be earlier than the assignment date.');
      return;
    }

    setIsSubmitting(true);
    const res = await WorkforceDirectoryService.assignToProject(
      {
        workforce_id: member.id,
        project_id: selectedProjectId,
        assigned_at: assignedAt ? `${assignedAt}T08:00:00.000Z` : new Date().toISOString(),
        expected_end_date: expectedEndDate || null,
        assignment_notes: assignmentNotes,
      },
      actorUserId
    );
    setIsSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    const proj = projects.find((p) => p.id === selectedProjectId);
    onAssigned(`Assigned ${member.full_name} to ${proj?.name || 'selected project'}.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">Assign to Project</h2>
              <p className="text-xs text-slate-500 truncate">
                Contract Worker: <strong className="text-slate-800">{member.full_name}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Project <span className="text-red-500">*</span>
            </label>
            <select
              required
              disabled={isLoadingProjects}
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
            >
              <option value="">
                {isLoadingProjects ? 'Loading projects...' : 'Choose an existing project...'}
              </option>
              {projects.map((p) => {
                const alreadyActive = activeProjectIds.has(p.id);
                return (
                  <option key={p.id} value={p.id} disabled={alreadyActive}>
                    {p.project_code ? `[${p.project_code}] ` : ''}
                    {p.name}
                    {alreadyActive ? ' (Already Actively Assigned)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Assignment Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  required
                  value={assignedAt}
                  onChange={(e) => setAssignedAt(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Expected Completion Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={expectedEndDate}
                  onChange={(e) => setExpectedEndDate(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assignment Notes & Scope
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <textarea
                rows={3}
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Trade scope, site area, agreed milestones, or reporting instructions..."
                className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingProjects}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{isSubmitting ? 'Assigning...' : 'Confirm Assignment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
