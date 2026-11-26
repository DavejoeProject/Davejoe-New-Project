import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  FileText,
  Palette,
  ClipboardCheck,
  ShieldCheck,
  GitBranch,
  MessageSquareWarning,
  LogOut,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  Upload,
  Eye,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  Loader2,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  ClientPortalService,
  ClientProjectAccess,
  ProjectPortalBundle,
  ClientQuotationContract,
  ProjectSpecification,
  PreworkSurfaceInspection,
  MediaEvidenceItem,
  ACCOUNT_TYPE_LABELS,
  PARTY_ROLE_LABELS,
  REWORK_CLASSIFICATION_LABELS,
  REQUEST_CATEGORIES,
  COMPLAINT_CATEGORIES,
  formatCurrency,
  formatShortDate,
  formatDateTime,
} from '../../services/clientPortalService';
import {
  Phase2ControlsService,
  ProjectWorkPackageBundle,
  INSPECTION_STATUS_LABELS,
  APPROVAL_STATUS_LABELS,
  DELAY_STATUS_LABELS,
} from '../../services/phase2ControlsService';
import {
  CorporateAuthorityService,
  CorporatePortfolioSummary,
  EffectiveAuthorityEvaluation,
  AUTHORITY_LEVEL_LABELS,
} from '../../services/corporateAuthorityService';
import {
  StatusText,
  ProgressStageTrack,
  VariationStepper,
  EvidenceUploader,
  EvidenceMediaGallery,
} from './ClientPortalShared';
import { NotificationBell, MenuAlertBadge } from '../common/NotificationBell';
import { useNotifications } from '../../context/NotificationContext';
import { AppNotification } from '../../services/notificationService';

type ClientSection =
  | 'portfolio'
  | 'overview'
  | 'work-packages'
  | 'quotations'
  | 'brief'
  | 'progress'
  | 'completions'
  | 'variations'
  | 'requests';

export const ClientPortalDashboard: React.FC = () => {
  const { user, profile, currentRoleKey, logout } = useAuth();
  const { getModuleUnreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const isLeadershipPreview = currentRoleKey === 'management' || currentRoleKey === 'executive_director';

  const [loading, setLoading] = useState(true);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unauthorizedProjectBlocked, setUnauthorizedProjectBlocked] = useState(false);

  const [accessRecords, setAccessRecords] = useState<ClientProjectAccess[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [bundle, setBundle] = useState<ProjectPortalBundle | null>(null);
  const [wpBundle, setWpBundle] = useState<ProjectWorkPackageBundle | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<CorporatePortfolioSummary | null>(null);
  const [effectiveAuthority, setEffectiveAuthority] = useState<EffectiveAuthorityEvaluation | null>(null);
  const [activeSection, setActiveSection] = useState<ClientSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Brief view toggle: residential room-by-room vs commercial floor/zone/work-package
  const [briefViewMode, setBriefViewMode] = useState<'residential' | 'commercial'>('residential');

  // Interactive decision drawers/states
  const [quoteActionId, setQuoteActionId] = useState<string | null>(null);
  const [quoteComment, setQuoteComment] = useState('');
  const [quoteConfirmChecked, setQuoteConfirmChecked] = useState(false);
  const [showB2BUpload, setShowB2BUpload] = useState(false);
  const [b2bTitle, setB2bTitle] = useState('');
  const [b2bRef, setB2bRef] = useState('');
  const [b2bDocType, setB2bDocType] = useState<'client_purchase_order' | 'contract'>('client_purchase_order');
  const [b2bScope, setB2bScope] = useState('');
  const [b2bAmount, setB2bAmount] = useState('');
  const [b2bFiles, setB2bFiles] = useState<MediaEvidenceItem[]>([]);

  const [specComments, setSpecComments] = useState<Record<string, string>>({});
  const [preworkNotes, setPreworkNotes] = useState<Record<string, string>>({});
  const [areaComments, setAreaComments] = useState<Record<string, string>>({});
  const [damageResponses, setDamageResponses] = useState<Record<string, string>>({});
  const [variationNotes, setVariationNotes] = useState<Record<string, string>>({});

  // Request / Complaint form state
  const [ticketKind, setTicketKind] = useState<'request' | 'complaint'>('request');
  const [ticketCategory, setTicketCategory] = useState<string>(REQUEST_CATEGORIES[0].value);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [ticketConfidential, setTicketConfidential] = useState(false);
  const [ticketAttachments, setTicketAttachments] = useState<MediaEvidenceItem[]>([]);
  const [submittingAction, setSubmittingAction] = useState(false);

  const actorName = useMemo(() => {
    return (
      profile?.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      user?.email ||
      'Authorized Client Representative'
    );
  }, [profile, user]);

  const activeAccess = useMemo(
    () => accessRecords.find((r) => r.project_id === selectedProjectId) || accessRecords[0] || null,
    [accessRecords, selectedProjectId]
  );

  // Extract optional deep-linked projectId from /client/projects/:projectId or ?projectId=...
  const requestedUrlProjectId = useMemo(() => {
    const pathMatch = location.pathname.match(/^\/client\/projects\/([^/?#]+)/);
    if (pathMatch && pathMatch[1]) {
      return decodeURIComponent(pathMatch[1]).trim();
    }
    const params = new URLSearchParams(location.search);
    const qId = params.get('projectId');
    return qId ? qId.trim() : null;
  }, [location.pathname, location.search]);

  // Load accessible projects for this client user (or leadership preview)
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!user) return;
      setLoading(true);
      setError(null);
      setUnauthorizedProjectBlocked(false);
      try {
        const ctx = await ClientPortalService.getMyClientPortalContext(user.id);
        let records = ctx.accessRecords;

        if (records.length === 0 && isLeadershipPreview) {
          const allProjects = await ClientPortalService.getAllProjectsSummary();
          records = allProjects.slice(0, 20).map((p) => ({
            id: `preview-${p.id}`,
            client_id: p.client_id || '',
            client_contact_id: '',
            project_id: p.id,
            user_id: user.id,
            party_role: 'corporate_client',
            can_view_commercial: true,
            can_approve_quotations: false,
            can_approve_specifications: false,
            can_approve_variations: false,
            can_acknowledge_completions: false,
            can_approve_payments: false,
            can_view_financials: true,
            hide_subcontract_pricing: false,
            can_submit_requests_complaints: true,
            is_active: true,
            granted_at: new Date().toISOString(),
            project: p,
          }));
        }

        if (mounted) {
          setAccessRecords(records);

          if (requestedUrlProjectId) {
            const matched = records.find((r) => r.project_id === requestedUrlProjectId);
            if (!matched) {
              // Strictly block unauthorized URL project UUID spoofing without querying that project
              setUnauthorizedProjectBlocked(true);
              setSelectedProjectId('');
              setBundle(null);
              return;
            }
            setUnauthorizedProjectBlocked(false);
            setSelectedProjectId(matched.project_id);
            const model = matched.project?.project_delivery_model;
            if (model === 'direct_corporate' || model === 'main_contractor_subcontract' || model === 'multi_party_commercial') {
              setBriefViewMode('commercial');
            }
            return;
          }

          if (records.length > 0) {
            setSelectedProjectId(records[0].project_id);
            const model = records[0].project?.project_delivery_model;
            if (model === 'direct_corporate' || model === 'main_contractor_subcontract' || model === 'multi_party_commercial') {
              setBriefViewMode('commercial');
            }
          } else {
            setSelectedProjectId('');
            setBundle(null);
          }
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Unable to load your authorized projects.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [user, isLeadershipPreview, requestedUrlProjectId]);

  const refreshBundle = useCallback(async () => {
    if (!selectedProjectId) return;
    setBundleLoading(true);
    setError(null);
    try {
      const [data, wpData, authEval] = await Promise.all([
        ClientPortalService.getProjectPortalBundle(selectedProjectId, {
          isClientView: !isLeadershipPreview,
          access: activeAccess || undefined,
        }),
        Phase2ControlsService.getProjectWorkPackageBundle(selectedProjectId, {
          includeOperationalLinks: false,
        }).catch(() => null),
        user
          ? CorporateAuthorityService.evaluateEffectiveAuthority(activeAccess, user.id).catch(() => null)
          : Promise.resolve(null),
      ]);
      setBundle(data);
      setWpBundle(wpData);
      setEffectiveAuthority(authEval);
    } catch (err: any) {
      setError(err?.message || 'Unable to load project details.');
    } finally {
      setBundleLoading(false);
    }
  }, [selectedProjectId, activeAccess, isLeadershipPreview, user]);

  useEffect(() => {
    refreshBundle();
  }, [refreshBundle]);

  // Load multi-project corporate portfolio rollup when client has multiple projects or portfolio access
  useEffect(() => {
    let active = true;
    async function loadPortfolio() {
      if (!user || accessRecords.length === 0) return;
      const shouldLoad =
        accessRecords.length > 1 ||
        Boolean(effectiveAuthority?.corporatePortfolioAccess) ||
        isLeadershipPreview;
      if (!shouldLoad) return;
      try {
        const pf = await CorporateAuthorityService.getCorporatePortfolioSummary(
          isLeadershipPreview ? null : activeAccess?.client_id || null
        );
        if (active) setPortfolioSummary(pf);
      } catch {
        // Non-blocking fallback
      }
    }
    loadPortfolio();
    return () => {
      active = false;
    };
  }, [user, accessRecords.length, effectiveAuthority?.corporatePortfolioAccess, isLeadershipPreview, activeAccess?.client_id]);

  const showSuccess = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  // Pending client action counts
  const pendingCounts = useMemo(() => {
    if (!bundle) return { quotations: 0, specs: 0, prework: 0, completions: 0, variations: 0, total: 0 };
    const quotations = bundle.quotations.filter((q) => q.status === 'issued').length;
    const specs = bundle.specifications.filter((s) => s.status === 'awaiting_approval' || s.status === 'submitted').length;
    const prework = bundle.preworkInspections.filter((p) => p.client_decision === 'pending').length;
    const completions = bundle.areaCompletions.filter((a) => a.client_acknowledgement_status === 'pending').length;
    const variations = bundle.variations.filter((v) => v.workflow_stage === 'awaiting_client_approval').length;
    return {
      quotations,
      specs,
      prework,
      completions,
      variations,
      total: quotations + specs + prework + completions + variations,
    };
  }, [bundle]);

  // Actions
  const handleQuotationView = async (q: ClientQuotationContract) => {
    if (user && !q.viewed_at && !isLeadershipPreview) {
      await ClientPortalService.markQuotationViewed(q.id, user.id);
    }
    setQuoteActionId(quoteActionId === q.id ? null : q.id);
    setQuoteComment('');
    setQuoteConfirmChecked(false);
  };

  const handleQuotationDecision = async (
    q: ClientQuotationContract,
    action: 'accepted' | 'declined' | 'clarification_requested' | 'revision_requested'
  ) => {
    if (!user) return;
    if (action === 'accepted' && !quoteConfirmChecked) {
      setError('Please tick the formal acceptance confirmation checkbox first. Viewing never counts as acceptance.');
      return;
    }
    setSubmittingAction(true);
    setError(null);
    try {
      await ClientPortalService.respondToQuotation({
        quotationId: q.id,
        action,
        userId: user.id,
        contactId: activeAccess?.client_contact_id,
        decidedByName: actorName,
        comments: quoteComment,
        confirmedAuthorityStatement: quoteConfirmChecked,
      });
      setQuoteActionId(null);
      setQuoteComment('');
      setQuoteConfirmChecked(false);
      await refreshBundle();
      showSuccess(
        action === 'accepted'
          ? `Quotation ${q.reference_no} v${q.version_number} formally accepted and locked.`
          : `Response recorded for ${q.reference_no}.`
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to record commercial response.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleB2BUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundle || !user || !activeAccess?.client_id) return;
    setSubmittingAction(true);
    setError(null);
    try {
      const primaryFile = b2bFiles[0];
      await ClientPortalService.createQuotationContract({
        project_id: bundle.project.id,
        client_id: activeAccess.client_id,
        document_type: b2bDocType,
        reference_no: b2bRef || undefined,
        title: b2bTitle,
        scope_summary: b2bScope,
        subtotal: Number(b2bAmount || 0),
        tax_amount: 0,
        total_amount: Number(b2bAmount || 0),
        is_b2b_client_issued: true,
        document_storage_path: primaryFile?.storage_path || null,
        document_file_name: primaryFile?.file_name || null,
        status: 'issued',
        prepared_by: user.id,
      });
      setShowB2BUpload(false);
      setB2bTitle('');
      setB2bRef('');
      setB2bScope('');
      setB2bAmount('');
      setB2bFiles([]);
      await refreshBundle();
      showSuccess('Client-issued commercial document submitted to project records.');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit document.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSpecDecision = async (spec: ProjectSpecification, decision: 'approved' | 'rejected') => {
    if (!user) return;
    setSubmittingAction(true);
    setError(null);
    try {
      await ClientPortalService.decideSpecification({
        specId: spec.id,
        decision,
        userId: user.id,
        contactId: activeAccess?.client_contact_id,
        approverName: actorName,
        comments: specComments[spec.id],
        parentSpecIdToSupersede: spec.parent_id,
      });
      await refreshBundle();
      showSuccess(
        decision === 'approved'
          ? `Specification ${spec.spec_code} v${spec.version_number} approved and locked.`
          : `Revision requested for ${spec.spec_code}.`
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to record specification decision.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handlePreworkDecision = async (
    item: PreworkSurfaceInspection,
    decision: PreworkSurfaceInspection['client_decision']
  ) => {
    if (!user) return;
    setSubmittingAction(true);
    setError(null);
    try {
      await ClientPortalService.recordClientPreworkDecision({
        inspectionId: item.id,
        decision,
        notes: preworkNotes[item.id],
        userId: user.id,
        deciderName: actorName,
      });
      await refreshBundle();
      showSuccess(`Decision recorded for Pre-Work Inspection ${item.inspection_ref}.`);
    } catch (err: any) {
      setError(err?.message || 'Unable to record pre-work decision.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleProgressAcknowledge = async (updateId: string) => {
    if (!user) return;
    setSubmittingAction(true);
    setError(null);
    try {
      await ClientPortalService.advanceProgressVerificationStage({
        updateId,
        nextStage: 'acknowledged_by_client',
        actorUserId: user.id,
        actorName,
      });
      await refreshBundle();
      showSuccess('Progress verification acknowledged.');
    } catch (err: any) {
      setError(err?.message || 'Unable to acknowledge progress update.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAreaAcknowledgement = async (completionId: string, decision: 'acknowledged' | 'rejected') => {
    if (!user) return;
    setSubmittingAction(true);
    setError(null);
    try {
      await ClientPortalService.clientAcknowledgeAreaCompletion({
        completionId,
        decision,
        userId: user.id,
        acknowledgerName: actorName,
        comments: areaComments[completionId],
      });
      await refreshBundle();
      showSuccess(
        decision === 'acknowledged' ? 'Area completion acknowledged.' : 'Area completion flagged with comments.'
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to update area acknowledgement.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDamageResponse = async (incidentId: string) => {
    if (!user || !damageResponses[incidentId]?.trim()) return;
    setSubmittingAction(true);
    setError(null);
    try {
      await ClientPortalService.recordExternalDamageResponse({
        incidentId,
        responseText: damageResponses[incidentId],
        userId: user.id,
      });
      setDamageResponses((prev) => ({ ...prev, [incidentId]: '' }));
      await refreshBundle();
      showSuccess('Your response has been logged on the subsequent damage record.');
    } catch (err: any) {
      setError(err?.message || 'Unable to submit response.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleVariationDecision = async (
    variationId: string,
    decision: 'client_approved' | 'client_rejected' | 'disputed'
  ) => {
    if (!user) return;
    setSubmittingAction(true);
    setError(null);
    try {
      await ClientPortalService.clientDecideVariation({
        variationId,
        decision,
        userId: user.id,
        deciderName: actorName,
        notes: variationNotes[variationId],
      });
      await refreshBundle();
      showSuccess('Variation decision recorded.');
    } catch (err: any) {
      setError(err?.message || 'Unable to record variation decision.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bundle) return;
    const clientId = activeAccess?.client_id || bundle.project.client_id;
    if (!clientId) {
      setError('This project is not linked to a client account yet.');
      return;
    }
    setSubmittingAction(true);
    setError(null);
    try {
      const created = await ClientPortalService.createRequestOrComplaint({
        record_kind: ticketKind,
        project_id: bundle.project.id,
        client_id: clientId,
        category: ticketCategory,
        subject: ticketSubject,
        description: ticketDescription,
        priority: ticketPriority,
        attachments: ticketAttachments,
        submitted_by_user_id: user.id,
        submitted_by_contact_id: activeAccess?.client_contact_id || null,
        submitted_by_name: actorName,
        is_confidential_management: ticketKind === 'complaint' && ticketConfidential,
      });
      setTicketSubject('');
      setTicketDescription('');
      setTicketConfidential(false);
      setTicketAttachments([]);
      await refreshBundle();
      showSuccess(
        created.is_confidential_management
          ? `Confidential escalation ${created.reference_no} delivered directly to Management & Executive Director.`
          : `${ticketKind === 'complaint' ? 'Complaint' : 'Request'} ${created.reference_no} submitted.`
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to submit request.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleDownloadQuotationDoc = async (storagePath?: string | null, fileName?: string | null) => {
    if (!storagePath) return;
    const url = await ClientPortalService.getSignedEvidenceUrl(storagePath);
    if (!url) {
      setError('Document attachment could not be retrieved.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.pdf';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const showPortfolioNav =
    accessRecords.length > 1 ||
    Boolean(effectiveAuthority?.corporatePortfolioAccess) ||
    isLeadershipPreview;

  const handleNavigateNotification = useCallback(
    (notification: AppNotification): boolean => {
      if (
        notification.project_id &&
        accessRecords.some((r) => r.project_id === notification.project_id)
      ) {
        setSelectedProjectId(notification.project_id);
      }
      const mod = notification.source_module;
      if (mod === 'work_packages') setActiveSection('work-packages');
      else if (mod === 'quotations') setActiveSection('quotations');
      else if (mod === 'specifications') setActiveSection('brief');
      else if (mod === 'technical_qc') setActiveSection('progress');
      else if (mod === 'completions') setActiveSection('completions');
      else if (mod === 'variations') setActiveSection('variations');
      else if (mod === 'requests_complaints') setActiveSection('requests');
      else setActiveSection('overview');
      setMobileMenuOpen(false);
      return true;
    },
    [accessRecords]
  );

  const navItems: {
    id: ClientSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    alertCount?: number;
  }[] = [
    ...(showPortfolioNav ? [{ id: 'portfolio' as ClientSection, label: 'Corporate Portfolio', icon: Briefcase }] : []),
    { id: 'overview', label: 'Project Overview', icon: LayoutDashboard, alertCount: getModuleUnreadCount(['client_portal', 'projects']) },
    { id: 'work-packages', label: 'Work Packages & Milestones', icon: Layers, alertCount: getModuleUnreadCount(['work_packages']) },
    { id: 'quotations', label: 'Quotations & Contracts', icon: FileText, count: pendingCounts.quotations, alertCount: getModuleUnreadCount(['quotations']) },
    { id: 'brief', label: 'Brief & Colour Approvals', icon: Palette, count: pendingCounts.specs, alertCount: getModuleUnreadCount(['specifications']) },
    { id: 'progress', label: 'Progress & Pre-Work QC', icon: ClipboardCheck, count: pendingCounts.prework, alertCount: getModuleUnreadCount(['technical_qc']) },
    { id: 'completions', label: 'Area Completions & Releases', icon: ShieldCheck, count: pendingCounts.completions, alertCount: getModuleUnreadCount(['completions']) },
    { id: 'variations', label: 'Variations & Rework', icon: GitBranch, count: pendingCounts.variations, alertCount: getModuleUnreadCount(['variations']) },
    { id: 'requests', label: 'Requests & Complaints', icon: MessageSquareWarning, alertCount: getModuleUnreadCount(['requests_complaints']) },
  ];

  // Grouped specs for residential vs commercial display
  const groupedSpecs = useMemo(() => {
    if (!bundle) return [];
    const groups = new Map<string, ProjectSpecification[]>();
    for (const spec of bundle.specifications) {
      const pkg = bundle.workPackages.find((w) => w.id === spec.work_package_id);
      const key =
        briefViewMode === 'residential'
          ? spec.area_label || 'General Room / Space'
          : pkg
            ? `${pkg.package_code} · ${pkg.title}${pkg.floor_level ? ` (${pkg.floor_level})` : ''}`
            : spec.floor_zone || 'General Work Package / Zone';
      const arr = groups.get(key) || [];
      arr.push(spec);
      groups.set(key, arr);
    }
    return Array.from(groups.entries());
  }, [bundle, briefViewMode]);

  const authoritySummary = useMemo(() => {
    if (!activeAccess) return [];
    const items: string[] = [];
    if (activeAccess.can_approve_quotations) items.push('Approve Quotations');
    if (activeAccess.can_approve_specifications) items.push('Approve Colours & Specs');
    if (activeAccess.can_approve_variations) items.push('Approve Variations');
    if (activeAccess.can_acknowledge_completions) items.push('Acknowledge Completions');
    if (activeAccess.can_approve_payments) items.push('Approve Payments');
    if (activeAccess.can_view_financials) items.push('View Financials');
    return items;
  }, [activeAccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9f8] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#18b892]" />
        <p className="text-xs font-medium text-slate-500">Loading Davejoe Client & Project Partner Portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9f8] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200/90 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#18b892] text-white font-bold text-xs flex items-center justify-center">
              DJ
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-tight text-slate-900 truncate">Davejoe Interiors</p>
              <p className="text-[11px] text-slate-500 truncate">Client & Partner Portal</p>
            </div>
          </div>
        </div>

        {/* Account Identity */}
        {activeAccess && (
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {activeAccess.client?.company_name || activeAccess.client?.name || 'Authorized Account'}
            </p>
            <p className="text-[11px] text-slate-500 truncate mt-0.5">
              {actorName} · {PARTY_ROLE_LABELS[activeAccess.party_role]}
            </p>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#18b892]/10 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#18b892]' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0 ml-2">
                  {item.alertCount ? <MenuAlertBadge count={item.alertCount} active={active} /> : null}
                  {item.count ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-semibold">
                      {item.count}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          {(authoritySummary.length > 0 || effectiveAuthority) && (
            <div className="px-2.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200/70 space-y-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                {effectiveAuthority?.isAuthorizedSignatory
                  ? 'Authorized Signatory'
                  : 'Your Project Authority'}
              </p>
              {effectiveAuthority && (
                <p className="text-[11px] font-semibold text-slate-800">
                  {AUTHORITY_LEVEL_LABELS[effectiveAuthority.authorityLevel] ||
                    `Level ${effectiveAuthority.authorityLevel}`}
                </p>
              )}
              {authoritySummary.length > 0 && (
                <p className="text-[11px] text-slate-600 leading-relaxed">{authoritySummary.join(' · ')}</p>
              )}
              {effectiveAuthority &&
                (effectiveAuthority.quotationLimit != null ||
                  effectiveAuthority.variationLimit != null) && (
                  <p className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-200/60">
                    {effectiveAuthority.canApproveQuotations &&
                      effectiveAuthority.quotationLimit != null &&
                      `Quote cap: ${formatCurrency(effectiveAuthority.quotationLimit, effectiveAuthority.currency)} `}
                    {effectiveAuthority.canApproveVariations &&
                      effectiveAuthority.variationLimit != null &&
                      `· Var cap: ${formatCurrency(effectiveAuthority.variationLimit, effectiveAuthority.currency)}`}
                  </p>
                )}
              {effectiveAuthority && effectiveAuthority.activeDelegationsReceived.length > 0 && (
                <p className="text-[10px] font-medium text-[#18b892] pt-0.5">
                  +{effectiveAuthority.activeDelegationsReceived.length} active delegated authority
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#18b892] text-white font-bold text-xs flex items-center justify-center">
            DJ
          </div>
          <span className="text-sm font-bold text-slate-900">Client Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell onNavigateNotification={handleNavigateNotification} />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="p-2 rounded-lg border border-slate-200 text-slate-600"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 z-20">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${
                  activeSection === item.id ? 'bg-[#18b892]/10 text-slate-900 font-semibold' : 'text-slate-600'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-[#18b892]" />
                  {item.label}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {item.alertCount ? <MenuAlertBadge count={item.alertCount} active={activeSection === item.id} /> : null}
                  {item.count ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono">{item.count}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => logout()}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Project Switcher Bar */}
        <header className="bg-white border-b border-slate-200/90 px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{activeAccess?.client?.account_type ? ACCOUNT_TYPE_LABELS[activeAccess.client.account_type] : 'Project Workspace'}</span>
              {isLeadershipPreview && (
                <>
                  <span>·</span>
                  <span className="text-[#18b892] font-semibold">Leadership Preview Mode</span>
                </>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate mt-0.5">
              {bundle?.project.name || 'No Assigned Projects Yet'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <NotificationBell onNavigateNotification={handleNavigateNotification} />
            </div>
            {accessRecords.length > 0 && (
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setUnauthorizedProjectBlocked(false);
                  setSelectedProjectId(nextId);
                  if (location.pathname !== '/client') {
                    navigate(`/client/projects/${nextId}`, { replace: true });
                  }
                }}
                aria-label="Switch project"
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:border-[#18b892]"
              >
                {accessRecords.map((rec) => (
                  <option key={rec.project_id} value={rec.project_id}>
                    {rec.project?.project_code} — {rec.project?.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={refreshBundle}
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${bundleLoading ? 'animate-spin text-[#18b892]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </span>
              <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:underline cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {notice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#18b892]" />
              {notice}
            </div>
          )}

          {unauthorizedProjectBlocked ? (
            <div className="bg-white rounded-2xl border border-rose-200 p-10 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Project Access Restricted</h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                You are not authorized to view the requested project. Your Client Portal only displays projects
                explicitly assigned to your account by Davejoe Interiors Management.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUnauthorizedProjectBlocked(false);
                    navigate('/client', { replace: true });
                    if (accessRecords.length > 0) {
                      setSelectedProjectId(accessRecords[0].project_id);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#18b892] hover:bg-[#139c7b] text-white text-xs font-bold cursor-pointer"
                >
                  Return to My Authorized Projects
                </button>
              </div>
            </div>
          ) : accessRecords.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#18b892] flex items-center justify-center mx-auto">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-slate-900">No Projects Assigned Yet</h2>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Welcome, <span className="font-semibold text-slate-800">{actorName}</span>. Your Client &amp; Project
                Partner account is active, but no projects have been assigned to your portal yet. Once Davejoe
                Interiors Management assigns your project(s), they will appear here automatically.
              </p>
              <p className="text-[11px] text-slate-400">
                Signed in as <span className="font-mono text-slate-600">{user?.email}</span>
              </p>
            </div>
          ) : !bundle ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#18b892]" />
            </div>
          ) : (
            <>
              {/* ================================================================= */}
              {/* SECTION 0: MULTI-PROJECT CORPORATE PORTFOLIO DASHBOARD            */}
              {/* ================================================================= */}
              {activeSection === 'portfolio' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Corporate Multi-Project Portfolio</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Consolidated visibility across all projects authorized for your organization and contact profile.
                    </p>
                  </div>

                  {portfolioSummary ? (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
                          <p className="text-xs text-slate-500">Authorized Projects</p>
                          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                            {portfolioSummary.project_count}
                          </p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
                          <p className="text-xs text-slate-500">Portfolio Avg. Progress</p>
                          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                            {portfolioSummary.average_verified_progress}%
                          </p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
                          <p className="text-xs text-slate-500">Work Packages Verified</p>
                          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                            {portfolioSummary.completed_work_packages}
                            <span className="text-sm font-normal text-slate-400">
                              /{portfolioSummary.total_work_packages}
                            </span>
                          </p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200/90 p-4">
                          <p className="text-xs text-slate-500">Pending Decisions</p>
                          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                            {portfolioSummary.total_pending_approvals}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {portfolioSummary.projects.map((p) => {
                          const pendingTotal =
                            p.pending_quotations +
                            p.pending_specs +
                            p.pending_variations +
                            p.pending_completions;
                          const isSelected = p.id === selectedProjectId;
                          return (
                            <div
                              key={p.id}
                              className={`bg-white rounded-xl border p-5 space-y-3 ${
                                isSelected ? 'border-[#18b892]' : 'border-slate-200/90'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-mono text-slate-500">
                                    {p.project_code}
                                    {p.location ? ` · ${p.location}` : ''}
                                  </p>
                                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">{p.name}</h3>
                                </div>
                                <StatusText label={p.status} tone="emerald" />
                              </div>

                              <div>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-slate-500">Verified Progress</span>
                                  <span className="font-mono font-semibold tabular-nums text-slate-900">
                                    {p.verified_progress_pct}%
                                  </span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#18b892]"
                                    style={{ width: `${Math.min(100, p.verified_progress_pct)}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                                <span>
                                  {p.completed_work_packages}/{p.total_work_packages} packages · {pendingTotal} pending
                                  {p.active_blockers > 0 ? ` · ${p.active_blockers} blockers` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedProjectId(p.id);
                                    setActiveSection('overview');
                                  }}
                                  className="text-xs font-semibold text-[#18b892] hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                  Open Project <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                      Loading corporate portfolio metrics...
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 1B: WORK PACKAGES, MILESTONES & DELIVERABLES              */}
              {/* ================================================================= */}
              {activeSection === 'work-packages' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Work Packages, Milestones & Schedule Controls</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Package-level deliverables, verified milestone stages, dependencies, and schedule health for {bundle.project.name}.
                    </p>
                  </div>

                  {!wpBundle || wpBundle.packages.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                      No client-visible work packages have been published for this project yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {wpBundle.packages.map((pkg) => {
                        const pkgMilestones = wpBundle.milestones.filter((m) => m.work_package_id === pkg.id);
                        const pkgBlockers = wpBundle.blockers.filter(
                          (b) => b.work_package_id === pkg.id && b.status !== 'resolved'
                        );
                        return (
                          <div key={pkg.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3.5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-mono text-slate-500">
                                  {pkg.package_code}
                                  {pkg.floor_level ? ` · ${pkg.floor_level}` : ''}
                                  {pkg.zone_name ? ` · ${pkg.zone_name}` : ''}
                                  {pkg.room_name ? ` · ${pkg.room_name}` : ''}
                                </p>
                                <h3 className="text-base font-bold text-slate-900 mt-0.5">{pkg.title}</h3>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
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
                                <StatusText
                                  label={INSPECTION_STATUS_LABELS[pkg.inspection_status]}
                                  tone={pkg.inspection_status === 'passed' ? 'emerald' : 'slate'}
                                />
                                <StatusText
                                  label={APPROVAL_STATUS_LABELS[pkg.approval_status]}
                                  tone={pkg.approval_status === 'approved' ? 'emerald' : 'amber'}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-100">
                              <div>
                                <p className="text-slate-400">Completion Progress</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#18b892]"
                                      style={{ width: `${Math.min(100, pkg.completion_percent)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                                    {Math.round(pkg.completion_percent)}%
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-slate-400">Planned Schedule</p>
                                <p className="font-mono font-medium text-slate-800 mt-0.5">
                                  {formatShortDate(pkg.planned_start_date)} – {formatShortDate(pkg.planned_end_date)}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400">Lead Supervisor</p>
                                <p className="font-medium text-slate-800 mt-0.5">
                                  {pkg.responsible_supervisor_name || 'Davejoe Site Supervision'}
                                </p>
                              </div>
                            </div>

                            {pkg.deliverables && (
                              <p className="text-xs text-slate-600 leading-relaxed">
                                <strong className="text-slate-800">Deliverables:</strong> {pkg.deliverables}
                              </p>
                            )}

                            {pkg.evidence_documents.length > 0 && (
                              <EvidenceMediaGallery items={pkg.evidence_documents} />
                            )}

                            {pkgMilestones.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 space-y-2.5">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                  Package Milestones ({pkgMilestones.length})
                                </p>
                                {pkgMilestones.map((ms) => (
                                  <div
                                    key={ms.id}
                                    className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2 text-xs">
                                      <span className="font-semibold text-slate-800">
                                        <span className="font-mono text-slate-500">{ms.milestone_code}</span> · {ms.title}
                                      </span>
                                      <span className="font-mono font-semibold text-slate-700 tabular-nums">
                                        {Math.round(ms.completion_pct)}%
                                      </span>
                                    </div>
                                    <ProgressStageTrack current={ms.verification_stage} />
                                  </div>
                                ))}
                              </div>
                            )}

                            {pkgBlockers.length > 0 && (
                              <div className="pt-2 border-t border-slate-100 space-y-2">
                                {pkgBlockers.map((blk) => (
                                  <div
                                    key={blk.id}
                                    className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-900"
                                  >
                                    <strong>
                                      {blk.title}
                                      {blk.impact_days > 0 ? ` (+${blk.impact_days}d impact)` : ''}:
                                    </strong>{' '}
                                    {blk.description}
                                    {blk.corrective_action ? ` — Plan: ${blk.corrective_action}` : ''}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 1: OVERVIEW & WEEKLY REMOTE REPORTS                       */}
              {/* ================================================================= */}
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  {/* KPI Band */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-slate-200/90 p-5">
                      <p className="text-xs font-medium text-slate-500">Verified Progress</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                        {Number(bundle.project.verified_progress_pct || 0)}%
                      </p>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-3">
                        <div
                          className="h-full bg-[#18b892] rounded-full"
                          style={{ width: `${Math.min(100, Number(bundle.project.verified_progress_pct || 0))}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 truncate">
                        Stage: {bundle.project.client_visible_stage || bundle.project.status}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/90 p-5">
                      <p className="text-xs font-medium text-slate-500">Outstanding Decisions</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                        {pendingCounts.total}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                        {pendingCounts.quotations} quotes · {pendingCounts.specs} specs · {pendingCounts.completions} areas ·{' '}
                        {pendingCounts.variations} variations
                      </p>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/90 p-5">
                      <p className="text-xs font-medium text-slate-500">Areas Verified / Released</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                        {bundle.areaCompletions.filter((a) => a.qc_outcome === 'pass' || a.qc_outcome === 'conditional_pass').length}
                        <span className="text-slate-400 text-base font-normal"> / {bundle.areaCompletions.length}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-3">
                        {bundle.areaCompletions.filter((a) => a.area_released).length} released for subsequent trades
                      </p>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/90 p-5">
                      <p className="text-xs font-medium text-slate-500">Permitted Commercial Summary</p>
                      {bundle.financialSummary.permitted ? (
                        <>
                          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                            {formatCurrency(
                              bundle.financialSummary.combinedApprovedValue || bundle.financialSummary.contractValueReference,
                              bundle.financialSummary.currency
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-3">
                            Approved variations:{' '}
                            <span className="font-mono">
                              {formatCurrency(bundle.financialSummary.approvedVariationsTotal, bundle.financialSummary.currency)}
                            </span>
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-700 mt-2 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-400" /> Restricted Scope
                          </p>
                          <p className="text-[11px] text-slate-500 mt-2">
                            Financial totals are restricted for your contact role.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Two-column Project Identity & Official Davejoe Contact */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-mono text-slate-400">{bundle.project.project_code}</p>
                          <h2 className="text-base font-bold text-slate-900 mt-0.5">{bundle.project.name}</h2>
                        </div>
                        <StatusText label={bundle.project.status} tone="emerald" />
                      </div>
                      {bundle.project.description && (
                        <p className="text-sm text-slate-600 leading-relaxed">{bundle.project.description}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 text-xs">
                        <div>
                          <p className="text-slate-400">Location</p>
                          <p className="font-medium text-slate-800 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {bundle.project.location || 'On file'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Schedule Window</p>
                          <p className="font-medium text-slate-800 mt-0.5 flex items-center gap-1 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {formatShortDate(bundle.project.start_date)} – {formatShortDate(bundle.project.end_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Contract Reference</p>
                          <p className="font-medium text-slate-800 mt-0.5 font-mono">
                            {bundle.project.contract_reference || 'Pending reference'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Official Davejoe Contact */}
                    <div className="bg-white rounded-xl border border-slate-200/90 p-6 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Official Davejoe Contact
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {bundle.project.official_contact_name || 'Davejoe Project Coordination Desk'}
                      </p>
                      <div className="space-y-2 text-xs text-slate-600 pt-1">
                        <p className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-[#18b892]" />
                          {bundle.project.official_contact_phone || 'Assigned upon mobilisation'}
                        </p>
                        <p className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-[#18b892]" />
                          {bundle.project.official_contact_email || 'projects@davejoeinteriors.com'}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setActiveSection('requests')}
                          className="text-xs font-semibold text-[#18b892] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          Open Request or Confidential Escalation <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Released Weekly Summaries (Remote / Diaspora Client View) */}
                  <div className="bg-white rounded-xl border border-slate-200/90 p-6 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Released Weekly Project Summaries</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Generated from verified site records and reviewed by Davejoe leadership before release.
                        </p>
                      </div>
                    </div>

                    {bundle.weeklySummaries.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg">
                        No weekly summaries have been released for this project yet.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {bundle.weeklySummaries.map((sum) => (
                          <div key={sum.id} className="rounded-xl border border-slate-200/80 p-5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h3 className="text-sm font-bold text-slate-900">{sum.summary_title}</h3>
                                <p className="text-xs text-slate-500 font-mono">
                                  {formatShortDate(sum.week_start_date)} – {formatShortDate(sum.week_end_date)} · Released{' '}
                                  {formatShortDate(sum.released_at)}
                                </p>
                              </div>
                              <StatusText label="Reviewed & Released" tone="emerald" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                              <div>
                                <p className="text-slate-400">Verified Progress</p>
                                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                                  {sum.snapshot_data?.verified_progress_pct ?? 0}%
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400">Areas QC Verified</p>
                                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                                  {sum.snapshot_data?.areas_qc_verified ?? 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400">Areas Released</p>
                                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                                  {sum.snapshot_data?.areas_released ?? 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-400">Pending Approvals</p>
                                <p className="font-mono font-semibold text-slate-900 mt-0.5">
                                  {(sum.snapshot_data?.pending_spec_approvals ?? 0) +
                                    (sum.snapshot_data?.pending_variation_approvals ?? 0)}
                                </p>
                              </div>
                            </div>
                            {sum.executive_notes && (
                              <p className="text-xs text-slate-700 leading-relaxed">{sum.executive_notes}</p>
                            )}
                            {sum.upcoming_activities && (
                              <p className="text-xs text-slate-600">
                                <span className="font-semibold text-slate-800">Upcoming:</span> {sum.upcoming_activities}
                              </p>
                            )}
                            {sum.pending_client_decisions && (
                              <p className="text-xs text-amber-800 bg-amber-50/70 border border-amber-200/70 rounded-lg px-3 py-2">
                                <span className="font-semibold">Pending Client Input:</span> {sum.pending_client_decisions}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Verified Client-Visible Photos */}
                  {bundle.verifiedPhotos.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200/90 p-6 space-y-4">
                      <h2 className="text-base font-bold text-slate-900">Verified Site Gallery</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {bundle.verifiedPhotos.map((photo) => (
                          <div key={photo.id} className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                            <img
                              src={photo.file_url}
                              alt={photo.title || 'Verified site progress'}
                              className="w-full h-36 object-cover"
                            />
                            <div className="p-2.5">
                              <p className="text-xs font-medium text-slate-800 truncate">{photo.title || 'Verified Photo'}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{formatShortDate(photo.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 2: QUOTATIONS, CONTRACTS & B2B CLIENT POs                 */}
              {/* ================================================================= */}
              {activeSection === 'quotations' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Quotations, Contracts & Purchase Orders</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Viewing a quotation never constitutes acceptance. Accepted commercial records are permanently locked.
                      </p>
                    </div>
                    {activeAccess?.can_view_commercial && (
                      <button
                        type="button"
                        onClick={() => setShowB2BUpload((v) => !v)}
                        className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Submit Client Contract / PO
                      </button>
                    )}
                  </div>

                  {!activeAccess?.can_view_commercial && !isLeadershipPreview ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
                      <Lock className="w-7 h-7 text-slate-400 mx-auto" />
                      <p className="text-sm font-semibold text-slate-800">Commercial Documents Restricted</p>
                      <p className="text-xs text-slate-500">
                        Your contact authority for this project does not include commercial quotation viewing.
                      </p>
                    </div>
                  ) : (
                    <>
                      {showB2BUpload && (
                        <form
                          onSubmit={handleB2BUpload}
                          className="bg-white rounded-xl border border-slate-200 p-5 space-y-4"
                        >
                          <h3 className="text-sm font-bold text-slate-900">
                            Submit B2B Client-Issued Contract or Purchase Order
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Document Type</label>
                              <select
                                value={b2bDocType}
                                onChange={(e) => setB2bDocType(e.target.value as 'client_purchase_order' | 'contract')}
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                              >
                                <option value="client_purchase_order">Client Purchase Order (PO)</option>
                                <option value="contract">Client-Issued Subcontract / Agreement</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
                              <input
                                type="text"
                                value={b2bRef}
                                onChange={(e) => setB2bRef(e.target.value)}
                                placeholder="e.g. PO-2026-084"
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Contract / PO Amount</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={b2bAmount}
                                onChange={(e) => setB2bAmount(e.target.value)}
                                required
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Document Title</label>
                            <input
                              type="text"
                              required
                              value={b2bTitle}
                              onChange={(e) => setB2bTitle(e.target.value)}
                              placeholder="e.g. Main Contractor Purchase Order — Floors 3 & 4 Painting"
                              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Scope & Reference Notes</label>
                            <textarea
                              rows={2}
                              required
                              value={b2bScope}
                              onChange={(e) => setB2bScope(e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                            />
                          </div>
                          <EvidenceUploader
                            projectId={bundle.project.id}
                            category="b2b_contracts"
                            uploadedByName={actorName}
                            items={b2bFiles}
                            onChange={setB2bFiles}
                            label="Attach Signed Contract / PO PDF"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowB2BUpload(false)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={submittingAction}
                              className="px-4 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
                            >
                              Submit Document
                            </button>
                          </div>
                        </form>
                      )}

                      {bundle.quotations.length === 0 ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                          No quotations or contract documents have been issued for this project yet.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {bundle.quotations.map((q) => {
                            const isExpanded = quoteActionId === q.id;
                            const isLocked = q.status === 'accepted' || q.status === 'superseded';
                            return (
                              <div key={q.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <span className="font-mono font-semibold text-slate-800">
                                        {q.reference_no} · v{q.version_number}
                                      </span>
                                      <span>·</span>
                                      <span className="capitalize">{q.document_type.replace(/_/g, ' ')}</span>
                                      {q.is_b2b_client_issued && (
                                        <>
                                          <span>·</span>
                                          <span className="text-sky-700 font-medium">Client-Issued</span>
                                        </>
                                      )}
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900">{q.title}</h3>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900">
                                      {formatCurrency(q.total_amount, q.currency)}
                                    </p>
                                    <div className="mt-1">
                                      <StatusText
                                        label={
                                          q.status === 'accepted'
                                            ? 'Accepted (Locked)'
                                            : q.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                                        }
                                        tone={
                                          q.status === 'accepted'
                                            ? 'emerald'
                                            : q.status === 'declined'
                                              ? 'rose'
                                              : q.status === 'issued'
                                                ? 'amber'
                                                : 'slate'
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-100">
                                  <div>
                                    <p className="font-semibold text-slate-700">Scope Summary</p>
                                    <p className="text-slate-600 mt-1 whitespace-pre-line leading-relaxed">{q.scope_summary}</p>
                                  </div>
                                  <div className="space-y-2">
                                    {q.exclusions && (
                                      <div>
                                        <p className="font-semibold text-slate-700">Exclusions</p>
                                        <p className="text-slate-600 mt-0.5">{q.exclusions}</p>
                                      </div>
                                    )}
                                    {q.payment_terms && (
                                      <div>
                                        <p className="font-semibold text-slate-700">Payment Terms</p>
                                        <p className="text-slate-600 mt-0.5">{q.payment_terms}</p>
                                      </div>
                                    )}
                                    {q.valid_until && (
                                      <p className="text-slate-500">
                                        Valid until: <span className="font-mono text-slate-700">{formatShortDate(q.valid_until)}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                    {q.document_storage_path && (
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadQuotationDoc(q.document_storage_path, q.document_file_name)}
                                        className="inline-flex items-center gap-1.5 text-[#18b892] font-semibold hover:underline cursor-pointer"
                                      >
                                        <Download className="w-3.5 h-3.5" /> Download Attachment
                                      </button>
                                    )}
                                    {q.decided_at && (
                                      <span>
                                        Decision by <strong className="text-slate-700">{q.decided_by_name}</strong> on{' '}
                                        {formatDateTime(q.decided_at)}
                                      </span>
                                    )}
                                  </div>

                                  {!isLocked && !q.is_b2b_client_issued && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuotationView(q)}
                                      className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#18b892] text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#18b892]" />
                                      {isExpanded ? 'Close Review Panel' : 'Review & Respond'}
                                    </button>
                                  )}
                                </div>

                                {isExpanded && !isLocked && (
                                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                                      <Info className="w-3.5 h-3.5 text-[#18b892] shrink-0" />
                                      Reviewing or downloading this document does not accept it. Acceptance requires explicit confirmation below.
                                    </p>
                                    {q.terms_and_conditions && (
                                      <div className="text-xs text-slate-600 bg-white rounded-lg border border-slate-200/80 p-3">
                                        <p className="font-semibold text-slate-800 mb-1">Terms & Conditions</p>
                                        <p className="whitespace-pre-line">{q.terms_and_conditions}</p>
                                      </div>
                                    )}
                                    <textarea
                                      rows={2}
                                      value={quoteComment}
                                      onChange={(e) => setQuoteComment(e.target.value)}
                                      placeholder="Add clarification questions, revision notes, or acceptance comments..."
                                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs"
                                    />

                                    {(effectiveAuthority?.canApproveQuotations ?? activeAccess?.can_approve_quotations) ? (() => {
                                      const quoteCap = effectiveAuthority?.quotationLimit ?? null;
                                      const exceedsQuoteCap =
                                        quoteCap !== null && Number(q.total_amount || 0) > quoteCap;
                                      return (
                                        <div className="space-y-3">
                                          {exceedsQuoteCap ? (
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                              <strong>Approval Limit Exceeded:</strong> This quotation ({formatCurrency(q.total_amount, q.currency)}) exceeds your authorized quotation approval limit of{' '}
                                              <span className="font-mono font-semibold">
                                                {formatCurrency(quoteCap, effectiveAuthority?.currency || q.currency)}
                                              </span>
                                              . Escalate to an authorized corporate signatory with higher approval authority.
                                            </div>
                                          ) : (
                                            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={quoteConfirmChecked}
                                                onChange={(e) => setQuoteConfirmChecked(e.target.checked)}
                                                className="mt-0.5 rounded border-slate-300 accent-[#18b892]"
                                              />
                                              <span>
                                                I confirm that I am formally authorized to accept{' '}
                                                <strong>
                                                  {q.reference_no} v{q.version_number}
                                                </strong>{' '}
                                                for <strong>{formatCurrency(q.total_amount, q.currency)}</strong> under the stated scope, exclusions, and terms.
                                              </span>
                                            </label>
                                          )}
                                          <div className="flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              disabled={submittingAction || !quoteConfirmChecked || exceedsQuoteCap}
                                              onClick={() => handleQuotationDecision(q, 'accepted')}
                                              className="px-3.5 py-2 rounded-lg bg-[#18b892] hover:bg-[#149f7e] text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                                            >
                                              Formally Accept Quotation
                                            </button>
                                            <button
                                              type="button"
                                              disabled={submittingAction}
                                              onClick={() => handleQuotationDecision(q, 'clarification_requested')}
                                              className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                                            >
                                              Request Clarification
                                            </button>
                                            <button
                                              type="button"
                                              disabled={submittingAction}
                                              onClick={() => handleQuotationDecision(q, 'revision_requested')}
                                              className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs font-medium text-amber-800 cursor-pointer"
                                            >
                                              Request Revised Quotation
                                            </button>
                                            <button
                                              type="button"
                                              disabled={submittingAction}
                                              onClick={() => handleQuotationDecision(q, 'declined')}
                                              className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-xs font-medium text-rose-700 cursor-pointer"
                                            >
                                              Decline
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })() : (
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs text-amber-700">
                                          Your contact profile can request clarification, while formal acceptance is reserved for the designated commercial approver.
                                        </p>
                                        <button
                                          type="button"
                                          disabled={submittingAction}
                                          onClick={() => handleQuotationDecision(q, 'clarification_requested')}
                                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
                                        >
                                          Request Clarification
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 3: PROJECT BRIEF & COLOUR / SPECIFICATION APPROVALS       */}
              {/* ================================================================= */}
              {activeSection === 'brief' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Project Brief & Colour / Specification Approvals</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Approved specifications are immutable. Any change requires a new versioned approval.
                      </p>
                    </div>
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setBriefViewMode('residential')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                          briefViewMode === 'residential' ? 'bg-slate-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        Room-by-Room (Residential)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBriefViewMode('commercial')}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                          briefViewMode === 'commercial' ? 'bg-slate-900 text-white' : 'text-slate-600'
                        }`}
                      >
                        Floor / Zone / Work Package
                      </button>
                    </div>
                  </div>

                  {/* Mandatory Physical Colour Sample Disclaimer */}
                  <div className="rounded-xl border border-amber-200/90 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p>
                      <strong>Colour Accuracy Notice:</strong> On-screen colour swatches and digital previews are visual
                      references only and <strong>do not substitute approved physical colour samples, sample boards, or manufacturer shade cards</strong> inspected under site lighting.
                    </p>
                  </div>

                  {groupedSpecs.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                      No specifications have been submitted for approval yet.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupedSpecs.map(([groupLabel, specs]) => (
                        <div key={groupLabel} className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#18b892]" />
                            {groupLabel}
                          </h3>

                          <div className="space-y-3">
                            {specs.map((spec) => {
                              const canDecide =
                                (spec.status === 'awaiting_approval' || spec.status === 'submitted') &&
                                Boolean(activeAccess?.can_approve_specifications);
                              return (
                                <div key={spec.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
                                  <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                      {spec.preview_hex && (
                                        <div className="shrink-0 text-center">
                                          <div
                                            className="w-11 h-11 rounded-lg border border-slate-300 shadow-inner"
                                            style={{ backgroundColor: spec.preview_hex }}
                                            title="Digital visual reference only"
                                          />
                                          <p className="text-[9px] text-slate-400 mt-1">Ref only</p>
                                        </div>
                                      )}
                                      <div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                          <span className="font-mono font-semibold text-slate-800">
                                            {spec.spec_code} · v{spec.version_number}
                                          </span>
                                          <span>·</span>
                                          <span>{spec.work_category}</span>
                                          <span>·</span>
                                          <span>{spec.area_label}</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                                          {spec.material_product}
                                          {spec.colour_name ? ` — ${spec.colour_name}` : ''}
                                          {spec.colour_code ? ` (${spec.colour_code})` : ''}
                                        </h4>
                                      </div>
                                    </div>

                                    <StatusText
                                      label={
                                        spec.status === 'approved'
                                          ? 'Approved (Locked)'
                                          : spec.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                                      }
                                      tone={
                                        spec.status === 'approved'
                                          ? 'emerald'
                                          : spec.status === 'rejected'
                                            ? 'rose'
                                            : spec.status === 'superseded'
                                              ? 'slate'
                                              : 'amber'
                                      }
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
                                    <div>
                                      <p className="text-slate-400">Manufacturer / Finish</p>
                                      <p className="font-medium text-slate-800 mt-0.5">
                                        {[spec.manufacturer, spec.finish_type].filter(Boolean).join(' · ') || '—'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400">Coats & Quantity</p>
                                      <p className="font-medium text-slate-800 mt-0.5 font-mono">
                                        {spec.number_of_coats ? `${spec.number_of_coats} coats` : 'Standard'}
                                        {spec.quantity ? ` · ${spec.quantity} ${spec.unit_of_measure || ''}` : ''}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400">Surface Preparation</p>
                                      <p className="font-medium text-slate-800 mt-0.5">{spec.surface_preparation || 'Standard prep'}</p>
                                    </div>
                                    <div>
                                      <p className="text-slate-400">Physical Sample Ref</p>
                                      <p className="font-medium text-slate-800 mt-0.5 font-mono">
                                        {spec.approved_sample_ref || 'Pending sample board'}
                                      </p>
                                    </div>
                                  </div>

                                  {(spec.technical_notes || spec.exclusions) && (
                                    <div className="text-xs text-slate-600 space-y-1">
                                      {spec.technical_notes && (
                                        <p>
                                          <strong className="text-slate-700">Technical Notes:</strong> {spec.technical_notes}
                                        </p>
                                      )}
                                      {spec.exclusions && (
                                        <p>
                                          <strong className="text-slate-700">Exclusions:</strong> {spec.exclusions}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  <EvidenceMediaGallery items={spec.attachments || []} />

                                  {spec.approved_at && (
                                    <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                                      {spec.status === 'approved' ? 'Approved' : 'Reviewed'} by{' '}
                                      <strong className="text-slate-700">{spec.approved_by_name}</strong> on{' '}
                                      {formatDateTime(spec.approved_at)}
                                      {spec.approval_comments ? ` — "${spec.approval_comments}"` : ''}
                                    </p>
                                  )}

                                  {canDecide && (
                                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                                      <input
                                        type="text"
                                        value={specComments[spec.id] || ''}
                                        onChange={(e) =>
                                          setSpecComments((prev) => ({ ...prev, [spec.id]: e.target.value }))
                                        }
                                        placeholder="Approval note or requested adjustment (e.g. physical sample verified on site)..."
                                        className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs"
                                      />
                                      <button
                                        type="button"
                                        disabled={submittingAction}
                                        onClick={() => handleSpecDecision(spec, 'approved')}
                                        className="px-3.5 h-9 rounded-lg bg-[#18b892] hover:bg-[#149f7e] text-white text-xs font-semibold cursor-pointer"
                                      >
                                        Approve & Lock Spec
                                      </button>
                                      <button
                                        type="button"
                                        disabled={submittingAction}
                                        onClick={() => handleSpecDecision(spec, 'rejected')}
                                        className="px-3 h-9 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer"
                                      >
                                        Reject / Revise
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 4: 5-STAGE VERIFIED PROGRESS & PRE-WORK SURFACE QC        */}
              {/* ================================================================= */}
              {activeSection === 'progress' && (
                <div className="space-y-6">
                  {/* Pre-Work Surface Inspections */}
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Pre-Work Surface Inspections & Clearance</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Substrate conditions documented by Technical / QC prior to application so corrections and limitations are agreed transparently.
                      </p>
                    </div>

                    {bundle.preworkInspections.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
                        No pre-work surface inspections recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {bundle.preworkInspections.map((ins) => {
                          const flags = [
                            ins.has_cracks && 'Cracks',
                            ins.has_dampness && 'Dampness / Moisture',
                            ins.has_unevenness && 'Uneven Surface',
                            ins.has_damage && 'Substrate Damage',
                          ].filter(Boolean) as string[];

                          return (
                            <div key={ins.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-mono text-slate-500">
                                    {ins.inspection_ref} · {formatShortDate(ins.inspection_date)} · Inspector:{' '}
                                    {ins.inspector_name || 'Technical / QC'}
                                  </p>
                                  <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                                    {ins.area_label} {ins.substrate_type ? `(${ins.substrate_type})` : ''}
                                  </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusText
                                    label={ins.clearance_to_proceed ? 'Cleared to Proceed' : 'Awaiting Clearance'}
                                    tone={ins.clearance_to_proceed ? 'emerald' : 'amber'}
                                  />
                                </div>
                              </div>

                              <p className="text-xs text-slate-700 leading-relaxed">
                                <strong>Substrate Condition:</strong> {ins.substrate_condition}
                                {ins.screeding_plastering_quality ? ` · Screeding/Plastering: ${ins.screeding_plastering_quality}` : ''}
                              </p>

                              {flags.length > 0 && (
                                <p className="text-xs text-rose-700 font-medium">
                                  Observed Surface Issues: {flags.join(' · ')}
                                </p>
                              )}

                              {ins.defect_details && <p className="text-xs text-slate-600">{ins.defect_details}</p>}
                              {ins.other_contractor_observation && (
                                <p className="text-xs text-slate-600 bg-slate-50 rounded-lg border border-slate-200/80 p-3">
                                  <strong>Factual Site Observation:</strong> {ins.other_contractor_observation}
                                </p>
                              )}
                              {ins.recommended_correction && (
                                <p className="text-xs text-slate-700">
                                  <strong>Recommended Correction:</strong> {ins.recommended_correction} · Responsibility:{' '}
                                  <span className="capitalize font-semibold">
                                    {ins.scope_responsibility.replace(/_/g, ' ')}
                                  </span>
                                  {ins.estimated_cost_impact ? ` · Est. Cost: ${formatCurrency(ins.estimated_cost_impact)}` : ''}
                                  {ins.estimated_time_impact_days ? ` · Est. Time: +${ins.estimated_time_impact_days}d` : ''}
                                </p>
                              )}

                              <EvidenceMediaGallery items={ins.evidence_media || []} />

                              {ins.client_decision !== 'pending' ? (
                                <p className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                                  Client Decision:{' '}
                                  <strong className="capitalize text-slate-900">
                                    {ins.client_decision.replace(/_/g, ' ')}
                                  </strong>{' '}
                                  by {ins.client_decided_by_name} on {formatDateTime(ins.client_decided_at)}
                                  {ins.client_decision_notes ? ` — "${ins.client_decision_notes}"` : ''}
                                </p>
                              ) : (
                                (activeAccess?.can_approve_specifications || activeAccess?.can_acknowledge_completions) && (
                                  <div className="pt-3 border-t border-slate-100 space-y-2">
                                    <input
                                      type="text"
                                      value={preworkNotes[ins.id] || ''}
                                      onChange={(e) =>
                                        setPreworkNotes((prev) => ({ ...prev, [ins.id]: e.target.value }))
                                      }
                                      placeholder="Add instruction or decision notes..."
                                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={submittingAction}
                                        onClick={() => handlePreworkDecision(ins, 'proceed_after_correction')}
                                        className="px-3 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
                                      >
                                        Proceed After Correction
                                      </button>
                                      <button
                                        type="button"
                                        disabled={submittingAction}
                                        onClick={() => handlePreworkDecision(ins, 'proceed_with_noted_limitations')}
                                        className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold cursor-pointer"
                                      >
                                        Proceed With Noted Limitations
                                      </button>
                                      <button
                                        type="button"
                                        disabled={submittingAction}
                                        onClick={() => handlePreworkDecision(ins, 'variation_requested')}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold cursor-pointer"
                                      >
                                        Request Remediation Variation
                                      </button>
                                      <button
                                        type="button"
                                        disabled={submittingAction}
                                        onClick={() => handlePreworkDecision(ins, 'hold_work')}
                                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer"
                                      >
                                        Hold Work
                                      </button>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 5-Stage Verified Project Progress */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">Verified Project Progress Log</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Every milestone tracks five separate verification stages — never collapsed into one generic status.
                      </p>
                    </div>

                    {bundle.progressUpdates.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
                        No progress updates logged yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {bundle.progressUpdates.map((up) => (
                          <div key={up.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs text-slate-500">
                                  <span className="capitalize font-medium text-slate-700">
                                    {up.activity_type.replace(/_/g, ' ')}
                                  </span>
                                  {up.stage_name ? ` · ${up.stage_name}` : ''}
                                  {up.planned_date ? ` · Planned ${formatShortDate(up.planned_date)}` : ''}
                                </p>
                                <h3 className="text-sm font-bold text-slate-900 mt-0.5">{up.title}</h3>
                              </div>
                              <span className="text-sm font-mono font-bold text-[#18b892] tabular-nums">
                                {up.progress_percent}%
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 leading-relaxed">{up.summary}</p>
                            {up.delay_reason && (
                              <p className="text-xs text-amber-800">
                                <strong>Delay Note:</strong> {up.delay_reason}
                              </p>
                            )}
                            {up.technical_concern && (
                              <p className="text-xs text-rose-700">
                                <strong>Technical Concern:</strong> {up.technical_concern}
                              </p>
                            )}

                            <ProgressStageTrack current={up.verification_stage} />
                            <EvidenceMediaGallery items={up.media_items || []} />

                            {up.verification_stage === 'verified_completed' && activeAccess?.can_acknowledge_completions && (
                              <div className="pt-3 border-t border-slate-100 flex justify-end">
                                <button
                                  type="button"
                                  disabled={submittingAction}
                                  onClick={() => handleProgressAcknowledge(up.id)}
                                  className="px-3.5 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
                                >
                                  Acknowledge Verified Milestone
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 5: AREA COMPLETIONS, RELEASES & SUBSEQUENT DAMAGE         */}
              {/* ================================================================= */}
              {activeSection === 'completions' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Area Completions, Condition Evidence & Subsequent Trade Releases
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Internal Technical/QC verification is strictly separated from external client/main-contractor acknowledgement.
                    </p>
                  </div>

                  {bundle.areaCompletions.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                      No area completion records have been logged yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bundle.areaCompletions.map((area) => {
                        const linkedIncidents = bundle.damageIncidents.filter((d) => d.area_completion_id === area.id);
                        return (
                          <div key={area.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-xs font-mono text-slate-500">
                                  {area.completion_ref} · Completed {formatShortDate(area.completion_date)}
                                  {area.site_supervisor_name ? ` · Supervisor: ${area.site_supervisor_name}` : ''}
                                </p>
                                <h3 className="text-base font-bold text-slate-900 mt-0.5">{area.area_location}</h3>
                                <p className="text-xs text-slate-600 mt-1">{area.work_performed}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <StatusText
                                  label={`Internal QC: ${area.qc_outcome.replace(/_/g, ' ').toUpperCase()}`}
                                  tone={
                                    area.qc_outcome === 'pass'
                                      ? 'emerald'
                                      : area.qc_outcome === 'fail'
                                        ? 'rose'
                                        : 'amber'
                                  }
                                />
                                <StatusText
                                  label={`Client Ack: ${area.client_acknowledgement_status.replace(/_/g, ' ')}`}
                                  tone={
                                    area.client_acknowledgement_status === 'acknowledged'
                                      ? 'emerald'
                                      : area.client_acknowledgement_status === 'rejected'
                                        ? 'rose'
                                        : 'slate'
                                  }
                                />
                              </div>
                            </div>

                            {area.area_released && (
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900 space-y-1">
                                <p className="font-bold">
                                  {area.release_label || 'Davejoe Work Verified — Area Released for Subsequent Trades'}
                                </p>
                                <p>
                                  Released {formatDateTime(area.released_at)} to{' '}
                                  <strong>{area.receiving_representative || 'Site Representative'}</strong> · Formal
                                  Handover: <strong>{area.formal_handover_occurred ? 'Yes' : 'No (Trade Release Only)'}</strong>
                                </p>
                                {area.condition_at_release && <p>Condition at release: {area.condition_at_release}</p>}
                                {area.protection_measures && <p>Protection measures: {area.protection_measures}</p>}
                              </div>
                            )}

                            <EvidenceMediaGallery
                              items={[...(area.completion_photos || []), ...(area.completion_videos || [])]}
                              emptyText="No completion photos or videos attached yet."
                            />

                            {area.client_acknowledgement_status === 'pending' && activeAccess?.can_acknowledge_completions && (
                              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={areaComments[area.id] || ''}
                                  onChange={(e) =>
                                    setAreaComments((prev) => ({ ...prev, [area.id]: e.target.value }))
                                  }
                                  placeholder="Optional acknowledgement note or observation..."
                                  className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs"
                                />
                                <button
                                  type="button"
                                  disabled={submittingAction}
                                  onClick={() => handleAreaAcknowledgement(area.id, 'acknowledged')}
                                  className="px-3.5 h-9 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
                                >
                                  Acknowledge Area Completion
                                </button>
                                <button
                                  type="button"
                                  disabled={submittingAction}
                                  onClick={() => handleAreaAcknowledgement(area.id, 'rejected')}
                                  className="px-3 h-9 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer"
                                >
                                  Flag Concern
                                </button>
                              </div>
                            )}

                            {/* Linked Subsequent Damage Incidents */}
                            {linkedIncidents.length > 0 && (
                              <div className="pt-3 border-t border-slate-100 space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
                                  Linked Subsequent Damage / Rework Records ({linkedIncidents.length})
                                </p>
                                {linkedIncidents.map((inc) => (
                                  <div
                                    key={inc.id}
                                    className="rounded-lg border border-rose-200/80 bg-rose-50/30 p-4 space-y-2 text-xs"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-mono font-semibold text-slate-900">
                                        {inc.incident_ref} · Discovered {formatShortDate(inc.discovered_date)}
                                      </span>
                                      <StatusText
                                        label={REWORK_CLASSIFICATION_LABELS[inc.rework_classification]}
                                        tone={inc.rework_classification === 'davejoe_workmanship_defect' ? 'emerald' : 'amber'}
                                      />
                                    </div>
                                    <p className="text-slate-700">{inc.description}</p>
                                    {inc.known_or_suspected_cause && (
                                      <p className="text-slate-600">
                                        <strong>Observed / Suspected Cause:</strong> {inc.known_or_suspected_cause}
                                      </p>
                                    )}
                                    {inc.technical_assessment && (
                                      <p className="text-slate-700">
                                        <strong>Technical Assessment:</strong> {inc.technical_assessment}
                                      </p>
                                    )}
                                    <EvidenceMediaGallery items={inc.damage_media || []} />

                                    {inc.external_response ? (
                                      <p className="text-slate-700 bg-white rounded-md border border-slate-200 p-2.5">
                                        <strong>Your Recorded Response:</strong> {inc.external_response}
                                      </p>
                                    ) : (
                                      <div className="flex gap-2 pt-1">
                                        <input
                                          type="text"
                                          value={damageResponses[inc.id] || ''}
                                          onChange={(e) =>
                                            setDamageResponses((prev) => ({ ...prev, [inc.id]: e.target.value }))
                                          }
                                          placeholder="Record client / main-contractor response to this evidence..."
                                          className="flex-1 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                                        />
                                        <button
                                          type="button"
                                          disabled={submittingAction}
                                          onClick={() => handleDamageResponse(inc.id)}
                                          className="px-3 h-8 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                                        >
                                          Submit Response
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 6: VARIATIONS & REWORK (10-STEP GOVERNANCE)               */}
              {/* ================================================================= */}
              {activeSection === 'variations' && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Variations & Rework Governance</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Every variation preserves original and revised scope, classification, internal leadership sign-off, and client approval.
                    </p>
                  </div>

                  {bundle.variations.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                      No project variations or rework instructions recorded yet.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {bundle.variations.map((v) => {
                        const canApproveFlag =
                          v.workflow_stage === 'awaiting_client_approval' &&
                          Boolean(
                            effectiveAuthority?.canApproveVariations ??
                              activeAccess?.can_approve_variations
                          );
                        const varCap = effectiveAuthority?.variationLimit ?? null;
                        const exceedsVarCap =
                          v.is_chargeable &&
                          varCap !== null &&
                          Number(v.estimated_cost || 0) > varCap;
                        return (
                          <div key={v.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="font-mono font-semibold text-slate-800">{v.variation_ref}</span>
                                  <span>·</span>
                                  <span>{REWORK_CLASSIFICATION_LABELS[v.rework_classification]}</span>
                                  <span>·</span>
                                  <span className="capitalize">{v.contract_variation_type.replace(/_/g, ' ')}</span>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mt-0.5">{v.title}</h3>
                              </div>
                              <div className="text-right">
                                <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                                  {v.is_chargeable ? formatCurrency(v.estimated_cost, v.currency) : 'Non-Chargeable (₦0)'}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono">
                                  Time impact: {v.time_impact_days > 0 ? `+${v.time_impact_days} days` : 'None'}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                              <div className="rounded-lg bg-slate-50 border border-slate-200/70 p-3">
                                <p className="font-semibold text-slate-700">Original Scope / Specification</p>
                                <p className="text-slate-600 mt-1">{v.original_spec_summary}</p>
                              </div>
                              <div className="rounded-lg bg-emerald-50/40 border border-emerald-200/70 p-3">
                                <p className="font-semibold text-slate-800">Revised Scope / Specification</p>
                                <p className="text-slate-700 mt-1">{v.revised_spec_summary}</p>
                              </div>
                            </div>

                            <VariationStepper stage={v.workflow_stage} />

                            {canApproveFlag && (
                              <div className="pt-3 border-t border-slate-100 space-y-2">
                                {exceedsVarCap && (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    <strong>Approval Cap Exceeded:</strong> This chargeable variation ({formatCurrency(v.estimated_cost, v.currency)}) exceeds your authorized variation limit of{' '}
                                    <span className="font-mono font-semibold">
                                      {formatCurrency(varCap!, effectiveAuthority?.currency || v.currency)}
                                    </span>
                                    . A higher corporate signatory must approve it.
                                  </div>
                                )}
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="text"
                                    value={variationNotes[v.id] || ''}
                                    onChange={(e) =>
                                      setVariationNotes((prev) => ({ ...prev, [v.id]: e.target.value }))
                                    }
                                    placeholder="Commercial approval or dispute comments..."
                                    className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs"
                                  />
                                  <button
                                    type="button"
                                    disabled={submittingAction || exceedsVarCap}
                                    onClick={() => handleVariationDecision(v.id, 'client_approved')}
                                    className="px-3.5 h-9 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Approve Variation
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submittingAction}
                                    onClick={() => handleVariationDecision(v.id, 'disputed')}
                                    className="px-3 h-9 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold cursor-pointer"
                                  >
                                    Mark Disputed
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submittingAction}
                                    onClick={() => handleVariationDecision(v.id, 'client_rejected')}
                                    className="px-3 h-9 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* SECTION 7: REQUEST CENTRE & COMPLAINT CENTRE                      */}
              {/* ================================================================= */}
              {activeSection === 'requests' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Submission Form */}
                  <form
                    onSubmit={handleSubmitTicket}
                    className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 space-y-4 h-fit"
                  >
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Submit Request or Complaint</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Every submission receives a tracked reference number and audit trail.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setTicketKind('request');
                          setTicketCategory(REQUEST_CATEGORIES[0].value);
                          setTicketConfidential(false);
                          setTicketAttachments((prev) =>
                            prev.filter((item) => item.bucket_id !== 'confidential-case-evidence')
                          );
                        }}
                        className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                          ticketKind === 'request' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Request Centre
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTicketKind('complaint');
                          setTicketCategory(COMPLAINT_CATEGORIES[0].value);
                        }}
                        className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                          ticketKind === 'complaint' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Complaint Centre
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                      <select
                        value={ticketCategory}
                        onChange={(e) => setTicketCategory(e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                      >
                        {(ticketKind === 'request' ? REQUEST_CATEGORIES : COMPLAINT_CATEGORIES).map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                      <select
                        value={ticketPriority}
                        onChange={(e) => setTicketPriority(e.target.value as 'low' | 'normal' | 'high' | 'urgent')}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                      <input
                        type="text"
                        required
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="Brief summary..."
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Details</label>
                      <textarea
                        rows={4}
                        required
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="Describe your request, concern, or complaint clearly..."
                        className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                      />
                    </div>

                    {ticketKind === 'complaint' && (
                      <label className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-200/80 bg-rose-50/50 text-xs text-rose-900 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ticketConfidential}
                          onChange={(e) => {
                            const nextVal = e.target.checked;
                            setTicketConfidential(nextVal);
                            // Prevent mixing standard and confidential storage bucket attachments
                            setTicketAttachments((prev) =>
                              prev.filter((item) =>
                                nextVal
                                  ? item.bucket_id === 'confidential-case-evidence'
                                  : item.bucket_id !== 'confidential-case-evidence'
                              )
                            );
                          }}
                          className="mt-0.5 accent-rose-600"
                        />
                        <span>
                          <strong>Confidential Management Escalation</strong>
                          <span className="block text-[11px] text-rose-700 mt-0.5">
                            Routes directly to Davejoe Management & Executive Director in an isolated private evidence vault. Completely hidden from site teams and other project parties.
                          </span>
                        </span>
                      </label>
                    )}

                    <EvidenceUploader
                      projectId={bundle.project.id}
                      category={ticketKind === 'complaint' && ticketConfidential ? 'confidential_complaints' : 'client_tickets'}
                      uploadedByName={actorName}
                      items={ticketAttachments}
                      onChange={setTicketAttachments}
                      isConfidential={ticketKind === 'complaint' && ticketConfidential}
                      label={
                        ticketKind === 'complaint' && ticketConfidential
                          ? 'Attach Confidential Evidence (Private Vault)'
                          : 'Attach Photo / Video Evidence'
                      }
                    />

                    <button
                      type="submit"
                      disabled={submittingAction}
                      className="w-full h-10 rounded-lg bg-[#18b892] hover:bg-[#149f7e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {submittingAction
                        ? 'Submitting...'
                        : ticketKind === 'complaint'
                          ? 'Submit Formal Complaint'
                          : 'Submit Project Request'}
                    </button>
                  </form>

                  {/* Ticket History */}
                  <div className="lg:col-span-3 space-y-3">
                    <h3 className="text-base font-bold text-slate-900">
                      Tracked Requests & Complaints ({bundle.requestsComplaints.length})
                    </h3>
                    {bundle.requestsComplaints.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                        You have not submitted any requests or complaints on this project yet.
                      </div>
                    ) : (
                      bundle.requestsComplaints.map((t) => (
                        <div key={t.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-mono text-slate-500">
                                {t.reference_no} · {t.record_kind.toUpperCase()} · {formatDateTime(t.created_at)}
                              </p>
                              <h4 className="text-sm font-bold text-slate-900 mt-0.5">{t.subject}</h4>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {t.is_confidential_management && (
                                <StatusText label="Confidential Management" tone="rose" />
                              )}
                              <StatusText
                                label={t.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                tone={t.status === 'resolved' || t.status === 'closed' ? 'emerald' : 'amber'}
                              />
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>
                          <EvidenceMediaGallery items={t.attachments || []} />
                          {t.resolution_summary && (
                            <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/70 p-3 text-xs text-emerald-900">
                              <strong>Resolution ({t.resolved_by_name}):</strong> {t.resolution_summary}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
