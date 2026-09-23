import React from 'react';
import { X, MapPin, Calendar, DollarSign, User, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';
import { ProjectItem } from '../../services/dashboardService';

interface ProjectDetailModalProps {
  project: ProjectItem | null;
  onClose: () => void;
  onNavigateToMaterials: () => void;
  onNavigateToInspections: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  onClose,
  onNavigateToMaterials,
  onNavigateToInspections,
}) => {
  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header with Image */}
        <div className="relative h-48 sm:h-56 bg-slate-900 overflow-hidden shrink-0">
          <img
            src={project.image}
            alt={project.name}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badge & Title */}
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider mb-1.5 ${
                project.status === 'On Track'
                  ? 'bg-emerald-500/90 text-white'
                  : project.status === 'At Risk'
                  ? 'bg-amber-500/90 text-white'
                  : 'bg-red-500/90 text-white'
              }`}
            >
              {project.status}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {project.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-200 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>{project.location}</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs sm:text-sm">
          {/* Progress Section */}
          <div>
            <div className="flex items-center justify-between font-semibold text-slate-700 mb-1.5">
              <span>Overall Completion Progress</span>
              <span className="text-[#01875F] font-bold text-base">{project.progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#01875F] rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-xs">Total Approved Budget</span>
              <span className="font-mono font-bold text-slate-900 text-sm sm:text-base">
                {project.budget}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-xs">Certified Costs Incurred</span>
              <span className="font-mono font-bold text-slate-700 text-sm sm:text-base">
                {project.spent}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-xs">Client / Developer</span>
              <span className="font-semibold text-slate-800 truncate block">
                {project.client}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-slate-400 block text-xs">Site Supervisor Lead</span>
              <span className="font-semibold text-slate-800 truncate block">
                {project.siteSupervisor}
              </span>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="pt-2 flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                onClose();
                onNavigateToMaterials();
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              View Site Materials →
            </button>
            <button
              onClick={() => {
                onClose();
                onNavigateToInspections();
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              View QC Inspections →
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            Target Handover: <strong className="text-slate-700">{project.targetDate}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
