import React, { useState } from 'react';
import {
  FolderKanban,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  MapPin,
  Calendar,
  DollarSign,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { ProjectItem } from '../../services/dashboardService';
import { ASSETS } from '../../assets/projectImages';

interface ProjectsModuleProps {
  onBackToDashboard: () => void;
  onOpenProjectDetail: (project: ProjectItem) => void;
  projects: ProjectItem[];
}

export const ProjectsModule: React.FC<ProjectsModuleProps> = ({
  onBackToDashboard,
  onOpenProjectDetail,
  projects,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredProjects = projects.filter((p) => {
    const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.client.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-[#01875F]" />
            <span>Projects Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Portfolio oversight, budget execution, and delivery milestones.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects, location, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {['All', 'On Track', 'At Risk', 'Delayed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterStatus === status
                  ? 'bg-[#01875F] text-white font-semibold shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProjects.map((proj) => {
          let badgeClass = 'bg-[#E6F4EA] text-[#01875F]';
          if (proj.status === 'At Risk') badgeClass = 'bg-[#FEF7E0] text-[#B06000]';
          if (proj.status === 'Delayed') badgeClass = 'bg-[#FCE8E6] text-[#C5221F]';

          return (
            <div
              key={proj.id}
              onClick={() => onOpenProjectDetail(proj)}
              className="bg-white rounded-xl border border-slate-200/80 hover:border-slate-300 shadow-2xs overflow-hidden flex flex-col justify-between transition-all cursor-pointer group"
            >
              <div>
                {/* Image Header */}
                <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
                  <img
                    src={proj.image}
                    alt={proj.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs ${badgeClass}`}>
                      {proj.status}
                    </span>
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-4 sm:p-5">
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#01875F] transition-colors truncate">
                    {proj.name}
                  </h3>
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{proj.location}</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Client:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[170px]">{proj.client}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Supervisor:</span>
                      <span className="font-medium text-slate-700">{proj.siteSupervisor}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Target Handover:</span>
                      <span className="font-medium text-slate-700">{proj.targetDate}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Budget:</span>
                      <span className="font-mono font-bold text-slate-900">{proj.budget}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Construction Progress</span>
                      <span className="font-bold text-slate-800">{proj.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#01875F] rounded-full transition-all duration-500"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">Spent: <strong className="text-slate-700 font-mono">{proj.spent}</strong></span>
                <span className="text-[#01875F] font-semibold group-hover:underline">
                  Manage Details →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
