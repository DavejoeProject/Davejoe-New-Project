import { supabase } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';
import {
  MediaEvidenceItem,
  ProgressVerificationStage,
  ProjectWorkPackage,
} from './clientPortalService';

// ==============================================================================
// TYPES — PHASE 2 MILESTONE 1 (WORKSTREAM A): WORK PACKAGES & PROJECT CONTROLS
// ==============================================================================

export type WorkPackageInspectionStatus =
  | 'not_inspected'
  | 'scheduled'
  | 'in_review'
  | 'snag_identified'
  | 'conditional_pass'
  | 'passed';

export type WorkPackageApprovalStatus =
  | 'pending'
  | 'submitted_for_approval'
  | 'approved'
  | 'revision_requested'
  | 'rejected';

export type WorkPackageDelayStatus =
  | 'on_track'
  | 'at_risk'
  | 'delayed'
  | 'blocked'
  | 'completed';

export interface EnhancedWorkPackage extends ProjectWorkPackage {
  deliverables?: string | null;
  responsible_supervisor_id?: string | null;
  responsible_supervisor_name?: string | null;
  responsible_team_summary?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  completion_percent: number;
  inspection_status: WorkPackageInspectionStatus;
  approval_status: WorkPackageApprovalStatus;
  approved_by_user_id?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  evidence_documents: MediaEvidenceItem[];
  delay_status: WorkPackageDelayStatus;
  client_visible: boolean;
  updated_at?: string;
}

export type DependencyType =
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'blocks';

export interface WorkPackageDependency {
  id: string;
  project_id: string;
  work_package_id: string;
  depends_on_package_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type MilestoneStatus =
  | 'planned'
  | 'in_progress'
  | 'at_risk'
  | 'completed'
  | 'verified';

export interface WorkPackageMilestone {
  id: string;
  project_id: string;
  work_package_id: string;
  milestone_code: string;
  title: string;
  description?: string | null;
  planned_date?: string | null;
  actual_date?: string | null;
  weight_pct: number;
  completion_pct: number;
  verification_stage: ProgressVerificationStage;
  status: MilestoneStatus;
  evidence_media: MediaEvidenceItem[];
  client_visible: boolean;
  sort_order: number;
  created_at: string;
}

export type BlockerType = 'delay' | 'blocker' | 'risk' | 'corrective_action';
export type BlockerSeverity = 'low' | 'medium' | 'high' | 'critical';
export type BlockerStatus = 'open' | 'mitigating' | 'escalated' | 'resolved';

export interface WorkPackageBlocker {
  id: string;
  project_id: string;
  work_package_id: string;
  blocker_type: BlockerType;
  severity: BlockerSeverity;
  title: string;
  description: string;
  impact_days: number;
  corrective_action?: string | null;
  owner_user_id?: string | null;
  owner_name?: string | null;
  target_resolution_date?: string | null;
  status: BlockerStatus;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolution_notes?: string | null;
  client_visible: boolean;
  created_at: string;
}

export interface LinkedOperationalItem {
  id: string;
  source:
    | 'project_tasks'
    | 'project_notes'
    | 'project_material_requirements'
    | 'purchase_orders'
    | 'technical_inspections'
    | 'project_area_completions';
  title: string;
  subtitle?: string;
  status?: string;
  date?: string | null;
  work_package_id?: string | null;
}

export interface ProjectWorkPackageBundle {
  packages: EnhancedWorkPackage[];
  dependencies: WorkPackageDependency[];
  milestones: WorkPackageMilestone[];
  blockers: WorkPackageBlocker[];
  linkedRecords: {
    tasks: LinkedOperationalItem[];
    notes: LinkedOperationalItem[];
    materials: LinkedOperationalItem[];
    purchaseOrders: LinkedOperationalItem[];
    inspections: LinkedOperationalItem[];
    areaCompletions: LinkedOperationalItem[];
  };
  migrationPending?: boolean;
}

export interface StaffSupervisorOption {
  user_id: string;
  full_name: string;
  role_label?: string;
}

export const INSPECTION_STATUS_LABELS: Record<WorkPackageInspectionStatus, string> = {
  not_inspected: 'Not Inspected',
  scheduled: 'Inspection Scheduled',
  in_review: 'QC In Review',
  snag_identified: 'Snags Identified',
  conditional_pass: 'Conditional Pass',
  passed: 'QC Passed',
};

export const APPROVAL_STATUS_LABELS: Record<WorkPackageApprovalStatus, string> = {
  pending: 'Pending',
  submitted_for_approval: 'Submitted for Approval',
  approved: 'Approved',
  revision_requested: 'Revision Requested',
  rejected: 'Rejected',
};

export const DELAY_STATUS_LABELS: Record<WorkPackageDelayStatus, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  delayed: 'Delayed',
  blocked: 'Blocked',
  completed: 'Completed',
};

export const DEPENDENCY_TYPE_LABELS: Record<DependencyType, string> = {
  finish_to_start: 'Finish-to-Start (FS)',
  start_to_start: 'Start-to-Start (SS)',
  finish_to_finish: 'Finish-to-Finish (FF)',
  blocks: 'Directly Blocks',
};

function isMissingSchemaError(err: any): boolean {
  const msg = String(err?.message || err?.details || '').toLowerCase();
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function normalizeWorkPackage(raw: any): EnhancedWorkPackage {
  return {
    id: raw.id,
    project_id: raw.project_id,
    package_code: raw.package_code || 'WP',
    title: raw.title || 'Untitled Work Package',
    scope_type: raw.scope_type || 'work_package',
    floor_level: raw.floor_level ?? null,
    zone_name: raw.zone_name ?? null,
    room_name: raw.room_name ?? null,
    description: raw.description ?? null,
    exclusions: raw.exclusions ?? null,
    planned_start_date: raw.planned_start_date ?? null,
    planned_end_date: raw.planned_end_date ?? null,
    status: raw.status || 'planned',
    sort_order: Number(raw.sort_order ?? 0),
    created_at: raw.created_at,
    deliverables: raw.deliverables ?? null,
    responsible_supervisor_id: raw.responsible_supervisor_id ?? null,
    responsible_supervisor_name: raw.responsible_supervisor_name ?? null,
    responsible_team_summary: raw.responsible_team_summary ?? null,
    actual_start_date: raw.actual_start_date ?? null,
    actual_end_date: raw.actual_end_date ?? null,
    completion_percent: Number(raw.completion_percent ?? 0),
    inspection_status: raw.inspection_status || 'not_inspected',
    approval_status: raw.approval_status || 'pending',
    approved_by_user_id: raw.approved_by_user_id ?? null,
    approved_by_name: raw.approved_by_name ?? null,
    approved_at: raw.approved_at ?? null,
    evidence_documents: Array.isArray(raw.evidence_documents) ? raw.evidence_documents : [],
    delay_status: raw.delay_status || 'on_track',
    client_visible: raw.client_visible !== false,
    updated_at: raw.updated_at,
  };
}

// ==============================================================================
// SERVICE IMPLEMENTATION
// ==============================================================================

export class Phase2ControlsService {
  static async getProjectWorkPackageBundle(
    projectId: string,
    options?: { includeOperationalLinks?: boolean }
  ): Promise<ProjectWorkPackageBundle> {
    const includeLinks = options?.includeOperationalLinks !== false;

    const [pkgRes, depRes, msRes, blkRes] = await Promise.all([
      supabase
        .from('project_work_packages')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('work_package_dependencies')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('work_package_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('planned_date', { ascending: true }),
      supabase
        .from('work_package_blockers')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
    ]);

    if (pkgRes.error) {
      throw new Error(pkgRes.error.message);
    }

    const migrationPending = Boolean(
      (depRes.error && isMissingSchemaError(depRes.error)) ||
        (msRes.error && isMissingSchemaError(msRes.error)) ||
        (blkRes.error && isMissingSchemaError(blkRes.error))
    );

    const packages = (pkgRes.data || []).map(normalizeWorkPackage);
    const dependencies: WorkPackageDependency[] = depRes.error
      ? []
      : (depRes.data || []) as WorkPackageDependency[];
    const milestones: WorkPackageMilestone[] = msRes.error
      ? []
      : (msRes.data || []).map((m: any) => ({
          ...m,
          weight_pct: Number(m.weight_pct ?? 0),
          completion_pct: Number(m.completion_pct ?? 0),
          evidence_media: Array.isArray(m.evidence_media) ? m.evidence_media : [],
          client_visible: m.client_visible !== false,
        }));
    const blockers: WorkPackageBlocker[] = blkRes.error
      ? []
      : (blkRes.data || []).map((b: any) => ({
          ...b,
          impact_days: Number(b.impact_days ?? 0),
          client_visible: Boolean(b.client_visible),
        }));

    let linkedRecords: ProjectWorkPackageBundle['linkedRecords'] = {
      tasks: [],
      notes: [],
      materials: [],
      purchaseOrders: [],
      inspections: [],
      areaCompletions: [],
    };

    if (includeLinks) {
      const [tasksRes, notesRes, matsRes, posRes, insRes, areasRes] = await Promise.all([
        supabase
          .from('project_tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('project_notes')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('project_material_requirements')
          .select('*, materials(name, unit)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('purchase_orders')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('technical_inspections')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('project_area_completions')
          .select('id, completion_ref, area_location, work_category, workflow_status, qc_outcome, work_package_id, created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(60),
      ]);

      linkedRecords = {
        tasks: (tasksRes.error ? [] : tasksRes.data || []).map((t: any) => ({
          id: t.id,
          source: 'project_tasks',
          title: t.title || t.task_title || 'Project Task',
          subtitle: t.priority ? `Priority: ${t.priority}` : t.description?.slice(0, 70),
          status: t.status || 'pending',
          date: t.due_date || t.created_at,
          work_package_id: t.work_package_id ?? null,
        })),
        notes: (notesRes.error ? [] : notesRes.data || []).map((n: any) => ({
          id: n.id,
          source: 'project_notes',
          title: n.title || 'Site Report / Note',
          subtitle: n.note_type ? n.note_type.replace(/_/g, ' ') : undefined,
          status: n.note_type || 'note',
          date: n.created_at,
          work_package_id: n.work_package_id ?? null,
        })),
        materials: (matsRes.error ? [] : matsRes.data || []).map((m: any) => ({
          id: m.id,
          source: 'project_material_requirements',
          title: m.materials?.name || m.material_name || 'Material Requirement',
          subtitle:
            m.required_quantity != null
              ? `Qty: ${m.required_quantity} ${m.materials?.unit || m.unit || ''}`.trim()
              : undefined,
          status: m.status || 'planned',
          date: m.created_at,
          work_package_id: m.work_package_id ?? null,
        })),
        purchaseOrders: (posRes.error ? [] : posRes.data || []).map((po: any) => ({
          id: po.id,
          source: 'purchase_orders',
          title: po.po_number || po.order_number || `PO-${String(po.id).slice(0, 6).toUpperCase()}`,
          subtitle: po.total_cost != null ? `₦${Number(po.total_cost).toLocaleString()}` : undefined,
          status: po.status || 'draft',
          date: po.order_date || po.created_at,
          work_package_id: po.work_package_id ?? null,
        })),
        inspections: (insRes.error ? [] : insRes.data || []).map((ins: any) => ({
          id: ins.id,
          source: 'technical_inspections',
          title: ins.inspection_type || ins.title || 'Technical Inspection',
          subtitle: ins.result ? `Result: ${ins.result}` : undefined,
          status: ins.status || 'scheduled',
          date: ins.scheduled_date || ins.created_at,
          work_package_id: ins.work_package_id ?? null,
        })),
        areaCompletions: (areasRes.error ? [] : areasRes.data || []).map((a: any) => ({
          id: a.id,
          source: 'project_area_completions',
          title: `${a.completion_ref || 'AREA'} · ${a.area_location}`,
          subtitle: a.work_category,
          status: a.workflow_status || a.qc_outcome || 'draft',
          date: a.created_at,
          work_package_id: a.work_package_id ?? null,
        })),
      };
    }

    return {
      packages,
      dependencies,
      milestones,
      blockers,
      linkedRecords,
      migrationPending,
    };
  }

  static async listStaffSupervisorOptions(): Promise<StaffSupervisorOption[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, first_name, last_name, status')
      .eq('status', 'active')
      .order('display_name', { ascending: true })
      .limit(120);

    if (error || !data) return [];
    return data
      .map((p: any) => {
        const name =
          p.display_name ||
          [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
        return name ? { user_id: p.id, full_name: name } : null;
      })
      .filter((x): x is StaffSupervisorOption => Boolean(x));
  }

  static async createWorkPackage(payload: {
    project_id: string;
    package_code: string;
    title: string;
    scope_type: EnhancedWorkPackage['scope_type'];
    floor_level?: string;
    zone_name?: string;
    room_name?: string;
    description?: string;
    deliverables?: string;
    exclusions?: string;
    responsible_supervisor_id?: string | null;
    responsible_supervisor_name?: string | null;
    responsible_team_summary?: string;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    client_visible?: boolean;
    created_by?: string;
  }): Promise<EnhancedWorkPackage> {
    const { data, error } = await supabase
      .from('project_work_packages')
      .insert({
        project_id: payload.project_id,
        package_code: payload.package_code.trim().toUpperCase(),
        title: payload.title.trim(),
        scope_type: payload.scope_type,
        floor_level: payload.floor_level?.trim() || null,
        zone_name: payload.zone_name?.trim() || null,
        room_name: payload.room_name?.trim() || null,
        description: payload.description?.trim() || null,
        deliverables: payload.deliverables?.trim() || null,
        exclusions: payload.exclusions?.trim() || null,
        responsible_supervisor_id: payload.responsible_supervisor_id || null,
        responsible_supervisor_name: payload.responsible_supervisor_name?.trim() || null,
        responsible_team_summary: payload.responsible_team_summary?.trim() || null,
        planned_start_date: payload.planned_start_date || null,
        planned_end_date: payload.planned_end_date || null,
        client_visible: payload.client_visible !== false,
        status: 'planned',
        completion_percent: 0,
        inspection_status: 'not_inspected',
        approval_status: 'pending',
        delay_status: 'on_track',
        created_by: payload.created_by || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    await AuditLogger.log({
      module: 'project_controls',
      action: 'work_package_created',
      tableName: 'project_work_packages',
      recordId: data.id,
      newValues: { package_code: data.package_code, title: data.title, project_id: payload.project_id },
    });
    return normalizeWorkPackage(data);
  }

  static async updateWorkPackage(
    packageId: string,
    updates: Partial<{
      title: string;
      scope_type: EnhancedWorkPackage['scope_type'];
      floor_level: string | null;
      zone_name: string | null;
      room_name: string | null;
      description: string | null;
      deliverables: string | null;
      exclusions: string | null;
      responsible_supervisor_id: string | null;
      responsible_supervisor_name: string | null;
      responsible_team_summary: string | null;
      planned_start_date: string | null;
      planned_end_date: string | null;
      actual_start_date: string | null;
      actual_end_date: string | null;
      status: EnhancedWorkPackage['status'];
      completion_percent: number;
      inspection_status: WorkPackageInspectionStatus;
      approval_status: WorkPackageApprovalStatus;
      approved_by_user_id: string | null;
      approved_by_name: string | null;
      approved_at: string | null;
      evidence_documents: MediaEvidenceItem[];
      delay_status: WorkPackageDelayStatus;
      client_visible: boolean;
    }>
  ): Promise<EnhancedWorkPackage> {
    const clean: Record<string, unknown> = { ...updates };
    if (clean.completion_percent != null) {
      clean.completion_percent = Math.max(0, Math.min(100, Number(clean.completion_percent)));
    }
    const { data, error } = await supabase
      .from('project_work_packages')
      .update(clean)
      .eq('id', packageId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    await AuditLogger.log({
      module: 'project_controls',
      action: 'work_package_updated',
      tableName: 'project_work_packages',
      recordId: packageId,
      newValues: clean,
    });
    return normalizeWorkPackage(data);
  }

  static async addDependency(payload: {
    project_id: string;
    work_package_id: string;
    depends_on_package_id: string;
    dependency_type: DependencyType;
    lag_days?: number;
    notes?: string;
    created_by?: string;
  }): Promise<WorkPackageDependency> {
    const { data, error } = await supabase
      .from('work_package_dependencies')
      .insert({
        project_id: payload.project_id,
        work_package_id: payload.work_package_id,
        depends_on_package_id: payload.depends_on_package_id,
        dependency_type: payload.dependency_type,
        lag_days: Number(payload.lag_days || 0),
        notes: payload.notes?.trim() || null,
        created_by: payload.created_by || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as WorkPackageDependency;
  }

  static async removeDependency(dependencyId: string): Promise<void> {
    const { error } = await supabase
      .from('work_package_dependencies')
      .delete()
      .eq('id', dependencyId);
    if (error) throw new Error(error.message);
  }

  static async createMilestone(payload: {
    project_id: string;
    work_package_id: string;
    milestone_code: string;
    title: string;
    description?: string;
    planned_date?: string | null;
    weight_pct?: number;
    client_visible?: boolean;
    created_by?: string;
  }): Promise<WorkPackageMilestone> {
    const { data, error } = await supabase
      .from('work_package_milestones')
      .insert({
        project_id: payload.project_id,
        work_package_id: payload.work_package_id,
        milestone_code: payload.milestone_code.trim().toUpperCase(),
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        planned_date: payload.planned_date || null,
        weight_pct: Math.max(0, Math.min(100, Number(payload.weight_pct ?? 0))),
        completion_pct: 0,
        verification_stage: 'reported_by_supervisor',
        status: 'planned',
        client_visible: payload.client_visible !== false,
        created_by: payload.created_by || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as WorkPackageMilestone;
  }

  static async updateMilestone(
    milestoneId: string,
    updates: Partial<{
      completion_pct: number;
      status: MilestoneStatus;
      verification_stage: ProgressVerificationStage;
      actual_date: string | null;
      evidence_media: MediaEvidenceItem[];
      client_visible: boolean;
    }>
  ): Promise<WorkPackageMilestone> {
    const { data, error } = await supabase
      .from('work_package_milestones')
      .update(updates)
      .eq('id', milestoneId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as WorkPackageMilestone;
  }

  static async createBlocker(payload: {
    project_id: string;
    work_package_id: string;
    blocker_type: BlockerType;
    severity: BlockerSeverity;
    title: string;
    description: string;
    impact_days?: number;
    corrective_action?: string;
    owner_user_id?: string | null;
    owner_name?: string | null;
    target_resolution_date?: string | null;
    client_visible?: boolean;
    created_by?: string;
  }): Promise<WorkPackageBlocker> {
    const { data, error } = await supabase
      .from('work_package_blockers')
      .insert({
        project_id: payload.project_id,
        work_package_id: payload.work_package_id,
        blocker_type: payload.blocker_type,
        severity: payload.severity,
        title: payload.title.trim(),
        description: payload.description.trim(),
        impact_days: Math.max(0, Number(payload.impact_days || 0)),
        corrective_action: payload.corrective_action?.trim() || null,
        owner_user_id: payload.owner_user_id || null,
        owner_name: payload.owner_name?.trim() || null,
        target_resolution_date: payload.target_resolution_date || null,
        status: 'open',
        client_visible: Boolean(payload.client_visible),
        created_by: payload.created_by || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as WorkPackageBlocker;
  }

  static async updateBlockerStatus(
    blockerId: string,
    updates: {
      status: BlockerStatus;
      corrective_action?: string | null;
      resolution_notes?: string | null;
      resolved_by?: string | null;
      client_visible?: boolean;
    }
  ): Promise<WorkPackageBlocker> {
    const patch: Record<string, unknown> = {
      status: updates.status,
    };
    if (updates.corrective_action !== undefined) patch.corrective_action = updates.corrective_action;
    if (updates.resolution_notes !== undefined) patch.resolution_notes = updates.resolution_notes;
    if (updates.client_visible !== undefined) patch.client_visible = updates.client_visible;
    if (updates.status === 'resolved') {
      patch.resolved_at = new Date().toISOString();
      patch.resolved_by = updates.resolved_by || null;
    }

    const { data, error } = await supabase
      .from('work_package_blockers')
      .update(patch)
      .eq('id', blockerId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as WorkPackageBlocker;
  }

  static async linkOperationalRecordToPackage(
    sourceTable: LinkedOperationalItem['source'],
    recordId: string,
    workPackageId: string | null
  ): Promise<void> {
    const allowedTables: LinkedOperationalItem['source'][] = [
      'project_tasks',
      'project_notes',
      'project_material_requirements',
      'purchase_orders',
      'technical_inspections',
      'project_area_completions',
    ];
    if (!allowedTables.includes(sourceTable)) {
      throw new Error('Unsupported operational table.');
    }

    const { error } = await supabase
      .from(sourceTable)
      .update({ work_package_id: workPackageId })
      .eq('id', recordId);

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(
          'Run Phase 2 Milestone 1 Migration 2A (20261125000002_phase2_m1_work_packages_controls.sql) first to enable work package links on existing operational records.'
        );
      }
      throw new Error(error.message);
    }
  }
}
