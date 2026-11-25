import { supabase } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';
import {
  ClientAccount,
  ClientContact,
  ClientProjectAccess,
  PartyRole,
} from './clientPortalService';

// ==============================================================================
// TYPES — PHASE 2 MILESTONE 1 (WORKSTREAM B): CORPORATE AUTHORITY & PORTFOLIOS
// ==============================================================================

export type CorporateTier =
  | 'standard'
  | 'enterprise'
  | 'institutional'
  | 'government'
  | 'developer_group'
  | 'main_contractor_partner';

export interface CorporateClientProfile extends ClientAccount {
  industry_sector?: string | null;
  tax_id?: string | null;
  parent_organization?: string | null;
  corporate_tier?: CorporateTier | null;
  headquarters_address?: string | null;
  default_currency?: string | null;
  portfolio_notes?: string | null;
  governance_policy_notes?: string | null;
  project_count?: number;
  contact_count?: number;
}

export interface CorporateContactAuthority extends ClientContact {
  department?: string | null;
  authority_level: number;
  is_authorized_signatory: boolean;
  corporate_portfolio_access: boolean;
  can_delegate_authority: boolean;
  quotation_approval_limit?: number | null;
  variation_approval_limit?: number | null;
  payment_approval_limit?: number | null;
  approval_currency: string;
}

export interface ProjectAccessAuthority extends ClientProjectAccess {
  access_scope: 'project' | 'corporate_portfolio';
  authority_level: number;
  is_authorized_signatory: boolean;
  quotation_approval_limit?: number | null;
  variation_approval_limit?: number | null;
  payment_approval_limit?: number | null;
  approval_currency: string;
  delegated_from_contact_id?: string | null;
}

export interface DelegatedAuthoritiesPayload {
  can_approve_quotations?: boolean;
  can_approve_specifications?: boolean;
  can_approve_variations?: boolean;
  can_acknowledge_completions?: boolean;
  can_approve_payments?: boolean;
}

export interface ClientAuthorityDelegation {
  id: string;
  client_id: string;
  project_id?: string | null;
  delegator_contact_id: string;
  delegate_contact_id: string;
  delegated_authorities: DelegatedAuthoritiesPayload;
  max_approval_limit?: number | null;
  currency: string;
  reason: string;
  starts_at: string;
  ends_at: string;
  status: 'active' | 'revoked' | 'expired';
  created_by?: string | null;
  revoked_by?: string | null;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  created_at: string;
  delegator?: { id: string; full_name: string; email: string; designation?: string | null };
  delegate?: { id: string; full_name: string; email: string; designation?: string | null };
  project?: { id: string; project_code: string; name: string } | null;
}

export interface ClientAuthorityAuditLog {
  id: string;
  client_id: string;
  project_id?: string | null;
  client_contact_id?: string | null;
  delegation_id?: string | null;
  event_type: string;
  actor_user_id?: string | null;
  actor_name?: string | null;
  previous_state?: Record<string, unknown> | null;
  new_state?: Record<string, unknown> | null;
  reason?: string | null;
  created_at: string;
}

export interface CorporatePortfolioProjectRow {
  id: string;
  project_code: string;
  name: string;
  client_id?: string | null;
  client_name?: string | null;
  client_account_type?: string | null;
  status: string;
  location?: string | null;
  currency: string;
  contract_value?: number | null;
  can_view_financials: boolean;
  start_date?: string | null;
  expected_completion_date?: string | null;
  project_delivery_model?: string | null;
  client_visible_stage?: string | null;
  verified_progress_pct: number;
  total_work_packages: number;
  completed_work_packages: number;
  active_blockers: number;
  pending_quotations: number;
  pending_specs: number;
  pending_variations: number;
  pending_completions: number;
  open_tickets: number;
}

export interface CorporatePortfolioSummary {
  project_count: number;
  average_verified_progress: number;
  total_contract_value: number;
  total_work_packages: number;
  completed_work_packages: number;
  active_blockers: number;
  total_pending_approvals: number;
  open_tickets: number;
  projects: CorporatePortfolioProjectRow[];
  migrationPending?: boolean;
}

export interface EffectiveAuthorityEvaluation {
  authorityLevel: number;
  isAuthorizedSignatory: boolean;
  corporatePortfolioAccess: boolean;
  canDelegateAuthority: boolean;
  currency: string;
  canApproveQuotations: boolean;
  quotationLimit: number | null; // null = unlimited when permitted
  canApproveSpecifications: boolean;
  canApproveVariations: boolean;
  variationLimit: number | null;
  canAcknowledgeCompletions: boolean;
  canApprovePayments: boolean;
  paymentLimit: number | null;
  activeDelegationsReceived: ClientAuthorityDelegation[];
}

export const AUTHORITY_LEVEL_LABELS: Record<number, string> = {
  1: 'Level 1 · Observer / Coordinator',
  2: 'Level 2 · Site / Technical Representative',
  3: 'Level 3 · Department Manager / QS',
  4: 'Level 4 · Commercial / Finance Approver',
  5: 'Level 5 · Authorized Corporate Signatory',
};

export const CORPORATE_TIER_LABELS: Record<CorporateTier, string> = {
  standard: 'Standard Client',
  enterprise: 'Enterprise Corporate',
  institutional: 'Institutional Organization',
  government: 'Public / Government Institution',
  developer_group: 'Real Estate / Developer Group',
  main_contractor_partner: 'Main Contractor Partner',
};

export const AUTHORITY_EVENT_LABELS: Record<string, string> = {
  contact_created: 'Contact Registered',
  contact_authority_updated: 'Contact Authority Updated',
  project_access_granted: 'Project Access Granted',
  project_access_revoked: 'Project Access Revoked',
  project_authority_updated: 'Project Authority Updated',
  delegation_created: 'Approval Delegation Issued',
  delegation_revoked: 'Approval Delegation Revoked',
  delegation_updated: 'Approval Delegation Updated',
};

function isMissingSchemaError(err: any): boolean {
  const msg = String(err?.message || err?.details || '').toLowerCase();
  const code = String(err?.code || '');
  return (
    code === '42P01' ||
    code === '42703' ||
    code === '42883' ||
    code === 'PGRST202' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the function') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function parseOptionalLimit(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeContact(raw: any): CorporateContactAuthority {
  return {
    id: raw.id,
    client_id: raw.client_id,
    user_id: raw.user_id ?? null,
    full_name: raw.full_name,
    email: raw.email,
    phone: raw.phone ?? null,
    designation: raw.designation ?? null,
    organization_name: raw.organization_name ?? null,
    party_role: raw.party_role as PartyRole,
    timezone: raw.timezone ?? null,
    is_primary_contact: Boolean(raw.is_primary_contact),
    is_active: raw.is_active !== false,
    created_at: raw.created_at,
    department: raw.department ?? null,
    authority_level: Number(raw.authority_level ?? 1),
    is_authorized_signatory: Boolean(raw.is_authorized_signatory),
    corporate_portfolio_access: Boolean(raw.corporate_portfolio_access),
    can_delegate_authority: Boolean(raw.can_delegate_authority),
    quotation_approval_limit: parseOptionalLimit(raw.quotation_approval_limit),
    variation_approval_limit: parseOptionalLimit(raw.variation_approval_limit),
    payment_approval_limit: parseOptionalLimit(raw.payment_approval_limit),
    approval_currency: raw.approval_currency || 'NGN',
  };
}

// ==============================================================================
// SERVICE IMPLEMENTATION
// ==============================================================================

export class CorporateAuthorityService {
  static async listCorporateClients(): Promise<CorporateClientProfile[]> {
    const [clientsRes, projectsRes, contactsRes] = await Promise.all([
      supabase.from('clients').select('*').order('name', { ascending: true }),
      supabase.from('projects').select('id, client_id'),
      supabase.from('client_contacts').select('id, client_id, is_active'),
    ]);

    if (clientsRes.error) throw new Error(clientsRes.error.message);

    const projectCountByClient: Record<string, number> = {};
    for (const p of projectsRes.data || []) {
      if (p.client_id) {
        projectCountByClient[p.client_id] = (projectCountByClient[p.client_id] || 0) + 1;
      }
    }

    const contactCountByClient: Record<string, number> = {};
    for (const c of contactsRes.data || []) {
      if (c.client_id && c.is_active !== false) {
        contactCountByClient[c.client_id] = (contactCountByClient[c.client_id] || 0) + 1;
      }
    }

    return (clientsRes.data || []).map((c: any) => ({
      ...c,
      account_type: c.account_type || 'individual',
      portal_enabled: c.portal_enabled !== false,
      default_currency: c.default_currency || 'NGN',
      corporate_tier: c.corporate_tier || 'standard',
      project_count: projectCountByClient[c.id] || 0,
      contact_count: contactCountByClient[c.id] || 0,
    }));
  }

  static async updateCorporateProfile(
    clientId: string,
    payload: Partial<{
      company_name: string | null;
      account_type: ClientAccount['account_type'];
      rc_number: string | null;
      tax_id: string | null;
      industry_sector: string | null;
      parent_organization: string | null;
      corporate_tier: CorporateTier;
      headquarters_address: string | null;
      billing_address: string | null;
      default_currency: string;
      portfolio_notes: string | null;
      governance_policy_notes: string | null;
      portal_enabled: boolean;
    }>
  ): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', clientId);

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(
          'Run Phase 2 Milestone 1 Migration 2B (20261125000003_phase2_m1_corporate_authority_portfolios.sql) to save corporate governance fields.'
        );
      }
      throw new Error(error.message);
    }

    await AuditLogger.log({
      module: 'corporate_clients',
      action: 'corporate_profile_updated',
      tableName: 'clients',
      recordId: clientId,
      newValues: payload as Record<string, unknown>,
    });
  }

  static async listClientContactsWithAuthority(clientId: string): Promise<CorporateContactAuthority[]> {
    const { data, error } = await supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary_contact', { ascending: false })
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(normalizeContact);
  }

  static async updateContactAuthority(
    contactId: string,
    updates: Partial<{
      designation: string | null;
      department: string | null;
      party_role: PartyRole;
      authority_level: number;
      is_authorized_signatory: boolean;
      corporate_portfolio_access: boolean;
      can_delegate_authority: boolean;
      quotation_approval_limit: number | null;
      variation_approval_limit: number | null;
      payment_approval_limit: number | null;
      approval_currency: string;
      is_active: boolean;
    }>
  ): Promise<CorporateContactAuthority> {
    const { data, error } = await supabase
      .from('client_contacts')
      .update(updates)
      .eq('id', contactId)
      .select('*')
      .single();

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(
          'Run Phase 2 Milestone 1 Migration 2B (20261125000003_phase2_m1_corporate_authority_portfolios.sql) to update corporate authority levels and limits.'
        );
      }
      throw new Error(error.message);
    }
    return normalizeContact(data);
  }

  static async listClientProjectAccess(clientId: string): Promise<ProjectAccessAuthority[]> {
    const { data, error } = await supabase
      .from('client_project_access')
      .select(`
        *,
        contact:client_contacts!client_project_access_client_contact_id_fkey(*),
        project:projects(id, project_code, name, status, contract_value, verified_progress_pct)
      `)
      .eq('client_id', clientId)
      .order('granted_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map((row: any) => ({
      ...row,
      access_scope: row.access_scope || 'project',
      authority_level: Number(row.authority_level ?? row.contact?.authority_level ?? 1),
      is_authorized_signatory: Boolean(row.is_authorized_signatory ?? row.contact?.is_authorized_signatory),
      quotation_approval_limit: parseOptionalLimit(row.quotation_approval_limit),
      variation_approval_limit: parseOptionalLimit(row.variation_approval_limit),
      payment_approval_limit: parseOptionalLimit(row.payment_approval_limit),
      approval_currency: row.approval_currency || row.contact?.approval_currency || 'NGN',
      delegated_from_contact_id: row.delegated_from_contact_id ?? null,
    }));
  }

  static async updateProjectAccessAuthority(
    accessId: string,
    updates: Partial<{
      access_scope: 'project' | 'corporate_portfolio';
      authority_level: number;
      is_authorized_signatory: boolean;
      can_view_commercial: boolean;
      can_approve_quotations: boolean;
      can_approve_specifications: boolean;
      can_approve_variations: boolean;
      can_acknowledge_completions: boolean;
      can_approve_payments: boolean;
      can_view_financials: boolean;
      hide_subcontract_pricing: boolean;
      quotation_approval_limit: number | null;
      variation_approval_limit: number | null;
      payment_approval_limit: number | null;
      approval_currency: string;
    }>
  ): Promise<void> {
    const { error } = await supabase
      .from('client_project_access')
      .update(updates)
      .eq('id', accessId);

    if (error) {
      if (isMissingSchemaError(error)) {
        throw new Error(
          'Run Phase 2 Milestone 1 Migration 2B (20261125000003_phase2_m1_corporate_authority_portfolios.sql) to save project-level authority caps.'
        );
      }
      throw new Error(error.message);
    }
  }

  static async listDelegations(clientId: string): Promise<{
    rows: ClientAuthorityDelegation[];
    migrationPending: boolean;
  }> {
    const { data, error } = await supabase
      .from('client_authority_delegations')
      .select(`
        *,
        delegator:client_contacts!client_authority_delegations_delegator_contact_id_fkey(id, full_name, email, designation),
        delegate:client_contacts!client_authority_delegations_delegate_contact_id_fkey(id, full_name, email, designation),
        project:projects(id, project_code, name)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingSchemaError(error)) {
        return { rows: [], migrationPending: true };
      }
      throw new Error(error.message);
    }

    const now = Date.now();
    const rows = (data || []).map((row: any) => {
      const expired =
        row.status === 'active' && row.ends_at && new Date(row.ends_at).getTime() < now;
      return {
        ...row,
        status: expired ? 'expired' : row.status,
        max_approval_limit: parseOptionalLimit(row.max_approval_limit),
        delegated_authorities: row.delegated_authorities || {},
      } as ClientAuthorityDelegation;
    });

    return { rows, migrationPending: false };
  }

  static async createDelegation(payload: {
    client_id: string;
    project_id?: string | null;
    delegator_contact_id: string;
    delegate_contact_id: string;
    delegated_authorities: DelegatedAuthoritiesPayload;
    max_approval_limit?: number | null;
    currency?: string;
    reason: string;
    starts_at: string;
    ends_at: string;
    created_by?: string;
  }): Promise<void> {
    const { error } = await supabase.from('client_authority_delegations').insert({
      client_id: payload.client_id,
      project_id: payload.project_id || null,
      delegator_contact_id: payload.delegator_contact_id,
      delegate_contact_id: payload.delegate_contact_id,
      delegated_authorities: payload.delegated_authorities,
      max_approval_limit:
        payload.max_approval_limit !== undefined ? payload.max_approval_limit : null,
      currency: payload.currency || 'NGN',
      reason: payload.reason.trim(),
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      status: 'active',
      created_by: payload.created_by || null,
    });

    if (error) throw new Error(error.message);
  }

  static async revokeDelegation(
    delegationId: string,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    const { error } = await supabase
      .from('client_authority_delegations')
      .update({
        status: 'revoked',
        revoked_by: revokedBy,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason.trim() || 'Revoked by authorized administrator',
      })
      .eq('id', delegationId);

    if (error) throw new Error(error.message);
  }

  static async listAuthorityAuditLogs(clientId: string): Promise<{
    rows: ClientAuthorityAuditLog[];
    migrationPending: boolean;
  }> {
    const { data, error } = await supabase
      .from('client_authority_audit_logs')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      if (isMissingSchemaError(error)) {
        return { rows: [], migrationPending: true };
      }
      throw new Error(error.message);
    }

    return { rows: (data || []) as ClientAuthorityAuditLog[], migrationPending: false };
  }

  static async getCorporatePortfolioSummary(
    clientId?: string | null
  ): Promise<CorporatePortfolioSummary> {
    const { data, error } = await supabase.rpc('get_corporate_portfolio_summary', {
      p_client_id: clientId || null,
    });

    if (error) {
      if (isMissingSchemaError(error)) {
        // Fallback read from existing projects table so UI remains informative pre-migration
        let q = supabase.from('projects').select('*').order('project_code', { ascending: true });
        if (clientId) q = q.eq('client_id', clientId);
        const { data: fallbackProjects } = await q;
        const rows: CorporatePortfolioProjectRow[] = (fallbackProjects || []).map((p: any) => ({
          id: p.id,
          project_code: p.project_code,
          name: p.name,
          client_id: p.client_id ?? null,
          status: p.status || 'planning',
          location: [p.city, p.state, p.country].filter(Boolean).join(', ') || null,
          currency: p.currency || 'NGN',
          contract_value: p.contract_value != null ? Number(p.contract_value) : null,
          can_view_financials: true,
          start_date: p.start_date ?? null,
          expected_completion_date: p.expected_completion_date ?? null,
          project_delivery_model: p.project_delivery_model ?? null,
          client_visible_stage: p.client_visible_stage ?? null,
          verified_progress_pct: Number(p.verified_progress_pct ?? 0),
          total_work_packages: 0,
          completed_work_packages: 0,
          active_blockers: 0,
          pending_quotations: 0,
          pending_specs: 0,
          pending_variations: 0,
          pending_completions: 0,
          open_tickets: 0,
        }));
        const avg =
          rows.length > 0
            ? Math.round(
                (rows.reduce((s, r) => s + r.verified_progress_pct, 0) / rows.length) * 10
              ) / 10
            : 0;
        return {
          project_count: rows.length,
          average_verified_progress: avg,
          total_contract_value: rows.reduce((s, r) => s + (r.contract_value || 0), 0),
          total_work_packages: 0,
          completed_work_packages: 0,
          active_blockers: 0,
          total_pending_approvals: 0,
          open_tickets: 0,
          projects: rows,
          migrationPending: true,
        };
      }
      throw new Error(error.message);
    }

    const payload = (data || {}) as any;
    return {
      project_count: Number(payload.project_count ?? 0),
      average_verified_progress: Number(payload.average_verified_progress ?? 0),
      total_contract_value: Number(payload.total_contract_value ?? 0),
      total_work_packages: Number(payload.total_work_packages ?? 0),
      completed_work_packages: Number(payload.completed_work_packages ?? 0),
      active_blockers: Number(payload.active_blockers ?? 0),
      total_pending_approvals: Number(payload.total_pending_approvals ?? 0),
      open_tickets: Number(payload.open_tickets ?? 0),
      projects: Array.isArray(payload.projects) ? payload.projects : [],
      migrationPending: false,
    };
  }

  /**
   * Computes the client contact's effective approval authority & monetary limits
   * for a given project (combining direct project override -> contact default -> active delegations).
   * Note: PostgreSQL triggers + auth_client_can_approve_amount() remain the authoritative gate.
   */
  static async evaluateEffectiveAuthority(
    access: ClientProjectAccess | null,
    userId: string
  ): Promise<EffectiveAuthorityEvaluation> {
    if (!access) {
      return {
        authorityLevel: 1,
        isAuthorizedSignatory: false,
        corporatePortfolioAccess: false,
        canDelegateAuthority: false,
        currency: 'NGN',
        canApproveQuotations: false,
        quotationLimit: 0,
        canApproveSpecifications: false,
        canApproveVariations: false,
        variationLimit: 0,
        canAcknowledgeCompletions: false,
        canApprovePayments: false,
        paymentLimit: 0,
        activeDelegationsReceived: [],
      };
    }

    const rawAccess = access as any;
    const rawContact = (access.contact || {}) as any;

    let activeDelegationsReceived: ClientAuthorityDelegation[] = [];
    if (access.client_contact_id && access.client_id) {
      const { rows } = await this.listDelegations(access.client_id);
      const now = Date.now();
      activeDelegationsReceived = rows.filter(
        (d) =>
          d.status === 'active' &&
          d.delegate_contact_id === access.client_contact_id &&
          (!d.project_id || d.project_id === access.project_id) &&
          new Date(d.starts_at).getTime() <= now &&
          new Date(d.ends_at).getTime() >= now
      );
    }

    const directQuoteLimit =
      parseOptionalLimit(rawAccess.quotation_approval_limit) ??
      parseOptionalLimit(rawContact.quotation_approval_limit);
    const directVarLimit =
      parseOptionalLimit(rawAccess.variation_approval_limit) ??
      parseOptionalLimit(rawContact.variation_approval_limit);
    const directPayLimit =
      parseOptionalLimit(rawAccess.payment_approval_limit) ??
      parseOptionalLimit(rawContact.payment_approval_limit);

    let canApproveQuotations = Boolean(access.can_approve_quotations);
    let quotationLimit: number | null = canApproveQuotations ? directQuoteLimit : 0;

    let canApproveSpecifications = Boolean(access.can_approve_specifications);

    let canApproveVariations = Boolean(access.can_approve_variations);
    let variationLimit: number | null = canApproveVariations ? directVarLimit : 0;

    let canAcknowledgeCompletions = Boolean(access.can_acknowledge_completions);

    let canApprovePayments = Boolean(access.can_approve_payments);
    let paymentLimit: number | null = canApprovePayments ? directPayLimit : 0;

    const combineLimit = (currentPermitted: boolean, currentLimit: number | null, delLimit: number | null) => {
      if (!currentPermitted) return delLimit;
      if (currentLimit === null || delLimit === null) return null;
      return Math.max(currentLimit, delLimit);
    };

    for (const del of activeDelegationsReceived) {
      const auths = del.delegated_authorities || {};
      if (auths.can_approve_quotations) {
        quotationLimit = combineLimit(canApproveQuotations, quotationLimit, del.max_approval_limit ?? null);
        canApproveQuotations = true;
      }
      if (auths.can_approve_specifications) {
        canApproveSpecifications = true;
      }
      if (auths.can_approve_variations) {
        variationLimit = combineLimit(canApproveVariations, variationLimit, del.max_approval_limit ?? null);
        canApproveVariations = true;
      }
      if (auths.can_acknowledge_completions) {
        canAcknowledgeCompletions = true;
      }
      if (auths.can_approve_payments) {
        paymentLimit = combineLimit(canApprovePayments, paymentLimit, del.max_approval_limit ?? null);
        canApprovePayments = true;
      }
    }

    // Silence unused parameter lint while keeping signature extensible for userId verification
    void userId;

    return {
      authorityLevel: Number(rawAccess.authority_level ?? rawContact.authority_level ?? 1),
      isAuthorizedSignatory: Boolean(
        rawAccess.is_authorized_signatory ?? rawContact.is_authorized_signatory
      ),
      corporatePortfolioAccess: Boolean(
        rawAccess.access_scope === 'corporate_portfolio' || rawContact.corporate_portfolio_access
      ),
      canDelegateAuthority: Boolean(rawContact.can_delegate_authority),
      currency: rawAccess.approval_currency || rawContact.approval_currency || 'NGN',
      canApproveQuotations,
      quotationLimit,
      canApproveSpecifications,
      canApproveVariations,
      variationLimit,
      canAcknowledgeCompletions,
      canApprovePayments,
      paymentLimit,
      activeDelegationsReceived,
    };
  }
}
