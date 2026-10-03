import React, { useState, useEffect } from 'react';
import { X, FolderPlus, AlertCircle, Briefcase, Calendar } from 'lucide-react';
import {
  WorkforceService,
  WorkforceMemberRecord,
  AssignableProject,
} from '../../services/workforceService';

interface AssignWorkerModalProps {
  member: WorkforceMemberRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: (message: string) => void;
}

export const AssignWorkerModal: React.FC<AssignWorkerModalProps> = ({
  member,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const [projects, setProjects] = useState<AssignableProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [roleOnProject, setRoleOnProject] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !member) return;

    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRoleOnProject(member.trade || '');
    setNotes('');
    setErrorMessage(null);

    async function loadProjects() {
      setIsLoadingProjects(true);
      const res = await WorkforceService.getAssignableProjects();
      if (res.data) {
        setProjects(res.data);
        if (res.data.length > 0) {
          setSelectedProjectId(res.data[0].id);
        }
      } else if (res.error) {
        setErrorMessage(res.error);
      }
      setIsLoadingProjects(false);
    }

    loadProjects();
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProjectId) {
      setErrorMessage('Please select a project to assign this worker to.');
      return;
    }

    setIsSubmitting(true);

    const res = await WorkforceService.assignWorkerToProject({
      projectId: selectedProjectId,
      workforceMemberId: member.id,
      roleOnProject: roleOnProject.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      notes: notes.trim() || null,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      const assignedProj = projects.find((p) => p.id === selectedProjectId);
      onAssigned(
        `Assigned ${member.workforce_code} to ${assignedProj?.name || 'project'} successfully.`
      );
      onClose();
    }
  };

  const prof = member.profiles;
  const workerDisplayName =
    prof?.display_name ||
    (prof?.first_name || prof?.last_name
      ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
      : member.workforce_code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Assign to Project
              </h2>
              <p className="text-xs text-slate-500">
                Deploy <span className="font-semibold text-slate-800">{workerDisplayName}</span> ({member.trade})
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {isLoadingProjects ? (
            <div className="p-4 text-center text-xs text-slate-500">Loading available projects...</div>
          ) : projects.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              No projects exist in the database. Please create a project first before assigning workforce members.
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Project <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.project_code}] {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Role / Specialization on Project
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead Mason, Lead Electrician, Artisan"
                  value={roleOnProject}
                  onChange={(e) => setRoleOnProject(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Expected End Date (Optional)
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assignment Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Scope of site work, deployment supervisor, or conditions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F] resize-none"
                />
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || projects.length === 0}
              className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <span>Confirm Assignment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
