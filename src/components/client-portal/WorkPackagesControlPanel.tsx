import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Layers,
  Plus,
  RefreshCw,
  GitBranch,
  Flag,
  AlertTriangle,
  Link2,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  UserCheck,
  Trash2,
  Loader2,
  Unlink,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  MediaEvidenceItem,
  ProgressVerificationStage,
  formatShortDate,
} from '../../services/clientPortalService';
import {
  Phase2ControlsService,
  EnhancedWorkPackage,
  ProjectWorkPackageBundle,
  StaffSupervisorOption,
  DependencyType,
  WorkPackageInspectionStatus,
  WorkPackageApprovalStatus,
  WorkPackageDelayStatus,
  BlockerType,
  BlockerSeverity,
  BlockerStatus,
  LinkedOperationalItem,
  INSPECTION_STATUS_LABELS,
  APPROVAL_STATUS_LABELS,
  DELAY_STATUS_LABELS,
  DEPENDENCY_TYPE_LABELS,
} from '../../services/phase2ControlsService';
import {
  StatusText,
  ProgressStageTrack,
  EvidenceUploader,
  EvidenceMediaGallery,
} from './ClientPortalShared';

type DetailTab = 'overview' | 'milestones' | 'dependencies' | 'blockers' | 'linked';

const PROGRESS_STAGE_OPTIONS: { value: ProgressVerificationStage; label: string }[] = [
  { value: 'reported_by_supervisor', label: '1. Reported by Supervisor' },
  { value: 'inspected_by_qc', label: '2. Inspected by QC' },
  { value: 'verified_completed', label: '3. Verified Completed' },
  { value: 'acknowledged_by_client', label: '4. Acknowledged by Client' },
  { value: 'formally_handed_over', label: '5. Formally Handed Over' },
];

export const WorkPackagesControlPanel: React.FC<{
  projectId: string;
  projectLabel?: string;
  canManage?: boolean;
  canApprove?: boolean;
}> = ({ projectId, projectLabel, canManage = true, canApprove = true }) => {
  const { user, profile } = useAuth();
  const actorName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Project Staff';

  const [bundle, setBundle] = useState<ProjectWorkPackageBundle | null>(null);
  const [supervisors, setSupervisors] = useState<StaffSupervisorOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create Work Package Drawer
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newScopeType, setNewScopeType] =
    useState<EnhancedWorkPackage['scope_type']>('work_package');
  const [newFloor, setNewFloor] = useState('');
  const [newZone, setNewZone] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDeliverables, setNewDeliverables] = useState('');
  const [newExclusions, setNewExclusions] = useState('');
  const [newSupervisorId, setNewSupervisorId] = useState('');
  const [newTeamSummary, setNewTeamSummary] = useState('');
  const [newPlannedStart, setNewPlannedStart] = useState('');
  const [newPlannedEnd, setNewPlannedEnd] = useState('');
  const [newClientVisible, setNewClientVisible] = useState(true);

  // Edit Selected Package Form State
  const [editDraft, setEditDraft] = useState<Partial<EnhancedWorkPackage>>({});

  // Dependency Form State
  const [depPredecessorId, setDepPredecessorId] = useState('');
  const [depType, setDepType] = useState<DependencyType>('finish_to_start');
  const [depLagDays, setDepLagDays] = useState('0');
  const [depNotes, setDepNotes] = useState('');

  // Milestone Form State
  const [msCode, setMsCode] = useState('');
  const [msTitle, setMsTitle] = useState('');
  const [msPlannedDate, setMsPlannedDate] = useState('');
  const [msWeight, setMsWeight] = useState('25');
  const [msClientVisible, setMsClientVisible] = useState(true);

  // Blocker Form State
  const [blkType, setBlkType] = useState<BlockerType>('blocker');
  const [blkSeverity, setBlkSeverity] = useState<BlockerSeverity>('medium');
  const [blkTitle, setBlkTitle] = useState('');
  const [blkDescription, setBlkDescription] = useState('');
  const [blkImpactDays, setBlkImpactDays] = useState('0');
  const [blkCorrectiveAction, setBlkCorrectiveAction] = useState('');
  const [blkTargetDate, setBlkTargetDate] = useState('');
  const [blkClientVisible, setBlkClientVisible] = useState(false);

  // Operational link filter
  const [linkCategory, setLinkCategory] = useState<
    'tasks' | 'notes' | 'materials' | 'purchaseOrders' | 'inspections' | 'areaCompletions'
  >('tasks');

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const [data, supList] = await Promise.all([
        Phase2ControlsService.getProjectWorkPackageBundle(projectId, {
          includeOperationalLinks: true,
        }),
        Phase2ControlsService.listStaffSupervisorOptions(),
      ]);
      setBundle(data);
      setSupervisors(supList);
      setSelectedId((prev) => {
        if (prev && data.packages.some((p) => p.id === prev)) return prev;
        return data.packages[0]?.id || '';
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load work packages for this project.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedPackage = useMemo(
    () => bundle?.packages.find((p) => p.id === selectedId) || null,
    [bundle, selectedId]
  );

  useEffect(() => {
    if (selectedPackage) {
      setEditDraft({
        title: selectedPackage.title,
        scope_type: selectedPackage.scope_type,
        floor_level: selectedPackage.floor_level || '',
        zone_name: selectedPackage.zone_name || '',
        room_name: selectedPackage.room_name || '',
        description: selectedPackage.description || '',
        deliverables: selectedPackage.deliverables || '',
        exclusions: selectedPackage.exclusions || '',
        responsible_supervisor_id: selectedPackage.responsible_supervisor_id || '',
        responsible_supervisor_name: selectedPackage.responsible_supervisor_name || '',
        responsible_team_summary: selectedPackage.responsible_team_summary || '',
        planned_start_date: selectedPackage.planned_start_date || '',
        planned_end_date: selectedPackage.planned_end_date || '',
        actual_start_date: selectedPackage.actual_start_date || '',
        actual_end_date: selectedPackage.actual_end_date || '',
        status: selectedPackage.status,
        completion_percent: selectedPackage.completion_percent,
        inspection_status: selectedPackage.inspection_status,
        approval_status: selectedPackage.approval_status,
        delay_status: selectedPackage.delay_status,
        client_visible: selectedPackage.client_visible,
        evidence_documents: selectedPackage.evidence_documents || [],
      });
    }
  }, [selectedPackage]);

  const kpis = useMemo(() => {
    const pkgs = bundle?.packages || [];
    const avgCompletion =
      pkgs.length > 0
        ? Math.round(pkgs.reduce((s, p) => s + Number(p.completion_percent || 0), 0) / pkgs.length)
        : 0;
    const openBlockers = (bundle?.blockers || []).filter(
      (b) => b.status === 'open' || b.status === 'escalated'
    ).length;
    const qcPassed = pkgs.filter(
      (p) => p.inspection_status === 'passed' || p.approval_status === 'approved'
    ).length;
    return { total: pkgs.length, avgCompletion, openBlockers, qcPassed };
  }, [bundle]);

  const packageMilestones = useMemo(
    () => (bundle?.milestones || []).filter((m) => m.work_package_id === selectedId),
    [bundle, selectedId]
  );

  const packageDependencies = useMemo(
    () => (bundle?.dependencies || []).filter((d) => d.work_package_id === selectedId),
    [bundle, selectedId]
  );

  const packageBlockers = useMemo(
    () => (bundle?.blockers || []).filter((b) => b.work_package_id === selectedId),
    [bundle, selectedId]
  );

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const sup = supervisors.find((s) => s.user_id === newSupervisorId);
      const created = await Phase2ControlsService.createWorkPackage({
        project_id: projectId,
        package_code: newCode,
        title: newTitle,
        scope_type: newScopeType,
        floor_level: newFloor,
        zone_name: newZone,
        room_name: newRoom,
        description: newDescription,
        deliverables: newDeliverables,
        exclusions: newExclusions,
        responsible_supervisor_id: sup?.user_id || null,
        responsible_supervisor_name: sup?.full_name || null,
        responsible_team_summary: newTeamSummary,
        planned_start_date: newPlannedStart || null,
        planned_end_date: newPlannedEnd || null,
        client_visible: newClientVisible,
        created_by: user?.id,
      });
      setShowCreateForm(false);
      setNewCode('');
      setNewTitle('');
      setNewFloor('');
      setNewZone('');
      setNewRoom('');
      setNewDescription('');
      setNewDeliverables('');
      setNewExclusions('');
      setNewSupervisorId('');
      setNewTeamSummary('');
      setNewPlannedStart('');
      setNewPlannedEnd('');
      await loadData();
      setSelectedId(created.id);
      flashNotice(`Work package ${created.package_code} created.`);
    } catch (err: any) {
      setError(err?.message || 'Unable to create work package.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePackageEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;
    setSaving(true);
    setError(null);
    try {
      const sup = supervisors.find((s) => s.user_id === editDraft.responsible_supervisor_id);
      await Phase2ControlsService.updateWorkPackage(selectedPackage.id, {
        title: String(editDraft.title || selectedPackage.title),
        scope_type: (editDraft.scope_type || selectedPackage.scope_type) as EnhancedWorkPackage['scope_type'],
        floor_level: (editDraft.floor_level as string) || null,
        zone_name: (editDraft.zone_name as string) || null,
        room_name: (editDraft.room_name as string) || null,
        description: (editDraft.description as string) || null,
        deliverables: (editDraft.deliverables as string) || null,
        exclusions: (editDraft.exclusions as string) || null,
        responsible_supervisor_id: (editDraft.responsible_supervisor_id as string) || null,
        responsible_supervisor_name:
          sup?.full_name || (editDraft.responsible_supervisor_name as string) || null,
        responsible_team_summary: (editDraft.responsible_team_summary as string) || null,
        planned_start_date: (editDraft.planned_start_date as string) || null,
        planned_end_date: (editDraft.planned_end_date as string) || null,
        actual_start_date: (editDraft.actual_start_date as string) || null,
        actual_end_date: (editDraft.actual_end_date as string) || null,
        status: editDraft.status as EnhancedWorkPackage['status'],
        completion_percent: Number(editDraft.completion_percent ?? 0),
        inspection_status: editDraft.inspection_status as WorkPackageInspectionStatus,
        approval_status: editDraft.approval_status as WorkPackageApprovalStatus,
        delay_status: editDraft.delay_status as WorkPackageDelayStatus,
        client_visible: editDraft.client_visible !== false,
        evidence_documents: (editDraft.evidence_documents || []) as MediaEvidenceItem[],
      });
      await loadData();
      flashNotice(`Saved controls for ${selectedPackage.package_code}.`);
    } catch (err: any) {
      setError(err?.message || 'Unable to save work package updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprovePackage = async () => {
    if (!selectedPackage || !user) return;
    setSaving(true);
    setError(null);
    try {
      await Phase2ControlsService.updateWorkPackage(selectedPackage.id, {
        approval_status: 'approved',
        approved_by_user_id: user.id,
        approved_by_name: actorName,
        approved_at: new Date().toISOString(),
        status: selectedPackage.status === 'planned' ? 'verified' : selectedPackage.status,
      });
      await loadData();
      flashNotice(`Work package ${selectedPackage.package_code} approved by ${actorName}.`);
    } catch (err: any) {
      setError(err?.message || 'Unable to approve work package.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || !depPredecessorId) return;
    setSaving(true);
    setError(null);
    try {
      await Phase2ControlsService.addDependency({
        project_id: projectId,
        work_package_id: selectedPackage.id,
        depends_on_package_id: depPredecessorId,
        dependency_type: depType,
        lag_days: Number(depLagDays || 0),
        notes: depNotes,
        created_by: user?.id,
      });
      setDepPredecessorId('');
      setDepLagDays('0');
      setDepNotes('');
      await loadData();
      flashNotice('Package dependency linked.');
    } catch (err: any) {
      setError(err?.message || 'Unable to link dependency.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    setSaving(true);
    setError(null);
    try {
      await Phase2ControlsService.removeDependency(depId);
      await loadData();
      flashNotice('Dependency removed.');
    } catch (err: any) {
      setError(err?.message || 'Unable to remove dependency.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || !msCode.trim() || !msTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await Phase2ControlsService.createMilestone({
        project_id: projectId,
        work_package_id: selectedPackage.id,
        milestone_code: msCode,
        title: msTitle,
        planned_date: msPlannedDate || null,
        weight_pct: Number(msWeight || 0),
        client_visible: msClientVisible,
        created_by: user?.id,
      });
      setMsCode('');
      setMsTitle('');
      setMsPlannedDate('');
      await loadData();
      flashNotice('Milestone added to work package.');
    } catch (err: any) {
      setError(err?.message || 'Unable to add milestone.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMilestone = async (
    milestoneId: string,
    patch: {
      completion_pct?: number;
      status?: 'planned' | 'in_progress' | 'at_risk' | 'completed' | 'verified';
      verification_stage?: ProgressVerificationStage;
    }
  ) => {
    setSaving(true);
    setError(null);
    try {
      await Phase2ControlsService.updateMilestone(milestoneId, {
        ...patch,
        actual_date:
          patch.status === 'completed' || patch.status === 'verified'
            ? new Date().toISOString().slice(0, 10)
            : undefined,
      });
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to update milestone.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage || !blkTitle.trim() || !blkDescription.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await Phase2ControlsService.createBlocker({
        project_id: projectId,
        work_package_id: selectedPackage.id,
        blocker_type: blkType,
        severity: blkSeverity,
        title: blkTitle,
        description: blkDescription,
        impact_days: Number(blkImpactDays || 0),
        corrective_action: blkCorrectiveAction,
        owner_user_id: user?.id || null,
        owner_name: actorName,
        target_resolution_date: blkTargetDate || null,
        client_visible: blkClientVisible,
        created_by: user?.id,
      });
      setBlkTitle('');
      setBlkDescription('');
      setBlkImpactDays('0');
      setBlkCorrectiveAction('');
      setBlkTargetDate('');
      await loadData();
      flashNotice('Delay / blocker logged on work package.');
    } catch (err: any) {
      setError(err?.message || 'Unable to log blocker.');
    } finally {
      setSaving(false);
    }
  };

  const handleBlockerStatus = async (blockerId: string, status: BlockerStatus) => {
    setSaving(true);
    setError(null);
    try {
      await Phase2ControlsService.updateBlockerStatus(blockerId, {
        status,
        resolved_by: status === 'resolved' ? user?.id || null : undefined,
      });
      await loadData();
      flashNotice(`Blocker status updated to ${status}.`);
    } catch (err: any) {
      setError(err?.message || 'Unable to update blocker.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOperationalLink = async (item: LinkedOperationalItem) => {
    if (!selectedPackage) return;
    setSaving(true);
    setError(null);
    try {
      const nextPackageId = item.work_package_id === selectedPackage.id ? null : selectedPackage.id;
      await Phase2ControlsService.linkOperationalRecordToPackage(
        item.source,
        item.id,
        nextPackageId
      );
      await loadData();
      flashNotice(
        nextPackageId
          ? `Linked "${item.title}" to ${selectedPackage.package_code}.`
          : `Unlinked "${item.title}" from ${selectedPackage.package_code}.`
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to update operational record link.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-[#18b892]" />
        Loading work packages & project controls...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Project Controls · Work Breakdown Structure
          </p>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Work Packages, Milestones & Operational Links
            {projectLabel ? <span className="text-slate-400 font-normal"> · {projectLabel}</span> : null}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage deliverables, dependencies, 5-stage milestones, blockers, and live connections to existing tasks, site reports, procurement, and QC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#18b892]" />
            Refresh
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="h-9 px-3.5 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {showCreateForm ? 'Close Form' : 'New Work Package'}
            </button>
          )}
        </div>
      </div>

      {bundle?.migrationPending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            Phase 2 Milestone 1 Migration 2A (<span className="font-mono font-semibold">20261125000002_phase2_m1_work_packages_controls.sql</span>) has not been executed in Supabase yet. Run it in the Supabase SQL Editor to activate dependencies, milestones, blockers, and cross-module work package links.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#18b892] shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
          <p className="text-[11px] font-medium text-slate-500">Work Packages</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{kpis.total}</p>
          <p className="text-[11px] text-slate-400 mt-1">Structured project scopes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
          <p className="text-[11px] font-medium text-slate-500">Avg. Completion</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.avgCompletion}%
          </p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-[#18b892] rounded-full" style={{ width: `${kpis.avgCompletion}%` }} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
          <p className="text-[11px] font-medium text-slate-500">QC Passed / Approved</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.qcPassed}
            <span className="text-sm font-normal text-slate-400"> / {kpis.total}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Verified packages</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
          <p className="text-[11px] font-medium text-slate-500">Active Delays & Blockers</p>
          <p
            className={`text-2xl font-bold font-mono tabular-nums mt-1 ${
              kpis.openBlockers > 0 ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {kpis.openBlockers}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Open or escalated</p>
        </div>
      </div>

      {/* Create Work Package Form */}
      {showCreateForm && canManage && (
        <form
          onSubmit={handleCreatePackage}
          className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4"
        >
          <h4 className="text-sm font-bold text-slate-900">Create New Work Package</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Package Code *</label>
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. WP-01"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Package Title *</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Ground Floor Reception — Venetian Plaster & Ceilings"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Scope Classification</label>
              <select
                value={newScopeType}
                onChange={(e) => setNewScopeType(e.target.value as EnhancedWorkPackage['scope_type'])}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="work_package">Work Package</option>
                <option value="residential_room">Residential Room</option>
                <option value="commercial_floor">Commercial Floor</option>
                <option value="commercial_zone">Commercial Zone</option>
                <option value="elevation">External Elevation</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Floor / Level</label>
              <input
                type="text"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                placeholder="e.g. Floor 2"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Zone / Wing</label>
              <input
                type="text"
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                placeholder="e.g. East Wing"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Room / Area</label>
              <input
                type="text"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                placeholder="e.g. Boardroom & Lobby"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsible Supervisor</label>
              <select
                value={newSupervisorId}
                onChange={(e) => setNewSupervisorId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="">Unassigned</option>
                {supervisors.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Responsible Team</label>
              <input
                type="text"
                value={newTeamSummary}
                onChange={(e) => setNewTeamSummary(e.target.value)}
                placeholder="e.g. Finishing Crew B (4 artisans)"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Planned Start</label>
              <input
                type="date"
                value={newPlannedStart}
                onChange={(e) => setNewPlannedStart(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Planned Completion</label>
              <input
                type="date"
                value={newPlannedEnd}
                onChange={(e) => setNewPlannedEnd(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Scope Description</label>
              <textarea
                rows={2}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Key Deliverables</label>
              <textarea
                rows={2}
                value={newDeliverables}
                onChange={(e) => setNewDeliverables(e.target.value)}
                placeholder="Surface prep, 2 coats primer, 3 coats satin finish, QC sign-off..."
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Exclusions</label>
              <textarea
                rows={2}
                value={newExclusions}
                onChange={(e) => setNewExclusions(e.target.value)}
                placeholder="Electrical fixtures, third-party glazing..."
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newClientVisible}
                onChange={(e) => setNewClientVisible(e.target.checked)}
                className="accent-[#18b892]"
              />
              Visible to authorized client contacts in the Client Portal
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Create Work Package'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Master-Detail Workspace */}
      {!bundle || bundle.packages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/90 p-10 text-center space-y-2">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-800">No work packages structured for this project yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Create work packages by room, floor, elevation, or trade scope to track milestones, dependencies, blockers, and connect existing tasks, procurement, and QC records.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Package Directory */}
          <div className="lg:col-span-4 space-y-2.5">
            {bundle.packages.map((pkg) => {
              const active = pkg.id === selectedId;
              const openBlkCount = bundle.blockers.filter(
                (b) => b.work_package_id === pkg.id && (b.status === 'open' || b.status === 'escalated')
              ).length;
              const msCount = bundle.milestones.filter((m) => m.work_package_id === pkg.id).length;

              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedId(pkg.id)}
                  className={`w-full text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                    active
                      ? 'bg-white border-[#18b892] ring-1 ring-[#18b892]/25'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono font-semibold text-slate-500">
                        {pkg.package_code}
                        {pkg.floor_level ? ` · ${pkg.floor_level}` : ''}
                        {pkg.zone_name ? ` · ${pkg.zone_name}` : ''}
                      </p>
                      <p className="text-sm font-bold text-slate-900 truncate mt-0.5">{pkg.title}</p>
                    </div>
                    <StatusText
                      label={DELAY_STATUS_LABELS[pkg.delay_status]}
                      tone={
                        pkg.delay_status === 'blocked' || pkg.delay_status === 'delayed'
                          ? 'rose'
                          : pkg.delay_status === 'at_risk'
                            ? 'amber'
                            : 'emerald'
                      }
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">
                      {pkg.responsible_supervisor_name || 'Supervisor unassigned'}
                    </span>
                    <span className="font-mono font-semibold text-slate-800 tabular-nums">
                      {Math.round(pkg.completion_percent)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-[#18b892] rounded-full"
                      style={{ width: `${Math.min(100, pkg.completion_percent)}%` }}
                    />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span>{INSPECTION_STATUS_LABELS[pkg.inspection_status]}</span>
                    <span>·</span>
                    <span>{msCount} milestones</span>
                    {openBlkCount > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-rose-700 font-semibold">{openBlkCount} open blockers</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Selected Package Control Workspace */}
          {selectedPackage && (
            <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200/90 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono text-slate-500">
                    {selectedPackage.package_code} · {selectedPackage.scope_type.replace(/_/g, ' ')}
                    {selectedPackage.room_name ? ` · ${selectedPackage.room_name}` : ''}
                  </p>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5">{selectedPackage.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <StatusText
                    label={APPROVAL_STATUS_LABELS[selectedPackage.approval_status]}
                    tone={
                      selectedPackage.approval_status === 'approved'
                        ? 'emerald'
                        : selectedPackage.approval_status === 'rejected'
                          ? 'rose'
                          : 'amber'
                    }
                  />
                  {canApprove && selectedPackage.approval_status !== 'approved' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleApprovePackage}
                      className="h-8 px-3 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      Approve Package
                    </button>
                  )}
                </div>
              </div>

              {/* Detail Sub-Tabs */}
              <div className="flex overflow-x-auto border-b border-slate-200 px-3 bg-white">
                {(
                  [
                    { id: 'overview', label: 'Controls & Evidence', icon: ShieldCheck },
                    { id: 'milestones', label: `Milestones (${packageMilestones.length})`, icon: Flag },
                    { id: 'dependencies', label: `Dependencies (${packageDependencies.length})`, icon: GitBranch },
                    { id: 'blockers', label: `Delays & Blockers (${packageBlockers.length})`, icon: AlertTriangle },
                    { id: 'linked', label: 'Connected Records', icon: Link2 },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  const isActive = detailTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetailTab(t.id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'border-[#18b892] text-slate-900'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#18b892]' : 'text-slate-400'}`} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="p-5">
                {/* SUB-TAB 1: OVERVIEW, SCHEDULE, QC & EVIDENCE */}
                {detailTab === 'overview' && (
                  <form onSubmit={handleSavePackageEdits} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Execution Status</label>
                        <select
                          disabled={!canManage}
                          value={editDraft.status || 'planned'}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              status: e.target.value as EnhancedWorkPackage['status'],
                            }))
                          }
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                        >
                          <option value="planned">Planned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="ready_for_inspection">Ready for QC Inspection</option>
                          <option value="verified">QC Verified</option>
                          <option value="released">Released for Next Trade</option>
                          <option value="handed_over">Formally Handed Over</option>
                          <option value="on_hold">On Hold</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Completion % ({Math.round(Number(editDraft.completion_percent || 0))}%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!canManage}
                          value={editDraft.completion_percent ?? 0}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              completion_percent: Number(e.target.value),
                            }))
                          }
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Schedule Health</label>
                        <select
                          disabled={!canManage}
                          value={editDraft.delay_status || 'on_track'}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              delay_status: e.target.value as WorkPackageDelayStatus,
                            }))
                          }
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                        >
                          {Object.entries(DELAY_STATUS_LABELS).map(([k, lbl]) => (
                            <option key={k} value={k}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Inspection Status</label>
                        <select
                          disabled={!canManage}
                          value={editDraft.inspection_status || 'not_inspected'}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              inspection_status: e.target.value as WorkPackageInspectionStatus,
                            }))
                          }
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                        >
                          {Object.entries(INSPECTION_STATUS_LABELS).map(([k, lbl]) => (
                            <option key={k} value={k}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Approval Status</label>
                        <select
                          disabled={!canManage}
                          value={editDraft.approval_status || 'pending'}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              approval_status: e.target.value as WorkPackageApprovalStatus,
                            }))
                          }
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                        >
                          {Object.entries(APPROVAL_STATUS_LABELS).map(([k, lbl]) => (
                            <option key={k} value={k}>
                              {lbl}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Responsible Supervisor</label>
                        <select
                          disabled={!canManage}
                          value={(editDraft.responsible_supervisor_id as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              responsible_supervisor_id: e.target.value,
                            }))
                          }
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                        >
                          <option value="">Unassigned</option>
                          {supervisors.map((s) => (
                            <option key={s.user_id} value={s.user_id}>
                              {s.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Planned Start</label>
                        <input
                          type="date"
                          disabled={!canManage}
                          value={(editDraft.planned_start_date as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({ ...prev, planned_start_date: e.target.value }))
                          }
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Planned End</label>
                        <input
                          type="date"
                          disabled={!canManage}
                          value={(editDraft.planned_end_date as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({ ...prev, planned_end_date: e.target.value }))
                          }
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Actual Start</label>
                        <input
                          type="date"
                          disabled={!canManage}
                          value={(editDraft.actual_start_date as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({ ...prev, actual_start_date: e.target.value }))
                          }
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Actual Completion</label>
                        <input
                          type="date"
                          disabled={!canManage}
                          value={(editDraft.actual_end_date as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({ ...prev, actual_end_date: e.target.value }))
                          }
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Responsible Team / Crew</label>
                        <input
                          type="text"
                          disabled={!canManage}
                          value={(editDraft.responsible_team_summary as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              responsible_team_summary: e.target.value,
                            }))
                          }
                          placeholder="Assigned artisans, trade lead, or subcontract crew"
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!canManage}
                            checked={editDraft.client_visible !== false}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                client_visible: e.target.checked,
                              }))
                            }
                            className="accent-[#18b892]"
                          />
                          Expose work package progress to authorized Client Portal contacts
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Deliverables & Acceptance Criteria</label>
                        <textarea
                          rows={3}
                          disabled={!canManage}
                          value={(editDraft.deliverables as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({ ...prev, deliverables: e.target.value }))
                          }
                          className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Scope Notes & Exclusions</label>
                        <textarea
                          rows={3}
                          disabled={!canManage}
                          value={(editDraft.exclusions as string) || ''}
                          onChange={(e) =>
                            setEditDraft((prev) => ({ ...prev, exclusions: e.target.value }))
                          }
                          className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                        />
                      </div>
                    </div>

                    {/* Package Evidence Documents */}
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-semibold text-slate-800">Package Evidence & Documents</p>
                      {canManage && (
                        <EvidenceUploader
                          projectId={projectId}
                          category={`work_package_${selectedPackage.package_code}`}
                          uploadedByName={actorName}
                          items={(editDraft.evidence_documents || []) as MediaEvidenceItem[]}
                          onChange={(items) =>
                            setEditDraft((prev) => ({ ...prev, evidence_documents: items }))
                          }
                          label="Upload Work Package Evidence / Inspection Pack"
                        />
                      )}
                      <EvidenceMediaGallery
                        items={(editDraft.evidence_documents || []) as MediaEvidenceItem[]}
                        emptyText="No package evidence documents attached yet."
                      />
                    </div>

                    {selectedPackage.approved_at && (
                      <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#18b892]" />
                        Approved by <strong className="text-slate-800">{selectedPackage.approved_by_name}</strong> on{' '}
                        {formatShortDate(selectedPackage.approved_at)}
                      </p>
                    )}

                    {canManage && (
                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-4 py-2 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save Work Package Controls'}
                        </button>
                      </div>
                    )}
                  </form>
                )}

                {/* SUB-TAB 2: MILESTONES */}
                {detailTab === 'milestones' && (
                  <div className="space-y-4">
                    {canManage && (
                      <form
                        onSubmit={handleAddMilestone}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                      >
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Code *</label>
                          <input
                            type="text"
                            required
                            value={msCode}
                            onChange={(e) => setMsCode(e.target.value)}
                            placeholder="MS-01"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Milestone Title *</label>
                          <input
                            type="text"
                            required
                            value={msTitle}
                            onChange={(e) => setMsTitle(e.target.value)}
                            placeholder="e.g. Substrate prep & primer sign-off"
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Planned Date</label>
                          <input
                            type="date"
                            value={msPlannedDate}
                            onChange={(e) => setMsPlannedDate(e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Wt %</label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={msWeight}
                            onChange={(e) => setMsWeight(e.target.value)}
                            className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="submit"
                            disabled={saving}
                            className="w-full h-8 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Add Milestone
                          </button>
                        </div>
                        <label className="sm:col-span-12 inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={msClientVisible}
                            onChange={(e) => setMsClientVisible(e.target.checked)}
                            className="accent-[#18b892]"
                          />
                          Show milestone in Client Portal
                        </label>
                      </form>
                    )}

                    {packageMilestones.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                        No milestones defined for {selectedPackage.package_code} yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {packageMilestones.map((ms) => (
                          <div
                            key={ms.id}
                            className="rounded-xl border border-slate-200/90 p-4 space-y-2.5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-mono text-slate-500">
                                  {ms.milestone_code} · Weight {ms.weight_pct}% · Planned{' '}
                                  {ms.planned_date ? formatShortDate(ms.planned_date) : 'TBD'}
                                  {ms.actual_date ? ` · Actual ${formatShortDate(ms.actual_date)}` : ''}
                                </p>
                                <p className="text-sm font-bold text-slate-900 mt-0.5">{ms.title}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                                  {Math.round(ms.completion_pct)}%
                                </span>
                                <StatusText
                                  label={ms.status.replace(/_/g, ' ')}
                                  tone={
                                    ms.status === 'verified' || ms.status === 'completed'
                                      ? 'emerald'
                                      : ms.status === 'at_risk'
                                        ? 'rose'
                                        : 'amber'
                                  }
                                />
                              </div>
                            </div>

                            <ProgressStageTrack current={ms.verification_stage} />

                            {canManage && (
                              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                                <select
                                  value={ms.verification_stage}
                                  onChange={(e) =>
                                    handleUpdateMilestone(ms.id, {
                                      verification_stage: e.target.value as ProgressVerificationStage,
                                    })
                                  }
                                  className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs"
                                >
                                  {PROGRESS_STAGE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={ms.status}
                                  onChange={(e) =>
                                    handleUpdateMilestone(ms.id, {
                                      status: e.target.value as any,
                                      completion_pct:
                                        e.target.value === 'completed' || e.target.value === 'verified'
                                          ? 100
                                          : ms.completion_pct,
                                    })
                                  }
                                  className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs"
                                >
                                  <option value="planned">Planned</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="at_risk">At Risk</option>
                                  <option value="completed">Completed</option>
                                  <option value="verified">QC Verified</option>
                                </select>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  defaultValue={ms.completion_pct}
                                  onBlur={(e) =>
                                    handleUpdateMilestone(ms.id, {
                                      completion_pct: Math.max(0, Math.min(100, Number(e.target.value))),
                                    })
                                  }
                                  className="w-20 h-8 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                                  title="Completion percentage"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB 3: DEPENDENCIES */}
                {detailTab === 'dependencies' && (
                  <div className="space-y-4">
                    {canManage && (
                      <form
                        onSubmit={handleAddDependency}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                      >
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            Predecessor Work Package *
                          </label>
                          <select
                            required
                            value={depPredecessorId}
                            onChange={(e) => setDepPredecessorId(e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            <option value="">Select predecessor package...</option>
                            {bundle.packages
                              .filter((p) => p.id !== selectedPackage.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.package_code} — {p.title}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Relationship</label>
                          <select
                            value={depType}
                            onChange={(e) => setDepType(e.target.value as DependencyType)}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                          >
                            {Object.entries(DEPENDENCY_TYPE_LABELS).map(([k, lbl]) => (
                              <option key={k} value={k}>
                                {lbl}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Lag (days)</label>
                          <input
                            type="number"
                            value={depLagDays}
                            onChange={(e) => setDepLagDays(e.target.value)}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <button
                            type="submit"
                            disabled={saving || !depPredecessorId}
                            className="w-full h-8 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Link
                          </button>
                        </div>
                        <div className="sm:col-span-12">
                          <input
                            type="text"
                            value={depNotes}
                            onChange={(e) => setDepNotes(e.target.value)}
                            placeholder="Optional dependency note (e.g. ceiling grid must pass QC before final paint coats)..."
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                        </div>
                      </form>
                    )}

                    {packageDependencies.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                        No predecessor dependencies linked to {selectedPackage.package_code}.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200/80 border border-slate-200/90 rounded-xl overflow-hidden">
                        {packageDependencies.map((dep) => {
                          const pred = bundle.packages.find((p) => p.id === dep.depends_on_package_id);
                          const predReady =
                            pred &&
                            (pred.status === 'verified' ||
                              pred.status === 'released' ||
                              pred.status === 'handed_over');
                          return (
                            <div
                              key={dep.id}
                              className="p-3.5 bg-white flex flex-wrap items-center justify-between gap-3"
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  Depends on:{' '}
                                  <span className="font-mono">{pred?.package_code || 'Package'}</span> —{' '}
                                  {pred?.title || 'Unknown'}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {DEPENDENCY_TYPE_LABELS[dep.dependency_type]}
                                  {dep.lag_days ? ` · Lag ${dep.lag_days}d` : ''}
                                  {dep.notes ? ` · ${dep.notes}` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusText
                                  label={
                                    predReady
                                      ? 'Predecessor Cleared'
                                      : `Waiting (${pred?.completion_percent ?? 0}%)`
                                  }
                                  tone={predReady ? 'emerald' : 'amber'}
                                />
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveDependency(dep.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    title="Remove dependency"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB 4: DELAYS, BLOCKERS & CORRECTIVE ACTIONS */}
                {detailTab === 'blockers' && (
                  <div className="space-y-4">
                    {canManage && (
                      <form
                        onSubmit={handleAddBlocker}
                        className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Type</label>
                            <select
                              value={blkType}
                              onChange={(e) => setBlkType(e.target.value as BlockerType)}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                            >
                              <option value="blocker">Blocker</option>
                              <option value="delay">Schedule Delay</option>
                              <option value="risk">Delivery Risk</option>
                              <option value="corrective_action">Corrective Action</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Severity</label>
                            <select
                              value={blkSeverity}
                              onChange={(e) => setBlkSeverity(e.target.value as BlockerSeverity)}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="critical">Critical</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Impact (days)</label>
                            <input
                              type="number"
                              min={0}
                              value={blkImpactDays}
                              onChange={(e) => setBlkImpactDays(e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Target Resolution</label>
                            <input
                              type="date"
                              value={blkTargetDate}
                              onChange={(e) => setBlkTargetDate(e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                            />
                          </div>
                        </div>
                        <input
                          type="text"
                          required
                          value={blkTitle}
                          onChange={(e) => setBlkTitle(e.target.value)}
                          placeholder="Summary title (e.g. MEP conduit chasing incomplete on North Wall)"
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <textarea
                            rows={2}
                            required
                            value={blkDescription}
                            onChange={(e) => setBlkDescription(e.target.value)}
                            placeholder="Root cause and site impact..."
                            className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                          <textarea
                            rows={2}
                            value={blkCorrectiveAction}
                            onChange={(e) => setBlkCorrectiveAction(e.target.value)}
                            placeholder="Agreed corrective action & escalation plan..."
                            className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={blkClientVisible}
                              onChange={(e) => setBlkClientVisible(e.target.checked)}
                              className="accent-[#18b892]"
                            />
                            Visible to Client Portal (e.g. client-side access or approval dependency)
                          </label>
                          <button
                            type="submit"
                            disabled={saving}
                            className="px-3.5 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Log Blocker / Delay
                          </button>
                        </div>
                      </form>
                    )}

                    {packageBlockers.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                        No delays, blockers, or corrective actions logged for this work package.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {packageBlockers.map((blk) => (
                          <div key={blk.id} className="rounded-xl border border-slate-200/90 p-4 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-[11px] font-mono text-slate-500 uppercase">
                                  {blk.blocker_type.replace(/_/g, ' ')} · {blk.severity}
                                  {blk.impact_days > 0 ? ` · +${blk.impact_days}d impact` : ''}
                                  {blk.client_visible ? ' · Client Visible' : ' · Internal Only'}
                                </p>
                                <p className="text-sm font-bold text-slate-900 mt-0.5">{blk.title}</p>
                              </div>
                              <StatusText
                                label={blk.status}
                                tone={
                                  blk.status === 'resolved'
                                    ? 'emerald'
                                    : blk.status === 'escalated'
                                      ? 'rose'
                                      : 'amber'
                                }
                              />
                            </div>
                            <p className="text-xs text-slate-600">{blk.description}</p>
                            {blk.corrective_action && (
                              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200/70 rounded-lg px-3 py-2">
                                <strong>Corrective Action:</strong> {blk.corrective_action}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Owner: {blk.owner_name || 'Unassigned'} · Target:{' '}
                                {blk.target_resolution_date ? formatShortDate(blk.target_resolution_date) : 'TBD'}
                              </span>
                              {canManage && blk.status !== 'resolved' && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleBlockerStatus(blk.id, 'mitigating')}
                                    className="px-2.5 py-1 rounded border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                                  >
                                    Mitigating
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleBlockerStatus(blk.id, 'escalated')}
                                    className="px-2.5 py-1 rounded border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700 cursor-pointer"
                                  >
                                    Escalate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleBlockerStatus(blk.id, 'resolved')}
                                    className="px-2.5 py-1 rounded bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Resolve
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUB-TAB 5: CONNECTED EXISTING OPERATIONAL RECORDS (NO DUPLICATION) */}
                {detailTab === 'linked' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      Link existing project tasks, site reports, material requirements, purchase orders, QC inspections, and area completions directly to{' '}
                      <strong className="text-slate-800">{selectedPackage.package_code}</strong> without duplicating operational systems.
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { key: 'tasks', label: 'Project Tasks' },
                          { key: 'notes', label: 'Site Reports / Notes' },
                          { key: 'materials', label: 'Material BOQ' },
                          { key: 'purchaseOrders', label: 'Purchase Orders' },
                          { key: 'inspections', label: 'Technical / QC' },
                          { key: 'areaCompletions', label: 'Area Completions' },
                        ] as const
                      ).map((cat) => {
                        const list = bundle.linkedRecords[cat.key];
                        const linkedCount = list.filter(
                          (item) => item.work_package_id === selectedPackage.id
                        ).length;
                        return (
                          <button
                            key={cat.key}
                            type="button"
                            onClick={() => setLinkCategory(cat.key)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                              linkCategory === cat.key
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {cat.label}{' '}
                            <span className="font-mono opacity-80">
                              ({linkedCount}/{list.length})
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {bundle.linkedRecords[linkCategory].length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                        No existing records found in this module for this project yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200/80 border border-slate-200/90 rounded-xl overflow-hidden">
                        {bundle.linkedRecords[linkCategory].map((item) => {
                          const isLinkedHere = item.work_package_id === selectedPackage.id;
                          const otherPkg =
                            item.work_package_id && !isLinkedHere
                              ? bundle.packages.find((p) => p.id === item.work_package_id)
                              : null;
                          return (
                            <div
                              key={item.id}
                              className="p-3.5 bg-white flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {item.status ? `${item.status}` : 'Active'}
                                  {item.subtitle ? ` · ${item.subtitle}` : ''}
                                  {item.date ? ` · ${formatShortDate(item.date)}` : ''}
                                  {otherPkg ? ` · Currently on ${otherPkg.package_code}` : ''}
                                </p>
                              </div>
                              {canManage && (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => handleToggleOperationalLink(item)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                                    isLinkedHere
                                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {isLinkedHere ? (
                                    <>
                                      <Unlink className="w-3.5 h-3.5" /> Linked to {selectedPackage.package_code}
                                    </>
                                  ) : (
                                    <>
                                      <Link2 className="w-3.5 h-3.5 text-[#18b892]" /> Link to Package
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
