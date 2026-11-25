import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FolderKanban,
  Layers,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { WorkPackagesControlPanel } from './WorkPackagesControlPanel';

interface ProjectOption {
  id: string;
  name: string;
  project_code: string | null;
  status: string | null;
  location: string | null;
}

interface PackageRollup {
  project_id: string;
  approval_status: string | null;
  delay_status: string | null;
  status: string | null;
}

interface WorkPackagesWorkspaceModuleProps {
  onBackToDashboard?: () => void;
}

export const WorkPackagesWorkspaceModule: React.FC<WorkPackagesWorkspaceModuleProps> = ({
  onBackToDashboard,
}) => {
  const { currentRoleKey, hasRole, hasAnyPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [packageRollups, setPackageRollups] = useState<PackageRollup[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectSearch, setProjectSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Separate menu/view visibility from action permissions (manage / approve)
  const canManage = useMemo(
    () =>
      hasRole('management') ||
      hasRole('executive_director') ||
      hasRole('admin') ||
      currentRoleKey === 'management' ||
      currentRoleKey === 'executive_director' ||
      currentRoleKey === 'admin' ||
      hasAnyPermission([
        'work_packages.manage',
        'work_packages.create',
        'work_packages.update',
        'Manage Work Packages',
      ]),
    [hasRole, hasAnyPermission, currentRoleKey]
  );

  const canApprove = useMemo(
    () =>
      hasRole('management') ||
      hasRole('executive_director') ||
      currentRoleKey === 'management' ||
      currentRoleKey === 'executive_director' ||
      hasAnyPermission(['work_packages.approve', 'Approve Work Packages']),
    [hasRole, hasAnyPermission, currentRoleKey]
  );

  const loadWorkspaceProjects = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [projectsRes, packagesRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, project_code, status, location')
          .order('created_at', { ascending: false }),
        supabase
          .from('project_work_packages')
          .select('project_id, approval_status, delay_status, status'),
      ]);

      if (projectsRes.error) {
        throw projectsRes.error;
      }

      const loadedProjects = (projectsRes.data || []) as ProjectOption[];
      setProjects(loadedProjects);

      // Work packages table rollup (graceful if migration not yet executed)
      if (!packagesRes.error && packagesRes.data) {
        setPackageRollups(packagesRes.data as PackageRollup[]);
      } else {
        setPackageRollups([]);
      }

      const paramProjectId = searchParams.get('projectId');
      if (paramProjectId && loadedProjects.some((p) => p.id === paramProjectId)) {
        setSelectedProjectId(paramProjectId);
      } else if (!selectedProjectId || !loadedProjects.some((p) => p.id === selectedProjectId)) {
        // Default to the first project that already has work packages, else the most recent project
        const projectWithPackages = loadedProjects.find((p) =>
          (packagesRes.data || []).some((wp: any) => wp.project_id === p.id)
        );
        setSelectedProjectId(projectWithPackages?.id || loadedProjects[0]?.id || '');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load projects for Work Packages.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadWorkspaceProjects(false);
  }, []);

  // Sync when deep-linked with ?projectId=...
  useEffect(() => {
    const paramProjectId = searchParams.get('projectId');
    if (paramProjectId && projects.some((p) => p.id === paramProjectId)) {
      setSelectedProjectId(paramProjectId);
    }
  }, [searchParams, projects]);

  const countsByProject = useMemo(() => {
    const map = new Map<string, { total: number; pendingApproval: number; delayed: number }>();
    for (const pkg of packageRollups) {
      const prev = map.get(pkg.project_id) || { total: 0, pendingApproval: 0, delayed: 0 };
      prev.total += 1;
      if (pkg.approval_status === 'submitted_for_approval') {
        prev.pendingApproval += 1;
      }
      if (pkg.delay_status === 'delayed' || pkg.delay_status === 'at_risk' || pkg.delay_status === 'blocked') {
        prev.delayed += 1;
      }
      map.set(pkg.project_id, prev);
    }
    return map;
  }, [packageRollups]);

  const portfolioMetrics = useMemo(() => {
    let pendingApproval = 0;
    let delayedOrBlocked = 0;
    let completed = 0;

    for (const pkg of packageRollups) {
      if (pkg.approval_status === 'submitted_for_approval') {
        pendingApproval += 1;
      }
      if (pkg.delay_status === 'delayed' || pkg.delay_status === 'at_risk' || pkg.delay_status === 'blocked') {
        delayedOrBlocked += 1;
      }
      if (pkg.status === 'verified' || pkg.status === 'released' || pkg.status === 'handed_over') {
        completed += 1;
      }
    }

    return {
      totalPackages: packageRollups.length,
      pendingApproval,
      delayedOrBlocked,
      completed,
    };
  }, [packageRollups]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.project_code || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
    );
  }, [projects, projectSearch]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    const next = new URLSearchParams(searchParams);
    if (projectId) next.set('projectId', projectId);
    else next.delete('projectId');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* Top Workspace Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {onBackToDashboard && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#18b892] transition-colors cursor-pointer mr-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </button>
              )}
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#18b892]">
                Project Controls &amp; Delivery Structure
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-[#18b892]" />
              <span>Work Packages</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Manage trade packages, assigned supervisors, milestone verification chains, blockers, and approval sign-offs across active projects.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadWorkspaceProjects(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#18b892]' : ''}`} />
              <span>Refresh Portfolio</span>
            </button>
          </div>
        </div>

        {/* Portfolio Rollup Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Total Work Packages
            </p>
            <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {loading ? '—' : portfolioMetrics.totalPackages}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Awaiting Approval
            </p>
            <p className="text-2xl font-bold font-mono text-amber-900 mt-1">
              {loading ? '—' : portfolioMetrics.pendingApproval}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-800">
              Delayed / Blocked
            </p>
            <p className="text-2xl font-bold font-mono text-rose-900 mt-1">
              {loading ? '—' : portfolioMetrics.delayedOrBlocked}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed / Verified</span>
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">
              {loading ? '—' : portfolioMetrics.completed}
            </p>
          </div>
        </div>

        {/* Project Selector Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder="Filter projects by name, code, or location..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#18b892]"
            />
          </div>

          <div className="flex-1 flex items-center gap-2.5">
            <label
              htmlFor="work-packages-project-select"
              className="text-xs font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1.5"
            >
              <FolderKanban className="w-4 h-4 text-[#18b892]" />
              <span>Project:</span>
            </label>
            <select
              id="work-packages-project-select"
              value={selectedProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#18b892]"
            >
              {filteredProjects.length === 0 ? (
                <option value="">No matching projects</option>
              ) : (
                filteredProjects.map((project) => {
                  const stats = countsByProject.get(project.id);
                  const suffix = stats ? ` (${stats.total} pkg${stats.total === 1 ? '' : 's'})` : ' (0 pkgs)';
                  return (
                    <option key={project.id} value={project.id}>
                      {project.project_code ? `${project.project_code} — ` : ''}
                      {project.name}
                      {suffix}
                    </option>
                  );
                })
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Body: Existing WorkPackagesControlPanel (zero duplicate implementation) */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 flex flex-col items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#18b892]" />
          <span className="text-xs font-medium">Loading live project work packages...</span>
        </div>
      ) : !selectedProject ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-2">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No Active Projects Found</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create or assign a project first, then structure its trade work packages, milestones, and blockers here.
          </p>
        </div>
      ) : (
        <WorkPackagesControlPanel
          key={selectedProject.id}
          projectId={selectedProject.id}
          projectLabel={
            selectedProject.project_code
              ? `${selectedProject.project_code} — ${selectedProject.name}`
              : selectedProject.name
          }
          canManage={canManage}
          canApprove={canApprove}
        />
      )}
    </div>
  );
};
