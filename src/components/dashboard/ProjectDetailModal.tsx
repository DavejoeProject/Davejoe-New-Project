import React from 'react';
import { X, Building2, Calendar, MapPin, Tag, User, Clock, ArrowRight, Edit3 } from 'lucide-react';
import { ProjectRecord, PROJECT_STATUS_CONFIG, ProjectStatus } from '../../services/projectService';
import { formatNaira, formatDateNigerian } from '../../services/dashboardService';

interface ProjectDetailModalProps {
  project: ProjectRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (project: ProjectRecord) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  isOpen,
  onClose,
  onEdit,
}) => {
  if (!isOpen || !project) return null;

  const statusCfg = PROJECT_STATUS_CONFIG[project.status as ProjectStatus] || {
    label: project.status,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const clientName = project.clients?.name || 'Unassigned Client';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {project.project_code}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.badgeClass}`}>
                  {statusCfg.label}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
                {project.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(project);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Attributes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Client Information
              </span>
              <div className="text-sm font-bold text-slate-900">{clientName}</div>
              {project.clients?.email && (
                <div className="text-xs text-slate-500 font-mono">{project.clients.email}</div>
              )}
              {project.clients?.phone && (
                <div className="text-xs text-slate-500">{project.clients.phone}</div>
              )}
            </div>

            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Contract &amp; Financials
              </span>
              <div className="text-lg font-bold text-slate-900 font-mono">
                {project.contract_value != null ? formatNaira(project.contract_value) : '—'}
              </div>
              <div className="text-xs text-slate-500">
                Currency: <strong className="text-slate-700">{project.currency || 'NGN'}</strong>
              </div>
            </div>
          </div>

          {/* Type & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Project Type:</span>
              <p className="font-semibold text-slate-800">{project.project_type || '—'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 font-medium">Site Address:</span>
              <p className="font-semibold text-slate-800">
                {[project.address, project.city, project.state, project.country]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
            </div>
          </div>

          {/* Timeline Dates */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
              Project Schedule &amp; Milestones
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Start Date:</span>
                <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                  {project.start_date ? formatDateNigerian(project.start_date) : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Expected Completion:</span>
                <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                  {project.expected_completion_date
                    ? formatDateNigerian(project.expected_completion_date)
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Actual Handover:</span>
                <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                  {project.actual_completion_date
                    ? formatDateNigerian(project.actual_completion_date)
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div className="space-y-1.5 text-xs">
              <span className="font-bold text-slate-700">Project Scope &amp; Brief:</span>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-200/80">
                {project.description}
              </p>
            </div>
          )}

          {/* System Audit Information */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>Created: {formatDateNigerian(project.created_at, true)}</span>
            <span>Last Updated: {formatDateNigerian(project.updated_at, true)}</span>
            <span className="font-mono">ID: {project.id}</span>
          </div>

          {/* Next Phases Notice */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
            <strong>Architecture Note:</strong> Detailed project progress tracking, milestone sign-offs, workforce rosters, material requirements, and quality inspections will be linked in subsequent phases.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex justify-end bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailModal;
