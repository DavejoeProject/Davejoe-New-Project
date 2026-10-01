import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Search,
  Filter,
  Plus,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Eye,
  Edit3,
  CheckCircle2,
} from 'lucide-react';
import {
  ProjectService,
  ProjectRecord,
  ProjectStatus,
  ALL_PROJECT_STATUSES,
  PROJECT_STATUS_CONFIG,
} from '../../services/projectService';
import { formatNaira, formatDateNigerian } from '../../services/dashboardService';
import { CreateProjectModal } from './CreateProjectModal';
import { EditProjectModal } from './EditProjectModal';
import { ProjectDetailModal } from './ProjectDetailModal';

interface ProjectsModuleProps {
  onBackToDashboard?: () => void;
}

export const ProjectsModule: React.FC<ProjectsModuleProps> = ({ onBackToDashboard }) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);
  const [viewingProject, setViewingProject] = useState<ProjectRecord | null>(null);

  // Feedback Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Live database fetch
  const fetchProjects = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      const res = await ProjectService.getProjects({
        search: searchQuery,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setProjects(res.data);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [searchQuery, statusFilter]
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#01875F]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                PROJECT MANAGEMENT
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <FolderKanban className="w-7 h-7 text-[#01875F]" />
              <span>Projects</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage and monitor all projects across the organization.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchProjects(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh project list from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Create Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by project name, code, city, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F] transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500 shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
          >
            <option value="all">All Statuses</option>
            {ALL_PROJECT_STATUSES.map((st) => (
              <option key={st} value={st}>
                {PROJECT_STATUS_CONFIG[st].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area: Table / Empty / Error / Loading */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
            ))}
          </div>
        </div>
      ) : errorMessage ? (
        /* Database Error State with Retry */
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load projects.</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            A database communication error occurred while querying the projects table.
          </p>
          <p className="text-xs font-mono text-red-600 bg-red-50 p-2.5 rounded-lg mt-3 border border-red-100">
            {errorMessage}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fetchProjects(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      ) : projects.length === 0 ? (
        /* Exact Empty State */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-4 border border-[#01875F]/20">
            <FolderKanban className="w-7 h-7" strokeWidth={1.8} />
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">No projects yet</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Projects created in the system will appear here.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-center">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Create Project</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Projects Table */
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 font-bold">Project</th>
                  <th className="py-3.5 px-3 font-bold">Project Code</th>
                  <th className="py-3.5 px-3 font-bold">Client</th>
                  <th className="py-3.5 px-3 font-bold">Type</th>
                  <th className="py-3.5 px-3 font-bold">Status</th>
                  <th className="py-3.5 px-3 font-bold text-right">Contract Value</th>
                  <th className="py-3.5 px-3 font-bold">Start Date</th>
                  <th className="py-3.5 px-3 font-bold">Expected Completion</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projects.map((proj) => {
                  const statusCfg = PROJECT_STATUS_CONFIG[proj.status as ProjectStatus] || {
                    label: proj.status,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  const clientDisplayName = proj.clients?.name || '—';

                  return (
                    <tr
                      key={proj.id}
                      onClick={() => navigate(`/management/projects/${proj.id}`)}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      {/* Project Name & Description */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-[#01875F] transition-colors truncate max-w-xs">
                          {proj.name}
                        </div>
                        {proj.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 max-w-xs">
                            {proj.description}
                          </p>
                        )}
                      </td>

                      {/* Project Code */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/80 text-[11px]">
                          {proj.project_code}
                        </span>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-800 truncate block max-w-[150px]">
                          {clientDisplayName}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-3 text-slate-600">
                        {proj.project_type || '—'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.badgeClass}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Contract Value: Strictly format in Naira or display — if null */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        {proj.contract_value != null ? formatNaira(proj.contract_value) : '—'}
                      </td>

                      {/* Start Date */}
                      <td className="py-3.5 px-3 text-slate-600 font-mono">
                        {proj.start_date ? formatDateNigerian(proj.start_date) : '—'}
                      </td>

                      {/* Expected Completion Date */}
                      <td className="py-3.5 px-3 text-slate-600 font-mono">
                        {proj.expected_completion_date
                          ? formatDateNigerian(proj.expected_completion_date)
                          : '—'}
                      </td>

                      {/* Actions: Open Control Centre and Edit */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/management/projects/${proj.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition-colors cursor-pointer"
                            title="Open Project Control Centre"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Control Centre</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingProject(proj)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#01875F]/10 hover:bg-[#01875F]/20 text-[#01875F] rounded text-xs font-semibold transition-colors cursor-pointer"
                            title="Edit project"
                          >
                            <Edit3 className="w-3 h-3 text-[#01875F]" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>
              Showing <strong>{projects.length}</strong> project{projects.length === 1 ? '' : 's'}
            </span>
            <span className="text-[11px] text-slate-400">
              Davejoe Construction &amp; Projects Database
            </span>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProjectCreated={(newProject) => {
          showToast(`Project "${newProject.name}" (${newProject.project_code}) created successfully.`);
          fetchProjects(true);
        }}
      />

      <EditProjectModal
        project={editingProject}
        isOpen={Boolean(editingProject)}
        onClose={() => setEditingProject(null)}
        onProjectUpdated={(updatedProject) => {
          showToast(`Project "${updatedProject.project_code}" updated successfully.`);
          fetchProjects(true);
        }}
      />

      <ProjectDetailModal
        project={viewingProject}
        isOpen={Boolean(viewingProject)}
        onClose={() => setViewingProject(null)}
        onEdit={(proj) => setEditingProject(proj)}
      />
    </div>
  );
};

export default ProjectsModule;
