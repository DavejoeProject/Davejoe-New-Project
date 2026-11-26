import { supabase } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';

// ==============================================================================
// TYPES & CONSTANTS — DAVEJOE CLIENT EXPERIENCE & PROJECT PARTNER PORTAL (PHASE 1)
// ==============================================================================

export type ClientAccountType =
  | 'individual'
  | 'corporate'
  | 'main_contractor'
  | 'subcontract_partner'
  | 'diaspora_remote';

export type ProjectDeliveryModel =
  | 'direct_residential'
  | 'diaspora_remote'
  | 'direct_corporate'
  | 'main_contractor_subcontract'
  | 'multi_party_commercial';

export type PartyRole =
  | 'owner'
  | 'diaspora_owner'
  | 'corporate_client'
  | 'main_contractor'
  | 'subcontractor'
  | 'consultant'
  | 'designer'
  | 'quantity_surveyor'
  | 'project_manager'
  | 'local_representative';

export type ReworkClassification =
  | 'davejoe_workmanship_defect'
  | 'client_requested_change'
  | 'main_contractor_instruction'
  | 'damage_by_another_trade'
  | 'pre_existing_substrate_issue'
  | 'material_issue'
  | 'accidental_damage'
  | 'cause_under_investigation'
  | 'other';

export type ProgressVerificationStage =
  | 'reported_by_supervisor'
  | 'inspected_by_qc'
  | 'verified_completed'
  | 'acknowledged_by_client'
  | 'formally_handed_over';

export type AreaCompletionWorkflowStatus =
  | 'draft'
  | 'ready_for_qc'
  | 'qc_failed_snag'
  | 'qc_conditional_pass'
  | 'qc_verified'
  | 'submitted_for_acknowledgement'
  | 'client_acknowledged'
  | 'client_rejected'
  | 'released_for_subsequent_trades'
  | 'formally_handed_over';

export type VariationWorkflowStage =
  | 'request_received'
  | 'technical_assessment'
  | 'scope_quantity_verified'
  | 'cost_time_assessed'
  | 'internal_commercial_approved'
  | 'awaiting_client_approval'
  | 'client_approved'
  | 'client_rejected'
  | 'disputed'
  | 'work_instruction_issued'
  | 'in_execution'
  | 'technically_verified'
  | 'financially_reconciled';

export type EvidenceBucketId = 'client-portal-evidence' | 'confidential-case-evidence';

export interface MediaEvidenceItem {
  storage_path: string;
  file_name: string;
  mime_type: string;
  bucket_id?: EvidenceBucketId;
  caption?: string;
  uploaded_at: string;
  uploaded_by_name?: string;
}

export interface ClientAccount {
  id: string;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  account_type: ClientAccountType;
  company_name?: string | null;
  rc_number?: string | null;
  billing_address?: string | null;
  country?: string | null;
  timezone?: string | null;
  preferred_channel?: string | null;
  official_account_manager_id?: string | null;
  portal_enabled: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ClientContact {
  id: string;
  client_id: string;
  user_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
  organization_name?: string | null;
  party_role: PartyRole;
  timezone?: string | null;
  is_primary_contact: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface ProjectAuthorityMatrix {
  can_view_commercial: boolean;
  can_approve_quotations: boolean;
  can_approve_specifications: boolean;
  can_approve_variations: boolean;
  can_acknowledge_completions: boolean;
  can_approve_payments: boolean;
  can_view_financials: boolean;
  hide_subcontract_pricing: boolean;
  can_submit_requests_complaints: boolean;
}

export interface ClientProjectAccess extends ProjectAuthorityMatrix {
  id: string;
  client_id: string;
  client_contact_id: string;
  project_id: string;
  user_id?: string | null;
  party_role: PartyRole;
  is_active: boolean;
  granted_by?: string | null;
  granted_at: string;
  revoked_by?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  client?: ClientAccount;
  contact?: ClientContact;
  project?: PortalProjectSummary;
}

export interface ClientInvitation {
  id: string;
  client_id: string;
  client_contact_id: string;
  project_ids: string[];
  email: string;
  full_name: string;
  party_role: PartyRole;
  authorities: Partial<ProjectAuthorityMatrix>;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  invited_by?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  created_at: string;
}

export interface InvitationPreview {
  valid: boolean;
  reason?: string;
  invitation_id?: string;
  client_name?: string;
  account_type?: ClientAccountType;
  full_name?: string;
  email?: string;
  party_role?: PartyRole;
  expires_at?: string;
  projects?: { id: string; project_code: string; name: string }[];
}

export interface PortalProjectSummary {
  id: string;
  project_code: string;
  name: string;
  status: string;
  location?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  contract_value?: number | null;
  budget_amount?: number | null;
  client_id?: string | null;
  project_delivery_model?: ProjectDeliveryModel | null;
  client_visible_stage?: string | null;
  verified_progress_pct?: number | null;
  official_contact_name?: string | null;
  official_contact_phone?: string | null;
  official_contact_email?: string | null;
  contract_reference?: string | null;
}

export interface ProjectWorkPackage {
  id: string;
  project_id: string;
  package_code: string;
  title: string;
  scope_type: 'residential_room' | 'commercial_floor' | 'commercial_zone' | 'elevation' | 'work_package';
  floor_level?: string | null;
  zone_name?: string | null;
  room_name?: string | null;
  description?: string | null;
  exclusions?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  status: 'planned' | 'in_progress' | 'ready_for_inspection' | 'verified' | 'released' | 'handed_over' | 'on_hold';
  sort_order: number;
  created_at: string;
}

export interface ProjectSpecification {
  id: string;
  project_id: string;
  work_package_id?: string | null;
  spec_code: string;
  version_number: number;
  parent_id?: string | null;
  area_label: string;
  floor_zone?: string | null;
  work_category: string;
  material_product: string;
  manufacturer?: string | null;
  colour_name?: string | null;
  colour_code?: string | null;
  preview_hex?: string | null;
  finish_type?: string | null;
  surface_preparation?: string | null;
  number_of_coats?: number | null;
  quantity?: number | null;
  unit_of_measure?: string | null;
  approved_sample_ref?: string | null;
  exclusions?: string | null;
  technical_notes?: string | null;
  attachments: MediaEvidenceItem[];
  status: 'draft' | 'submitted' | 'awaiting_approval' | 'approved' | 'superseded' | 'rejected';
  prepared_by?: string | null;
  prepared_by_name?: string | null;
  submitted_at?: string | null;
  approved_by_user_id?: string | null;
  approved_by_contact_id?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  approval_comments?: string | null;
  created_at: string;
}

export interface ClientQuotationContract {
  id: string;
  project_id: string;
  client_id: string;
  document_type: 'quotation' | 'revised_quotation' | 'contract' | 'client_purchase_order';
  reference_no: string;
  version_number: number;
  parent_id?: string | null;
  title: string;
  scope_summary: string;
  specifications_summary?: string | null;
  exclusions?: string | null;
  terms_and_conditions?: string | null;
  payment_terms?: string | null;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  is_subcontract_confidential: boolean;
  is_b2b_client_issued: boolean;
  document_storage_path?: string | null;
  document_file_name?: string | null;
  status:
    | 'draft'
    | 'issued'
    | 'clarification_requested'
    | 'revision_requested'
    | 'accepted'
    | 'declined'
    | 'superseded';
  prepared_by?: string | null;
  issued_at?: string | null;
  valid_until?: string | null;
  viewed_at?: string | null;
  viewed_by?: string | null;
  decided_by_user_id?: string | null;
  decided_by_contact_id?: string | null;
  decided_by_name?: string | null;
  decided_at?: string | null;
  decision_comments?: string | null;
  acceptance_evidence?: Record<string, unknown>;
  created_at: string;
}

export interface PreworkSurfaceInspection {
  id: string;
  project_id: string;
  work_package_id?: string | null;
  technical_inspection_id?: string | null;
  inspection_ref: string;
  area_label: string;
  inspection_date: string;
  inspector_id?: string | null;
  inspector_name?: string | null;
  substrate_type?: string | null;
  substrate_condition: string;
  screeding_plastering_quality?: string | null;
  has_cracks: boolean;
  has_dampness: boolean;
  has_unevenness: boolean;
  has_damage: boolean;
  defect_details?: string | null;
  other_contractor_observation?: string | null;
  recommended_correction?: string | null;
  scope_responsibility: 'davejoe' | 'client' | 'main_contractor' | 'other_trade' | 'shared' | 'under_review';
  estimated_cost_impact?: number | null;
  estimated_time_impact_days?: number | null;
  evidence_media: MediaEvidenceItem[];
  client_decision:
    | 'pending'
    | 'proceed_after_correction'
    | 'proceed_with_noted_limitations'
    | 'hold_work'
    | 'variation_requested';
  client_decision_notes?: string | null;
  client_decided_by?: string | null;
  client_decided_by_name?: string | null;
  client_decided_at?: string | null;
  clearance_to_proceed: boolean;
  clearance_notes?: string | null;
  client_visible: boolean;
  created_at: string;
}

export interface ProjectProgressUpdate {
  id: string;
  project_id: string;
  work_package_id?: string | null;
  title: string;
  stage_name?: string | null;
  activity_type:
    | 'milestone'
    | 'completed_activity'
    | 'work_in_progress'
    | 'upcoming_activity'
    | 'pending_client_decision'
    | 'delay'
    | 'technical_concern';
  verification_stage: ProgressVerificationStage;
  planned_date?: string | null;
  actual_date?: string | null;
  progress_percent: number;
  summary: string;
  delay_reason?: string | null;
  technical_concern?: string | null;
  media_items: MediaEvidenceItem[];
  reported_by?: string | null;
  reported_by_name?: string | null;
  reported_at: string;
  inspected_by?: string | null;
  inspected_by_name?: string | null;
  inspected_at?: string | null;
  verified_by?: string | null;
  verified_by_name?: string | null;
  verified_at?: string | null;
  acknowledged_by?: string | null;
  acknowledged_by_name?: string | null;
  acknowledged_at?: string | null;
  acknowledgement_comments?: string | null;
  handed_over_at?: string | null;
  client_visible: boolean;
  created_at: string;
}

export interface ProjectAreaCompletion {
  id: string;
  project_id: string;
  work_package_id?: string | null;
  specification_id?: string | null;
  specification_version?: number | null;
  technical_inspection_id?: string | null;
  completion_ref: string;
  area_location: string;
  work_performed: string;
  quantity_completed?: number | null;
  unit_of_measure?: string | null;
  completion_date: string;
  site_supervisor_id?: string | null;
  site_supervisor_name?: string | null;
  assigned_team_summary?: string | null;
  completion_photos: MediaEvidenceItem[];
  completion_videos: MediaEvidenceItem[];
  workflow_status: AreaCompletionWorkflowStatus;
  qc_inspector_id?: string | null;
  qc_inspector_name?: string | null;
  qc_outcome: 'pending' | 'pass' | 'conditional_pass' | 'fail';
  qc_snag_status: 'none' | 'open_snags' | 'snags_cleared';
  qc_notes?: string | null;
  qc_verified_at?: string | null;
  linked_snag_task_id?: string | null;
  client_acknowledgement_status: 'not_submitted' | 'pending' | 'acknowledged' | 'rejected';
  client_acknowledged_by?: string | null;
  client_acknowledged_by_name?: string | null;
  client_acknowledged_at?: string | null;
  client_comments?: string | null;
  area_released: boolean;
  release_label?: string | null;
  condition_at_release?: string | null;
  outstanding_snags_at_release?: string | null;
  released_at?: string | null;
  released_by?: string | null;
  released_by_name?: string | null;
  receiving_representative?: string | null;
  protection_measures?: string | null;
  coordination_notes?: string | null;
  formal_handover_occurred: boolean;
  formal_handover_at?: string | null;
  created_at: string;
}

export interface SubsequentDamageIncident {
  id: string;
  incident_ref: string;
  project_id: string;
  area_completion_id: string;
  discovered_date: string;
  area_location: string;
  description: string;
  known_or_suspected_cause?: string | null;
  relevant_contractors_activities?: string | null;
  damage_media: MediaEvidenceItem[];
  reported_by?: string | null;
  reported_by_name?: string | null;
  technical_assessment?: string | null;
  assessed_by?: string | null;
  assessed_by_name?: string | null;
  assessed_at?: string | null;
  proposed_correction?: string | null;
  rework_classification: ReworkClassification;
  liability_status:
    | 'under_assessment'
    | 'evidence_shared'
    | 'agreed_non_davejoe'
    | 'davejoe_rectification'
    | 'disputed';
  is_chargeable: boolean;
  estimated_cost_impact?: number | null;
  estimated_time_impact_days?: number | null;
  notified_party?: string | null;
  notified_at?: string | null;
  external_response?: string | null;
  external_responded_by?: string | null;
  external_responded_at?: string | null;
  linked_variation_id?: string | null;
  resolution_status: 'open' | 'assessed' | 'notified' | 'in_remediation' | 'resolved' | 'closed';
  resolution_notes?: string | null;
  resolved_at?: string | null;
  client_visible: boolean;
  created_at: string;
}

export interface ClientRequestComplaint {
  id: string;
  reference_no: string;
  record_kind: 'request' | 'complaint';
  project_id: string;
  client_id: string;
  category: string;
  subject: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  attachments: MediaEvidenceItem[];
  submitted_by_user_id?: string | null;
  submitted_by_contact_id?: string | null;
  submitted_by_name?: string | null;
  is_confidential_management: boolean;
  subject_user_id?: string | null;
  independent_reviewer_id?: string | null;
  status: 'open' | 'in_review' | 'action_in_progress' | 'awaiting_client' | 'resolved' | 'closed';
  assigned_to_user_id?: string | null;
  assigned_to_name?: string | null;
  internal_notes?: string | null;
  resolution_summary?: string | null;
  resolved_by?: string | null;
  resolved_by_name?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface ProjectVariation {
  id: string;
  variation_ref: string;
  project_id: string;
  work_package_id?: string | null;
  source_damage_incident_id?: string | null;
  source_request_id?: string | null;
  title: string;
  rework_classification: ReworkClassification;
  original_spec_summary: string;
  revised_spec_summary: string;
  scope_and_quantity_notes?: string | null;
  is_chargeable: boolean;
  estimated_cost: number;
  currency: string;
  time_impact_days: number;
  contract_variation_type: 'standard' | 'pending_valuation' | 'disputed' | 'instructed_unpriced';
  workflow_stage: VariationWorkflowStage;
  requested_by?: string | null;
  requested_by_name?: string | null;
  technical_assessor_id?: string | null;
  technical_assessment_notes?: string | null;
  internal_approved_by?: string | null;
  internal_approved_by_name?: string | null;
  internal_approved_at?: string | null;
  client_decided_by?: string | null;
  client_decided_by_name?: string | null;
  client_decided_at?: string | null;
  client_decision_notes?: string | null;
  revised_instruction_notes?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  reconciled_amount?: number | null;
  reconciled_at?: string | null;
  is_subcontract_confidential: boolean;
  created_at: string;
}

export interface ClientWeeklySummary {
  id: string;
  project_id: string;
  week_start_date: string;
  week_end_date: string;
  summary_title: string;
  snapshot_data: {
    verified_progress_pct?: number;
    areas_qc_verified?: number;
    areas_client_acknowledged?: number;
    areas_released?: number;
    pending_spec_approvals?: number;
    pending_quotation_approvals?: number;
    pending_variation_approvals?: number;
    open_prework_concerns?: number;
    open_damage_incidents?: number;
    open_requests?: number;
    approved_variations_total?: number;
  };
  executive_notes?: string | null;
  upcoming_activities?: string | null;
  pending_client_decisions?: string | null;
  status: 'draft' | 'reviewed' | 'released';
  contains_subcontract_financials?: boolean;
  prepared_by?: string | null;
  prepared_by_name?: string | null;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  released_by?: string | null;
  released_by_name?: string | null;
  released_at?: string | null;
  created_at: string;
}

export interface VerifiedProjectPhoto {
  id: string;
  project_id: string;
  file_url: string;
  storage_path?: string | null;
  file_name?: string | null;
  title?: string | null;
  description?: string | null;
  area_completion_id?: string | null;
  area_location?: string | null;
  created_at: string;
}

export interface ProjectPortalBundle {
  project: PortalProjectSummary;
  workPackages: ProjectWorkPackage[];
  specifications: ProjectSpecification[];
  quotations: ClientQuotationContract[];
  preworkInspections: PreworkSurfaceInspection[];
  progressUpdates: ProjectProgressUpdate[];
  areaCompletions: ProjectAreaCompletion[];
  damageIncidents: SubsequentDamageIncident[];
  variations: ProjectVariation[];
  requestsComplaints: ClientRequestComplaint[];
  weeklySummaries: ClientWeeklySummary[];
  verifiedPhotos: VerifiedProjectPhoto[];
  financialSummary: {
    permitted: boolean;
    currency: string;
    acceptedContractsTotal: number;
    approvedVariationsTotal: number;
    combinedApprovedValue: number;
    pendingVariationsTotal: number;
    contractValueReference: number;
  };
}

// ==============================================================================
// LABELS & SAFETY HELPERS
// ==============================================================================

export const EVIDENCE_BUCKET: EvidenceBucketId = 'client-portal-evidence';
export const CONFIDENTIAL_EVIDENCE_BUCKET: EvidenceBucketId = 'confidential-case-evidence';
export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
export const ALLOWED_EVIDENCE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
]);
export const ALLOWED_CONFIDENTIAL_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/x-m4a',
]);

export const ACCOUNT_TYPE_LABELS: Record<ClientAccountType, string> = {
  individual: 'Individual Residential Client',
  diaspora_remote: 'Diaspora / Remote Investor',
  corporate: 'Direct Corporate Client',
  main_contractor: 'Main Contractor',
  subcontract_partner: 'Subcontracting Partner',
};

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  owner: 'Property Owner / Client',
  diaspora_owner: 'Diaspora Homeowner',
  corporate_client: 'Corporate Representative',
  main_contractor: 'Main Contractor',
  subcontractor: 'Subcontract Partner',
  consultant: 'Project Consultant',
  designer: 'Interior Designer',
  quantity_surveyor: 'Quantity Surveyor (QS)',
  project_manager: 'Project Manager',
  local_representative: 'Local Representative',
};

export const REWORK_CLASSIFICATION_LABELS: Record<ReworkClassification, string> = {
  davejoe_workmanship_defect: 'Davejoe Workmanship Defect (Non-Chargeable)',
  client_requested_change: 'Client-Requested Change',
  main_contractor_instruction: 'Main-Contractor Instruction',
  damage_by_another_trade: 'Damage Caused by Another Trade After Completion',
  pre_existing_substrate_issue: 'Pre-Existing Substrate / Surface Issue',
  material_issue: 'Material / Manufacturer Issue',
  accidental_damage: 'Accidental Damage',
  cause_under_investigation: 'Cause Under Technical Investigation',
  other: 'Other Classified Scope Event',
};

export const PROGRESS_STAGE_LABELS: Record<ProgressVerificationStage, string> = {
  reported_by_supervisor: '1. Reported by Site Supervisor',
  inspected_by_qc: '2. Inspected by Technical / QC',
  verified_completed: '3. Verified as Completed',
  acknowledged_by_client: '4. Acknowledged by Client / Representative',
  formally_handed_over: '5. Formally Handed Over',
};

export const VARIATION_STAGE_SEQUENCE: { key: VariationWorkflowStage; label: string; step: number }[] = [
  { key: 'request_received', label: 'Request Received', step: 1 },
  { key: 'technical_assessment', label: 'Technical Assessment', step: 2 },
  { key: 'scope_quantity_verified', label: 'Scope & Quantity Verified', step: 3 },
  { key: 'cost_time_assessed', label: 'Cost & Time Assessed', step: 4 },
  { key: 'internal_commercial_approved', label: 'Internal Commercial Approval', step: 5 },
  { key: 'awaiting_client_approval', label: 'Awaiting Client / Partner Approval', step: 6 },
  { key: 'client_approved', label: 'Client / Partner Approved', step: 6 },
  { key: 'work_instruction_issued', label: 'Revised Work Instruction Issued', step: 7 },
  { key: 'in_execution', label: 'Execution In Progress', step: 8 },
  { key: 'technically_verified', label: 'Technical / QC Verified', step: 9 },
  { key: 'financially_reconciled', label: 'Financially Reconciled', step: 10 },
];

export const REQUEST_CATEGORIES: { value: string; label: string }[] = [
  { value: 'general_question', label: 'Ask a Project Question' },
  { value: 'additional_work', label: 'Request Additional Work' },
  { value: 'colour_material_change', label: 'Request Colour or Material Change' },
  { value: 'report_concern', label: 'Report a Site Concern' },
  { value: 'request_inspection', label: 'Request Technical Inspection' },
  { value: 'request_callback', label: 'Request Callback / Meeting' },
  { value: 'request_aftercare', label: 'Request Aftercare / Snag Support' },
];

export const COMPLAINT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'poor_workmanship', label: 'Poor Workmanship' },
  { value: 'wrong_colour', label: 'Wrong Colour / Specification Mismatch' },
  { value: 'delay', label: 'Unexplained Delay' },
  { value: 'damage', label: 'Property or Surface Damage' },
  { value: 'unprofessional_behaviour', label: 'Unprofessional Behaviour' },
  { value: 'unauthorised_payment_request', label: 'Unauthorised Payment Request' },
  { value: 'missing_materials', label: 'Missing or Misused Materials' },
  { value: 'unsafe_conduct', label: 'Unsafe Site Conduct' },
  { value: 'poor_coordination', label: 'Poor Site Coordination' },
];

export const AREA_RELEASE_STANDARD_LABEL = 'Davejoe Work Verified — Area Released for Subsequent Trades';

export function isSafeHttpUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90);
}

function generateReferenceCode(prefix: string): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${rand}`;
}

export function formatCurrency(amount: number | null | undefined, currency = 'NGN'): string {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeProjectSummary(raw: Record<string, any>): PortalProjectSummary {
  const composedLocation =
    raw.location ||
    [raw.address, raw.city, raw.state, raw.country].filter((v) => typeof v === 'string' && v.trim().length > 0).join(', ') ||
    null;

  return {
    id: String(raw.id),
    project_code: String(raw.project_code || raw.code || 'PRJ'),
    name: String(raw.name || 'Untitled Project'),
    status: String(raw.status || 'in_progress'),
    location: composedLocation,
    description: raw.description ?? null,
    start_date: raw.start_date ?? null,
    end_date: raw.end_date ?? raw.expected_completion_date ?? raw.actual_completion_date ?? null,
    contract_value: raw.contract_value != null ? Number(raw.contract_value) : null,
    budget_amount: raw.budget_amount != null ? Number(raw.budget_amount) : raw.contract_value != null ? Number(raw.contract_value) : null,
    client_id: raw.client_id ?? null,
    project_delivery_model: raw.project_delivery_model ?? null,
    client_visible_stage: raw.client_visible_stage ?? null,
    verified_progress_pct: raw.verified_progress_pct != null ? Number(raw.verified_progress_pct) : 0,
    official_contact_name: raw.official_contact_name ?? null,
    official_contact_phone: raw.official_contact_phone ?? null,
    official_contact_email: raw.official_contact_email ?? null,
    contract_reference: raw.contract_reference ?? null,
  };
}

// ==============================================================================
// SERVICE CLASS
// ==============================================================================

export class ClientPortalService {
  // ----------------------------------------------------------------------------
  // PRIVATE STORAGE EVIDENCE UPLOAD & SIGNED URLS
  // ----------------------------------------------------------------------------
  static async uploadEvidenceFile(params: {
    projectId: string;
    category: string;
    file: File;
    caption?: string;
    uploadedByName?: string;
    isConfidential?: boolean;
  }): Promise<MediaEvidenceItem> {
    const { projectId, category, file, caption, uploadedByName, isConfidential } = params;
    const allowedMimes = isConfidential ? ALLOWED_CONFIDENTIAL_MIMES : ALLOWED_EVIDENCE_MIMES;

    if (!allowedMimes.has(file.type)) {
      throw new Error(
        isConfidential
          ? 'Unsupported file type. Upload JPG, PNG, WebP, MP4, MOV, WebM, PDF, or audio (MP3, M4A, WAV, OGG) files only.'
          : 'Unsupported file type. Upload JPG, PNG, WebP, MP4, MOV, WebM, or PDF files only.'
      );
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      throw new Error('File exceeds the 25MB limit for project evidence uploads.');
    }

    const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '') || 'evidence';
    const safeName = sanitizeFileName(file.name);
    const targetBucket: EvidenceBucketId = isConfidential ? CONFIDENTIAL_EVIDENCE_BUCKET : EVIDENCE_BUCKET;

    let storagePath: string;
    if (isConfidential) {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (userErr || !uid) {
        throw new Error('Active authenticated session required to upload confidential evidence.');
      }
      const scopeSegment = projectId && projectId.trim() ? projectId.trim() : 'general';
      storagePath = `${scopeSegment}/${uid}/${safeCategory}/${Date.now()}_${safeName}`;
    } else {
      storagePath = `${projectId}/${safeCategory}/${Date.now()}_${safeName}`;
    }

    const { error } = await supabase.storage
      .from(targetBucket)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      throw new Error(`Evidence upload failed: ${error.message}`);
    }

    return {
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      bucket_id: targetBucket,
      caption: caption?.trim() || undefined,
      uploaded_at: new Date().toISOString(),
      uploaded_by_name: uploadedByName,
    };
  }

  static async getSignedEvidenceUrl(
    storagePath: string,
    expiresInSeconds = 3600,
    bucketId?: EvidenceBucketId
  ): Promise<string | null> {
    if (!storagePath) return null;
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return isSafeHttpUrl(storagePath) ? storagePath : null;
    }

    const resolvedBucket: EvidenceBucketId = bucketId || EVIDENCE_BUCKET;
    const { data, error } = await supabase.storage
      .from(resolvedBucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.warn(`[ClientPortalService] Signed URL error (${resolvedBucket}):`, error?.message);
      return null;
    }
    return isSafeHttpUrl(data.signedUrl) ? data.signedUrl : null;
  }

  // ----------------------------------------------------------------------------
  // 1. CLIENT ACCOUNTS, CONTACTS, ACCESS MATRIX & SECURE INVITATIONS
  // ----------------------------------------------------------------------------
  static async getClientAccounts(): Promise<ClientAccount[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []) as ClientAccount[];
  }

  static async upsertClientAccount(payload: Partial<ClientAccount> & { name: string }): Promise<ClientAccount> {
    const record: Record<string, unknown> = {
      name: payload.name.trim(),
      contact_person: payload.contact_person?.trim() || null,
      email: payload.email?.trim().toLowerCase() || null,
      phone: payload.phone?.trim() || null,
      address: payload.address?.trim() || null,
      account_type: payload.account_type || 'individual',
      company_name: payload.company_name?.trim() || null,
      rc_number: payload.rc_number?.trim() || null,
      billing_address: payload.billing_address?.trim() || null,
      country: payload.country?.trim() || 'Nigeria',
      timezone: payload.timezone?.trim() || 'Africa/Lagos',
      preferred_channel: payload.preferred_channel || 'portal',
      portal_enabled: payload.portal_enabled ?? true,
      notes: payload.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const query = payload.id
      ? supabase.from('clients').update(record).eq('id', payload.id).select('*').single()
      : supabase.from('clients').insert(record).select('*').single();

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: payload.id ? 'client_portal.account_updated' : 'client_portal.account_created',
      module: 'client_portal',
      tableName: 'clients',
      recordId: data.id,
      newValues: { name: data.name, account_type: data.account_type },
    });

    return data as ClientAccount;
  }

  static async getAllProjectsSummary(): Promise<PortalProjectSummary[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((row) => normalizeProjectSummary(row as Record<string, any>));
  }

  static async updateProjectPortalSettings(
    projectId: string,
    updates: Partial<
      Pick<
        PortalProjectSummary,
        | 'client_id'
        | 'project_delivery_model'
        | 'client_visible_stage'
        | 'verified_progress_pct'
        | 'official_contact_name'
        | 'official_contact_phone'
        | 'official_contact_email'
        | 'contract_reference'
      >
    >
  ): Promise<void> {
    const { error } = await supabase.from('projects').update(updates).eq('id', projectId);
    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.project_settings_updated',
      module: 'client_portal',
      tableName: 'projects',
      recordId: projectId,
      newValues: updates as Record<string, unknown>,
    });
  }

  static async getClientContacts(clientId?: string): Promise<ClientContact[]> {
    let query = supabase
      .from('client_contacts')
      .select('*')
      .order('is_primary_contact', { ascending: false })
      .order('full_name', { ascending: true });

    if (clientId) query = query.eq('client_id', clientId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as ClientContact[];
  }

  static async getProjectAccessList(filters?: { clientId?: string; projectId?: string }): Promise<ClientProjectAccess[]> {
    let query = supabase
      .from('client_project_access')
      .select(
        '*, client:clients(*), contact:client_contacts!client_project_access_client_contact_id_fkey(*), project:projects(*)'
      )
      .order('created_at', { ascending: false });

    if (filters?.clientId) query = query.eq('client_id', filters.clientId);
    if (filters?.projectId) query = query.eq('project_id', filters.projectId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data || []) as unknown as Array<ClientProjectAccess & { project?: Record<string, any> | null }>).map((row) => ({
      ...row,
      project: row.project ? normalizeProjectSummary(row.project) : undefined,
    }));
  }

  static async updateProjectAccessAuthorities(
    accessId: string,
    authorities: Partial<ProjectAuthorityMatrix>
  ): Promise<void> {
    const { error } = await supabase
      .from('client_project_access')
      .update({ ...authorities, updated_at: new Date().toISOString() })
      .eq('id', accessId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.access_authorities_updated',
      module: 'client_portal',
      tableName: 'client_project_access',
      recordId: accessId,
      newValues: authorities as Record<string, unknown>,
    });
  }

  static async revokeProjectAccess(accessId: string, reason: string, revokedByUserId?: string): Promise<void> {
    const { error } = await supabase
      .from('client_project_access')
      .update({
        is_active: false,
        revoked_by: revokedByUserId || null,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason.trim() || 'Access revoked by Davejoe administration',
        updated_at: new Date().toISOString(),
      })
      .eq('id', accessId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.access_revoked',
      module: 'client_portal',
      tableName: 'client_project_access',
      recordId: accessId,
      newValues: { revoke_reason: reason },
    });
  }

  static async getClientInvitations(clientId?: string): Promise<ClientInvitation[]> {
    let query = supabase
      .from('client_invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (clientId) query = query.eq('client_id', clientId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as ClientInvitation[];
  }

  static async createClientInvitation(params: {
    clientId: string;
    email: string;
    fullName: string;
    phone?: string;
    designation?: string;
    partyRole: PartyRole;
    projectIds: string[];
    authorities: ProjectAuthorityMatrix;
    expiresInDays?: number;
  }): Promise<{ invitation_id: string; client_contact_id: string; token: string; expires_at: string; inviteUrl: string }> {
    const { data, error } = await supabase.rpc('create_client_invitation', {
      p_client_id: params.clientId,
      p_email: params.email.trim().toLowerCase(),
      p_full_name: params.fullName.trim(),
      p_phone: params.phone?.trim() || null,
      p_designation: params.designation?.trim() || null,
      p_party_role: params.partyRole,
      p_project_ids: params.projectIds,
      p_authorities: params.authorities,
      p_expires_in_days: params.expiresInDays ?? 7,
    });

    if (error) throw new Error(error.message);
    const result = data as { invitation_id: string; client_contact_id: string; token: string; expires_at: string };
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return {
      ...result,
      inviteUrl: `${origin}/client/invite/${result.token}`,
    };
  }

  static async previewClientInvitation(token: string): Promise<InvitationPreview> {
    const { data, error } = await supabase.rpc('preview_client_invitation', { p_token: token });
    if (error) return { valid: false, reason: error.message };
    return data as InvitationPreview;
  }

  static async acceptClientInvitation(token: string): Promise<{ accepted: boolean; client_id: string; project_ids: string[] }> {
    const { data, error } = await supabase.rpc('accept_client_invitation', { p_token: token });
    if (error) throw new Error(error.message);
    return data as { accepted: boolean; client_id: string; project_ids: string[] };
  }

  static async revokeClientInvitation(invitationId: string, reason: string, userId?: string): Promise<void> {
    const { error } = await supabase
      .from('client_invitations')
      .update({
        status: 'revoked',
        revoked_by: userId || null,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason.trim() || 'Revoked by administrator',
      })
      .eq('id', invitationId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.invitation_revoked',
      module: 'client_portal',
      tableName: 'client_invitations',
      recordId: invitationId,
      newValues: { revoke_reason: reason },
    });
  }

  // ----------------------------------------------------------------------------
  // 2. CLIENT PORTAL CONTEXT & PROJECT BUNDLE LOADER
  // ----------------------------------------------------------------------------
  static async getMyClientPortalContext(userId: string): Promise<{
    accessRecords: ClientProjectAccess[];
    contact: ClientContact | null;
    account: ClientAccount | null;
  }> {
    const [accessRes, maskedProjectsRes] = await Promise.all([
      supabase
        .from('client_project_access')
        .select(
          '*, client:clients(*), contact:client_contacts!client_project_access_client_contact_id_fkey(*), project:projects(*)'
        )
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('revoked_at', null)
        .order('granted_at', { ascending: false }),
      supabase.rpc('get_client_authorized_projects', { p_project_id: null }),
    ]);

    if (accessRes.error) throw new Error(accessRes.error.message);

    // Prefer DB-boundary masked project records from get_client_authorized_projects when available
    const maskedById = new Map<string, Record<string, any>>();
    if (!maskedProjectsRes.error && Array.isArray(maskedProjectsRes.data)) {
      for (const item of maskedProjectsRes.data as Record<string, any>[]) {
        if (item?.id) maskedById.set(String(item.id), item);
      }
    }

    const records = ((accessRes.data || []) as unknown as Array<ClientProjectAccess & { project?: Record<string, any> | null }>)
      .filter((r) => Boolean(r.project) || maskedById.has(r.project_id))
      .map((r) => {
        const dbMasked = maskedById.get(r.project_id);
        const rawProject = dbMasked || r.project;
        if (!rawProject) return { ...r, project: undefined };
        const summary = normalizeProjectSummary(rawProject);
        // Defense-in-depth mirror if remote DB has not yet applied Release 1A migration
        const isSubcontractModel =
          summary.project_delivery_model === 'main_contractor_subcontract' ||
          summary.project_delivery_model === 'multi_party_commercial';
        if (!r.can_view_financials || (isSubcontractModel && r.hide_subcontract_pricing)) {
          summary.contract_value = null;
          summary.budget_amount = null;
        }
        return {
          ...r,
          project: summary,
        };
      });

    return {
      accessRecords: records,
      contact: records[0]?.contact || null,
      account: records[0]?.client || null,
    };
  }

  static async getProjectPortalBundle(
    projectId: string,
    options?: {
      isClientView?: boolean;
      access?: Partial<ProjectAuthorityMatrix>;
    }
  ): Promise<ProjectPortalBundle> {
    const isClientView = Boolean(options?.isClientView);
    const access = options?.access;

    const [
      projectRes,
      maskedProjectRes,
      packagesRes,
      specsRes,
      quotesRes,
      preworkRes,
      progressRes,
      completionsRes,
      damageRes,
      variationsRes,
      requestsRes,
      summariesRpcRes,
      summariesFallbackRes,
      photosRes,
    ] = await Promise.all([
      isClientView
        ? Promise.resolve({ data: null, error: null })
        : supabase.from('projects').select('*').eq('id', projectId).single(),
      isClientView
        ? supabase.rpc('get_client_authorized_projects', { p_project_id: projectId })
        : Promise.resolve({ data: null, error: null }),
      supabase.from('project_work_packages').select('*').eq('project_id', projectId).order('sort_order', { ascending: true }),
      supabase
        .from('project_specifications')
        .select('*')
        .eq('project_id', projectId)
        .order('spec_code', { ascending: true })
        .order('version_number', { ascending: false }),
      supabase
        .from('client_quotations_contracts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('prework_surface_inspections')
        .select('*')
        .eq('project_id', projectId)
        .order('inspection_date', { ascending: false }),
      supabase
        .from('project_progress_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('project_area_completions')
        .select('*')
        .eq('project_id', projectId)
        .order('completion_date', { ascending: false }),
      supabase
        .from('subsequent_damage_incidents')
        .select('*')
        .eq('project_id', projectId)
        .order('discovered_date', { ascending: false }),
      supabase
        .from('project_variations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_requests_complaints')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      isClientView
        ? supabase.rpc('get_client_weekly_summaries', { p_project_id: projectId })
        : Promise.resolve({ data: null, error: null }),
      !isClientView
        ? supabase
            .from('client_weekly_summaries')
            .select('*')
            .eq('project_id', projectId)
            .order('week_end_date', { ascending: false })
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('job_completion_photos')
        .select(
          'id, file_name, description, storage_path, mime_type, area_completion_id, created_at, area_completion:project_area_completions!inner(id, project_id, area_location)'
        )
        .eq('area_completion.project_id', projectId)
        .eq('client_visible', true)
        .not('area_completion_id', 'is', null)
        .order('created_at', { ascending: false }),
    ]);

    let rawProjectData: Record<string, any> | null = null;
    if (isClientView) {
      if (!maskedProjectRes.error && Array.isArray(maskedProjectRes.data) && maskedProjectRes.data.length > 0) {
        rawProjectData = maskedProjectRes.data[0] as Record<string, any>;
      } else {
        // Graceful fallback if Release 1A migration has not been applied to remote Supabase yet
        const fallbackProj = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (fallbackProj.error) throw new Error(fallbackProj.error.message);
        rawProjectData = fallbackProj.data as Record<string, any>;
      }
    } else {
      if (projectRes.error) throw new Error(projectRes.error.message);
      rawProjectData = projectRes.data as Record<string, any>;
    }

    const project = normalizeProjectSummary(rawProjectData);
    let quotations = (quotesRes.data || []) as ClientQuotationContract[];
    let variations = (variationsRes.data || []) as ProjectVariation[];
    let specifications = (specsRes.data || []) as ProjectSpecification[];
    let summaries: ClientWeeklySummary[] = [];

    if (isClientView) {
      if (!summariesRpcRes.error && Array.isArray(summariesRpcRes.data)) {
        summaries = summariesRpcRes.data as ClientWeeklySummary[];
      } else {
        const fallbackSummaries = await supabase
          .from('client_weekly_summaries')
          .select('*')
          .eq('project_id', projectId)
          .order('week_end_date', { ascending: false });
        summaries = (fallbackSummaries.data || []) as ClientWeeklySummary[];
      }
    } else {
      summaries = (summariesFallbackRes.data || []) as ClientWeeklySummary[];
    }

    // Resolve signed URLs for client-visible completion photos linked via area_completion_id
    const rawPhotos = ((photosRes.data || []) as unknown as Array<{
      id: string;
      file_name?: string | null;
      description?: string | null;
      storage_path?: string | null;
      area_completion_id?: string | null;
      created_at: string;
      area_completion?: { id: string; project_id: string; area_location?: string | null } | null;
    }>);

    const verifiedPhotos: VerifiedProjectPhoto[] = (
      await Promise.all(
        rawPhotos.map(async (row) => {
          let resolvedUrl = '';
          const rawPath = row.storage_path || '';
          if (isSafeHttpUrl(rawPath)) {
            resolvedUrl = rawPath;
          } else if (rawPath && !rawPath.startsWith('data:')) {
            const { data: signedData } = await supabase.storage
              .from('job-completion-photos')
              .createSignedUrl(rawPath, 3600);
            if (signedData?.signedUrl && isSafeHttpUrl(signedData.signedUrl)) {
              resolvedUrl = signedData.signedUrl;
            }
          }
          if (!resolvedUrl) return null;
          return {
            id: row.id,
            project_id: row.area_completion?.project_id || projectId,
            file_url: resolvedUrl,
            storage_path: row.storage_path ?? null,
            file_name: row.file_name ?? null,
            title: row.area_completion?.area_location || row.file_name || 'Verified Completion Photo',
            description: row.description ?? null,
            area_completion_id: row.area_completion_id ?? null,
            area_location: row.area_completion?.area_location ?? null,
            created_at: row.created_at,
          } as VerifiedProjectPhoto;
        })
      )
    ).filter((item): item is VerifiedProjectPhoto => item !== null);

    // Defense-in-depth client visibility & subcontract pricing filtering (mirrors RLS)
    if (isClientView) {
      specifications = specifications.filter((s) => s.status !== 'draft');
      summaries = summaries.filter((s) => s.status === 'released');

      const hideSubcontract = access?.hide_subcontract_pricing ?? true;
      const canViewCommercial = access?.can_view_commercial ?? false;
      if (!canViewCommercial) {
        quotations = [];
      } else if (hideSubcontract) {
        quotations = quotations.filter((q) => !q.is_subcontract_confidential);
      }
      if (hideSubcontract) {
        variations = variations.filter((v) => !v.is_subcontract_confidential);
      }
    }

    const canViewFinancials = !isClientView || Boolean(access?.can_view_financials);
    const acceptedContractsTotal = quotations
      .filter((q) => q.status === 'accepted')
      .reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
    const approvedVariationsTotal = variations
      .filter((v) =>
        ['client_approved', 'work_instruction_issued', 'in_execution', 'technically_verified', 'financially_reconciled'].includes(
          v.workflow_stage
        )
      )
      .reduce((sum, v) => sum + Number(v.reconciled_amount ?? v.estimated_cost ?? 0), 0);
    const pendingVariationsTotal = variations
      .filter((v) => ['awaiting_client_approval', 'disputed'].includes(v.workflow_stage) && v.is_chargeable)
      .reduce((sum, v) => sum + Number(v.estimated_cost || 0), 0);

    return {
      project,
      workPackages: (packagesRes.data || []) as ProjectWorkPackage[],
      specifications,
      quotations,
      preworkInspections: (preworkRes.data || []) as PreworkSurfaceInspection[],
      progressUpdates: (progressRes.data || []) as ProjectProgressUpdate[],
      areaCompletions: (completionsRes.data || []) as ProjectAreaCompletion[],
      damageIncidents: (damageRes.data || []) as SubsequentDamageIncident[],
      variations,
      requestsComplaints: (requestsRes.data || []) as ClientRequestComplaint[],
      weeklySummaries: summaries,
      verifiedPhotos,
      financialSummary: {
        permitted: canViewFinancials,
        currency: quotations[0]?.currency || variations[0]?.currency || 'NGN',
        acceptedContractsTotal: canViewFinancials ? acceptedContractsTotal : 0,
        approvedVariationsTotal: canViewFinancials ? approvedVariationsTotal : 0,
        combinedApprovedValue: canViewFinancials ? acceptedContractsTotal + approvedVariationsTotal : 0,
        pendingVariationsTotal: canViewFinancials ? pendingVariationsTotal : 0,
        contractValueReference: canViewFinancials ? Number(project.contract_value || 0) : 0,
      },
    };
  }

  // ----------------------------------------------------------------------------
  // 3. QUOTATIONS, CONTRACTS & B2B CLIENT DOCUMENTS
  // ----------------------------------------------------------------------------
  static async createQuotationContract(payload: {
    project_id: string;
    client_id: string;
    document_type: ClientQuotationContract['document_type'];
    reference_no?: string;
    version_number?: number;
    parent_id?: string | null;
    title: string;
    scope_summary: string;
    specifications_summary?: string;
    exclusions?: string;
    terms_and_conditions?: string;
    payment_terms?: string;
    currency?: string;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    is_subcontract_confidential?: boolean;
    is_b2b_client_issued?: boolean;
    document_storage_path?: string | null;
    document_file_name?: string | null;
    status?: ClientQuotationContract['status'];
    valid_until?: string | null;
    prepared_by?: string | null;
  }): Promise<ClientQuotationContract> {
    const status = payload.status || 'issued';
    const { data, error } = await supabase
      .from('client_quotations_contracts')
      .insert({
        project_id: payload.project_id,
        client_id: payload.client_id,
        document_type: payload.document_type,
        reference_no: payload.reference_no?.trim() || generateReferenceCode(payload.document_type === 'client_purchase_order' ? 'PO' : 'QT'),
        version_number: payload.version_number ?? 1,
        parent_id: payload.parent_id || null,
        title: payload.title.trim(),
        scope_summary: payload.scope_summary.trim(),
        specifications_summary: payload.specifications_summary?.trim() || null,
        exclusions: payload.exclusions?.trim() || null,
        terms_and_conditions: payload.terms_and_conditions?.trim() || null,
        payment_terms: payload.payment_terms?.trim() || null,
        currency: payload.currency || 'NGN',
        subtotal: Number(payload.subtotal || 0),
        tax_amount: Number(payload.tax_amount || 0),
        total_amount: Number(payload.total_amount || 0),
        is_subcontract_confidential: Boolean(payload.is_subcontract_confidential),
        is_b2b_client_issued: Boolean(payload.is_b2b_client_issued),
        document_storage_path: payload.document_storage_path || null,
        document_file_name: payload.document_file_name || null,
        status,
        prepared_by: payload.prepared_by || null,
        issued_at: status === 'issued' ? new Date().toISOString() : null,
        valid_until: payload.valid_until || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.quotation_created',
      module: 'client_portal',
      tableName: 'client_quotations_contracts',
      recordId: data.id,
      newValues: { reference_no: data.reference_no, version_number: data.version_number, total_amount: data.total_amount },
    });

    return data as ClientQuotationContract;
  }

  /**
   * Viewing a quotation ONLY records viewed_at/viewed_by — NEVER constitutes acceptance.
   */
  static async markQuotationViewed(quotationId: string, userId: string): Promise<void> {
    await supabase
      .from('client_quotations_contracts')
      .update({
        viewed_at: new Date().toISOString(),
        viewed_by: userId,
      })
      .eq('id', quotationId)
      .is('viewed_at', null);
  }

  static async respondToQuotation(params: {
    quotationId: string;
    action: 'accepted' | 'declined' | 'clarification_requested' | 'revision_requested';
    userId: string;
    contactId?: string | null;
    decidedByName: string;
    comments?: string;
    confirmedAuthorityStatement?: boolean;
  }): Promise<void> {
    if (params.action === 'accepted' && !params.confirmedAuthorityStatement) {
      throw new Error('Explicit acceptance confirmation is required. Viewing a quotation does not constitute acceptance.');
    }

    const updatePayload: Record<string, unknown> = {
      status: params.action,
      decided_by_user_id: params.userId,
      decided_by_contact_id: params.contactId || null,
      decided_by_name: params.decidedByName,
      decided_at: new Date().toISOString(),
      decision_comments: params.comments?.trim() || null,
      acceptance_evidence: {
        action: params.action,
        recorded_at: new Date().toISOString(),
        explicit_confirmation: Boolean(params.confirmedAuthorityStatement),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'portal',
      },
    };

    const { error } = await supabase
      .from('client_quotations_contracts')
      .update(updatePayload)
      .eq('id', params.quotationId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.quotation_${params.action}`,
      module: 'client_portal',
      tableName: 'client_quotations_contracts',
      recordId: params.quotationId,
      newValues: { decided_by_name: params.decidedByName, comments: params.comments || null },
    });
  }

  static async createQuotationRevision(
    original: ClientQuotationContract,
    updates: {
      title: string;
      scope_summary: string;
      specifications_summary?: string;
      exclusions?: string;
      terms_and_conditions?: string;
      payment_terms?: string;
      subtotal: number;
      tax_amount: number;
      total_amount: number;
      prepared_by?: string | null;
    }
  ): Promise<ClientQuotationContract> {
    const created = await this.createQuotationContract({
      project_id: original.project_id,
      client_id: original.client_id,
      document_type: 'revised_quotation',
      reference_no: original.reference_no,
      version_number: original.version_number + 1,
      parent_id: original.id,
      title: updates.title,
      scope_summary: updates.scope_summary,
      specifications_summary: updates.specifications_summary,
      exclusions: updates.exclusions,
      terms_and_conditions: updates.terms_and_conditions,
      payment_terms: updates.payment_terms,
      currency: original.currency,
      subtotal: updates.subtotal,
      tax_amount: updates.tax_amount,
      total_amount: updates.total_amount,
      is_subcontract_confidential: original.is_subcontract_confidential,
      status: 'issued',
      prepared_by: updates.prepared_by,
    });

    // Mark prior version superseded (allowed by immutability trigger)
    await supabase
      .from('client_quotations_contracts')
      .update({ status: 'superseded' })
      .eq('id', original.id);

    return created;
  }

  // ----------------------------------------------------------------------------
  // 4. WORK PACKAGES & STRUCTURED BRIEF / VERSIONED COLOUR SPECIFICATIONS
  // ----------------------------------------------------------------------------
  static async createWorkPackage(payload: {
    project_id: string;
    package_code?: string;
    title: string;
    scope_type: ProjectWorkPackage['scope_type'];
    floor_level?: string;
    zone_name?: string;
    room_name?: string;
    description?: string;
    exclusions?: string;
    planned_start_date?: string | null;
    planned_end_date?: string | null;
    created_by?: string | null;
  }): Promise<ProjectWorkPackage> {
    const { data, error } = await supabase
      .from('project_work_packages')
      .insert({
        project_id: payload.project_id,
        package_code: payload.package_code?.trim() || generateReferenceCode('WP'),
        title: payload.title.trim(),
        scope_type: payload.scope_type,
        floor_level: payload.floor_level?.trim() || null,
        zone_name: payload.zone_name?.trim() || null,
        room_name: payload.room_name?.trim() || null,
        description: payload.description?.trim() || null,
        exclusions: payload.exclusions?.trim() || null,
        planned_start_date: payload.planned_start_date || null,
        planned_end_date: payload.planned_end_date || null,
        created_by: payload.created_by || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as ProjectWorkPackage;
  }

  static async createSpecification(payload: {
    project_id: string;
    work_package_id?: string | null;
    spec_code?: string;
    version_number?: number;
    parent_id?: string | null;
    area_label: string;
    floor_zone?: string;
    work_category?: string;
    material_product: string;
    manufacturer?: string;
    colour_name?: string;
    colour_code?: string;
    preview_hex?: string;
    finish_type?: string;
    surface_preparation?: string;
    number_of_coats?: number | null;
    quantity?: number | null;
    unit_of_measure?: string;
    approved_sample_ref?: string;
    exclusions?: string;
    technical_notes?: string;
    attachments?: MediaEvidenceItem[];
    status?: ProjectSpecification['status'];
    prepared_by?: string | null;
    prepared_by_name?: string | null;
  }): Promise<ProjectSpecification> {
    const status = payload.status || 'awaiting_approval';
    const { data, error } = await supabase
      .from('project_specifications')
      .insert({
        project_id: payload.project_id,
        work_package_id: payload.work_package_id || null,
        spec_code: payload.spec_code?.trim() || generateReferenceCode('SPEC'),
        version_number: payload.version_number ?? 1,
        parent_id: payload.parent_id || null,
        area_label: payload.area_label.trim(),
        floor_zone: payload.floor_zone?.trim() || null,
        work_category: payload.work_category?.trim() || 'Painting & Interior Finishes',
        material_product: payload.material_product.trim(),
        manufacturer: payload.manufacturer?.trim() || null,
        colour_name: payload.colour_name?.trim() || null,
        colour_code: payload.colour_code?.trim() || null,
        preview_hex: payload.preview_hex?.trim() || null,
        finish_type: payload.finish_type?.trim() || null,
        surface_preparation: payload.surface_preparation?.trim() || null,
        number_of_coats: payload.number_of_coats ?? null,
        quantity: payload.quantity ?? null,
        unit_of_measure: payload.unit_of_measure?.trim() || null,
        approved_sample_ref: payload.approved_sample_ref?.trim() || null,
        exclusions: payload.exclusions?.trim() || null,
        technical_notes: payload.technical_notes?.trim() || null,
        attachments: payload.attachments || [],
        status,
        prepared_by: payload.prepared_by || null,
        prepared_by_name: payload.prepared_by_name || null,
        submitted_at: status !== 'draft' ? new Date().toISOString() : null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.specification_created',
      module: 'client_portal',
      tableName: 'project_specifications',
      recordId: data.id,
      newValues: { spec_code: data.spec_code, version_number: data.version_number, area_label: data.area_label },
    });

    return data as ProjectSpecification;
  }

  static async decideSpecification(params: {
    specId: string;
    decision: 'approved' | 'rejected';
    userId: string;
    contactId?: string | null;
    approverName: string;
    comments?: string;
    parentSpecIdToSupersede?: string | null;
  }): Promise<void> {
    const { error } = await supabase
      .from('project_specifications')
      .update({
        status: params.decision,
        approved_by_user_id: params.userId,
        approved_by_contact_id: params.contactId || null,
        approved_by_name: params.approverName,
        approved_at: new Date().toISOString(),
        approval_comments: params.comments?.trim() || null,
      })
      .eq('id', params.specId);

    if (error) throw new Error(error.message);

    if (params.decision === 'approved' && params.parentSpecIdToSupersede) {
      await supabase
        .from('project_specifications')
        .update({ status: 'superseded' })
        .eq('id', params.parentSpecIdToSupersede);
    }

    await AuditLogger.log({
      action: `client_portal.specification_${params.decision}`,
      module: 'client_portal',
      tableName: 'project_specifications',
      recordId: params.specId,
      newValues: { approver: params.approverName, comments: params.comments || null },
    });
  }

  static async createSpecificationRevision(
    prior: ProjectSpecification,
    updates: {
      material_product: string;
      colour_name?: string;
      colour_code?: string;
      preview_hex?: string;
      finish_type?: string;
      surface_preparation?: string;
      number_of_coats?: number | null;
      technical_notes?: string;
      prepared_by?: string | null;
      prepared_by_name?: string | null;
    }
  ): Promise<ProjectSpecification> {
    return this.createSpecification({
      project_id: prior.project_id,
      work_package_id: prior.work_package_id,
      spec_code: prior.spec_code,
      version_number: prior.version_number + 1,
      parent_id: prior.id,
      area_label: prior.area_label,
      floor_zone: prior.floor_zone || undefined,
      work_category: prior.work_category,
      material_product: updates.material_product,
      manufacturer: prior.manufacturer || undefined,
      colour_name: updates.colour_name,
      colour_code: updates.colour_code,
      preview_hex: updates.preview_hex,
      finish_type: updates.finish_type,
      surface_preparation: updates.surface_preparation,
      number_of_coats: updates.number_of_coats,
      quantity: prior.quantity,
      unit_of_measure: prior.unit_of_measure || undefined,
      approved_sample_ref: prior.approved_sample_ref || undefined,
      exclusions: prior.exclusions || undefined,
      technical_notes: updates.technical_notes,
      status: 'awaiting_approval',
      prepared_by: updates.prepared_by,
      prepared_by_name: updates.prepared_by_name,
    });
  }

  // ----------------------------------------------------------------------------
  // 5. PRE-WORK SURFACE INSPECTIONS (TECHNICAL/QC INTEGRATED)
  // ----------------------------------------------------------------------------
  static async createPreworkInspection(payload: {
    project_id: string;
    work_package_id?: string | null;
    area_label: string;
    inspection_date?: string;
    inspector_id?: string | null;
    inspector_name?: string | null;
    substrate_type?: string;
    substrate_condition: string;
    screeding_plastering_quality?: string;
    has_cracks: boolean;
    has_dampness: boolean;
    has_unevenness: boolean;
    has_damage: boolean;
    defect_details?: string;
    other_contractor_observation?: string;
    recommended_correction?: string;
    scope_responsibility: PreworkSurfaceInspection['scope_responsibility'];
    estimated_cost_impact?: number;
    estimated_time_impact_days?: number;
    evidence_media?: MediaEvidenceItem[];
    clearance_to_proceed?: boolean;
    clearance_notes?: string;
  }): Promise<PreworkSurfaceInspection> {
    const { data, error } = await supabase
      .from('prework_surface_inspections')
      .insert({
        project_id: payload.project_id,
        work_package_id: payload.work_package_id || null,
        inspection_ref: generateReferenceCode('PWI'),
        area_label: payload.area_label.trim(),
        inspection_date: payload.inspection_date || new Date().toISOString().slice(0, 10),
        inspector_id: payload.inspector_id || null,
        inspector_name: payload.inspector_name || null,
        substrate_type: payload.substrate_type?.trim() || null,
        substrate_condition: payload.substrate_condition.trim(),
        screeding_plastering_quality: payload.screeding_plastering_quality?.trim() || null,
        has_cracks: payload.has_cracks,
        has_dampness: payload.has_dampness,
        has_unevenness: payload.has_unevenness,
        has_damage: payload.has_damage,
        defect_details: payload.defect_details?.trim() || null,
        other_contractor_observation: payload.other_contractor_observation?.trim() || null,
        recommended_correction: payload.recommended_correction?.trim() || null,
        scope_responsibility: payload.scope_responsibility,
        estimated_cost_impact: Number(payload.estimated_cost_impact || 0),
        estimated_time_impact_days: Number(payload.estimated_time_impact_days || 0),
        evidence_media: payload.evidence_media || [],
        clearance_to_proceed: Boolean(payload.clearance_to_proceed),
        clearance_notes: payload.clearance_notes?.trim() || null,
        client_visible: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.prework_inspection_created',
      module: 'client_portal',
      tableName: 'prework_surface_inspections',
      recordId: data.id,
      newValues: { inspection_ref: data.inspection_ref, area_label: data.area_label },
    });

    return data as PreworkSurfaceInspection;
  }

  static async recordClientPreworkDecision(params: {
    inspectionId: string;
    decision: PreworkSurfaceInspection['client_decision'];
    notes?: string;
    userId: string;
    deciderName: string;
  }): Promise<void> {
    const clearance =
      params.decision === 'proceed_with_noted_limitations' ? true : params.decision === 'hold_work' ? false : undefined;

    const payload: Record<string, unknown> = {
      client_decision: params.decision,
      client_decision_notes: params.notes?.trim() || null,
      client_decided_by: params.userId,
      client_decided_by_name: params.deciderName,
      client_decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (clearance !== undefined) {
      payload.clearance_to_proceed = clearance;
    }

    const { error } = await supabase.from('prework_surface_inspections').update(payload).eq('id', params.inspectionId);
    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.prework_client_decision',
      module: 'client_portal',
      tableName: 'prework_surface_inspections',
      recordId: params.inspectionId,
      newValues: { decision: params.decision, decider: params.deciderName },
    });
  }

  static async togglePreworkClearance(inspectionId: string, cleared: boolean, notes?: string): Promise<void> {
    const { error } = await supabase
      .from('prework_surface_inspections')
      .update({
        clearance_to_proceed: cleared,
        clearance_notes: notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inspectionId);

    if (error) throw new Error(error.message);
  }

  // ----------------------------------------------------------------------------
  // 6. 5-STAGE VERIFIED PROJECT PROGRESS
  // ----------------------------------------------------------------------------
  static async createProgressUpdate(payload: {
    project_id: string;
    work_package_id?: string | null;
    title: string;
    stage_name?: string;
    activity_type: ProjectProgressUpdate['activity_type'];
    planned_date?: string | null;
    actual_date?: string | null;
    progress_percent: number;
    summary: string;
    delay_reason?: string;
    technical_concern?: string;
    media_items?: MediaEvidenceItem[];
    reported_by?: string | null;
    reported_by_name?: string | null;
  }): Promise<ProjectProgressUpdate> {
    const { data, error } = await supabase
      .from('project_progress_updates')
      .insert({
        project_id: payload.project_id,
        work_package_id: payload.work_package_id || null,
        title: payload.title.trim(),
        stage_name: payload.stage_name?.trim() || null,
        activity_type: payload.activity_type,
        verification_stage: 'reported_by_supervisor',
        planned_date: payload.planned_date || null,
        actual_date: payload.actual_date || null,
        progress_percent: Math.max(0, Math.min(100, Number(payload.progress_percent || 0))),
        summary: payload.summary.trim(),
        delay_reason: payload.delay_reason?.trim() || null,
        technical_concern: payload.technical_concern?.trim() || null,
        media_items: payload.media_items || [],
        reported_by: payload.reported_by || null,
        reported_by_name: payload.reported_by_name || null,
        client_visible: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as ProjectProgressUpdate;
  }

  static async advanceProgressVerificationStage(params: {
    updateId: string;
    nextStage: ProgressVerificationStage;
    actorUserId: string;
    actorName: string;
    comments?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      verification_stage: params.nextStage,
      updated_at: now,
    };

    if (params.nextStage === 'inspected_by_qc') {
      patch.inspected_by = params.actorUserId;
      patch.inspected_by_name = params.actorName;
      patch.inspected_at = now;
    } else if (params.nextStage === 'verified_completed') {
      patch.verified_by = params.actorUserId;
      patch.verified_by_name = params.actorName;
      patch.verified_at = now;
    } else if (params.nextStage === 'acknowledged_by_client') {
      patch.acknowledged_by = params.actorUserId;
      patch.acknowledged_by_name = params.actorName;
      patch.acknowledged_at = now;
      patch.acknowledgement_comments = params.comments?.trim() || null;
    } else if (params.nextStage === 'formally_handed_over') {
      patch.handed_over_at = now;
    }

    const { error } = await supabase.from('project_progress_updates').update(patch).eq('id', params.updateId);
    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.progress_${params.nextStage}`,
      module: 'client_portal',
      tableName: 'project_progress_updates',
      recordId: params.updateId,
      newValues: { actor: params.actorName },
    });
  }

  // ----------------------------------------------------------------------------
  // 7. AREA COMPLETION, CONDITION EVIDENCE & AREA RELEASE (MANDATORY CORE)
  // ----------------------------------------------------------------------------
  static async createAreaCompletion(payload: {
    project_id: string;
    work_package_id?: string | null;
    specification_id?: string | null;
    specification_version?: number | null;
    area_location: string;
    work_performed: string;
    quantity_completed?: number | null;
    unit_of_measure?: string;
    completion_date?: string;
    site_supervisor_id?: string | null;
    site_supervisor_name?: string | null;
    assigned_team_summary?: string;
    completion_photos?: MediaEvidenceItem[];
    completion_videos?: MediaEvidenceItem[];
  }): Promise<ProjectAreaCompletion> {
    const { data, error } = await supabase
      .from('project_area_completions')
      .insert({
        project_id: payload.project_id,
        work_package_id: payload.work_package_id || null,
        specification_id: payload.specification_id || null,
        specification_version: payload.specification_version ?? null,
        completion_ref: generateReferenceCode('ACR'),
        area_location: payload.area_location.trim(),
        work_performed: payload.work_performed.trim(),
        quantity_completed: payload.quantity_completed ?? null,
        unit_of_measure: payload.unit_of_measure?.trim() || null,
        completion_date: payload.completion_date || new Date().toISOString().slice(0, 10),
        site_supervisor_id: payload.site_supervisor_id || null,
        site_supervisor_name: payload.site_supervisor_name || null,
        assigned_team_summary: payload.assigned_team_summary?.trim() || null,
        completion_photos: payload.completion_photos || [],
        completion_videos: payload.completion_videos || [],
        workflow_status: 'ready_for_qc',
        qc_outcome: 'pending',
        qc_snag_status: 'none',
        client_acknowledgement_status: 'not_submitted',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.area_completion_created',
      module: 'client_portal',
      tableName: 'project_area_completions',
      recordId: data.id,
      newValues: { completion_ref: data.completion_ref, area_location: data.area_location },
    });

    return data as ProjectAreaCompletion;
  }

  static async verifyAreaCompletionQC(params: {
    completion: ProjectAreaCompletion;
    outcome: 'pass' | 'conditional_pass' | 'fail';
    qcNotes: string;
    inspectorId: string;
    inspectorName: string;
  }): Promise<void> {
    let linkedSnagTaskId: string | null = params.completion.linked_snag_task_id || null;

    // On QC fail, auto-create a snag task in existing project_tasks table
    if (params.outcome === 'fail') {
      const { data: snagTask } = await supabase
        .from('project_tasks')
        .insert({
          project_id: params.completion.project_id,
          title: `[QC SNAG] ${params.completion.area_location} (${params.completion.completion_ref})`,
          description: `QC inspection failed for area completion ${params.completion.completion_ref}. Notes: ${params.qcNotes}`,
          status: 'pending',
          priority: 'high',
        })
        .select('id')
        .maybeSingle();

      if (snagTask?.id) {
        linkedSnagTaskId = snagTask.id;
      }
    }

    const workflowStatus: AreaCompletionWorkflowStatus =
      params.outcome === 'pass'
        ? 'qc_verified'
        : params.outcome === 'conditional_pass'
          ? 'qc_conditional_pass'
          : 'qc_failed_snag';

    const { error } = await supabase
      .from('project_area_completions')
      .update({
        qc_inspector_id: params.inspectorId,
        qc_inspector_name: params.inspectorName,
        qc_outcome: params.outcome,
        qc_snag_status: params.outcome === 'fail' ? 'open_snags' : params.outcome === 'conditional_pass' ? 'open_snags' : 'snags_cleared',
        qc_notes: params.qcNotes.trim(),
        qc_verified_at: new Date().toISOString(),
        linked_snag_task_id: linkedSnagTaskId,
        workflow_status: workflowStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.completion.id);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.area_qc_${params.outcome}`,
      module: 'client_portal',
      tableName: 'project_area_completions',
      recordId: params.completion.id,
      newValues: { outcome: params.outcome, inspector: params.inspectorName, linked_snag_task_id: linkedSnagTaskId },
    });
  }

  static async submitAreaForClientAcknowledgement(completionId: string): Promise<void> {
    const { error } = await supabase
      .from('project_area_completions')
      .update({
        workflow_status: 'submitted_for_acknowledgement',
        client_acknowledgement_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', completionId);

    if (error) throw new Error(error.message);
  }

  static async clientAcknowledgeAreaCompletion(params: {
    completionId: string;
    decision: 'acknowledged' | 'rejected';
    userId: string;
    acknowledgerName: string;
    comments?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('project_area_completions')
      .update({
        client_acknowledgement_status: params.decision,
        client_acknowledged_by: params.userId,
        client_acknowledged_by_name: params.acknowledgerName,
        client_acknowledged_at: new Date().toISOString(),
        client_comments: params.comments?.trim() || null,
        workflow_status: params.decision === 'acknowledged' ? 'client_acknowledged' : 'client_rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.completionId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.area_${params.decision}`,
      module: 'client_portal',
      tableName: 'project_area_completions',
      recordId: params.completionId,
      newValues: { by: params.acknowledgerName, comments: params.comments || null },
    });
  }

  static async releaseAreaForSubsequentTrades(params: {
    completionId: string;
    conditionAtRelease: string;
    outstandingSnags?: string;
    receivingRepresentative: string;
    protectionMeasures?: string;
    coordinationNotes?: string;
    formalHandoverOccurred: boolean;
    releasedByUserId: string;
    releasedByName: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('project_area_completions')
      .update({
        area_released: true,
        release_label: AREA_RELEASE_STANDARD_LABEL,
        condition_at_release: params.conditionAtRelease.trim(),
        outstanding_snags_at_release: params.outstandingSnags?.trim() || 'None recorded',
        receiving_representative: params.receivingRepresentative.trim(),
        protection_measures: params.protectionMeasures?.trim() || null,
        coordination_notes: params.coordinationNotes?.trim() || null,
        released_by: params.releasedByUserId,
        released_by_name: params.releasedByName,
        released_at: now,
        formal_handover_occurred: params.formalHandoverOccurred,
        formal_handover_at: params.formalHandoverOccurred ? now : null,
        workflow_status: params.formalHandoverOccurred ? 'formally_handed_over' : 'released_for_subsequent_trades',
        updated_at: now,
      })
      .eq('id', params.completionId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.area_released_for_subsequent_trades',
      module: 'client_portal',
      tableName: 'project_area_completions',
      recordId: params.completionId,
      newValues: {
        release_label: AREA_RELEASE_STANDARD_LABEL,
        receiving_representative: params.receivingRepresentative,
        formal_handover_occurred: params.formalHandoverOccurred,
      },
    });
  }

  // ----------------------------------------------------------------------------
  // 8. SUBSEQUENT DAMAGE / REWORK INCIDENTS
  // ----------------------------------------------------------------------------
  static async createSubsequentDamageIncident(payload: {
    project_id: string;
    area_completion_id: string;
    discovered_date: string;
    area_location: string;
    description: string;
    known_or_suspected_cause?: string;
    relevant_contractors_activities?: string;
    damage_media?: MediaEvidenceItem[];
    reported_by?: string | null;
    reported_by_name?: string | null;
    rework_classification: ReworkClassification;
    proposed_correction?: string;
    estimated_cost_impact?: number;
    estimated_time_impact_days?: number;
  }): Promise<SubsequentDamageIncident> {
    if (!payload.area_completion_id) {
      throw new Error('A subsequent damage incident must reference an existing Area Completion Record.');
    }

    const { data, error } = await supabase
      .from('subsequent_damage_incidents')
      .insert({
        incident_ref: generateReferenceCode('SDI'),
        project_id: payload.project_id,
        area_completion_id: payload.area_completion_id,
        discovered_date: payload.discovered_date,
        area_location: payload.area_location.trim(),
        description: payload.description.trim(),
        known_or_suspected_cause: payload.known_or_suspected_cause?.trim() || null,
        relevant_contractors_activities: payload.relevant_contractors_activities?.trim() || null,
        damage_media: payload.damage_media || [],
        reported_by: payload.reported_by || null,
        reported_by_name: payload.reported_by_name || null,
        rework_classification: payload.rework_classification,
        liability_status: 'under_assessment',
        is_chargeable: false, // Never auto-charged without assessment & governance approval
        proposed_correction: payload.proposed_correction?.trim() || null,
        estimated_cost_impact: Number(payload.estimated_cost_impact || 0),
        estimated_time_impact_days: Number(payload.estimated_time_impact_days || 0),
        resolution_status: 'open',
        client_visible: true,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.subsequent_damage_logged',
      module: 'client_portal',
      tableName: 'subsequent_damage_incidents',
      recordId: data.id,
      newValues: {
        incident_ref: data.incident_ref,
        area_completion_id: payload.area_completion_id,
        classification: payload.rework_classification,
      },
    });

    return data as SubsequentDamageIncident;
  }

  static async updateSubsequentDamageAssessment(params: {
    incidentId: string;
    technical_assessment: string;
    proposed_correction: string;
    rework_classification: ReworkClassification;
    liability_status: SubsequentDamageIncident['liability_status'];
    is_chargeable: boolean;
    estimated_cost_impact: number;
    estimated_time_impact_days: number;
    notified_party?: string;
    resolution_status: SubsequentDamageIncident['resolution_status'];
    resolution_notes?: string;
    assessedByUserId: string;
    assessedByName: string;
  }): Promise<void> {
    if (params.rework_classification === 'davejoe_workmanship_defect' && params.is_chargeable) {
      throw new Error('Davejoe workmanship defects cannot be marked chargeable to the client.');
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('subsequent_damage_incidents')
      .update({
        technical_assessment: params.technical_assessment.trim(),
        proposed_correction: params.proposed_correction.trim(),
        rework_classification: params.rework_classification,
        liability_status: params.liability_status,
        is_chargeable: params.rework_classification === 'davejoe_workmanship_defect' ? false : params.is_chargeable,
        estimated_cost_impact: Number(params.estimated_cost_impact || 0),
        estimated_time_impact_days: Number(params.estimated_time_impact_days || 0),
        notified_party: params.notified_party?.trim() || null,
        notified_at: params.notified_party?.trim() ? now : undefined,
        resolution_status: params.resolution_status,
        resolution_notes: params.resolution_notes?.trim() || null,
        resolved_at: params.resolution_status === 'resolved' || params.resolution_status === 'closed' ? now : null,
        assessed_by: params.assessedByUserId,
        assessed_by_name: params.assessedByName,
        assessed_at: now,
      })
      .eq('id', params.incidentId);

    if (error) throw new Error(error.message);
  }

  static async recordExternalDamageResponse(params: {
    incidentId: string;
    responseText: string;
    userId: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('subsequent_damage_incidents')
      .update({
        external_response: params.responseText.trim(),
        external_responded_by: params.userId,
        external_responded_at: new Date().toISOString(),
      })
      .eq('id', params.incidentId);

    if (error) throw new Error(error.message);
  }

  // ----------------------------------------------------------------------------
  // 9. 10-STAGE VARIATIONS & REWORK APPROVALS
  // ----------------------------------------------------------------------------
  static async createVariation(payload: {
    project_id: string;
    work_package_id?: string | null;
    source_damage_incident_id?: string | null;
    source_request_id?: string | null;
    title: string;
    rework_classification: ReworkClassification;
    original_spec_summary: string;
    revised_spec_summary: string;
    scope_and_quantity_notes?: string;
    is_chargeable: boolean;
    estimated_cost: number;
    currency?: string;
    time_impact_days?: number;
    contract_variation_type?: ProjectVariation['contract_variation_type'];
    is_subcontract_confidential?: boolean;
    requested_by?: string | null;
    requested_by_name?: string | null;
  }): Promise<ProjectVariation> {
    if (payload.rework_classification === 'davejoe_workmanship_defect' && payload.is_chargeable) {
      throw new Error('Davejoe workmanship defects cannot be created as chargeable client variations.');
    }

    const { data, error } = await supabase
      .from('project_variations')
      .insert({
        variation_ref: generateReferenceCode('VAR'),
        project_id: payload.project_id,
        work_package_id: payload.work_package_id || null,
        source_damage_incident_id: payload.source_damage_incident_id || null,
        source_request_id: payload.source_request_id || null,
        title: payload.title.trim(),
        rework_classification: payload.rework_classification,
        original_spec_summary: payload.original_spec_summary.trim(),
        revised_spec_summary: payload.revised_spec_summary.trim(),
        scope_and_quantity_notes: payload.scope_and_quantity_notes?.trim() || null,
        is_chargeable: payload.rework_classification === 'davejoe_workmanship_defect' ? false : payload.is_chargeable,
        estimated_cost: Number(payload.estimated_cost || 0),
        currency: payload.currency || 'NGN',
        time_impact_days: Number(payload.time_impact_days || 0),
        contract_variation_type: payload.contract_variation_type || 'standard',
        workflow_stage: 'request_received',
        is_subcontract_confidential: Boolean(payload.is_subcontract_confidential),
        requested_by: payload.requested_by || null,
        requested_by_name: payload.requested_by_name || null,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    // Link back to subsequent damage incident if applicable
    if (payload.source_damage_incident_id) {
      await supabase
        .from('subsequent_damage_incidents')
        .update({ linked_variation_id: data.id })
        .eq('id', payload.source_damage_incident_id);
    }

    await AuditLogger.log({
      action: 'client_portal.variation_created',
      module: 'client_portal',
      tableName: 'project_variations',
      recordId: data.id,
      newValues: { variation_ref: data.variation_ref, classification: data.rework_classification, cost: data.estimated_cost },
    });

    return data as ProjectVariation;
  }

  static async advanceVariationStage(params: {
    variationId: string;
    nextStage: VariationWorkflowStage;
    actorUserId: string;
    actorName: string;
    notes?: string;
    reconciledAmount?: number;
  }): Promise<void> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      workflow_stage: params.nextStage,
      updated_at: now,
    };

    if (params.nextStage === 'technical_assessment') {
      patch.technical_assessor_id = params.actorUserId;
      if (params.notes) patch.technical_assessment_notes = params.notes.trim();
    } else if (params.nextStage === 'internal_commercial_approved') {
      patch.internal_approved_by = params.actorUserId;
      patch.internal_approved_by_name = params.actorName;
      patch.internal_approved_at = now;
    } else if (params.nextStage === 'work_instruction_issued') {
      if (params.notes) patch.revised_instruction_notes = params.notes.trim();
    } else if (params.nextStage === 'technically_verified') {
      patch.verified_by = params.actorUserId;
      patch.verified_at = now;
    } else if (params.nextStage === 'financially_reconciled') {
      if (params.reconciledAmount !== undefined) patch.reconciled_amount = params.reconciledAmount;
      patch.reconciled_at = now;
    }

    const { error } = await supabase.from('project_variations').update(patch).eq('id', params.variationId);
    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.variation_${params.nextStage}`,
      module: 'client_portal',
      tableName: 'project_variations',
      recordId: params.variationId,
      newValues: { actor: params.actorName, notes: params.notes || null },
    });
  }

  static async clientDecideVariation(params: {
    variationId: string;
    decision: 'client_approved' | 'client_rejected' | 'disputed';
    userId: string;
    deciderName: string;
    notes?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('project_variations')
      .update({
        workflow_stage: params.decision,
        client_decided_by: params.userId,
        client_decided_by_name: params.deciderName,
        client_decided_at: new Date().toISOString(),
        client_decision_notes: params.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.variationId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.variation_${params.decision}`,
      module: 'client_portal',
      tableName: 'project_variations',
      recordId: params.variationId,
      newValues: { decider: params.deciderName, notes: params.notes || null },
    });
  }

  // ----------------------------------------------------------------------------
  // 10. CLIENT REQUEST CENTRE & COMPLAINT CENTRE (CONFIDENTIAL ESCALATION)
  // ----------------------------------------------------------------------------
  static async createRequestOrComplaint(payload: {
    record_kind: 'request' | 'complaint';
    project_id: string;
    client_id: string;
    category: string;
    subject: string;
    description: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    attachments?: MediaEvidenceItem[];
    submitted_by_user_id: string;
    submitted_by_contact_id?: string | null;
    submitted_by_name: string;
    is_confidential_management?: boolean;
    subject_user_id?: string | null;
  }): Promise<ClientRequestComplaint> {
    const prefix = payload.record_kind === 'complaint' ? 'CMP' : 'REQ';
    const { data, error } = await supabase
      .from('client_requests_complaints')
      .insert({
        reference_no: generateReferenceCode(prefix),
        record_kind: payload.record_kind,
        project_id: payload.project_id,
        client_id: payload.client_id,
        category: payload.category,
        subject: payload.subject.trim(),
        description: payload.description.trim(),
        priority: payload.priority,
        attachments: payload.attachments || [],
        submitted_by_user_id: payload.submitted_by_user_id,
        submitted_by_contact_id: payload.submitted_by_contact_id || null,
        submitted_by_name: payload.submitted_by_name,
        is_confidential_management: Boolean(payload.record_kind === 'complaint' && payload.is_confidential_management),
        subject_user_id: payload.subject_user_id || null,
        status: 'open',
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: payload.is_confidential_management
        ? 'client_portal.confidential_complaint_submitted'
        : `client_portal.${payload.record_kind}_submitted`,
      module: 'client_portal',
      tableName: 'client_requests_complaints',
      recordId: data.id,
      newValues: { reference_no: data.reference_no, category: data.category, confidential: data.is_confidential_management },
    });

    return data as ClientRequestComplaint;
  }

  static async updateRequestComplaintStatus(params: {
    recordId: string;
    status: ClientRequestComplaint['status'];
    internal_notes?: string;
    resolution_summary?: string;
    actorUserId: string;
    actorName: string;
  }): Promise<void> {
    const isResolved = params.status === 'resolved' || params.status === 'closed';
    const { error } = await supabase
      .from('client_requests_complaints')
      .update({
        status: params.status,
        internal_notes: params.internal_notes?.trim() || undefined,
        resolution_summary: params.resolution_summary?.trim() || undefined,
        resolved_by: isResolved ? params.actorUserId : undefined,
        resolved_by_name: isResolved ? params.actorName : undefined,
        resolved_at: isResolved ? new Date().toISOString() : undefined,
      })
      .eq('id', params.recordId);

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.ticket_${params.status}`,
      module: 'client_portal',
      tableName: 'client_requests_complaints',
      recordId: params.recordId,
      newValues: { actor: params.actorName, status: params.status },
    });
  }

  // ----------------------------------------------------------------------------
  // 11. WEEKLY REMOTE CLIENT PROJECT SUMMARIES (FROM LIVE DB DATA, REVIEWED BEFORE RELEASE)
  // ----------------------------------------------------------------------------
  static async generateDraftWeeklySummary(params: {
    projectId: string;
    weekStartDate: string;
    weekEndDate: string;
    summaryTitle: string;
    executiveNotes?: string;
    upcomingActivities?: string;
    pendingClientDecisions?: string;
    preparedByUserId: string;
    preparedByName: string;
  }): Promise<ClientWeeklySummary> {
    // Pull actual recorded data from live tables — zero mock numbers
    // Exclude subcontract-confidential items from client-facing weekly summary snapshots
    const bundle = await this.getProjectPortalBundle(params.projectId, { isClientView: false });
    const isSubcontractProject =
      bundle.project.project_delivery_model === 'main_contractor_subcontract' ||
      bundle.project.project_delivery_model === 'multi_party_commercial';

    const nonConfidentialApprovedVariationsTotal = bundle.variations
      .filter(
        (v) =>
          !v.is_subcontract_confidential &&
          ['client_approved', 'work_instruction_issued', 'in_execution', 'technically_verified', 'financially_reconciled'].includes(
            v.workflow_stage
          )
      )
      .reduce((sum, v) => sum + Number(v.reconciled_amount ?? v.estimated_cost ?? 0), 0);

    const snapshot: ClientWeeklySummary['snapshot_data'] = {
      verified_progress_pct: Number(bundle.project.verified_progress_pct || 0),
      areas_qc_verified: bundle.areaCompletions.filter((a) =>
        ['qc_verified', 'submitted_for_acknowledgement', 'client_acknowledged', 'released_for_subsequent_trades', 'formally_handed_over'].includes(
          a.workflow_status
        )
      ).length,
      areas_client_acknowledged: bundle.areaCompletions.filter((a) => a.client_acknowledgement_status === 'acknowledged').length,
      areas_released: bundle.areaCompletions.filter((a) => a.area_released).length,
      pending_spec_approvals: bundle.specifications.filter((s) => s.status === 'awaiting_approval' || s.status === 'submitted').length,
      pending_quotation_approvals: bundle.quotations.filter((q) => q.status === 'issued' && !q.is_subcontract_confidential).length,
      pending_variation_approvals: bundle.variations.filter(
        (v) => v.workflow_stage === 'awaiting_client_approval' && !v.is_subcontract_confidential
      ).length,
      open_prework_concerns: bundle.preworkInspections.filter((p) => !p.clearance_to_proceed).length,
      open_damage_incidents: bundle.damageIncidents.filter((d) => d.resolution_status !== 'resolved' && d.resolution_status !== 'closed').length,
      open_requests: bundle.requestsComplaints.filter(
        (r) => !r.is_confidential_management && r.status !== 'resolved' && r.status !== 'closed'
      ).length,
      ...(isSubcontractProject ? {} : { approved_variations_total: nonConfidentialApprovedVariationsTotal }),
    };

    const { data, error } = await supabase
      .from('client_weekly_summaries')
      .insert({
        project_id: params.projectId,
        week_start_date: params.weekStartDate,
        week_end_date: params.weekEndDate,
        summary_title: params.summaryTitle.trim(),
        snapshot_data: snapshot,
        executive_notes: params.executiveNotes?.trim() || null,
        upcoming_activities: params.upcomingActivities?.trim() || null,
        pending_client_decisions: params.pendingClientDecisions?.trim() || null,
        status: 'draft',
        prepared_by: params.preparedByUserId,
        prepared_by_name: params.preparedByName,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: 'client_portal.weekly_summary_drafted',
      module: 'client_portal',
      tableName: 'client_weekly_summaries',
      recordId: data.id,
      newValues: { project_id: params.projectId, title: data.summary_title },
    });

    return data as ClientWeeklySummary;
  }

  static async reviewOrReleaseWeeklySummary(params: {
    summaryId: string;
    nextStatus: 'reviewed' | 'released';
    actorUserId: string;
    actorName: string;
    executiveNotes?: string;
    upcomingActivities?: string;
    pendingClientDecisions?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: params.nextStatus,
      updated_at: now,
    };
    if (params.executiveNotes !== undefined) patch.executive_notes = params.executiveNotes.trim();
    if (params.upcomingActivities !== undefined) patch.upcoming_activities = params.upcomingActivities.trim();
    if (params.pendingClientDecisions !== undefined) patch.pending_client_decisions = params.pendingClientDecisions.trim();

    if (params.nextStatus === 'reviewed') {
      patch.reviewed_by = params.actorUserId;
      patch.reviewed_by_name = params.actorName;
      patch.reviewed_at = now;
    } else {
      patch.released_by = params.actorUserId;
      patch.released_by_name = params.actorName;
      patch.released_at = now;
    }

    const { error } = await supabase.from('client_weekly_summaries').update(patch).eq('id', params.summaryId);
    if (error) throw new Error(error.message);

    await AuditLogger.log({
      action: `client_portal.weekly_summary_${params.nextStatus}`,
      module: 'client_portal',
      tableName: 'client_weekly_summaries',
      recordId: params.summaryId,
      newValues: { actor: params.actorName },
    });
  }
}
