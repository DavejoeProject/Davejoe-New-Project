import { supabase } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';
import {
  ClientPortalService,
  CONFIDENTIAL_EVIDENCE_BUCKET,
  MediaEvidenceItem,
} from './clientPortalService';

// ==============================================================================
// TYPES — RELEASE 1A CONFIDENTIAL WORKER CONDUCT DISCLOSURES
// ==============================================================================

export type WorkerDisclosureCategory =
  | 'unauthorised_payment_request'
  | 'side_job_solicitation'
  | 'material_diversion'
  | 'spec_bypass_pressure'
  | 'complaint_concealment'
  | 'workmanship_coverup'
  | 'unsafe_instruction'
  | 'other_conduct';

export type WorkerDisclosureStatus =
  | 'submitted'
  | 'under_investigation'
  | 'action_taken'
  | 'closed'
  | 'unsubstantiated';

export interface WorkerConductDisclosure {
  id: string;
  disclosure_ref: string;
  project_id?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  reported_by: string;
  reported_by_name?: string | null;
  reporter_role?: string | null;
  disclosure_category: WorkerDisclosureCategory;
  subject_user_id?: string | null;
  subject_description?: string | null;
  incident_date: string;
  description: string;
  evidence_media: MediaEvidenceItem[];
  is_anonymous_to_site_team: boolean;
  status: WorkerDisclosureStatus;
  assigned_investigator_id?: string | null;
  investigation_notes?: string | null;
  resolution_summary?: string | null;
  resolved_by?: string | null;
  resolved_by_name?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const DISCLOSURE_CATEGORY_OPTIONS: {
  value: WorkerDisclosureCategory;
  label: string;
  helper: string;
}[] = [
  {
    value: 'unauthorised_payment_request',
    label: 'Unauthorised Payment / Cash Request',
    helper: 'Soliciting direct cash, side transfer, or unofficial payment from a client or partner.',
  },
  {
    value: 'side_job_solicitation',
    label: 'Side-Job / Direct Off-Portal Solicitation',
    helper: 'Arranging private work with a Davejoe client outside approved company channels.',
  },
  {
    value: 'material_diversion',
    label: 'Material Diversion / Missing Stock',
    helper: 'Unauthorised removal, substitution, or misappropriation of project materials.',
  },
  {
    value: 'spec_bypass_pressure',
    label: 'Specification or QC Bypass Pressure',
    helper: 'Instruction to skip coats, substitute approved finishes, or bypass QC verification.',
  },
  {
    value: 'complaint_concealment',
    label: 'Concealing a Client Complaint or Defect',
    helper: 'Suppressing or hiding a client concern, surface defect, or site damage incident.',
  },
  {
    value: 'workmanship_coverup',
    label: 'Workmanship or Damage Cover-Up',
    helper: 'Covering up defective finishes or damage without proper technical assessment.',
  },
  {
    value: 'unsafe_instruction',
    label: 'Unsafe Site Instruction',
    helper: 'Pressure to perform unsafe site work or violate safety controls.',
  },
  {
    value: 'other_conduct',
    label: 'Other Confidential Conduct Concern',
    helper: 'Any other serious conduct or integrity issue requiring Leadership review.',
  },
];

export const DISCLOSURE_STATUS_META: Record<
  WorkerDisclosureStatus,
  { label: string; tone: 'amber' | 'sky' | 'emerald' | 'slate' | 'rose' }
> = {
  submitted: { label: 'Submitted (Awaiting Review)', tone: 'amber' },
  under_investigation: { label: 'Under Investigation', tone: 'sky' },
  action_taken: { label: 'Action Taken', tone: 'emerald' },
  closed: { label: 'Closed', tone: 'slate' },
  unsubstantiated: { label: 'Closed — Unsubstantiated', tone: 'slate' },
};

export interface DisclosureListResult {
  items: WorkerConductDisclosure[];
  migrationPending: boolean;
  error: string | null;
}

function isMissingRelationError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    msg.includes('worker_conduct_disclosures') && (msg.includes('does not exist') || msg.includes('not find'))
  );
}

export class ConductDisclosureService {
  /**
   * Lists disclosures visible to the current user per RLS:
   * - Site Supervisors / Artisans / Staff: ONLY their own submitted disclosures.
   * - Leadership (Management / Executive Director) & assigned investigators:
   *   all disclosures EXCEPT any disclosure where they are named as subject_user_id.
   */
  static async listDisclosures(): Promise<DisclosureListResult> {
    const { data, error } = await supabase
      .from('worker_conduct_disclosures')
      .select('*, project:projects(id, name, project_code)')
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingRelationError(error)) {
        return { items: [], migrationPending: true, error: null };
      }
      return { items: [], migrationPending: false, error: error.message };
    }

    const items: WorkerConductDisclosure[] = (data || []).map((row: any) => ({
      ...row,
      project_name: row.project?.name ?? null,
      project_code: row.project?.project_code ?? null,
      evidence_media: Array.isArray(row.evidence_media) ? row.evidence_media : [],
    }));

    return { items, migrationPending: false, error: null };
  }

  /**
   * Uploads disclosure evidence exclusively into the private 'confidential-case-evidence' vault.
   */
  static async uploadDisclosureEvidence(params: {
    projectId?: string | null;
    file: File;
    uploadedByName?: string;
  }): Promise<MediaEvidenceItem> {
    const item = await ClientPortalService.uploadEvidenceFile({
      projectId: params.projectId || 'general',
      category: 'worker_disclosures',
      file: params.file,
      uploadedByName: params.uploadedByName,
      isConfidential: true,
    });
    return {
      ...item,
      bucket_id: CONFIDENTIAL_EVIDENCE_BUCKET,
    };
  }

  /**
   * Submits a confidential worker conduct disclosure directly to Leadership.
   * Reporter identity, role, reference number, and initial status are derived
   * and locked server-side from auth.uid() by trg_01_worker_disclosure_insert_guard.
   */
  static async submitDisclosure(payload: {
    project_id?: string | null;
    disclosure_category: WorkerDisclosureCategory;
    subject_description?: string;
    incident_date: string;
    description: string;
    evidence_media?: MediaEvidenceItem[];
    is_anonymous_to_site_team?: boolean;
  }): Promise<WorkerConductDisclosure> {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const uid = authData?.user?.id;
    if (authErr || !uid) {
      throw new Error('You must be signed in to submit a confidential conduct disclosure.');
    }

    const cleanEvidence = (payload.evidence_media || []).map((item) => ({
      ...item,
      bucket_id: CONFIDENTIAL_EVIDENCE_BUCKET,
    }));

    const { data, error } = await supabase
      .from('worker_conduct_disclosures')
      .insert({
        disclosure_ref: '',
        project_id: payload.project_id || null,
        reported_by: uid,
        disclosure_category: payload.disclosure_category,
        subject_description: payload.subject_description?.trim() || null,
        incident_date: payload.incident_date,
        description: payload.description.trim(),
        evidence_media: cleanEvidence,
        is_anonymous_to_site_team: payload.is_anonymous_to_site_team ?? true,
      })
      .select('*')
      .single();

    if (error) {
      if (isMissingRelationError(error)) {
        throw new Error(
          'Confidential worker disclosure table is not yet provisioned. Please execute Release 1A migration 20261126000001 in Supabase SQL Editor.'
        );
      }
      throw new Error(error.message);
    }

    await AuditLogger.log({
      action: 'conduct.worker_disclosure_submitted',
      module: 'workforce',
      tableName: 'worker_conduct_disclosures',
      recordId: data.id,
      newValues: {
        disclosure_ref: data.disclosure_ref,
        category: data.disclosure_category,
        project_id: data.project_id,
      },
    });

    return data as WorkerConductDisclosure;
  }

  /**
   * Leadership / assigned investigator triage and resolution update.
   */
  static async updateDisclosureInvestigation(params: {
    disclosureId: string;
    status: WorkerDisclosureStatus;
    investigation_notes?: string;
    resolution_summary?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('worker_conduct_disclosures')
      .update({
        status: params.status,
        investigation_notes: params.investigation_notes?.trim() || null,
        resolution_summary: params.resolution_summary?.trim() || null,
      })
      .eq('id', params.disclosureId);

    if (error) {
      throw new Error(error.message);
    }

    await AuditLogger.log({
      action: `conduct.worker_disclosure_${params.status}`,
      module: 'workforce',
      tableName: 'worker_conduct_disclosures',
      recordId: params.disclosureId,
      newValues: { status: params.status },
    });
  }
}
