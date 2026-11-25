import React, { useState } from 'react';
import {
  Building2,
  UserPlus,
  Link2,
  Copy,
  Check,
  ShieldOff,
  Edit3,
  Plus,
  X,
} from 'lucide-react';
import {
  ClientPortalService,
  ClientAccount,
  ClientAccountType,
  ClientProjectAccess,
  ClientInvitation,
  PortalProjectSummary,
  PartyRole,
  ProjectAuthorityMatrix,
  ACCOUNT_TYPE_LABELS,
  PARTY_ROLE_LABELS,
  formatShortDate,
} from '../../services/clientPortalService';
import { StatusText } from './ClientPortalShared';

const DEFAULT_AUTHORITIES: ProjectAuthorityMatrix = {
  can_view_commercial: true,
  can_approve_quotations: false,
  can_approve_specifications: true,
  can_approve_variations: false,
  can_acknowledge_completions: true,
  can_approve_payments: false,
  can_view_financials: false,
  hide_subcontract_pricing: true,
  can_submit_requests_complaints: true,
};

const AUTHORITY_FIELDS: { key: keyof ProjectAuthorityMatrix; label: string; hint: string }[] = [
  { key: 'can_view_commercial', label: 'View Commercial Docs', hint: 'See quotations & contracts' },
  { key: 'can_approve_quotations', label: 'Approve Quotations', hint: 'Formally accept/decline quotes' },
  { key: 'can_approve_specifications', label: 'Approve Colours & Specs', hint: 'e.g. Designer / Homeowner' },
  { key: 'can_approve_variations', label: 'Approve Variations', hint: 'e.g. QS / Client / Main Contractor' },
  { key: 'can_acknowledge_completions', label: 'Acknowledge Completions', hint: 'e.g. PM / Site Rep' },
  { key: 'can_approve_payments', label: 'Approve Payments', hint: 'e.g. Corporate Rep' },
  { key: 'can_view_financials', label: 'View Financial Summary', hint: 'Contract & variation totals' },
  { key: 'hide_subcontract_pricing', label: 'Hide Subcontract Pricing', hint: 'Protect confidential B2B rates' },
  { key: 'can_submit_requests_complaints', label: 'Submit Requests/Complaints', hint: 'Open tracked tickets' },
];

export const ClientPortalAccountsPanel: React.FC<{
  accounts: ClientAccount[];
  projects: PortalProjectSummary[];
  accessList: ClientProjectAccess[];
  invitations: ClientInvitation[];
  currentUserId?: string;
  onRefresh: () => Promise<void>;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ accounts, projects, accessList, invitations, currentUserId, onRefresh, onSuccess, onError }) => {
  // Client Account Form
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<ClientAccountType>('individual');
  const [accCompany, setAccCompany] = useState('');
  const [accContactPerson, setAccContactPerson] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [accPhone, setAccPhone] = useState('');
  const [accCountry, setAccCountry] = useState('Nigeria');
  const [accTimezone, setAccTimezone] = useState('Africa/Lagos');
  const [accAddress, setAccAddress] = useState('');
  const [saving, setSaving] = useState(false);

  // Invitation Form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [invClientId, setInvClientId] = useState('');
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invDesignation, setInvDesignation] = useState('');
  const [invRole, setInvRole] = useState<PartyRole>('owner');
  const [invProjectIds, setInvProjectIds] = useState<string[]>([]);
  const [invExpiryDays, setInvExpiryDays] = useState(7);
  const [invAuth, setInvAuth] = useState<ProjectAuthorityMatrix>(DEFAULT_AUTHORITIES);
  const [generatedLink, setGeneratedLink] = useState<{ url: string; email: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const openEditAccount = (acc: ClientAccount) => {
    setEditingAccountId(acc.id);
    setAccName(acc.name);
    setAccType(acc.account_type || 'individual');
    setAccCompany(acc.company_name || '');
    setAccContactPerson(acc.contact_person || '');
    setAccEmail(acc.email || '');
    setAccPhone(acc.phone || '');
    setAccCountry(acc.country || 'Nigeria');
    setAccTimezone(acc.timezone || 'Africa/Lagos');
    setAccAddress(acc.address || '');
    setShowAccountForm(true);
  };

  const resetAccountForm = () => {
    setEditingAccountId(null);
    setAccName('');
    setAccType('individual');
    setAccCompany('');
    setAccContactPerson('');
    setAccEmail('');
    setAccPhone('');
    setAccCountry('Nigeria');
    setAccTimezone('Africa/Lagos');
    setAccAddress('');
    setShowAccountForm(false);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ClientPortalService.upsertClientAccount({
        id: editingAccountId || undefined,
        name: accName,
        account_type: accType,
        company_name: accCompany || undefined,
        contact_person: accContactPerson || undefined,
        email: accEmail || undefined,
        phone: accPhone || undefined,
        country: accCountry,
        timezone: accTimezone,
        address: accAddress || undefined,
        portal_enabled: true,
      });
      resetAccountForm();
      await onRefresh();
      onSuccess(editingAccountId ? 'Client account updated.' : 'Client account created.');
    } catch (err: any) {
      onError(err?.message || 'Unable to save client account.');
    } finally {
      setSaving(false);
    }
  };

  const applyRolePreset = (role: PartyRole) => {
    setInvRole(role);
    if (role === 'owner' || role === 'diaspora_owner') {
      setInvAuth({
        can_view_commercial: true,
        can_approve_quotations: true,
        can_approve_specifications: true,
        can_approve_variations: true,
        can_acknowledge_completions: true,
        can_approve_payments: true,
        can_view_financials: true,
        hide_subcontract_pricing: true,
        can_submit_requests_complaints: true,
      });
    } else if (role === 'designer') {
      setInvAuth({
        ...DEFAULT_AUTHORITIES,
        can_view_commercial: false,
        can_approve_specifications: true,
        can_view_financials: false,
      });
    } else if (role === 'quantity_surveyor') {
      setInvAuth({
        ...DEFAULT_AUTHORITIES,
        can_view_commercial: true,
        can_approve_variations: true,
        can_view_financials: true,
        can_approve_specifications: false,
      });
    } else if (role === 'main_contractor') {
      setInvAuth({
        can_view_commercial: true,
        can_approve_quotations: true,
        can_approve_specifications: true,
        can_approve_variations: true,
        can_acknowledge_completions: true,
        can_approve_payments: true,
        can_view_financials: true,
        hide_subcontract_pricing: false,
        can_submit_requests_complaints: true,
      });
    } else if (role === 'project_manager' || role === 'local_representative') {
      setInvAuth({
        ...DEFAULT_AUTHORITIES,
        can_view_commercial: false,
        can_acknowledge_completions: true,
        can_approve_specifications: false,
        can_view_financials: false,
      });
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invClientId || invProjectIds.length === 0) {
      onError('Select a client account and at least one project.');
      return;
    }
    setSaving(true);
    try {
      const res = await ClientPortalService.createClientInvitation({
        clientId: invClientId,
        email: invEmail,
        fullName: invName,
        phone: invPhone || undefined,
        designation: invDesignation || undefined,
        partyRole: invRole,
        projectIds: invProjectIds,
        authorities: invAuth,
        expiresInDays: invExpiryDays,
      });
      setGeneratedLink({ url: res.inviteUrl, email: invEmail, expiresAt: res.expires_at });
      setInvName('');
      setInvEmail('');
      setInvPhone('');
      setInvDesignation('');
      setInvProjectIds([]);
      await onRefresh();
      onSuccess('Secure expiring invitation link generated.');
    } catch (err: any) {
      onError(err?.message || 'Unable to create invitation.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink?.url) return;
    try {
      await navigator.clipboard.writeText(generatedLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onError('Copy failed — select the link manually.');
    }
  };

  const handleRevokeAccess = async (accessId: string) => {
    setSaving(true);
    try {
      await ClientPortalService.revokeProjectAccess(accessId, 'Revoked via Davejoe Portal Control', currentUserId);
      await onRefresh();
      onSuccess('Project access revoked immediately.');
    } catch (err: any) {
      onError(err?.message || 'Unable to revoke access.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeInvitation = async (invId: string) => {
    setSaving(true);
    try {
      await ClientPortalService.revokeClientInvitation(invId, 'Revoked by administrator', currentUserId);
      await onRefresh();
      onSuccess('Invitation revoked.');
    } catch (err: any) {
      onError(err?.message || 'Unable to revoke invitation.');
    } finally {
      setSaving(false);
    }
  };

  const toggleProjectSelection = (pid: string) => {
    setInvProjectIds((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]));
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Client Accounts, Contact Authorities & Invitations</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Supports individual, diaspora/remote, corporate, main contractor, and subcontract partners with per-project granular authorities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetAccountForm();
              setShowAccountForm(true);
            }}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#18b892]" /> New Client Account
          </button>
          <button
            type="button"
            onClick={() => setShowInviteForm((v) => !v)}
            className="px-3.5 py-2 rounded-lg bg-[#18b892] hover:bg-[#149f7e] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Issue Secure Portal Invite
          </button>
        </div>
      </div>

      {/* Generated Invite Link Banner */}
      {generatedLink && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-[#18b892]" />
              One-Time Secure Invitation Link for {generatedLink.email} (expires {formatShortDate(generatedLink.expiresAt)})
            </p>
            <button
              type="button"
              onClick={() => setGeneratedLink(null)}
              className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={generatedLink.url}
              className="flex-1 h-9 px-3 rounded-lg border border-emerald-200 bg-white text-xs font-mono text-slate-700"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#18b892]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Invite Link'}
            </button>
          </div>
          <p className="text-[11px] text-emerald-800">
            This raw token is displayed once and stored only as a SHA-256 hash. Share securely with the invited contact.
          </p>
        </div>
      )}

      {/* Client Account Modal/Form */}
      {showAccountForm && (
        <form onSubmit={handleSaveAccount} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">
              {editingAccountId ? 'Edit Client Account' : 'Register New Client / Project Partner Account'}
            </h4>
            <button type="button" onClick={resetAccountForm} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Display Name *</label>
              <input
                type="text"
                required
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                placeholder="e.g. Mr. Adewale Ogunleye / Zenith Build Ltd"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Category *</label>
              <select
                value={accType}
                onChange={(e) => setAccType(e.target.value as ClientAccountType)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                {(Object.keys(ACCOUNT_TYPE_LABELS) as ClientAccountType[]).map((k) => (
                  <option key={k} value={k}>
                    {ACCOUNT_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Organization</label>
              <input
                type="text"
                value={accCompany}
                onChange={(e) => setAccCompany(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Contact Person</label>
              <input
                type="text"
                value={accContactPerson}
                onChange={(e) => setAccContactPerson(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={accEmail}
                onChange={(e) => setAccEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={accPhone}
                onChange={(e) => setAccPhone(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={accCountry}
                onChange={(e) => setAccCountry(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time Zone (Diaspora/Remote)</label>
              <input
                type="text"
                value={accTimezone}
                onChange={(e) => setAccTimezone(e.target.value)}
                placeholder="e.g. Africa/Lagos, Europe/London, America/New_York"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={accAddress}
                onChange={(e) => setAccAddress(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={resetAccountForm}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : editingAccountId ? 'Update Account' : 'Create Client Account'}
            </button>
          </div>
        </form>
      )}

      {/* Secure Invitation Form */}
      {showInviteForm && (
        <form onSubmit={handleCreateInvitation} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">Invite Authorized Contact with Granular Authority Matrix</h4>
            <button type="button" onClick={() => setShowInviteForm(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client Account *</label>
              <select
                required
                value={invClientId}
                onChange={(e) => setInvClientId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="">Select client account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company_name || a.name} ({ACCOUNT_TYPE_LABELS[a.account_type || 'individual']})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Full Name *</label>
              <input
                type="text"
                required
                value={invName}
                onChange={(e) => setInvName(e.target.value)}
                placeholder="e.g. Chidinma Okafor"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email *</label>
              <input
                type="email"
                required
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Party Role Preset *</label>
              <select
                value={invRole}
                onChange={(e) => applyRolePreset(e.target.value as PartyRole)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                {(Object.keys(PARTY_ROLE_LABELS) as PartyRole[]).map((r) => (
                  <option key={r} value={r}>
                    {PARTY_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / Title</label>
              <input
                type="text"
                value={invDesignation}
                onChange={(e) => setInvDesignation(e.target.value)}
                placeholder="e.g. Senior QS, Interior Architect"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Link Expiry (Days)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={invExpiryDays}
                onChange={(e) => setInvExpiryDays(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
          </div>

          {/* Project Multi-Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Authorized Projects * ({invProjectIds.length} selected)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
              {projects.map((p) => {
                const checked = invProjectIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer ${
                      checked ? 'border-[#18b892] bg-[#18b892]/8 text-slate-900 font-medium' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProjectSelection(p.id)}
                      className="accent-[#18b892]"
                    />
                    <span className="truncate">
                      <span className="font-mono text-[10px] text-slate-400 mr-1">{p.project_code}</span>
                      {p.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Authority Matrix Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Granular Contact Authority Matrix (Explicitly define what this contact can approve or view)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {AUTHORITY_FIELDS.map((f) => (
                <label
                  key={f.key}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 bg-white text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={invAuth[f.key]}
                    onChange={(e) => setInvAuth((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                    className="mt-0.5 accent-[#18b892]"
                  />
                  <span>
                    <span className="font-semibold text-slate-800 block">{f.label}</span>
                    <span className="text-[11px] text-slate-500">{f.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInviteForm(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Generating...' : 'Generate Secure Invitation Link'}
            </button>
          </div>
        </form>
      )}

      {/* Client Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#18b892]" /> Registered Client & Partner Accounts ({accounts.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-5">Client / Organization</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Contact</th>
                <th className="py-2.5 px-4">Location / TZ</th>
                <th className="py-2.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-5">
                    <p className="font-semibold text-slate-900">{acc.company_name || acc.name}</p>
                    {acc.company_name && acc.name !== acc.company_name && (
                      <p className="text-[11px] text-slate-500">{acc.name}</p>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {ACCOUNT_TYPE_LABELS[acc.account_type || 'individual']}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    <p>{acc.email || '—'}</p>
                    <p className="text-[11px] text-slate-400">{acc.phone || ''}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {acc.country || 'Nigeria'} · <span className="font-mono text-[11px]">{acc.timezone || 'Africa/Lagos'}</span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => openEditAccount(acc)}
                      className="text-xs font-semibold text-[#18b892] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No client accounts registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Project Access & Revocation Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Authorized Project Contacts & Permissions ({accessList.length})
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-5">Contact</th>
                <th className="py-2.5 px-4">Project</th>
                <th className="py-2.5 px-4">Role & Authorities</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-5 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {accessList.map((row) => {
                const granted = [
                  row.can_approve_quotations && 'Quotes',
                  row.can_approve_specifications && 'Specs',
                  row.can_approve_variations && 'Variations',
                  row.can_acknowledge_completions && 'Completions',
                  row.can_approve_payments && 'Payments',
                  row.can_view_financials && 'Financials',
                ].filter(Boolean) as string[];
                return (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-5">
                      <p className="font-semibold text-slate-900">{row.contact?.full_name || 'Contact'}</p>
                      <p className="text-[11px] text-slate-500">{row.contact?.email}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-mono text-[11px] text-slate-400 mr-1">{row.project?.project_code}</span>
                      {row.project?.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <p className="font-medium text-slate-800">{PARTY_ROLE_LABELS[row.party_role]}</p>
                      <p className="text-[11px] text-slate-500">{granted.join(' · ') || 'View-Only'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusText
                        label={row.is_active && !row.revoked_at ? 'Active' : 'Revoked'}
                        tone={row.is_active && !row.revoked_at ? 'emerald' : 'rose'}
                      />
                    </td>
                    <td className="py-3 px-5 text-right">
                      {row.is_active && !row.revoked_at && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleRevokeAccess(row.id)}
                          className="text-xs font-semibold text-rose-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldOff className="w-3 h-3" /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {accessList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No active client portal access records yet. Issue an invitation above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending / Recent Invitations */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Invitation Audit Log ({invitations.length})
            </h4>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {invitations.slice(0, 10).map((inv) => (
              <div key={inv.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {inv.full_name} · <span className="font-normal text-slate-500">{inv.email}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {PARTY_ROLE_LABELS[inv.party_role]} · {inv.project_ids.length} project(s) · Expires{' '}
                    {formatShortDate(inv.expires_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusText
                    label={inv.status.toUpperCase()}
                    tone={inv.status === 'accepted' ? 'emerald' : inv.status === 'pending' ? 'amber' : 'slate'}
                  />
                  {inv.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleRevokeInvitation(inv.id)}
                      className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
