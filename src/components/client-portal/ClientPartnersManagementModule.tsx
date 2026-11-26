import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserCheck,
  UserPlus,
  Building2,
  FolderKanban,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Shield,
  Mail,
  Phone,
  Briefcase,
  Eye,
  EyeOff,
  Lock,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
  RotateCcw,
  Link2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ArrowLeft,
  KeyRound,
  Info,
} from 'lucide-react';
import {
  ClientPartnerService,
  ClientPartnerRecord,
  ClientPartnerAssignedProject,
  ClientPartnerAccountStatus,
  ClientPartnerAuthorities,
  DEFAULT_CLIENT_PARTNER_AUTHORITIES,
  AssignableProjectSummary,
} from '../../services/clientPartnerService';
import {
  ClientAccountType,
  PartyRole,
  ClientAccount,
} from '../../services/clientPortalService';

interface ClientPartnersManagementModuleProps {
  onBackToDashboard?: () => void;
}

const ACCOUNT_TYPE_OPTIONS: { value: ClientAccountType; label: string }[] = [
  { value: 'individual', label: 'Individual Residential Client' },
  { value: 'diaspora_remote', label: 'Diaspora / Remote Investor' },
  { value: 'corporate', label: 'Direct Corporate Client' },
  { value: 'main_contractor', label: 'Main Contractor' },
  { value: 'subcontract_partner', label: 'Subcontracting Partner' },
];

const PARTY_ROLE_OPTIONS: { value: PartyRole; label: string }[] = [
  { value: 'owner', label: 'Property Owner / Client' },
  { value: 'diaspora_owner', label: 'Diaspora Homeowner / Investor' },
  { value: 'corporate_client', label: 'Corporate Client Representative' },
  { value: 'main_contractor', label: 'Main Contractor' },
  { value: 'subcontractor', label: 'Subcontracting Partner' },
  { value: 'project_manager', label: 'Client Project Manager' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'designer', label: 'Architect / Designer' },
  { value: 'quantity_surveyor', label: 'Quantity Surveyor' },
  { value: 'local_representative', label: 'Local Representative' },
];

const AUTHORITY_DEFINITIONS: {
  key: keyof ClientPartnerAuthorities;
  label: string;
  description: string;
}[] = [
  {
    key: 'can_view_commercial',
    label: 'View Commercial Quotations & Contracts',
    description: 'Allows viewing client-visible quotations, contracts, and commercial schedules.',
  },
  {
    key: 'can_approve_quotations',
    label: 'Approve Quotations',
    description: 'Authorizes approving or rejecting project quotations.',
  },
  {
    key: 'can_approve_specifications',
    label: 'Approve Design Brief, Specs & Colours',
    description: 'Authorizes signing off paint colours, finishes, and design selections.',
  },
  {
    key: 'can_approve_variations',
    label: 'Approve Variations / Change Orders',
    description: 'Authorizes approving scope changes and variation requests.',
  },
  {
    key: 'can_acknowledge_completions',
    label: 'Acknowledge Area Completions',
    description: 'Authorizes signing off completed areas and milestone handovers.',
  },
  {
    key: 'can_approve_payments',
    label: 'Approve Payment Releases',
    description: 'Authorizes approving payment milestones and invoice releases.',
  },
  {
    key: 'can_view_financials',
    label: 'View Financial Summary',
    description: 'Grants visibility into project payment summaries and balances.',
  },
  {
    key: 'hide_subcontract_pricing',
    label: 'Hide Internal / Subcontract Pricing',
    description: 'Keeps internal subcontract rates and margins hidden from this account.',
  },
  {
    key: 'can_submit_requests_complaints',
    label: 'Submit Requests & Complaints',
    description: 'Allows logging service requests, issues, and confidential complaints.',
  },
];

function formatDateDisplay(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTimeDisplay(value?: string | null): string {
  if (!value) return 'Never signed in';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never signed in';
  return d.toLocaleString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRoleLabel(role: string): string {
  return (
    PARTY_ROLE_OPTIONS.find((o) => o.value === role)?.label ||
    role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const array = new Uint32Array(12);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * chars.length);
  }
  return 'DJ-' + Array.from(array, (n) => chars[n % chars.length]).join('');
}

export const ClientPartnersManagementModule: React.FC<ClientPartnersManagementModuleProps> = ({
  onBackToDashboard,
}) => {
  const [partners, setPartners] = useState<ClientPartnerRecord[]>([]);
  const [projects, setProjects] = useState<AssignableProjectSummary[]>([]);
  const [clientAccounts, setClientAccounts] = useState<ClientAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClientPartnerAccountStatus>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Create Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    full_name: string;
    email: string;
    password: string;
    company_name?: string;
    assigned_project_count: number;
    user_id: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newDesignation, setNewDesignation] = useState('');
  const [newExistingClientId, setNewExistingClientId] = useState('');
  const [newAccountType, setNewAccountType] = useState<ClientAccountType>('individual');
  const [newPartyRole, setNewPartyRole] = useState<PartyRole>('owner');
  const [newStatus, setNewStatus] = useState<'active' | 'pending'>('active');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newProjectIds, setNewProjectIds] = useState<string[]>([]);
  const [newProjectSearch, setNewProjectSearch] = useState('');
  const [newAuthorities, setNewAuthorities] = useState<ClientPartnerAuthorities>({
    ...DEFAULT_CLIENT_PARTNER_AUTHORITIES,
  });

  // Profile Detail Drawer State
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'projects' | 'profile'>('projects');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Edit Profile State inside Drawer
  const [editFullName, setEditFullName] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editAccountType, setEditAccountType] = useState<ClientAccountType>('individual');
  const [editPartyRole, setEditPartyRole] = useState<PartyRole>('owner');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Assign Project Panel inside Drawer
  const [assignPanelOpen, setAssignPanelOpen] = useState(false);
  const [assignProjectId, setAssignProjectId] = useState('');
  const [assignPartyRole, setAssignPartyRole] = useState<PartyRole>('owner');
  const [assignAuthorities, setAssignAuthorities] = useState<ClientPartnerAuthorities>({
    ...DEFAULT_CLIENT_PARTNER_AUTHORITIES,
  });
  const [isAssigningProject, setIsAssigningProject] = useState(false);

  // Revoke inline confirmation state
  const [revokingAccessId, setRevokingAccessId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  // Per-project authority edit state
  const [editingAccessId, setEditingAccessId] = useState<string | null>(null);
  const [editingAccessAuth, setEditingAccessAuth] = useState<ClientPartnerAuthorities | null>(null);
  const [isSavingAuthorities, setIsSavingAuthorities] = useState(false);

  // Invitation link state
  const [inviteLinkInfo, setInviteLinkInfo] = useState<{
    projectId: string;
    url: string;
    copied: boolean;
  } | null>(null);
  const [generatingInviteProjectId, setGeneratingInviteProjectId] = useState<string | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [partnersRes, projectsRes, clientsRes] = await Promise.all([
        ClientPartnerService.listClientPartners(),
        ClientPartnerService.listAssignableProjects(),
        ClientPartnerService.listClientAccounts(),
      ]);

      if (partnersRes.error) {
        setError(partnersRes.error);
      } else {
        setPartners(partnersRes.data);
        setMigrationPending(Boolean(partnersRes.migrationPending));
      }

      if (!projectsRes.error) {
        setProjects(projectsRes.data);
      }
      if (!clientsRes.error) {
        setClientAccounts(clientsRes.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load Client/Project Partners.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const selectedPartner = useMemo(
    () => partners.find((p) => p.user_id === selectedPartnerId) || null,
    [partners, selectedPartnerId]
  );

  // Sync profile edit inputs when switching selected partner
  useEffect(() => {
    if (selectedPartner) {
      setEditFullName(selectedPartner.full_name || '');
      setEditCompanyName(selectedPartner.company_name || '');
      setEditPhone(selectedPartner.phone || '');
      setEditDesignation(selectedPartner.designation || '');
      setEditAccountType(selectedPartner.account_type || 'individual');
      setEditPartyRole(selectedPartner.party_role || 'owner');
      setAssignPartyRole(selectedPartner.party_role || 'owner');
      setAssignPanelOpen(false);
      setRevokingAccessId(null);
      setEditingAccessId(null);
      setInviteLinkInfo(null);
    }
  }, [selectedPartner?.user_id]);

  // Derived KPI metrics
  const metrics = useMemo(() => {
    const total = partners.length;
    const active = partners.filter((p) => p.account_status === 'active').length;
    const pendingOrSuspended = partners.filter((p) => p.account_status !== 'active').length;
    const totalAssignments = partners.reduce((acc, p) => acc + p.active_project_count, 0);
    return { total, active, pendingOrSuspended, totalAssignments };
  }, [partners]);

  // Filtered & paginated list
  const filteredPartners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return partners.filter((p) => {
      if (statusFilter !== 'all' && p.account_status !== statusFilter) return false;
      if (assignmentFilter === 'assigned' && p.active_project_count === 0) return false;
      if (assignmentFilter === 'unassigned' && p.active_project_count > 0) return false;
      if (!q) return true;
      const inBasic = [p.full_name, p.company_name, p.client_name, p.email, p.phone, p.designation]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
      const inProjects = p.assigned_projects.some(
        (proj) =>
          (proj.project_name || '').toLowerCase().includes(q) ||
          (proj.project_code || '').toLowerCase().includes(q)
      );
      return inBasic || inProjects;
    });
  }, [partners, searchQuery, statusFilter, assignmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPartners.length / pageSize));
  const paginatedPartners = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPartners.slice(start, start + pageSize);
  }, [filteredPartners, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  const resetCreateForm = () => {
    setNewFullName('');
    setNewEmail('');
    setNewPhone('');
    setNewCompanyName('');
    setNewDesignation('');
    setNewExistingClientId('');
    setNewAccountType('individual');
    setNewPartyRole('owner');
    setNewStatus('active');
    setNewPassword(generateSecurePassword());
    setShowNewPassword(true);
    setNewProjectIds([]);
    setNewProjectSearch('');
    setNewAuthorities({ ...DEFAULT_CLIENT_PARTNER_AUTHORITIES });
    setCreateError(null);
    setCreatedCredentials(null);
    setCopiedCreds(false);
  };

  const handleOpenCreateModal = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newFullName.trim()) {
      setCreateError('Please enter the Client or Project Partner full name.');
      return;
    }
    if (!newEmail.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())) {
      setCreateError('Please enter a valid email address.');
      return;
    }
    const finalPassword = newPassword.trim() || generateSecurePassword();
    if (finalPassword.length < 8) {
      setCreateError('Password must be at least 8 characters long.');
      return;
    }

    setIsCreating(true);
    try {
      const res = await ClientPartnerService.createClientPartner({
        full_name: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: finalPassword,
        company_name: newCompanyName.trim() || undefined,
        phone: newPhone.trim() || undefined,
        designation: newDesignation.trim() || undefined,
        account_type: newAccountType,
        party_role: newPartyRole,
        status: newStatus,
        existing_client_id: newExistingClientId || null,
        project_ids: newProjectIds,
        authorities: newAuthorities,
      });

      if (res.error || !res.data) {
        setCreateError(res.error || 'Failed to create Client/Project Partner account.');
        return;
      }

      setCreatedCredentials({
        full_name: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: finalPassword,
        company_name: newCompanyName.trim() || undefined,
        assigned_project_count: res.data.assigned_project_count,
        user_id: res.data.user_id,
      });

      showToast(
        'success',
        `Client/Project Partner "${newFullName.trim()}" created with ${res.data.assigned_project_count} assigned project(s).`
      );
      await loadData(true);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;
    const loginUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : '/login';
    const text = [
      'Davejoe Interiors — Client & Project Partner Portal Access',
      `Name: ${createdCredentials.full_name}`,
      createdCredentials.company_name ? `Company: ${createdCredentials.company_name}` : null,
      `Portal Login URL: ${loginUrl}`,
      'Sign In As Role: Client / Project Partner',
      `Email: ${createdCredentials.email}`,
      `Temporary Password: ${createdCredentials.password}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 3000);
    } catch {
      showToast('error', 'Could not copy to clipboard.');
    }
  };

  const handleQuickStatusToggle = async (
    partner: ClientPartnerRecord,
    nextStatus: ClientPartnerAccountStatus
  ) => {
    setUpdatingStatusId(partner.user_id);
    try {
      const { error: statusErr } = await ClientPartnerService.updateClientPartnerStatus(
        partner.user_id,
        nextStatus
      );
      if (statusErr) {
        showToast('error', statusErr);
      } else {
        showToast(
          'success',
          `${partner.full_name}'s account status updated to ${nextStatus.toUpperCase()}.`
        );
        await loadData(true);
      }
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner) return;
    setIsSavingProfile(true);
    try {
      const { error: saveErr } = await ClientPartnerService.updateClientPartnerProfile({
        user_id: selectedPartner.user_id,
        full_name: editFullName,
        company_name: editCompanyName,
        phone: editPhone,
        designation: editDesignation,
        account_type: editAccountType,
        party_role: editPartyRole,
      });
      if (saveErr) {
        showToast('error', saveErr);
      } else {
        showToast('success', 'Client/Project Partner profile updated.');
        await loadData(true);
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAssignProject = async () => {
    if (!selectedPartner || !assignProjectId) return;
    setIsAssigningProject(true);
    try {
      const { error: assignErr } = await ClientPartnerService.assignProjectToPartner({
        user_id: selectedPartner.user_id,
        project_id: assignProjectId,
        party_role: assignPartyRole,
        authorities: assignAuthorities,
      });
      if (assignErr) {
        showToast('error', assignErr);
      } else {
        const proj = projects.find((p) => p.id === assignProjectId);
        showToast(
          'success',
          `Assigned "${proj?.name || 'project'}" to ${selectedPartner.full_name}. Client notified.`
        );
        setAssignProjectId('');
        setAssignPanelOpen(false);
        await loadData(true);
      }
    } finally {
      setIsAssigningProject(false);
    }
  };

  const handleRestoreProject = async (proj: ClientPartnerAssignedProject) => {
    if (!selectedPartner) return;
    setIsAssigningProject(true);
    try {
      const { error: restoreErr } = await ClientPartnerService.assignProjectToPartner({
        user_id: selectedPartner.user_id,
        project_id: proj.project_id,
        party_role: proj.party_role,
        authorities: {
          can_view_commercial: proj.can_view_commercial,
          can_approve_quotations: proj.can_approve_quotations,
          can_approve_specifications: proj.can_approve_specifications,
          can_approve_variations: proj.can_approve_variations,
          can_acknowledge_completions: proj.can_acknowledge_completions,
          can_approve_payments: proj.can_approve_payments,
          can_view_financials: proj.can_view_financials,
          hide_subcontract_pricing: proj.hide_subcontract_pricing,
          can_submit_requests_complaints: proj.can_submit_requests_complaints,
        },
      });
      if (restoreErr) {
        showToast('error', restoreErr);
      } else {
        showToast('success', `Restored portal access to "${proj.project_name}".`);
        await loadData(true);
      }
    } finally {
      setIsAssigningProject(false);
    }
  };

  const handleConfirmRevoke = async (accessId: string, projectName: string) => {
    setIsRevoking(true);
    try {
      const { error: revErr } = await ClientPartnerService.revokeProjectFromPartner(
        accessId,
        revokeReason
      );
      if (revErr) {
        showToast('error', revErr);
      } else {
        showToast('success', `Revoked portal access to "${projectName}".`);
        setRevokingAccessId(null);
        setRevokeReason('');
        await loadData(true);
      }
    } finally {
      setIsRevoking(false);
    }
  };

  const handleSaveProjectAuthorities = async (accessId: string) => {
    if (!editingAccessAuth) return;
    setIsSavingAuthorities(true);
    try {
      const { error: authErr } = await ClientPartnerService.updateProjectAuthorities(
        accessId,
        editingAccessAuth
      );
      if (authErr) {
        showToast('error', authErr);
      } else {
        showToast('success', 'Project authority controls updated.');
        setEditingAccessId(null);
        setEditingAccessAuth(null);
        await loadData(true);
      }
    } finally {
      setIsSavingAuthorities(false);
    }
  };

  const handleGenerateInviteLink = async (proj: ClientPartnerAssignedProject) => {
    if (!selectedPartner?.client_id) {
      showToast('error', 'Client account link is required before generating an invitation link.');
      return;
    }
    setGeneratingInviteProjectId(proj.project_id);
    try {
      const res = await ClientPartnerService.generateInvitationLink({
        client_id: selectedPartner.client_id,
        full_name: selectedPartner.full_name,
        phone: selectedPartner.phone,
        designation: selectedPartner.designation,
        project_id: proj.project_id,
        email: selectedPartner.email,
        party_role: proj.party_role,
        authorities: {
          can_view_commercial: proj.can_view_commercial,
          can_approve_quotations: proj.can_approve_quotations,
          can_approve_specifications: proj.can_approve_specifications,
          can_approve_variations: proj.can_approve_variations,
          can_acknowledge_completions: proj.can_acknowledge_completions,
          can_approve_payments: proj.can_approve_payments,
          can_view_financials: proj.can_view_financials,
          hide_subcontract_pricing: proj.hide_subcontract_pricing,
          can_submit_requests_complaints: proj.can_submit_requests_complaints,
        },
      });
      if (res.error || !res.inviteUrl) {
        showToast('error', res.error || 'Could not generate invitation link.');
        return;
      }
      setInviteLinkInfo({ projectId: proj.project_id, url: res.inviteUrl, copied: false });
      showToast('success', 'Secure client invitation link generated.');
    } finally {
      setGeneratingInviteProjectId(null);
    }
  };

  const renderStatusBadge = (status: ClientPartnerAccountStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#18b892] border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
            <AlertCircle className="w-3 h-3" />
            Suspended
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3" />
            Inactive
          </span>
        );
    }
  };

  const availableProjectsForSelectedPartner = useMemo(() => {
    if (!selectedPartner) return projects;
    const activeIds = new Set(
      selectedPartner.assigned_projects
        .filter((p) => p.is_active && !p.revoked_at)
        .map((p) => p.project_id)
    );
    return projects.filter((p) => !activeIds.has(p.id));
  }, [projects, selectedPartner]);

  const filteredCreateProjects = useMemo(() => {
    const q = newProjectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.project_code || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
    );
  }, [projects, newProjectSearch]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto p-0.5 rounded hover:bg-white/15 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#18b892] mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Overview
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Client/Project Partners
            </h1>
            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-[#18b892] border border-[#18b892]/25">
              External Portal Accounts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Register, activate, suspend, and assign projects to residential clients, diaspora investors,
            corporate representatives, main contractors, and subcontracting partners—completely separate from internal Staff.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#18b892] hover:bg-[#139c7b] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Create Client/Project Partner</span>
          </button>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin text-[#18b892]' : 'text-slate-500'}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Migration Notice (only if RPC isn't yet deployed on remote DB) */}
      {migrationPending && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Database Migration Pending</p>
            <p className="mt-0.5 text-amber-800 leading-relaxed">
              Run migration <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">20261125000005_client_partners_separation_and_management.sql</code> in Supabase SQL Editor to enable full last-login tracking, direct account provisioning, and automatic project-assignment notifications.
            </p>
          </div>
        </div>
      )}

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Client/Partners
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#18b892] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.total}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">External portal accounts</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Portal Accounts
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.active}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Authorized to sign in at /login</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Pending / Suspended
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.pendingOrSuspended}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Blocked from portal login</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Project Links
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{metrics.totalAssignments}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Explicit project access grants</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by client name, company, email, phone, or assigned project..."
              className="w-full pl-10 pr-4 h-10 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none focus:bg-white focus:border-[#18b892] focus:ring-1 focus:ring-[#18b892]"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 outline-none focus:bg-white focus:border-[#18b892] cursor-pointer"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={assignmentFilter}
              onChange={(e) => {
                setAssignmentFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 outline-none focus:bg-white focus:border-[#18b892] cursor-pointer"
            >
              <option value="all">All Project Assignments</option>
              <option value="assigned">Has Assigned Projects</option>
              <option value="unassigned">No Projects Assigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {partners.length === 0
                ? 'No Client/Project Partners Registered Yet'
                : 'No Matching Client/Project Partners Found'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              {partners.length === 0
                ? 'Create your first Client or Project Partner account and assign their authorized projects so they can access the Client Portal.'
                : 'Try adjusting your search query or account status filters.'}
            </p>
            {partners.length === 0 && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Create Client/Project Partner
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Client / Partner &amp; Company</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Assigned Projects</th>
                    <th className="py-3.5 px-4">Created / Last Login</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {paginatedPartners.map((partner) => {
                    const activeProjects = partner.assigned_projects.filter(
                      (p) => p.is_active && !p.revoked_at
                    );
                    const isUpdating = updatingStatusId === partner.user_id;

                    return (
                      <tr
                        key={partner.user_id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#18b892] font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-100">
                              {(partner.full_name || 'C').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPartnerId(partner.user_id);
                                  setDrawerTab('projects');
                                }}
                                className="font-bold text-slate-900 hover:text-[#18b892] text-left truncate block cursor-pointer"
                              >
                                {partner.full_name}
                              </button>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                {partner.company_name && (
                                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                                    <Building2 className="w-3 h-3 text-slate-400" />
                                    {partner.company_name}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                  {formatRoleLabel(partner.party_role)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="text-slate-800 font-medium flex items-center gap-1.5">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]">{partner.email}</span>
                            </div>
                            {partner.phone && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{partner.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">{renderStatusBadge(partner.account_status)}</td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                activeProjects.length > 0
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                  : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                            >
                              <FolderKanban className="w-3 h-3" />
                              {activeProjects.length}{' '}
                              {activeProjects.length === 1 ? 'Project' : 'Projects'}
                            </span>
                            {activeProjects.length > 0 && (
                              <div className="flex flex-wrap gap-1 max-w-[250px]">
                                {activeProjects.slice(0, 2).map((proj) => (
                                  <span
                                    key={proj.access_id}
                                    className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-700 truncate max-w-[160px]"
                                    title={proj.project_name}
                                  >
                                    {proj.project_code ? `${proj.project_code} · ` : ''}
                                    {proj.project_name}
                                  </span>
                                ))}
                                {activeProjects.length > 2 && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-500">
                                    +{activeProjects.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5 text-[11px]">
                            <div className="text-slate-700 font-medium">
                              Created: {formatDateDisplay(partner.created_at)}
                            </div>
                            <div className="text-slate-500">
                              Last login: {formatDateTimeDisplay(partner.last_sign_in_at)}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPartnerId(partner.user_id);
                                setDrawerTab('projects');
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#18b892] font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Manage &amp; Projects
                            </button>
                            {partner.account_status === 'active' ? (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleQuickStatusToggle(partner, 'suspended')}
                                className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleQuickStatusToggle(partner, 'active')}
                                className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, filteredPartners.length)} of{' '}
                {filteredPartners.length} Client/Project Partners
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-semibold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CREATE CLIENT / PROJECT PARTNER MODAL                                     */}
      {/* ========================================================================= */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#18b892] text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Create Client/Project Partner Account
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Provisions an external Client Portal account separate from internal Staff.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdCredentials ? (
              /* SUCCESS SCREEN */
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      Client/Project Partner Account Created
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {createdCredentials.full_name} is now registered in Client/Project Partners with{' '}
                      <strong>{createdCredentials.assigned_project_count}</strong> assigned project(s) and can sign in at{' '}
                      <code className="font-mono bg-emerald-100 px-1 rounded">/login</code>.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Client / Partner Name</span>
                    <span className="font-bold text-slate-900">{createdCredentials.full_name}</span>
                  </div>
                  {createdCredentials.company_name && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Company / Organization</span>
                      <span className="font-semibold text-slate-800">
                        {createdCredentials.company_name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sign-In Role</span>
                    <span className="font-semibold text-[#18b892]">Client / Project Partner</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Login Email</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {createdCredentials.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Temporary Password</span>
                    <span className="font-mono font-bold text-slate-900">
                      {createdCredentials.password}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    {copiedCreds ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        Credentials Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Login Details
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const uid = createdCredentials.user_id;
                      setCreateOpen(false);
                      setSelectedPartnerId(uid);
                      setDrawerTab('projects');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold cursor-pointer"
                  >
                    <FolderKanban className="w-4 h-4" />
                    Open Partner Profile
                  </button>
                </div>
              </div>
            ) : (
              /* CREATE FORM */
              <form onSubmit={handleCreatePartner} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 space-y-5 overflow-y-auto">
                  {createError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                      <span>{createError}</span>
                    </div>
                  )}

                  {/* Identity & Contact */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newFullName}
                        onChange={(e) => setNewFullName(e.target.value)}
                        placeholder="e.g. Engr. Chinedu Okafor"
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:border-[#18b892]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="client@company.com"
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:border-[#18b892]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Company / Organization Name
                      </label>
                      <input
                        type="text"
                        value={newCompanyName}
                        onChange={(e) => setNewCompanyName(e.target.value)}
                        placeholder="Optional for residential clients"
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:border-[#18b892]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+234 800 000 0000"
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:border-[#18b892]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Designation / Title
                      </label>
                      <input
                        type="text"
                        value={newDesignation}
                        onChange={(e) => setNewDesignation(e.target.value)}
                        placeholder="e.g. Managing Director, Homeowner"
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:bg-white focus:border-[#18b892]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Link to Existing Client Account (Optional)
                      </label>
                      <select
                        value={newExistingClientId}
                        onChange={(e) => {
                          setNewExistingClientId(e.target.value);
                          const matched = clientAccounts.find((c) => c.id === e.target.value);
                          if (matched && !newCompanyName) {
                            setNewCompanyName(matched.company_name || matched.name);
                          }
                        }}
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#18b892]"
                      >
                        <option value="">Create new client account automatically</option>
                        {clientAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.company_name || acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Account Type & Party Role */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Account Type
                      </label>
                      <select
                        value={newAccountType}
                        onChange={(e) => setNewAccountType(e.target.value as ClientAccountType)}
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#18b892]"
                      >
                        {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Project Party Role
                      </label>
                      <select
                        value={newPartyRole}
                        onChange={(e) => setNewPartyRole(e.target.value as PartyRole)}
                        className="w-full h-9 px-3 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#18b892]"
                      >
                        {PARTY_ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Password & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Initial Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setNewPassword(generateSecurePassword());
                            setShowNewPassword(true);
                          }}
                          className="text-[11px] font-semibold text-[#18b892] hover:underline cursor-pointer"
                        >
                          Generate Secure
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 characters"
                          className="w-full pl-8 pr-9 h-9 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 outline-none focus:bg-white focus:border-[#18b892]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Initial Account Status
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewStatus('active')}
                          className={`h-9 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                            newStatus === 'active'
                              ? 'bg-emerald-50 border-[#18b892] text-[#18b892]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewStatus('pending')}
                          className={`h-9 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                            newStatus === 'pending'
                              ? 'bg-amber-50 border-amber-400 text-amber-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Pending
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Initial Project Assignments */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Assign Initial Projects ({newProjectIds.length} selected)
                      </label>
                      <span className="text-[10px] text-slate-400">
                        Clients only see explicitly assigned projects
                      </span>
                    </div>

                    <input
                      type="text"
                      value={newProjectSearch}
                      onChange={(e) => setNewProjectSearch(e.target.value)}
                      placeholder="Filter projects by name, code, or location..."
                      className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:bg-white focus:border-[#18b892]"
                    />

                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {filteredCreateProjects.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No projects available to select.
                        </div>
                      ) : (
                        filteredCreateProjects.map((proj) => {
                          const checked = newProjectIds.includes(proj.id);
                          return (
                            <label
                              key={proj.id}
                              className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                                checked ? 'bg-emerald-50/60' : 'hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setNewProjectIds((prev) =>
                                      prev.includes(proj.id)
                                        ? prev.filter((id) => id !== proj.id)
                                        : [...prev, proj.id]
                                    )
                                  }
                                  className="rounded text-[#18b892] focus:ring-[#18b892] cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <span className="font-semibold text-slate-800 block truncate">
                                    {proj.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {proj.project_code || 'No Code'}
                                    {proj.location ? ` · ${proj.location}` : ''}
                                  </span>
                                </div>
                              </div>
                              {proj.status && (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600 capitalize shrink-0">
                                  {proj.status.replace(/_/g, ' ')}
                                </span>
                              )}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Portal Authorities for Assigned Projects */}
                  {newProjectIds.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Portal Permissions for Assigned Projects
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {AUTHORITY_DEFINITIONS.map((def) => (
                          <label
                            key={def.key}
                            className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/40 text-xs cursor-pointer hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={newAuthorities[def.key]}
                              onChange={(e) =>
                                setNewAuthorities((prev) => ({
                                  ...prev,
                                  [def.key]: e.target.checked,
                                }))
                              }
                              className="mt-0.5 rounded text-[#18b892] focus:ring-[#18b892] cursor-pointer"
                            />
                            <span className="leading-snug text-[11px] font-medium text-slate-700">
                              {def.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {isCreating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        Create Client/Project Partner
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLIENT / PROJECT PARTNER PROFILE & ASSIGNED PROJECTS DRAWER               */}
      {/* ========================================================================= */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/70 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#18b892] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {(selectedPartner.full_name || 'C').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-slate-900 truncate">
                      {selectedPartner.full_name}
                    </h2>
                    {renderStatusBadge(selectedPartner.account_status)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {selectedPartner.company_name ? `${selectedPartner.company_name} · ` : ''}
                    {selectedPartner.email}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500">
                    <span>Created: {formatDateDisplay(selectedPartner.created_at)}</span>
                    <span>·</span>
                    <span>Last login: {formatDateTimeDisplay(selectedPartner.last_sign_in_at)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPartnerId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="px-6 border-b border-slate-200 flex items-center gap-6 bg-white">
              <button
                type="button"
                onClick={() => setDrawerTab('projects')}
                className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  drawerTab === 'projects'
                    ? 'border-[#18b892] text-[#18b892]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FolderKanban className="w-4 h-4" />
                <span>Assigned Projects ({selectedPartner.active_project_count})</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('profile')}
                className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                  drawerTab === 'profile'
                    ? 'border-[#18b892] text-[#18b892]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Account Profile &amp; Status</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {drawerTab === 'projects' ? (
                <>
                  {/* Assign Project Trigger Bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Assigned Projects</h3>
                      <p className="text-xs text-slate-500">
                        Only active projects listed here appear inside this client&apos;s portal at{' '}
                        <code className="font-mono text-[11px] bg-slate-100 px-1 rounded">/client</code>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignPanelOpen((prev) => !prev);
                        setAssignAuthorities({ ...DEFAULT_CLIENT_PARTNER_AUTHORITIES });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Assign Project</span>
                    </button>
                  </div>

                  {/* Inline Assign Project Form */}
                  {assignPanelOpen && (
                    <div className="p-4 rounded-2xl border border-[#18b892]/40 bg-emerald-50/30 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Grant Access to Another Project
                        </span>
                        <button
                          type="button"
                          onClick={() => setAssignPanelOpen(false)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Select Project *
                          </label>
                          <select
                            value={assignProjectId}
                            onChange={(e) => setAssignProjectId(e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#18b892]"
                          >
                            <option value="">Choose a project...</option>
                            {availableProjectsForSelectedPartner.map((proj) => (
                              <option key={proj.id} value={proj.id}>
                                {proj.project_code ? `[${proj.project_code}] ` : ''}
                                {proj.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Party Role on Project
                          </label>
                          <select
                            value={assignPartyRole}
                            onChange={(e) => setAssignPartyRole(e.target.value as PartyRole)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#18b892]"
                          >
                            {PARTY_ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {AUTHORITY_DEFINITIONS.map((def) => (
                          <label
                            key={def.key}
                            className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200/80 text-[11px] text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={assignAuthorities[def.key]}
                              onChange={(e) =>
                                setAssignAuthorities((prev) => ({
                                  ...prev,
                                  [def.key]: e.target.checked,
                                }))
                              }
                              className="mt-0.5 rounded text-[#18b892] focus:ring-[#18b892] cursor-pointer"
                            />
                            <span>{def.label}</span>
                          </label>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAssignPanelOpen(false)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!assignProjectId || isAssigningProject}
                          onClick={handleAssignProject}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          {isAssigningProject ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Confirm Project Assignment
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Generated Invitation Link Callout */}
                  {inviteLinkInfo && (
                    <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-950 flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-blue-600" />
                          Secure Single-Use Invitation Link
                        </span>
                        <button
                          type="button"
                          onClick={() => setInviteLinkInfo(null)}
                          className="text-blue-500 hover:text-blue-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={inviteLinkInfo.url}
                          className="flex-1 h-8 px-2.5 bg-white border border-blue-200 rounded-lg font-mono text-[11px] text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(inviteLinkInfo.url);
                              setInviteLinkInfo((prev) => (prev ? { ...prev, copied: true } : null));
                            } catch {
                              showToast('error', 'Failed to copy link.');
                            }
                          }}
                          className="px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] cursor-pointer shrink-0"
                        >
                          {inviteLinkInfo.copied ? 'Copied' : 'Copy Link'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Assigned Projects List */}
                  {selectedPartner.assigned_projects.length === 0 ? (
                    <div className="py-12 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <FolderKanban className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">No Projects Assigned Yet</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                        This client can log in, but will see an empty portal until you assign one or more projects above.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPartner.assigned_projects.map((proj) => {
                        const isActiveAccess = proj.is_active && !proj.revoked_at;
                        const isEditingAuth = editingAccessId === proj.access_id;
                        const isRevokingThis = revokingAccessId === proj.access_id;

                        return (
                          <div
                            key={proj.access_id}
                            className={`rounded-2xl border p-4 space-y-3 ${
                              isActiveAccess
                                ? 'bg-white border-slate-200 shadow-2xs'
                                : 'bg-slate-50/80 border-slate-200/70 opacity-85'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-bold text-slate-900">
                                    {proj.project_name}
                                  </h4>
                                  {proj.project_code && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-semibold text-slate-600">
                                      {proj.project_code}
                                    </span>
                                  )}
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isActiveAccess
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-red-50 text-red-600 border border-red-200'
                                    }`}
                                  >
                                    {isActiveAccess ? 'Active Access' : 'Revoked'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                                  <span>Role: {formatRoleLabel(proj.party_role)}</span>
                                  {proj.project_location && <span>· {proj.project_location}</span>}
                                  <span>· Granted: {formatDateDisplay(proj.granted_at)}</span>
                                </div>
                                {!isActiveAccess && (
                                  <div className="text-[11px] text-red-600 mt-1">
                                    Revoked on {formatDateDisplay(proj.revoked_at)}
                                    {proj.revoke_reason ? ` — Reason: ${proj.revoke_reason}` : ''}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isActiveAccess ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isEditingAuth) {
                                          setEditingAccessId(null);
                                          setEditingAccessAuth(null);
                                        } else {
                                          setEditingAccessId(proj.access_id);
                                          setEditingAccessAuth({
                                            can_view_commercial: proj.can_view_commercial,
                                            can_approve_quotations: proj.can_approve_quotations,
                                            can_approve_specifications:
                                              proj.can_approve_specifications,
                                            can_approve_variations: proj.can_approve_variations,
                                            can_acknowledge_completions:
                                              proj.can_acknowledge_completions,
                                            can_approve_payments: proj.can_approve_payments,
                                            can_view_financials: proj.can_view_financials,
                                            hide_subcontract_pricing:
                                              proj.hide_subcontract_pricing,
                                            can_submit_requests_complaints:
                                              proj.can_submit_requests_complaints,
                                          });
                                        }
                                      }}
                                      title="Configure permissions"
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                                    >
                                      <SlidersHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={generatingInviteProjectId === proj.project_id}
                                      onClick={() => handleGenerateInviteLink(proj)}
                                      title="Generate invitation link"
                                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 text-blue-600 cursor-pointer disabled:opacity-50"
                                    >
                                      <Link2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRevokingAccessId(proj.access_id);
                                        setRevokeReason('');
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-[11px] font-semibold cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Revoke
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isAssigningProject}
                                    onClick={() => handleRestoreProject(proj)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700 text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    Restore Access
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Active permission summary badges */}
                            {isActiveAccess && !isEditingAuth && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {proj.can_view_commercial && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                                    Commercial
                                  </span>
                                )}
                                {proj.can_approve_quotations && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                                    Approve Quotes
                                  </span>
                                )}
                                {proj.can_approve_specifications && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                                    Approve Specs
                                  </span>
                                )}
                                {proj.can_approve_variations && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                                    Approve Variations
                                  </span>
                                )}
                                {proj.can_acknowledge_completions && (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-600">
                                    Acknowledge Completions
                                  </span>
                                )}
                                {proj.can_approve_payments && (
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-[10px] font-semibold text-blue-700">
                                    Approve Payments
                                  </span>
                                )}
                                {proj.hide_subcontract_pricing && (
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-[10px] font-semibold text-amber-700">
                                    Subcontract Rates Hidden
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Inline Permission Editor */}
                            {isEditingAuth && editingAccessAuth && (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {AUTHORITY_DEFINITIONS.map((def) => (
                                    <label
                                      key={def.key}
                                      className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={editingAccessAuth[def.key]}
                                        onChange={(e) =>
                                          setEditingAccessAuth((prev) =>
                                            prev ? { ...prev, [def.key]: e.target.checked } : prev
                                          )
                                        }
                                        className="mt-0.5 rounded text-[#18b892] focus:ring-[#18b892] cursor-pointer"
                                      />
                                      <span>{def.label}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAccessId(null);
                                      setEditingAccessAuth(null);
                                    }}
                                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSavingAuthorities}
                                    onClick={() => handleSaveProjectAuthorities(proj.access_id)}
                                    className="px-3 py-1 rounded-lg bg-[#18b892] hover:bg-[#139c7b] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {isSavingAuthorities ? 'Saving...' : 'Save Permissions'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Inline Revoke Confirmation */}
                            {isRevokingThis && (
                              <div className="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2.5">
                                <p className="text-xs font-bold text-red-900">
                                  Revoke portal access to {proj.project_name}?
                                </p>
                                <input
                                  type="text"
                                  value={revokeReason}
                                  onChange={(e) => setRevokeReason(e.target.value)}
                                  placeholder="Optional reason for audit log (e.g. Project completed, Role changed)"
                                  className="w-full h-8 px-2.5 bg-white border border-red-200 rounded-lg text-xs text-slate-800 outline-none focus:border-red-400"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setRevokingAccessId(null)}
                                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isRevoking}
                                    onClick={() =>
                                      handleConfirmRevoke(proj.access_id, proj.project_name)
                                    }
                                    className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                  >
                                    {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* PROFILE & ACCOUNT STATUS TAB */
                <div className="space-y-6">
                  {/* Account Status Controls */}
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Account Status &amp; Login Access
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Suspending or deactivating an account immediately blocks Client Portal login and API queries.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['active', 'pending', 'suspended', 'inactive'] as ClientPartnerAccountStatus[]).map(
                        (st) => {
                          const isCurrent = selectedPartner.account_status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              disabled={isCurrent || updatingStatusId === selectedPartner.user_id}
                              onClick={() => handleQuickStatusToggle(selectedPartner, st)}
                              className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-colors cursor-pointer disabled:cursor-default ${
                                isCurrent
                                  ? 'bg-[#18b892] text-white border-[#18b892]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Edit Profile Form */}
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#18b892]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Company / Organization
                        </label>
                        <input
                          type="text"
                          value={editCompanyName}
                          onChange={(e) => setEditCompanyName(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#18b892]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Phone Number
                        </label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#18b892]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={editDesignation}
                          onChange={(e) => setEditDesignation(e.target.value)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#18b892]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Account Type
                        </label>
                        <select
                          value={editAccountType}
                          onChange={(e) => setEditAccountType(e.target.value as ClientAccountType)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#18b892]"
                        >
                          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Default Party Role
                        </label>
                        <select
                          value={editPartyRole}
                          onChange={(e) => setEditPartyRole(e.target.value as PartyRole)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-[#18b892]"
                        >
                          {PARTY_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-slate-700">
                        <KeyRound className="w-3.5 h-3.5 text-[#18b892]" />
                        <span>Client Portal Sign-In Details</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Login Email: <span className="font-mono text-slate-800">{selectedPartner.email}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Portal Route: <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">/login</code>{' '}
                        &rarr; select <strong>Client / Project Partner</strong> &rarr; redirects to{' '}
                        <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">/client</code>
                      </p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                      >
                        {isSavingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientPartnersManagementModule;
