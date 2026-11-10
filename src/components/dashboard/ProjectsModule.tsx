import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  const handleOpenProject = (id: string) => {
    if (location.pathname.startsWith('/admin')) {
      navigate(`/admin/projects/${id}`);
    } else {
      navigate(`/management/projects/${id}`);
    }
  };

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
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#18b892] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#18b892] hover:underline mb-3 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Dashboard</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
              <FolderKanban className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#18b892]">
                  PROJECT MANAGEMENT
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Projects
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Manage and monitor all projects across the organization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchProjects(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 h-10 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              title="Refresh project list from database"
            >
              <RefreshCw className={`w-4 h-4 text-[#18b892] shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>+ Create Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="Search by project name, code, city, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#18b892] transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
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
        <div className="bg-white rounded-2xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 shrink-0" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load projects.</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            A database communication error occurred while querying the projects table.
          </p>
          <p className="text-xs font-mono text-red-600 bg-red-50 p-3 rounded-xl mt-3 border border-red-100">
            {errorMessage}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => fetchProjects(false)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      ) : projects.length === 0 ? (
        /* Exact Empty State */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center mx-auto mb-4 border border-[#18b892]/20">
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>+ Create Project</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Projects Table / Mobile Card View */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Mobile Card List (md:hidden) */}
          <div className="md:hidden divide-y divide-slate-100">
            {projects.map((proj) => {
              const statusCfg = PROJECT_STATUS_CONFIG[proj.status as ProjectStatus] || {
                label: proj.status,
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
              };
              const clientDisplayName = proj.clients?.name || '—';

              return (
                <div
                  key={proj.id}
                  onClick={() => handleOpenProject(proj.id)}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-xs border border-slate-200/80 whitespace-nowrap">
                          {proj.project_code}
                        </span>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mt-1.5 leading-snug">
                        {proj.name}
                      </h3>
                      {proj.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {proj.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400 block">Client</span>
                      <span className="font-semibold text-slate-800 truncate block mt-0.5">{clientDisplayName}</span>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400 block">Contract Value</span>
                      <span className="font-mono font-bold text-[#18b892] truncate block mt-0.5">
                        {proj.contract_value != null ? formatNaira(proj.contract_value) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400 block">Start Date</span>
                      <span className="text-slate-700 font-mono text-xs mt-0.5 block">
                        {proj.start_date ? formatDateNigerian(proj.start_date) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-bold text-slate-400 block">Target Completion</span>
                      <span className="text-slate-700 font-mono text-xs mt-0.5 block">
                        {proj.expected_completion_date ? formatDateNigerian(proj.expected_completion_date) : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenProject(proj.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Control Centre</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingProject(proj)}
                      className="inline-flex items-center justify-center gap-2 py-2 px-3.5 bg-[#18b892]/10 hover:bg-[#18b892]/20 text-[#18b892] rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer min-h-[40px] whitespace-nowrap"
                    >
                      <Edit3 className="w-4 h-4 shrink-0" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 font-bold min-w-[200px]">Project</th>
                  <th className="py-3.5 px-3 font-bold min-w-[130px]">Project Code</th>
                  <th className="py-3.5 px-3 font-bold min-w-[140px]">Client</th>
                  <th className="py-3.5 px-3 font-bold min-w-[120px]">Type</th>
                  <th className="py-3.5 px-3 font-bold min-w-[120px]">Status</th>
                  <th className="py-3.5 px-3 font-bold text-right min-w-[140px]">Contract Value</th>
                  <th className="py-3.5 px-3 font-bold min-w-[110px]">Start Date</th>
                  <th className="py-3.5 px-3 font-bold min-w-[120px]">Expected Completion</th>
                  <th className="py-3.5 px-4 font-bold text-right min-w-[170px]">Actions</th>
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
                      onClick={() => handleOpenProject(proj.id)}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      {/* Project Name & Description */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-[#18b892] transition-colors truncate max-w-xs text-sm">
                          {proj.name}
                        </div>
                        {proj.description && (
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 max-w-xs">
                            {proj.description}
                          </p>
                        )}
                      </td>

                      {/* Project Code */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/80 text-xs whitespace-nowrap">
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
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {proj.project_type || '—'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${statusCfg.badgeClass}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Contract Value: Strictly format in Naira or display — if null */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {proj.contract_value != null ? formatNaira(proj.contract_value) : '—'}
                      </td>

                      {/* Start Date */}
                      <td className="py-3.5 px-3 text-slate-600 font-mono text-xs">
                        {proj.start_date ? formatDateNigerian(proj.start_date) : '—'}
                      </td>

                      {/* Expected Completion Date */}
                      <td className="py-3.5 px-3 text-slate-600 font-mono text-xs">
                        {proj.expected_completion_date
                          ? formatDateNigerian(proj.expected_completion_date)
                          : '—'}
                      </td>

                      {/* Actions: Open Control Centre and Edit */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenProject(proj.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                            title="Open Project Control Centre"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Control Centre</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingProject(proj)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#18b892]/10 hover:bg-[#18b892]/20 text-[#18b892] rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                            title="Edit project"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#18b892] shrink-0" />
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
          <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-xs sm:text-sm text-slate-500 flex items-center justify-between">
            <span>
              Showing <strong className="text-slate-800">{projects.length}</strong> project{projects.length === 1 ? '' : 's'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
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
