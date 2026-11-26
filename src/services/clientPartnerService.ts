import { supabase } from '../lib/supabase';
import {
  ClientAccountType,
  PartyRole,
  ClientPortalService,
  ClientAccount,
} from './clientPortalService';

export type ClientPartnerAccountStatus = 'active' | 'pending' | 'suspended' | 'inactive';

export interface ClientPartnerAuthorities {
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

export const DEFAULT_CLIENT_PARTNER_AUTHORITIES: ClientPartnerAuthorities = {
  can_view_commercial: true,
  can_approve_quotations: true,
  can_approve_specifications: true,
  can_approve_variations: true,
  can_acknowledge_completions: true,
  can_approve_payments: false,
  can_view_financials: false,
  hide_subcontract_pricing: true,
  can_submit_requests_complaints: true,
};

export interface ClientPartnerAssignedProject {
  access_id: string;
  project_id: string;
  project_name: string;
  project_code?: string | null;
  project_status?: string | null;
  project_location?: string | null;
  party_role: PartyRole;
  is_active: boolean;
  granted_at: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
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

export interface ClientPartnerRecord {
  user_id: string;
  email: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  designation?: string | null;
  account_status: ClientPartnerAccountStatus;
  created_at: string;
  last_sign_in_at?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  company_name?: string | null;
  account_type: ClientAccountType;
  client_contact_id?: string | null;
  party_role: PartyRole;
  contact_is_active: boolean;
  active_project_count: number;
  assigned_projects: ClientPartnerAssignedProject[];
}

export interface CreateClientPartnerInput {
  full_name: string;
  email: string;
  password: string;
  company_name?: string;
  phone?: string;
  designation?: string;
  account_type: ClientAccountType;
  party_role: PartyRole;
  status: 'active' | 'pending';
  existing_client_id?: string | null;
  project_ids: string[];
  authorities: ClientPartnerAuthorities;
}

export interface CreateClientPartnerResult {
  user_id: string;
  client_id: string;
  client_contact_id: string;
  assigned_project_count: number;
  already_existed: boolean;
}

export interface AssignableProjectSummary {
  id: string;
  name: string;
  project_code?: string | null;
  status?: string | null;
  location?: string | null;
  client_id?: string | null;
}

const INTERNAL_STAFF_SLUGS = new Set([
  'management',
  'executive_director',
  'admin',
  'technical',
  'supervisor',
  'procurement',
  'accounts',
  'artisan',
  'social_media_manager',
]);

function normalizeStatus(value?: string | null): ClientPartnerAccountStatus {
  const s = (value || 'active').toLowerCase().trim();
  if (s === 'pending' || s === 'suspended' || s === 'inactive') return s;
  return 'active';
}

function composeProjectLocation(row: Record<string, any> | null | undefined): string | null {
  if (!row) return null;
  if (typeof row.location === 'string' && row.location.trim().length > 0) {
    return row.location.trim();
  }
  const parts = [row.address, row.city, row.state, row.country].filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );
  return parts.length > 0 ? parts.map((p) => p.trim()).join(', ') : null;
}

function isMissingRpcError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42883' || err.code === 'PGRST202') return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('could not find the function') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
}

function isStaleColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === '42703') return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('column') && msg.includes('does not exist');
}

export class ClientPartnerService {
  /**
   * Lists all registered Client / Project Partner accounts (strictly isolated from internal Staff).
   * Uses the authoritative `get_client_partners_directory` RPC (includes auth.users.last_sign_in_at)
   * with a resilient fallback using explicit PostgREST FK hints if the RPC needs creation/patching.
   */
  static async listClientPartners(): Promise<{
    data: ClientPartnerRecord[];
    error: string | null;
    migrationNotice?: string | null;
  }> {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_client_partners_directory');
      if (!rpcError && Array.isArray(rpcData)) {
        const mapped: ClientPartnerRecord[] = rpcData.map((row: any) => ({
          user_id: row.user_id,
          email: row.email || '',
          full_name: row.full_name || 'Unnamed Client',
          first_name: row.first_name || null,
          last_name: row.last_name || null,
          phone: row.phone || null,
          designation: row.designation || null,
          account_status: normalizeStatus(row.account_status),
          created_at: row.created_at || new Date().toISOString(),
          last_sign_in_at: row.last_sign_in_at || null,
          client_id: row.client_id || null,
          client_name: row.client_name || null,
          company_name: row.company_name || null,
          account_type: (row.account_type || 'individual') as ClientAccountType,
          client_contact_id: row.client_contact_id || null,
          party_role: (row.party_role || 'owner') as PartyRole,
          contact_is_active: row.contact_is_active !== false,
          active_project_count: Number(row.active_project_count || 0),
          assigned_projects: Array.isArray(row.assigned_projects) ? row.assigned_projects : [],
        }));
        return { data: mapped, error: null, migrationNotice: null };
      }

      const missingRpc = isMissingRpcError(rpcError);
      const staleColumn = isStaleColumnError(rpcError);

      if (!missingRpc && !staleColumn && rpcError) {
        return { data: [], error: rpcError.message, migrationNotice: null };
      }

      const migrationNotice = missingRpc
        ? 'Run migrations 20261125000005_client_partners_separation_and_management.sql and 20261125000006_fix_client_partners_directory_and_projects_rpc.sql in Supabase SQL Editor to enable full last-login tracking and direct partner provisioning.'
        : 'Run patch migration 20261125000006_fix_client_partners_directory_and_projects_rpc.sql in Supabase SQL Editor to update get_client_partners_directory() for the actual projects address columns and restore last-login tracking.';

      const [rolesRes, userRolesRes, profilesRes, contactsRes, accessRes] = await Promise.all([
        supabase.from('roles').select('id, slug'),
        supabase.from('user_roles').select('user_id, role_id'),
        supabase
          .from('profiles')
          .select('id, email, first_name, last_name, display_name, phone, job_title, status, created_at'),
        supabase
          .from('client_contacts')
          .select('*, client:clients(id, name, company_name, account_type, phone)')
          .not('user_id', 'is', null),
        supabase
          .from('client_project_access')
          .select(
            '*, contact:client_contacts!client_project_access_client_contact_id_fkey(*), project:projects(*)'
          )
          .order('granted_at', { ascending: false }),
      ]);

      const roleSlugById = new Map<string, string>();
      (rolesRes.data || []).forEach((r: any) => roleSlugById.set(r.id, (r.slug || '').toLowerCase()));

      const userSlugs = new Map<string, Set<string>>();
      (userRolesRes.data || []).forEach((ur: any) => {
        const slug = roleSlugById.get(ur.role_id);
        if (!slug) return;
        if (!userSlugs.has(ur.user_id)) userSlugs.set(ur.user_id, new Set());
        userSlugs.get(ur.user_id)!.add(slug);
      });

      const partnerUserIds = new Set<string>();
      userSlugs.forEach((slugs, uid) => {
        const hasClientPartner = slugs.has('client_partner');
        const hasInternal = Array.from(slugs).some((s) => INTERNAL_STAFF_SLUGS.has(s));
        if (hasClientPartner && !hasInternal) {
          partnerUserIds.add(uid);
        }
      });

      const contactByUserId = new Map<string, any>();
      (contactsRes.data || []).forEach((c: any) => {
        if (!c.user_id) return;
        const slugs = userSlugs.get(c.user_id);
        const hasInternal = slugs ? Array.from(slugs).some((s) => INTERNAL_STAFF_SLUGS.has(s)) : false;
        if (!hasInternal) {
          partnerUserIds.add(c.user_id);
          if (!contactByUserId.has(c.user_id) || c.is_active) {
            contactByUserId.set(c.user_id, c);
          }
        }
      });

      const profileById = new Map<string, any>();
      (profilesRes.data || []).forEach((p: any) => profileById.set(p.id, p));

      const accessByUserId = new Map<string, ClientPartnerAssignedProject[]>();
      (accessRes.data || []).forEach((a: any) => {
        const uid = a.user_id || a.contact?.user_id;
        if (!uid) return;
        const list = accessByUserId.get(uid) || [];
        list.push({
          access_id: a.id,
          project_id: a.project_id,
          project_name: a.project?.name || 'Assigned Project',
          project_code: a.project?.project_code || a.project?.code || null,
          project_status: a.project?.status || null,
          project_location: composeProjectLocation(a.project),
          party_role: (a.party_role || 'owner') as PartyRole,
          is_active: a.is_active === true,
          granted_at: a.granted_at,
          revoked_at: a.revoked_at || null,
          revoke_reason: a.revoke_reason || null,
          can_view_commercial: Boolean(a.can_view_commercial),
          can_approve_quotations: Boolean(a.can_approve_quotations),
          can_approve_specifications: Boolean(a.can_approve_specifications),
          can_approve_variations: Boolean(a.can_approve_variations),
          can_acknowledge_completions: Boolean(a.can_acknowledge_completions),
          can_approve_payments: Boolean(a.can_approve_payments),
          can_view_financials: Boolean(a.can_view_financials),
          hide_subcontract_pricing: a.hide_subcontract_pricing !== false,
          can_submit_requests_complaints: a.can_submit_requests_complaints !== false,
        });
        accessByUserId.set(uid, list);
      });

      const results: ClientPartnerRecord[] = Array.from(partnerUserIds).map((uid) => {
        const profile = profileById.get(uid);
        const contact = contactByUserId.get(uid);
        const client = contact?.client || null;
        const projects = accessByUserId.get(uid) || [];
        const activeCount = projects.filter((p) => p.is_active && !p.revoked_at).length;

        const fullName =
          contact?.full_name ||
          profile?.display_name ||
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() ||
          profile?.email?.split('@')[0] ||
          'Client Partner';

        return {
          user_id: uid,
          email: profile?.email || contact?.email || '',
          full_name: fullName,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          phone: contact?.phone || profile?.phone || client?.phone || null,
          designation: contact?.designation || profile?.job_title || null,
          account_status: normalizeStatus(profile?.status),
          created_at: profile?.created_at || contact?.created_at || new Date().toISOString(),
          last_sign_in_at: null,
          client_id: client?.id || contact?.client_id || null,
          client_name: client?.name || null,
          company_name: client?.company_name || contact?.organization_name || client?.name || null,
          account_type: (client?.account_type || 'individual') as ClientAccountType,
          client_contact_id: contact?.id || null,
          party_role: (contact?.party_role || 'owner') as PartyRole,
          contact_is_active: contact ? contact.is_active !== false : true,
          active_project_count: activeCount,
          assigned_projects: projects,
        };
      });

      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { data: results, error: null, migrationNotice };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load Client/Project Partners.' };
    }
  }

  /**
   * Provisions a new Client / Project Partner account atomically via the server-side
   * `admin_create_client_partner` RPC (never exposes service-role keys in the browser).
   */
  static async createClientPartner(
    input: CreateClientPartnerInput
  ): Promise<{ data: CreateClientPartnerResult | null; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('admin_create_client_partner', {
        p_email: input.email.trim().toLowerCase(),
        p_password: input.password,
        p_full_name: input.full_name.trim(),
        p_company_name: input.company_name?.trim() || null,
        p_phone: input.phone?.trim() || null,
        p_designation: input.designation?.trim() || null,
        p_account_type: input.account_type,
        p_party_role: input.party_role,
        p_status: input.status,
        p_existing_client_id: input.existing_client_id || null,
        p_project_ids: input.project_ids || [],
        p_authorities: input.authorities,
      });

      if (error) {
        if (error.code === '42883' || error.message?.includes('Could not find the function')) {
          return {
            data: null,
            error:
              'Database migration 20261125000005_client_partners_separation_and_management.sql has not been applied to Supabase yet. Apply the migration to enable direct Client/Project Partner provisioning.',
          };
        }
        return { data: null, error: error.message };
      }

      return { data: data as CreateClientPartnerResult, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to create Client/Project Partner account.' };
    }
  }

  /**
   * Updates account status (`active` | `pending` | `suspended` | `inactive`) and keeps
   * `profiles.status` + `client_contacts.is_active` strictly synchronized.
   */
  static async updateClientPartnerStatus(
    userId: string,
    status: ClientPartnerAccountStatus
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('admin_manage_client_partner_status', {
        p_user_id: userId,
        p_status: status,
      });
      if (!error) return { error: null };

      // Fallback if RPC not yet deployed
      if (error.code === '42883' || error.message?.includes('Could not find the function')) {
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (profErr) return { error: profErr.message };

        await supabase
          .from('client_contacts')
          .update({ is_active: status === 'active', updated_at: new Date().toISOString() })
          .eq('user_id', userId);
        return { error: null };
      }

      return { error: error.message };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update account status.' };
    }
  }

  /**
   * Updates Client / Project Partner profile metadata across profiles, client_contacts, and clients.
   */
  static async updateClientPartnerProfile(payload: {
    user_id: string;
    full_name: string;
    company_name?: string;
    phone?: string;
    designation?: string;
    account_type?: ClientAccountType;
    party_role?: PartyRole;
  }): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('admin_update_client_partner_profile', {
        p_user_id: payload.user_id,
        p_full_name: payload.full_name.trim(),
        p_company_name: payload.company_name?.trim() || null,
        p_phone: payload.phone?.trim() || null,
        p_designation: payload.designation?.trim() || null,
        p_account_type: payload.account_type || null,
        p_party_role: payload.party_role || null,
      });

      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update Client/Project Partner profile.' };
    }
  }

  /**
   * Assigns a project (or restores revoked access) for a Client / Project Partner via `client_project_access`.
   */
  static async assignProjectToPartner(payload: {
    user_id: string;
    project_id: string;
    party_role: PartyRole;
    authorities: ClientPartnerAuthorities;
  }): Promise<{ access_id?: string; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('admin_assign_client_partner_project', {
        p_user_id: payload.user_id,
        p_project_id: payload.project_id,
        p_party_role: payload.party_role,
        p_authorities: payload.authorities,
      });

      if (!error) {
        return { access_id: (data as any)?.access_id, error: null };
      }
      return { error: error.message };
    } catch (err: any) {
      return { error: err?.message || 'Failed to assign project to Client/Project Partner.' };
    }
  }

  /**
   * Revokes project access for a Client / Project Partner without deleting historical audit trails.
   */
  static async revokeProjectFromPartner(
    accessId: string,
    reason?: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.rpc('admin_revoke_client_partner_project', {
        p_access_id: accessId,
        p_reason: reason?.trim() || null,
      });
      if (!error) return { error: null };

      // Fallback to existing ClientPortalService helper
      if (error.code === '42883' || error.message?.includes('Could not find the function')) {
        await ClientPortalService.revokeProjectAccess(
          accessId,
          reason?.trim() || 'Revoked by Management'
        );
        return { error: null };
      }
      return { error: error.message };
    } catch (err: any) {
      return { error: err?.message || 'Failed to revoke project access.' };
    }
  }

  /**
   * Updates per-project authority toggles on an existing `client_project_access` record.
   */
  static async updateProjectAuthorities(
    accessId: string,
    authorities: Partial<ClientPartnerAuthorities> & { party_role?: PartyRole }
  ): Promise<{ error: string | null }> {
    try {
      await ClientPortalService.updateProjectAccessAuthorities(accessId, authorities);
      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update project authorities.' };
    }
  }

  /**
   * Lists all existing projects eligible for assignment by authorized Management,
   * Executive Director, or Admin users. Uses the dedicated authorized RPC first
   * and falls back cleanly to `projects.select('*')` (composing location from
   * actual address/city/state/country columns so it never fails on a missing
   * `location` column).
   */
  static async listAssignableProjects(): Promise<{ data: AssignableProjectSummary[]; error: string | null }> {
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'get_assignable_projects_for_client_partners'
      );

      if (!rpcError && Array.isArray(rpcData)) {
        const mapped: AssignableProjectSummary[] = rpcData.map((row: any) => ({
          id: String(row.id),
          name: String(row.name || 'Untitled Project'),
          project_code: row.project_code || null,
          status: row.status || null,
          location: row.location || null,
          client_id: row.client_id || null,
        }));
        return { data: mapped, error: null };
      }

      if (rpcError && !isMissingRpcError(rpcError)) {
        return { data: [], error: rpcError.message };
      }

      // Direct table fallback using SELECT * (matches ClientPortalService.getAllProjectsSummary)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { data: [], error: error.message };

      const mapped: AssignableProjectSummary[] = (data || []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name || row.title || row.project_name || 'Untitled Project'),
        project_code: row.project_code || row.code || null,
        status: row.status || null,
        location: composeProjectLocation(row),
        client_id: row.client_id || null,
      }));
      return { data: mapped, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load assignable projects.' };
    }
  }

  /**
   * Lists existing client accounts for linking when creating additional contacts under a company.
   */
  static async listClientAccounts(): Promise<{ data: ClientAccount[]; error: string | null }> {
    try {
      const accounts = await ClientPortalService.getClientAccounts();
      return { data: accounts, error: null };
    } catch (err: any) {
      return { data: [], error: err?.message || 'Failed to load client accounts.' };
    }
  }

  /**
   * Generates a secure single-use invitation link for a Client/Project Partner contact on a project.
   */
  static async generateInvitationLink(payload: {
    client_id: string;
    full_name: string;
    phone?: string | null;
    designation?: string | null;
    project_id: string;
    email: string;
    party_role: PartyRole;
    authorities: ClientPartnerAuthorities;
  }): Promise<{ inviteUrl: string | null; expiresAt?: string; error: string | null }> {
    try {
      const res = await ClientPortalService.createClientInvitation({
        clientId: payload.client_id,
        email: payload.email,
        fullName: payload.full_name,
        phone: payload.phone || undefined,
        designation: payload.designation || undefined,
        partyRole: payload.party_role,
        projectIds: [payload.project_id],
        authorities: payload.authorities,
      });
      if (!res?.inviteUrl) {
        return { inviteUrl: null, error: 'Could not create invitation link.' };
      }
      return {
        inviteUrl: res.inviteUrl,
        expiresAt: res.expires_at,
        error: null,
      };
    } catch (err: any) {
      return { inviteUrl: null, error: err?.message || 'Could not create invitation link.' };
    }
  }
}
