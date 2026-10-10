import React, { useState, useEffect } from 'react';
import { X, FileText, CheckCircle2, AlertCircle, Building2, Calendar, Users, Package } from 'lucide-react';
import { SiteSupervisorService, SupervisorProjectItem } from '../../services/siteSupervisorService';
import { getNigerianTodayIso } from '../../services/attendanceService';

interface CreateDailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects: SupervisorProjectItem[];
  preselectedProjectId?: string;
}

export const CreateDailyReportModal: React.FC<CreateDailyReportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projects,
  preselectedProjectId,
}) => {
  const [projectId, setProjectId] = useState<string>(preselectedProjectId || (projects[0]?.id || ''));
  const [reportDate, setReportDate] = useState<string>(getNigerianTodayIso());
  const [title, setTitle] = useState<string>('');
  const [workPlanned, setWorkPlanned] = useState<string>('');
  const [workCompleted, setWorkCompleted] = useState<string>('');
  const [areasWorked, setAreasWorked] = useState<string>('');
  const [quantitiesCompleted, setQuantitiesCompleted] = useState<string>('');
  const [workforcePresent, setWorkforcePresent] = useState<string>('');
  const [materialsReceived, setMaterialsReceived] = useState<string>('');
  const [materialsUsed, setMaterialsUsed] = useState<string>('');
  const [delaysIssues, setDelaysIssues] = useState<string>('');
  const [safetyConcerns, setSafetyConcerns] = useState<string>('');
  const [nextSteps, setNextSteps] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedProjectId) {
      setProjectId(preselectedProjectId);
    } else if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [preselectedProjectId, projects, projectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setErrorMessage('Please select a project.');
      return;
    }
    if (!workCompleted.trim()) {
      setErrorMessage('Please enter the work completed description.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await SiteSupervisorService.submitDailySiteReport({
      projectId,
      title: title.trim() || `Daily Site Execution Report`,
      reportDate,
      workPlanned: workPlanned.trim() || undefined,
      workCompleted: workCompleted.trim(),
      areasWorked: areasWorked.trim() || undefined,
      quantitiesCompleted: quantitiesCompleted.trim() || undefined,
      workforcePresent: workforcePresent ? Number(workforcePresent) : undefined,
      materialsReceived: materialsReceived.trim() || undefined,
      materialsUsed: materialsUsed.trim() || undefined,
      delaysIssues: delaysIssues.trim() || undefined,
      safetyConcerns: safetyConcerns.trim() || undefined,
      nextSteps: nextSteps.trim() || undefined,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSuccessMessage('Daily site report submitted successfully.');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">New Daily Site Report</h3>
              <p className="text-xs text-slate-500">Record structured daily execution, output, and site observations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Project <span className="text-rose-500">*</span>
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs font-medium text-slate-800"
              >
                <option value="">Select Project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Report Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Report Title / Summary Header</label>
            <input
              type="text"
              placeholder="e.g., Priming & Wall Skimming — 2nd Floor"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Work Planned for Day</label>
              <textarea
                rows={2}
                placeholder="Scope scheduled for today's shift..."
                value={workPlanned}
                onChange={(e) => setWorkPlanned(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Work Actually Completed <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Specific tasks completed by artisans..."
                value={workCompleted}
                onChange={(e) => setWorkCompleted(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Areas / Rooms Worked</label>
              <input
                type="text"
                placeholder="e.g., Living room, Rooms 1-3"
                value={areasWorked}
                onChange={(e) => setAreasWorked(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quantities / Measurements</label>
              <input
                type="text"
                placeholder="e.g., 250 m² primed"
                value={quantitiesCompleted}
                onChange={(e) => setQuantitiesCompleted(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Workforce Present</label>
              <input
                type="number"
                min="0"
                placeholder="e.g., 8"
                value={workforcePresent}
                onChange={(e) => setWorkforcePresent(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Materials Received / Waybills</label>
              <textarea
                rows={2}
                placeholder="Paint drums, filler bags, sandpaper..."
                value={materialsReceived}
                onChange={(e) => setMaterialsReceived(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Materials Consumed / Used</label>
              <textarea
                rows={2}
                placeholder="Quantities used during the shift..."
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Delays, Blockers &amp; Site Issues</label>
              <textarea
                rows={2}
                placeholder="Power outage, water shortage, client delay..."
                value={delaysIssues}
                onChange={(e) => setDelaysIssues(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Safety Incidents / Instructions</label>
              <textarea
                rows={2}
                placeholder="Safety PPE compliance, client instructions..."
                value={safetyConcerns}
                onChange={(e) => setSafetyConcerns(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Planned Next Steps (Tomorrow)</label>
            <input
              type="text"
              placeholder="e.g., Final coat of emulsion in master bedroom"
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] text-xs text-slate-800"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white font-bold rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting Report...' : 'Submit Daily Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
