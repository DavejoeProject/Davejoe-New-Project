import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  Plus,
  FolderKanban,
  FileCheck2,
  Users,
  CheckCircle2,
  Clock,
  Archive,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import {
  ProjectProjectionsService,
  ProjectProjection,
} from '../../services/projectProjectionsService';
import { PlanningOverviewView } from './PlanningOverviewView';
import { ProjectionsTableView } from './ProjectionsTableView';
import { CreateProjectionModal } from './CreateProjectionModal';
import { ProjectionDetailModal } from './ProjectionDetailModal';
import { useAuth } from '../../hooks/useAuth';

export type PlanningWorkspaceSection =
  | 'overview'
  | 'all-projections'
  | 'my-contributions'
  | 'pending-reviews'
  | 'awaiting-approval'
  | 'approved-projections'
  | 'converted-projects'
  | 'archived-declined';

interface ProjectPlanningModuleProps {
  initialSection?: PlanningWorkspaceSection;
  onBackToDashboard?: () => void;
}

export const ProjectPlanningModule: React.FC<ProjectPlanningModuleProps> = ({
  initialSection = 'overview',
  onBackToDashboard,
}) => {
  const { user, profile, hasRole, currentRoleKey } = useAuth();
  const [currentSection, setCurrentSection] = useState<PlanningWorkspaceSection>(initialSection);
  const [projections, setProjections] = useState<ProjectProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedProjection, setSelectedProjection] = useState<ProjectProjection | null>(null);

  const loadProjections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await ProjectProjectionsService.getProjections();
      if (err) setError(err);
      setProjections(data || []);
      // If modal is open, sync currently selected projection
      if (selectedProjection) {
        const refreshed = (data || []).find((p) => p.id === selectedProjection.id);
        if (refreshed) setSelectedProjection(refreshed);
      }
    } catch (e: any) {
      setError(e.message || 'Error loading project projections');
    } finally {
      setLoading(false);
    }
  }, [selectedProjection]);

  useEffect(() => {
    loadProjections();
  }, []);

  // Filter projections for specific sections
  const getSectionProjections = () => {
    switch (currentSection) {
      case 'all-projections':
        return projections;
      case 'my-contributions':
        return projections.filter((p) =>
          p.contributions?.some(
            (c) =>
              c.invited_user_id === user?.id ||
              c.invited_role === (currentRoleKey as any) ||
              c.status === 'pending'
          )
        );
      case 'pending-reviews':
        return projections.filter(
          (p) =>
            p.status === 'under_review' ||
            p.sub_status === 'awaiting_contributions' ||
            p.sub_status === 'under_technical_review' ||
            p.sub_status === 'changes_requested'
        );
      case 'awaiting-approval':
        return projections.filter(
          (p) =>
            p.sub_status === 'awaiting_management_approval' ||
            (p.status === 'under_review' && (!p.contributions || p.contributions.every((c) => c.status !== 'pending')))
        );
      case 'approved-projections':
        return projections.filter(
          (p) => p.status === 'approved' || p.status === 'client_review'
        );
      case 'converted-projects':
        return projections.filter((p) => p.status === 'converted');
      case 'archived-declined':
        return projections.filter(
          (p) => p.status === 'rejected' || p.status === 'archived'
        );
      case 'overview':
      default:
        return projections;
    }
  };

  const getSectionMetadata = () => {
    switch (currentSection) {
      case 'all-projections':
        return {
          title: 'All Project Projections',
          subtitle: 'Complete central repository of planned proposals, scopes and estimates.',
        };
      case 'my-contributions':
        return {
          title: 'My Departmental Contributions',
          subtitle: 'Projections requiring technical, procurement, supervisor or accounts input.',
        };
      case 'pending-reviews':
        return {
          title: 'Pending Technical & Cost Reviews',
          subtitle: 'Projections currently gathering specialist contributions or undergoing revision.',
        };
      case 'awaiting-approval':
        return {
          title: 'Awaiting Management Approval',
          subtitle: 'Completed proposals ready for executive commercial sign-off.',
        };
      case 'approved-projections':
        return {
          title: 'Approved Projections & Quotations',
          subtitle: 'Commercially cleared proposals active in client quotation phase.',
        };
      case 'converted-projects':
        return {
          title: 'Converted Active Projects',
          subtitle: 'Proposals formally transitioned into official Davejoe construction projects.',
        };
      case 'archived-declined':
        return {
          title: 'Archived & Declined Projections',
          subtitle: 'Unsuccessful or historically archived pre-project evaluations.',
        };
      default:
        return { title: 'Planning Overview', subtitle: '' };
    }
  };

  const { title, subtitle } = getSectionMetadata();

  return (
    <div className="space-y-6">
      {/* Module Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-2 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'overview' as const, label: 'Overview', icon: Calculator },
            { id: 'all-projections' as const, label: 'All Projections', icon: FolderKanban },
            { id: 'my-contributions' as const, label: 'My Contributions', icon: Users },
            { id: 'pending-reviews' as const, label: 'Pending Reviews', icon: Clock },
            { id: 'awaiting-approval' as const, label: 'Awaiting Approval', icon: FileCheck2 },
            { id: 'approved-projections' as const, label: 'Approved', icon: CheckCircle2 },
            { id: 'converted-projects' as const, label: 'Converted', icon: FolderKanban },
            { id: 'archived-declined' as const, label: 'Archived / Declined', icon: Archive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCurrentSection(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#01875F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={loadProjections}
          disabled={loading}
          title="Refresh projections data"
          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main View Display */}
      {currentSection === 'overview' ? (
        <PlanningOverviewView
          projections={projections}
          onOpenCreateModal={() => setCreateModalOpen(true)}
          onSelectProjection={(p) => setSelectedProjection(p)}
          onNavigateSection={(sec) => setCurrentSection(sec as PlanningWorkspaceSection)}
        />
      ) : (
        <ProjectionsTableView
          projections={getSectionProjections()}
          title={title}
          subtitle={subtitle}
          onOpenCreateModal={() => setCreateModalOpen(true)}
          onSelectProjection={(p) => setSelectedProjection(p)}
        />
      )}

      {/* Create New Projection Modal */}
      <CreateProjectionModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadProjections}
      />

      {/* Projection Deep-Dive Detail Modal */}
      {selectedProjection && (
        <ProjectionDetailModal
          projection={selectedProjection}
          isOpen={Boolean(selectedProjection)}
          onClose={() => setSelectedProjection(null)}
          onUpdated={loadProjections}
        />
      )}
    </div>
  );
};
