import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ShieldCheck,
  Briefcase,
  UserCog,
  History,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Loader2,
  ArrowRightLeft,
  FolderKanban,
  Ban,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  ACCOUNT_TYPE_LABELS,
  PARTY_ROLE_LABELS,
  formatCurrency,
  formatDateTime,
  formatShortDate,
} from '../../services/clientPortalService';
import {
  CorporateAuthorityService,
  CorporateClientProfile,
  CorporateContactAuthority,
  ProjectAccessAuthority,
  ClientAuthorityDelegation,
  ClientAuthorityAuditLog,
  CorporatePortfolioSummary,
  CorporateTier,
  AUTHORITY_LEVEL_LABELS,
  CORPORATE_TIER_LABELS,
  AUTHORITY_EVENT_LABELS,
} from '../../services/corporateAuthorityService';
import { StatusText } from './ClientPortalShared';

type CorporateSubTab = 'portfolio' | 'profile' | 'authority' | 'delegations' | 'audit';

export const CorporateAuthorityPortfolioPanel: React.FC<{
  canManageGovernance?: boolean;
  onSelectProject?: (projectId: string) => void;
}> = ({ canManageGovernance = true, onSelectProject }) => {
  const { user } = useAuth();

  const [clients, setClients] = useState<CorporateClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'corporate_only'>('all');
  const [subTab, setSubTab] = useState<CorporateSubTab>('portfolio');

  const [portfolio, setPortfolio] = useState<CorporatePortfolioSummary | null>(null);
  const [contacts, setContacts] = useState<CorporateContactAuthority[]>([]);
  const [projectAccessRows, setProjectAccessRows] = useState<ProjectAccessAuthority[]>([]);
  const [delegations, setDelegations] = useState<ClientAuthorityDelegation[]>([]);
  const [auditLogs, setAuditLogs] = useState<ClientAuthorityAuditLog[]>([]);
  const [migrationPending, setMigrationPending] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Corporate Profile Draft
  const [profileDraft, setProfileDraft] = useState<Partial<CorporateClientProfile>>({});

  // Contact Authority Editor
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactDraft, setContactDraft] = useState<{
    department: string;
    designation: string;
    authority_level: number;
    is_authorized_signatory: boolean;
    corporate_portfolio_access: boolean;
    can_delegate_authority: boolean;
    quotation_approval_limit: string;
    variation_approval_limit: string;
    payment_approval_limit: string;
    approval_currency: string;
  }>({
    department: '',
    designation: '',
    authority_level: 1,
    is_authorized_signatory: false,
    corporate_portfolio_access: false,
    can_delegate_authority: false,
    quotation_approval_limit: '',
    variation_approval_limit: '',
    payment_approval_limit: '',
    approval_currency: 'NGN',
  });

  // Project Access Limit Override Editor
  const [editingAccessId, setEditingAccessId] = useState<string | null>(null);
  const [accessDraft, setAccessDraft] = useState<{
    access_scope: 'project' | 'corporate_portfolio';
    authority_level: number;
    is_authorized_signatory: boolean;
    can_approve_quotations: boolean;
    can_approve_specifications: boolean;
    can_approve_variations: boolean;
    can_acknowledge_completions: boolean;
    can_approve_payments: boolean;
    can_view_financials: boolean;
    quotation_approval_limit: string;
    variation_approval_limit: string;
    payment_approval_limit: string;
  }>({
    access_scope: 'project',
    authority_level: 1,
    is_authorized_signatory: false,
    can_approve_quotations: false,
    can_approve_specifications: false,
    can_approve_variations: false,
    can_acknowledge_completions: false,
    can_approve_payments: false,
    can_view_financials: false,
    quotation_approval_limit: '',
    variation_approval_limit: '',
    payment_approval_limit: '',
  });

  // New Delegation Form
  const [delDelegatorId, setDelDelegatorId] = useState('');
  const [delDelegateId, setDelDelegateId] = useState('');
  const [delProjectId, setDelProjectId] = useState('');
  const [delMaxLimit, setDelMaxLimit] = useState('');
  const [delStartsAt, setDelStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [delEndsAt, setDelEndsAt] = useState(() => {
    const dt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    return dt.toISOString().slice(0, 16);
  });
  const [delReason, setDelReason] = useState('');
  const [delAuthQuotes, setDelAuthQuotes] = useState(false);
  const [delAuthSpecs, setDelAuthSpecs] = useState(true);
  const [delAuthVars, setDelAuthVars] = useState(false);
  const [delAuthComp, setDelAuthComp] = useState(true);
  const [delAuthPay, setDelAuthPay] = useState(false);

  // Inline Revoke Delegation Confirmation
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4500);
  };

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await CorporateAuthorityService.listCorporateClients();
      setClients(list);
      setSelectedClientId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        const preferred =
          list.find((c) => c.account_type === 'corporate' || c.account_type === 'main_contractor') ||
          list[0];
        return preferred?.id || '';
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load corporate client accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const visibleClients = useMemo(() => {
    if (filterType === 'all') return clients;
    return clients.filter(
      (c) =>
        c.account_type === 'corporate' ||
        c.account_type === 'main_contractor' ||
        c.account_type === 'subcontract_partner'
    );
  }, [clients, filterType]);

  const loadClientDetails = useCallback(async () => {
    if (!selectedClientId) {
      setPortfolio(null);
      return;
    }
    setError(null);
    try {
      const [pf, cList, accessList, delRes, audRes] = await Promise.all([
        CorporateAuthorityService.getCorporatePortfolioSummary(selectedClientId),
        CorporateAuthorityService.listClientContactsWithAuthority(selectedClientId),
        CorporateAuthorityService.listClientProjectAccess(selectedClientId),
        CorporateAuthorityService.listDelegations(selectedClientId),
        CorporateAuthorityService.listAuthorityAuditLogs(selectedClientId),
      ]);
      setPortfolio(pf);
      setContacts(cList);
      setProjectAccessRows(accessList);
      setDelegations(delRes.rows);
      setAuditLogs(audRes.rows);
      setMigrationPending(Boolean(pf.migrationPending || delRes.migrationPending || audRes.migrationPending));
    } catch (err: any) {
      setError(err?.message || 'Unable to load corporate client governance data.');
    }
  }, [selectedClientId]);

  useEffect(() => {
    loadClientDetails();
  }, [loadClientDetails]);

  useEffect(() => {
    if (selectedClient) {
      setProfileDraft({
        company_name: selectedClient.company_name || selectedClient.name,
        account_type: selectedClient.account_type,
        corporate_tier: selectedClient.corporate_tier || 'standard',
        industry_sector: selectedClient.industry_sector || '',
        rc_number: selectedClient.rc_number || '',
        tax_id: selectedClient.tax_id || '',
        parent_organization: selectedClient.parent_organization || '',
        headquarters_address: selectedClient.headquarters_address || selectedClient.address || '',
        billing_address: selectedClient.billing_address || '',
        default_currency: selectedClient.default_currency || 'NGN',
        portfolio_notes: selectedClient.portfolio_notes || '',
        governance_policy_notes: selectedClient.governance_policy_notes || '',
        portal_enabled: selectedClient.portal_enabled,
      });
    }
  }, [selectedClient]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setSaving(true);
    setError(null);
    try {
      await CorporateAuthorityService.updateCorporateProfile(selectedClient.id, {
        company_name: profileDraft.company_name?.trim() || null,
        account_type: profileDraft.account_type,
        corporate_tier: (profileDraft.corporate_tier || 'standard') as CorporateTier,
        industry_sector: profileDraft.industry_sector?.trim() || null,
        rc_number: profileDraft.rc_number?.trim() || null,
        tax_id: profileDraft.tax_id?.trim() || null,
        parent_organization: profileDraft.parent_organization?.trim() || null,
        headquarters_address: profileDraft.headquarters_address?.trim() || null,
        billing_address: profileDraft.billing_address?.trim() || null,
        default_currency: profileDraft.default_currency || 'NGN',
        portfolio_notes: profileDraft.portfolio_notes?.trim() || null,
        governance_policy_notes: profileDraft.governance_policy_notes?.trim() || null,
        portal_enabled: profileDraft.portal_enabled !== false,
      });
      await loadClients();
      flashNotice('Corporate client governance profile updated.');
    } catch (err: any) {
      setError(err?.message || 'Unable to save corporate profile.');
    } finally {
      setSaving(false);
    }
  };

  const openContactEditor = (c: CorporateContactAuthority) => {
    setEditingContactId(c.id);
    setContactDraft({
      department: c.department || '',
      designation: c.designation || '',
      authority_level: c.authority_level,
      is_authorized_signatory: c.is_authorized_signatory,
      corporate_portfolio_access: c.corporate_portfolio_access,
      can_delegate_authority: c.can_delegate_authority,
      quotation_approval_limit: c.quotation_approval_limit != null ? String(c.quotation_approval_limit) : '',
      variation_approval_limit: c.variation_approval_limit != null ? String(c.variation_approval_limit) : '',
      payment_approval_limit: c.payment_approval_limit != null ? String(c.payment_approval_limit) : '',
      approval_currency: c.approval_currency || 'NGN',
    });
  };

  const handleSaveContactAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContactId) return;
    setSaving(true);
    setError(null);
    try {
      await CorporateAuthorityService.updateContactAuthority(editingContactId, {
        department: contactDraft.department.trim() || null,
        designation: contactDraft.designation.trim() || null,
        authority_level: Number(contactDraft.authority_level),
        is_authorized_signatory: contactDraft.is_authorized_signatory,
        corporate_portfolio_access: contactDraft.corporate_portfolio_access,
        can_delegate_authority: contactDraft.can_delegate_authority,
        quotation_approval_limit:
          contactDraft.quotation_approval_limit.trim() === ''
            ? null
            : Number(contactDraft.quotation_approval_limit),
        variation_approval_limit:
          contactDraft.variation_approval_limit.trim() === ''
            ? null
            : Number(contactDraft.variation_approval_limit),
        payment_approval_limit:
          contactDraft.payment_approval_limit.trim() === ''
            ? null
            : Number(contactDraft.payment_approval_limit),
        approval_currency: contactDraft.approval_currency,
      });
      setEditingContactId(null);
      await loadClientDetails();
      flashNotice('Contact authority hierarchy & monetary limits saved and audited.');
    } catch (err: any) {
      setError(err?.message || 'Unable to save contact authority.');
    } finally {
      setSaving(false);
    }
  };

  const openAccessEditor = (row: ProjectAccessAuthority) => {
    setEditingAccessId(row.id);
    setAccessDraft({
      access_scope: row.access_scope,
      authority_level: row.authority_level,
      is_authorized_signatory: row.is_authorized_signatory,
      can_approve_quotations: row.can_approve_quotations,
      can_approve_specifications: row.can_approve_specifications,
      can_approve_variations: row.can_approve_variations,
      can_acknowledge_completions: row.can_acknowledge_completions,
      can_approve_payments: row.can_approve_payments,
      can_view_financials: row.can_view_financials,
      quotation_approval_limit:
        row.quotation_approval_limit != null ? String(row.quotation_approval_limit) : '',
      variation_approval_limit:
        row.variation_approval_limit != null ? String(row.variation_approval_limit) : '',
      payment_approval_limit:
        row.payment_approval_limit != null ? String(row.payment_approval_limit) : '',
    });
  };

  const handleSaveAccessOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccessId) return;
    setSaving(true);
    setError(null);
    try {
      await CorporateAuthorityService.updateProjectAccessAuthority(editingAccessId, {
        access_scope: accessDraft.access_scope,
        authority_level: Number(accessDraft.authority_level),
        is_authorized_signatory: accessDraft.is_authorized_signatory,
        can_approve_quotations: accessDraft.can_approve_quotations,
        can_approve_specifications: accessDraft.can_approve_specifications,
        can_approve_variations: accessDraft.can_approve_variations,
        can_acknowledge_completions: accessDraft.can_acknowledge_completions,
        can_approve_payments: accessDraft.can_approve_payments,
        can_view_financials: accessDraft.can_view_financials,
        quotation_approval_limit:
          accessDraft.quotation_approval_limit.trim() === ''
            ? null
            : Number(accessDraft.quotation_approval_limit),
        variation_approval_limit:
          accessDraft.variation_approval_limit.trim() === ''
            ? null
            : Number(accessDraft.variation_approval_limit),
        payment_approval_limit:
          accessDraft.payment_approval_limit.trim() === ''
            ? null
            : Number(accessDraft.payment_approval_limit),
      });
      setEditingAccessId(null);
      await loadClientDetails();
      flashNotice('Project-level authority matrix updated and recorded in audit trail.');
    } catch (err: any) {
      setError(err?.message || 'Unable to update project authority override.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !delDelegatorId || !delDelegateId || !delReason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await CorporateAuthorityService.createDelegation({
        client_id: selectedClient.id,
        project_id: delProjectId || null,
        delegator_contact_id: delDelegatorId,
        delegate_contact_id: delDelegateId,
        delegated_authorities: {
          can_approve_quotations: delAuthQuotes,
          can_approve_specifications: delAuthSpecs,
          can_approve_variations: delAuthVars,
          can_acknowledge_completions: delAuthComp,
          can_approve_payments: delAuthPay,
        },
        max_approval_limit: delMaxLimit.trim() === '' ? null : Number(delMaxLimit),
        currency: selectedClient.default_currency || 'NGN',
        reason: delReason,
        starts_at: new Date(delStartsAt).toISOString(),
        ends_at: new Date(delEndsAt).toISOString(),
        created_by: user?.id,
      });
      setDelDelegatorId('');
      setDelDelegateId('');
      setDelProjectId('');
      setDelMaxLimit('');
      setDelReason('');
      await loadClientDetails();
      flashNotice('Time-bounded approval delegation issued and logged.');
    } catch (err: any) {
      setError(err?.message || 'Unable to create delegation.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeDelegation = async (delegationId: string) => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await CorporateAuthorityService.revokeDelegation(delegationId, user.id, revokeReason);
      setRevokingId(null);
      setRevokeReason('');
      await loadClientDetails();
      flashNotice('Approval delegation revoked immediately.');
    } catch (err: any) {
      setError(err?.message || 'Unable to revoke delegation.');
    } finally {
      setSaving(false);
    }
  };

  const delegatorCandidates = useMemo(
    () => contacts.filter((c) => c.is_active && c.can_delegate_authority),
    [contacts]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-10 flex items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin text-[#18b892]" />
        Loading corporate client portfolios & authority matrices...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Corporate Account Selector Header */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Corporate & Institutional Governance
          </p>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Multi-Project Portfolios, Signatories & Approval Limits
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enforce authority hierarchies, monetary caps, time-bounded delegations, and immutable audit logs across multi-project clients.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              All Accounts
            </button>
            <button
              type="button"
              onClick={() => setFilterType('corporate_only')}
              className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                filterType === 'corporate_only'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              Corporate / Partners
            </button>
          </div>

          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            aria-label="Select client organization"
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 min-w-[240px]"
          >
            {visibleClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name || c.name} ({c.project_count || 0} projects)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              loadClients();
              loadClientDetails();
            }}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#18b892]" />
            Refresh
          </button>
        </div>
      </div>

      {migrationPending && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            Phase 2 Milestone 1 Migration 2B (<span className="font-mono font-semibold">20261125000003_phase2_m1_corporate_authority_portfolios.sql</span>) has not been executed in Supabase yet. Run it in the Supabase SQL Editor to activate monetary cap enforcement, approval delegations, portfolio KPIs, and immutable authority audit logs.
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

      {!selectedClient ? (
        <div className="bg-white rounded-xl border border-slate-200/90 p-10 text-center text-sm text-slate-500">
          Select or register a client account in the Accounts & Access tab to manage corporate portfolios and approval authority.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
          {/* Selected Client Identity Strip */}
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{ACCOUNT_TYPE_LABELS[selectedClient.account_type]}</span>
                <span>·</span>
                <span>{CORPORATE_TIER_LABELS[(selectedClient.corporate_tier || 'standard') as CorporateTier]}</span>
                {selectedClient.rc_number && (
                  <>
                    <span>·</span>
                    <span className="font-mono">RC: {selectedClient.rc_number}</span>
                  </>
                )}
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                {selectedClient.company_name || selectedClient.name}
              </h4>
            </div>
            <div className="text-xs text-slate-600 font-mono">
              {selectedClient.project_count || 0} projects · {contacts.length} contacts ·{' '}
              {delegations.filter((d) => d.status === 'active').length} active delegations
            </div>
          </div>

          {/* Sub-Navigation */}
          <div className="flex overflow-x-auto border-b border-slate-200 px-3 bg-white">
            {(
              [
                { id: 'portfolio', label: 'Multi-Project Portfolio', icon: FolderKanban },
                { id: 'profile', label: 'Corporate Profile', icon: Building2 },
                { id: 'authority', label: 'Authority & Limits', icon: ShieldCheck },
                { id: 'delegations', label: 'Approval Delegations', icon: ArrowRightLeft },
                { id: 'audit', label: 'Authority Audit Trail', icon: History },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSubTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap cursor-pointer ${
                    active
                      ? 'border-[#18b892] text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#18b892]' : 'text-slate-400'}`} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {/* TAB 1: MULTI-PROJECT PORTFOLIO */}
            {subTab === 'portfolio' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/40">
                    <p className="text-[11px] text-slate-500">Portfolio Projects</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {portfolio?.project_count ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/40">
                    <p className="text-[11px] text-slate-500">Avg. Verified Progress</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {portfolio?.average_verified_progress ?? 0}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/40">
                    <p className="text-[11px] text-slate-500">Combined Contract Value</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1 truncate">
                      {formatCurrency(
                        portfolio?.total_contract_value ?? 0,
                        selectedClient.default_currency || 'NGN'
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/40">
                    <p className="text-[11px] text-slate-500">Work Packages Verified</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {portfolio?.completed_work_packages ?? 0}
                      <span className="text-xs font-normal text-slate-400">
                        /{portfolio?.total_work_packages ?? 0}
                      </span>
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 p-3.5 bg-slate-50/40">
                    <p className="text-[11px] text-slate-500">Pending Approvals / Blockers</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {portfolio?.total_pending_approvals ?? 0}
                      <span className="text-xs font-normal text-rose-600">
                        {' '}· {portfolio?.active_blockers ?? 0} blk
                      </span>
                    </p>
                  </div>
                </div>

                {!portfolio || portfolio.projects.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-xl">
                    No projects are currently assigned to {selectedClient.company_name || selectedClient.name}. Assign projects to this client in the Projects module to populate the corporate portfolio.
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200/90 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3.5 font-semibold">Project</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Verified Progress</th>
                          <th className="py-2.5 px-3 font-semibold">Work Packages</th>
                          <th className="py-2.5 px-3 font-semibold">Pending Actions</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Contract Value</th>
                          {onSelectProject && <th className="py-2.5 px-3 text-right font-semibold">Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {portfolio.projects.map((p) => {
                          const totalPending =
                            p.pending_quotations +
                            p.pending_specs +
                            p.pending_variations +
                            p.pending_completions;
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/60">
                              <td className="py-3 px-3.5">
                                <p className="font-mono text-[11px] text-slate-500">{p.project_code}</p>
                                <p className="font-bold text-slate-900">{p.name}</p>
                                {p.location && <p className="text-[11px] text-slate-500">{p.location}</p>}
                              </td>
                              <td className="py-3 px-3">
                                <StatusText label={p.status} tone="emerald" />
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#18b892]"
                                      style={{ width: `${Math.min(100, p.verified_progress_pct)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-semibold tabular-nums">
                                    {p.verified_progress_pct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono tabular-nums text-slate-700">
                                {p.completed_work_packages}/{p.total_work_packages}
                                {p.active_blockers > 0 && (
                                  <span className="text-rose-700 font-semibold ml-1.5">
                                    ({p.active_blockers} blk)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-mono">
                                {totalPending} appr · {p.open_tickets} tickets
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-slate-900">
                                {p.contract_value != null
                                  ? formatCurrency(p.contract_value, p.currency)
                                  : 'Restricted'}
                              </td>
                              {onSelectProject && (
                                <td className="py-3 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => onSelectProject(p.id)}
                                    className="px-2.5 py-1 rounded-md border border-slate-200 hover:border-[#18b892] text-xs font-semibold text-slate-700 cursor-pointer"
                                  >
                                    Inspect
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CORPORATE PROFILE */}
            {subTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Organization / Company Name</label>
                    <input
                      type="text"
                      disabled={!canManageGovernance}
                      value={profileDraft.company_name || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, company_name: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Account Category</label>
                    <select
                      disabled={!canManageGovernance}
                      value={profileDraft.account_type || 'corporate'}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({
                          ...prev,
                          account_type: e.target.value as CorporateClientProfile['account_type'],
                        }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    >
                      {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Corporate Governance Tier</label>
                    <select
                      disabled={!canManageGovernance}
                      value={profileDraft.corporate_tier || 'standard'}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({
                          ...prev,
                          corporate_tier: e.target.value as CorporateTier,
                        }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    >
                      {Object.entries(CORPORATE_TIER_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Industry Sector</label>
                    <input
                      type="text"
                      disabled={!canManageGovernance}
                      value={profileDraft.industry_sector || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, industry_sector: e.target.value }))
                      }
                      placeholder="e.g. Banking, Hospitality, Real Estate"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">RC / Registration No.</label>
                    <input
                      type="text"
                      disabled={!canManageGovernance}
                      value={profileDraft.rc_number || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, rc_number: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tax ID (TIN)</label>
                    <input
                      type="text"
                      disabled={!canManageGovernance}
                      value={profileDraft.tax_id || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, tax_id: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Default Currency</label>
                    <select
                      disabled={!canManageGovernance}
                      value={profileDraft.default_currency || 'NGN'}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, default_currency: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                    >
                      <option value="NGN">NGN (₦)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Parent Group / Holding Co.</label>
                    <input
                      type="text"
                      disabled={!canManageGovernance}
                      value={profileDraft.parent_organization || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, parent_organization: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Headquarters Address</label>
                    <input
                      type="text"
                      disabled={!canManageGovernance}
                      value={profileDraft.headquarters_address || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, headquarters_address: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Billing / Accounts Address</label>
                    <input
                      type="text"
                      disabled={!canManageGovernance}
                      value={profileDraft.billing_address || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, billing_address: e.target.value }))
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Approval Governance Policy & Sign-Off Rules
                    </label>
                    <textarea
                      rows={3}
                      disabled={!canManageGovernance}
                      value={profileDraft.governance_policy_notes || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({
                          ...prev,
                          governance_policy_notes: e.target.value,
                        }))
                      }
                      placeholder="e.g. Variations above ₦5M require Executive Finance Signatory sign-off; site engineers may only approve colour specs."
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Corporate Portfolio Notes
                    </label>
                    <textarea
                      rows={3}
                      disabled={!canManageGovernance}
                      value={profileDraft.portfolio_notes || ''}
                      onChange={(e) =>
                        setProfileDraft((prev) => ({ ...prev, portfolio_notes: e.target.value }))
                      }
                      placeholder="Master framework terms, reporting cadence, SLA expectations..."
                      className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                    />
                  </div>
                </div>

                {canManageGovernance && (
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Corporate Profile'}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* TAB 3: AUTHORITY HIERARCHY, SIGNATORIES & MONETARY LIMITS */}
            {subTab === 'authority' && (
              <div className="space-y-6">
                {/* Contact-Level Default Authority Hierarchy */}
                <div className="space-y-3">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      Corporate Representatives, Signatories & Monetary Limits
                    </h5>
                    <p className="text-xs text-slate-500">
                      Every contact has explicit authority tiers and optional monetary approval ceilings enforced in PostgreSQL. Leave a limit blank only if that contact has unlimited authority when permitted.
                    </p>
                  </div>

                  {contacts.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                      No contacts registered for this organization yet. Invite contacts in the Accounts & Access tab.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {contacts.map((c) => {
                        const isEditing = editingContactId === c.id;
                        return (
                          <div
                            key={c.id}
                            className="rounded-xl border border-slate-200/90 p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="font-bold text-slate-900">{c.full_name}</span>
                                  <span className="text-slate-400">·</span>
                                  <span className="font-mono text-slate-600">{c.email}</span>
                                  {c.designation && (
                                    <>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-600">{c.designation}</span>
                                    </>
                                  )}
                                  {c.department && (
                                    <>
                                      <span className="text-slate-400">·</span>
                                      <span className="text-slate-500">{c.department}</span>
                                    </>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                  {AUTHORITY_LEVEL_LABELS[c.authority_level] || `Level ${c.authority_level}`} ·{' '}
                                  {PARTY_ROLE_LABELS[c.party_role]}
                                  {c.corporate_portfolio_access ? ' · Corporate Portfolio View' : ''}
                                  {c.can_delegate_authority ? ' · Can Delegate' : ''}
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                {c.is_authorized_signatory && (
                                  <StatusText label="Authorized Signatory" tone="emerald" />
                                )}
                                {canManageGovernance && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditing ? setEditingContactId(null) : openContactEditor(c)
                                    }
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#18b892] text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <UserCog className="w-3.5 h-3.5 text-[#18b892]" />
                                    {isEditing ? 'Close' : 'Configure Authority'}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] pt-2 border-t border-slate-100">
                              <div className="rounded-lg bg-slate-50 px-3 py-2">
                                <span className="text-slate-500 block">Quotation Approval Cap</span>
                                <span className="font-mono font-semibold text-slate-900">
                                  {c.quotation_approval_limit != null
                                    ? formatCurrency(c.quotation_approval_limit, c.approval_currency)
                                    : 'No monetary cap (if permitted)'}
                                </span>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2">
                                <span className="text-slate-500 block">Variation Approval Cap</span>
                                <span className="font-mono font-semibold text-slate-900">
                                  {c.variation_approval_limit != null
                                    ? formatCurrency(c.variation_approval_limit, c.approval_currency)
                                    : 'No monetary cap (if permitted)'}
                                </span>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-3 py-2">
                                <span className="text-slate-500 block">Payment Approval Cap</span>
                                <span className="font-mono font-semibold text-slate-900">
                                  {c.payment_approval_limit != null
                                    ? formatCurrency(c.payment_approval_limit, c.approval_currency)
                                    : 'No monetary cap (if permitted)'}
                                </span>
                              </div>
                            </div>

                            {isEditing && (
                              <form
                                onSubmit={handleSaveContactAuthority}
                                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Authority Level
                                    </label>
                                    <select
                                      value={contactDraft.authority_level}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          authority_level: Number(e.target.value),
                                        }))
                                      }
                                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                                    >
                                      {Object.entries(AUTHORITY_LEVEL_LABELS).map(([lvl, lbl]) => (
                                        <option key={lvl} value={lvl}>
                                          {lbl}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Department
                                    </label>
                                    <input
                                      type="text"
                                      value={contactDraft.department}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({ ...p, department: e.target.value }))
                                      }
                                      placeholder="e.g. Facilities / Procurement"
                                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Designation
                                    </label>
                                    <input
                                      type="text"
                                      value={contactDraft.designation}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({ ...p, designation: e.target.value }))
                                      }
                                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Limit Currency
                                    </label>
                                    <select
                                      value={contactDraft.approval_currency}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          approval_currency: e.target.value,
                                        }))
                                      }
                                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                    >
                                      <option value="NGN">NGN</option>
                                      <option value="USD">USD</option>
                                      <option value="GBP">GBP</option>
                                      <option value="EUR">EUR</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Quotation Cap (blank = unlimited)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={contactDraft.quotation_approval_limit}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          quotation_approval_limit: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. 5000000"
                                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Variation Cap (blank = unlimited)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={contactDraft.variation_approval_limit}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          variation_approval_limit: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. 1500000"
                                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Payment Cap (blank = unlimited)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={contactDraft.payment_approval_limit}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          payment_approval_limit: e.target.value,
                                        }))
                                      }
                                      placeholder="e.g. 10000000"
                                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={contactDraft.is_authorized_signatory}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          is_authorized_signatory: e.target.checked,
                                        }))
                                      }
                                      className="accent-[#18b892]"
                                    />
                                    Authorized Signatory
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={contactDraft.corporate_portfolio_access}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          corporate_portfolio_access: e.target.checked,
                                        }))
                                      }
                                      className="accent-[#18b892]"
                                    />
                                    Corporate Portfolio Dashboard Access
                                  </label>
                                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={contactDraft.can_delegate_authority}
                                      onChange={(e) =>
                                        setContactDraft((p) => ({
                                          ...p,
                                          can_delegate_authority: e.target.checked,
                                        }))
                                      }
                                      className="accent-[#18b892]"
                                    />
                                    Permitted to Delegate Approval Authority
                                  </label>
                                </div>

                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingContactId(null)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Save Authority Profile
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Project-Specific Access & Limit Overrides */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      Project-Specific Access & Authority Overrides ({projectAccessRows.length})
                    </h5>
                    <p className="text-xs text-slate-500">
                      Fine-tune exact permissions and project-level monetary ceilings per contact and project.
                    </p>
                  </div>

                  {projectAccessRows.length === 0 ? (
                    <p className="text-xs text-slate-500 py-5 text-center border border-dashed border-slate-200 rounded-xl">
                      No project access assignments found for this organization yet.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {projectAccessRows.map((row) => {
                        const isEditing = editingAccessId === row.id;
                        const activeFlags = [
                          row.can_approve_quotations && 'Quotations',
                          row.can_approve_specifications && 'Specs/Colours',
                          row.can_approve_variations && 'Variations',
                          row.can_acknowledge_completions && 'Completions',
                          row.can_approve_payments && 'Payments',
                          row.can_view_financials && 'Financials',
                        ].filter(Boolean) as string[];

                        return (
                          <div key={row.id} className="rounded-xl border border-slate-200/90 p-3.5 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-slate-900">
                                  {row.contact?.full_name || 'Contact'} →{' '}
                                  <span className="font-mono text-[#18b892]">
                                    {row.project?.project_code}
                                  </span>{' '}
                                  {row.project?.name}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  Scope: {row.access_scope === 'corporate_portfolio' ? 'Corporate Portfolio' : 'Project Only'} ·
                                  Level {row.authority_level} ·{' '}
                                  {activeFlags.length > 0 ? activeFlags.join(' · ') : 'View / Coordinate Only'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusText
                                  label={row.is_active && !row.revoked_at ? 'Active' : 'Revoked'}
                                  tone={row.is_active && !row.revoked_at ? 'emerald' : 'rose'}
                                />
                                {canManageGovernance && row.is_active && !row.revoked_at && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditing ? setEditingAccessId(null) : openAccessEditor(row)
                                    }
                                    className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:border-[#18b892] cursor-pointer"
                                  >
                                    {isEditing ? 'Close' : 'Edit Caps'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {isEditing && (
                              <form
                                onSubmit={handleSaveAccessOverride}
                                className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3"
                              >
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                                  {(
                                    [
                                      ['can_approve_quotations', 'Approve Quotations'],
                                      ['can_approve_specifications', 'Approve Specs/Colours'],
                                      ['can_approve_variations', 'Approve Variations'],
                                      ['can_acknowledge_completions', 'Acknowledge Completions'],
                                      ['can_approve_payments', 'Approve Payments'],
                                      ['can_view_financials', 'View Financials'],
                                    ] as const
                                  ).map(([key, label]) => (
                                    <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={accessDraft[key]}
                                        onChange={(e) =>
                                          setAccessDraft((p) => ({ ...p, [key]: e.target.checked }))
                                        }
                                        className="accent-[#18b892]"
                                      />
                                      {label}
                                    </label>
                                  ))}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Access Scope</label>
                                    <select
                                      value={accessDraft.access_scope}
                                      onChange={(e) =>
                                        setAccessDraft((p) => ({
                                          ...p,
                                          access_scope: e.target.value as 'project' | 'corporate_portfolio',
                                        }))
                                      }
                                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs"
                                    >
                                      <option value="project">Project Specific</option>
                                      <option value="corporate_portfolio">Corporate Portfolio</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Project Quote Cap
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={accessDraft.quotation_approval_limit}
                                      onChange={(e) =>
                                        setAccessDraft((p) => ({
                                          ...p,
                                          quotation_approval_limit: e.target.value,
                                        }))
                                      }
                                      placeholder="Inherit contact cap"
                                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Project Variation Cap
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={accessDraft.variation_approval_limit}
                                      onChange={(e) =>
                                        setAccessDraft((p) => ({
                                          ...p,
                                          variation_approval_limit: e.target.value,
                                        }))
                                      }
                                      placeholder="Inherit contact cap"
                                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                                      Project Payment Cap
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={accessDraft.payment_approval_limit}
                                      onChange={(e) =>
                                        setAccessDraft((p) => ({
                                          ...p,
                                          payment_approval_limit: e.target.value,
                                        }))
                                      }
                                      placeholder="Inherit contact cap"
                                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingAccessId(null)}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Save Project Override
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: APPROVAL DELEGATIONS */}
            {subTab === 'delegations' && (
              <div className="space-y-5">
                {canManageGovernance && (
                  <form
                    onSubmit={handleCreateDelegation}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-[#18b892]" />
                        Issue Time-Bounded Approval Delegation
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        Only contacts with &ldquo;Can Delegate&rdquo; enabled appear as delegators
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Delegator *</label>
                        <select
                          required
                          value={delDelegatorId}
                          onChange={(e) => setDelDelegatorId(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <option value="">Select authorized delegator...</option>
                          {delegatorCandidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.full_name} (L{c.authority_level})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Delegate (Recipient) *</label>
                        <select
                          required
                          value={delDelegateId}
                          onChange={(e) => setDelDelegateId(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <option value="">Select colleague in organization...</option>
                          {contacts
                            .filter((c) => c.is_active && c.id !== delDelegatorId)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.full_name} ({c.email})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Project Scope</label>
                        <select
                          value={delProjectId}
                          onChange={(e) => setDelProjectId(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <option value="">All Projects under this Corporate Client</option>
                          {(portfolio?.projects || []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.project_code} — {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Valid From *</label>
                        <input
                          type="datetime-local"
                          required
                          value={delStartsAt}
                          onChange={(e) => setDelStartsAt(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Valid Until *</label>
                        <input
                          type="datetime-local"
                          required
                          value={delEndsAt}
                          onChange={(e) => setDelEndsAt(e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Delegated Monetary Ceiling ({selectedClient.default_currency || 'NGN'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={delMaxLimit}
                          onChange={(e) => setDelMaxLimit(e.target.value)}
                          placeholder="Optional cap (e.g. 2000000)"
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delAuthQuotes}
                          onChange={(e) => setDelAuthQuotes(e.target.checked)}
                          className="accent-[#18b892]"
                        />
                        Approve Quotations
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delAuthSpecs}
                          onChange={(e) => setDelAuthSpecs(e.target.checked)}
                          className="accent-[#18b892]"
                        />
                        Approve Specs & Colours
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delAuthVars}
                          onChange={(e) => setDelAuthVars(e.target.checked)}
                          className="accent-[#18b892]"
                        />
                        Approve Variations
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delAuthComp}
                          onChange={(e) => setDelAuthComp(e.target.checked)}
                          className="accent-[#18b892]"
                        />
                        Acknowledge Completions
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delAuthPay}
                          onChange={(e) => setDelAuthPay(e.target.checked)}
                          className="accent-[#18b892]"
                        />
                        Approve Payments
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        required
                        value={delReason}
                        onChange={(e) => setDelReason(e.target.value)}
                        placeholder="Formal delegation reason (e.g. Executive travel cover — Q4 fit-out)..."
                        className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                      <button
                        type="submit"
                        disabled={saving || delegatorCandidates.length === 0}
                        className="px-4 h-8 rounded-lg bg-[#18b892] hover:bg-[#149e7e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Issue Delegation
                      </button>
                    </div>
                  </form>
                )}

                {delegations.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                    No approval delegations have been issued for this client organization.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {delegations.map((d) => {
                      const authList = [
                        d.delegated_authorities.can_approve_quotations && 'Quotations',
                        d.delegated_authorities.can_approve_specifications && 'Specs',
                        d.delegated_authorities.can_approve_variations && 'Variations',
                        d.delegated_authorities.can_acknowledge_completions && 'Completions',
                        d.delegated_authorities.can_approve_payments && 'Payments',
                      ].filter(Boolean) as string[];

                      return (
                        <div key={d.id} className="rounded-xl border border-slate-200/90 p-4 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {d.delegator?.full_name || 'Delegator'} →{' '}
                                {d.delegate?.full_name || 'Delegate'}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Scope:{' '}
                                {d.project
                                  ? `${d.project.project_code} · ${d.project.name}`
                                  : 'Corporate Portfolio-Wide'}{' '}
                                · Window: {formatShortDate(d.starts_at)} – {formatShortDate(d.ends_at)}
                                {d.max_approval_limit != null
                                  ? ` · Cap: ${formatCurrency(d.max_approval_limit, d.currency)}`
                                  : ''}
                              </p>
                            </div>
                            <StatusText
                              label={d.status}
                              tone={
                                d.status === 'active'
                                  ? 'emerald'
                                  : d.status === 'revoked'
                                    ? 'rose'
                                    : 'slate'
                              }
                            />
                          </div>

                          <p className="text-xs text-slate-600">
                            <strong>Delegated Authorities:</strong>{' '}
                            {authList.length > 0 ? authList.join(' · ') : 'None'} — &ldquo;{d.reason}&rdquo;
                          </p>

                          {d.status === 'active' && canManageGovernance && (
                            <div className="pt-2 border-t border-slate-100">
                              {revokingId === d.id ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={revokeReason}
                                    onChange={(e) => setRevokeReason(e.target.value)}
                                    placeholder="Reason for revoking delegation..."
                                    className="flex-1 h-8 px-2.5 rounded-lg border border-rose-200 text-xs"
                                  />
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleRevokeDelegation(d.id)}
                                    className="px-3 h-8 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Confirm Revoke
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRevokingId(null);
                                      setRevokeReason('');
                                    }}
                                    className="px-2.5 h-8 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setRevokingId(d.id)}
                                  className="text-xs font-semibold text-rose-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Revoke Delegation
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: IMMUTABLE AUTHORITY AUDIT TRAIL */}
            {subTab === 'audit' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">
                      Immutable Client Authority Audit Trail
                    </h5>
                    <p className="text-xs text-slate-500">
                      Automatically recorded by database triggers on every contact authority update, project access change, and delegation event. Records cannot be modified or deleted.
                    </p>
                  </div>
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-xl">
                    No authority governance changes have been recorded for this organization yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200/80 border border-slate-200/90 rounded-xl overflow-hidden">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3.5 bg-white space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-900">
                            {AUTHORITY_EVENT_LABELS[log.event_type] || log.event_type}
                          </p>
                          <span className="text-[11px] font-mono text-slate-500">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Actor: <strong className="text-slate-800">{log.actor_name || 'System'}</strong>
                          {log.reason ? ` · Reason: "${log.reason}"` : ''}
                        </p>
                        {log.new_state && (
                          <p className="text-[11px] font-mono text-slate-500 truncate">
                            Snapshot: {JSON.stringify(log.new_state).slice(0, 220)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
