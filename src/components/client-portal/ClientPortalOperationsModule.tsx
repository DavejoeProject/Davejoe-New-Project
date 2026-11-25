import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  FileText,
  Palette,
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  GitBranch,
  MessageSquareWarning,
  CalendarCheck,
  RefreshCw,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Activity,
  Layers,
  Briefcase,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  ClientPortalService,
  ClientAccount,
  ClientProjectAccess,
  ClientInvitation,
  PortalProjectSummary,
  ProjectPortalBundle,
} from '../../services/clientPortalService';
import { ClientPortalAccountsPanel } from './ClientPortalAccountsPanel';
import { ClientPortalCommercialPanel } from './ClientPortalCommercialPanel';
import { ClientPortalProtectionPanel, ProtectionSubTab } from './ClientPortalProtectionPanel';
import { WorkPackagesControlPanel } from './WorkPackagesControlPanel';
import { CorporateAuthorityPortfolioPanel } from './CorporateAuthorityPortfolioPanel';

type OpsTab =
  | 'accounts'
  | 'corporate-portfolio'
  | 'work-packages'
  | 'brief'
  | 'quotations'
  | 'prework'
  | 'progress'
  | 'completions'
  | 'damage'
  | 'variations'
  | 'tickets'
  | 'weekly';

export interface ClientPortalOperationsModuleProps {
  mode?: 'full' | 'project' | 'qc' | 'supervisor';
  fixedProjectId?: string;
  onBackToDashboard?: () => void;
}

export const ClientPortalOperationsModule: React.FC<ClientPortalOperationsModuleProps> = ({
  mode = 'full',
  fixedProjectId,
  onBackToDashboard,
}) => {
  const { user, profile, currentRoleKey } = useAuth();

  const isLeadership = currentRoleKey === 'management' || currentRoleKey === 'executive_director';
  const isPortalManager = isLeadership || currentRoleKey === 'admin';
  const canVerifyQC = isLeadership || currentRoleKey === 'technical';

  const actorName = useMemo(() => {
    return (
      profile?.display_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      user?.email ||
      'Davejoe Staff'
    );
  }, [profile, user]);

  const availableTabs = useMemo((): { id: OpsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] => {
    if (mode === 'qc') {
      return [
        { id: 'work-packages', label: 'Work Packages & QC', icon: Layers },
        { id: 'prework', label: 'Pre-Work Surface QC', icon: ClipboardCheck },
        { id: 'completions', label: 'Area Completions & Releases', icon: ShieldCheck },
        { id: 'damage', label: 'Subsequent Damage', icon: AlertTriangle },
        { id: 'progress', label: '5-Stage Progress QC', icon: Activity },
        { id: 'variations', label: 'Variations Assessment', icon: GitBranch },
      ];
    }
    if (mode === 'supervisor') {
      return [
        { id: 'work-packages', label: 'Work Packages & Milestones', icon: Layers },
        { id: 'completions', label: 'Area Completions', icon: ShieldCheck },
        { id: 'progress', label: '5-Stage Progress', icon: Activity },
        { id: 'prework', label: 'Pre-Work Surfaces', icon: ClipboardCheck },
        { id: 'damage', label: 'Subsequent Damage', icon: AlertTriangle },
      ];
    }
    if (mode === 'project') {
      return [
        { id: 'work-packages', label: 'Work Packages & Controls', icon: Layers },
        { id: 'brief', label: 'Brief & Specs', icon: Palette },
        { id: 'quotations', label: 'Quotations & Contracts', icon: FileText },
        { id: 'prework', label: 'Pre-Work QC', icon: ClipboardCheck },
        { id: 'progress', label: '5-Stage Progress', icon: Activity },
        { id: 'completions', label: 'Area Completions & Releases', icon: ShieldCheck },
        { id: 'damage', label: 'Subsequent Damage', icon: AlertTriangle },
        { id: 'variations', label: 'Variations (10-Step)', icon: GitBranch },
        { id: 'tickets', label: 'Requests & Complaints', icon: MessageSquareWarning },
        { id: 'weekly', label: 'Weekly Summaries', icon: CalendarCheck },
      ];
    }
    return [
      ...(isPortalManager
        ? [
            { id: 'accounts' as OpsTab, label: 'Accounts & Invitations', icon: Building2 },
            { id: 'corporate-portfolio' as OpsTab, label: 'Corporate Portfolios & Authority', icon: Briefcase },
          ]
        : []),
      { id: 'work-packages', label: 'Work Packages & Controls', icon: Layers },
      { id: 'brief', label: 'Brief & Colour Specs', icon: Palette },
      { id: 'quotations', label: 'Quotations & Contracts', icon: FileText },
      { id: 'prework', label: 'Pre-Work QC', icon: ClipboardCheck },
      { id: 'progress', label: '5-Stage Progress', icon: Activity },
      { id: 'completions', label: 'Area Completions & Releases', icon: ShieldCheck },
      { id: 'damage', label: 'Subsequent Damage', icon: AlertTriangle },
      { id: 'variations', label: 'Variations (10-Step)', icon: GitBranch },
      { id: 'tickets', label: 'Requests & Complaints', icon: MessageSquareWarning },
      { id: 'weekly', label: 'Weekly Summaries', icon: CalendarCheck },
    ];
  }, [mode, isPortalManager]);

  const [activeTab, setActiveTab] = useState<OpsTab>(availableTabs[0]?.id || 'completions');
  const [loading, setLoading] = useState(true);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<ClientAccount[]>([]);
  const [projects, setProjects] = useState<PortalProjectSummary[]>([]);
  const [accessList, setAccessList] = useState<ClientProjectAccess[]>([]);
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(fixedProjectId || '');
  const [bundle, setBundle] = useState<ProjectPortalBundle | null>(null);

  const showSuccess = (msg: string) => {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 5000);
  };

  const loadDirectoryData = useCallback(async () => {
    setLoading(true);
    try {
      const [projList, accList, accGrants, invs] = await Promise.all([
        ClientPortalService.getAllProjectsSummary(),
        isPortalManager ? ClientPortalService.getClientAccounts() : Promise.resolve([]),
        isPortalManager ? ClientPortalService.getProjectAccessList() : Promise.resolve([]),
        isPortalManager ? ClientPortalService.getClientInvitations() : Promise.resolve([]),
      ]);
      setProjects(projList);
      setAccounts(accList);
      setAccessList(accGrants);
      setInvitations(invs);

      if (fixedProjectId) {
        setSelectedProjectId(fixedProjectId);
      } else if (!selectedProjectId && projList.length > 0) {
        setSelectedProjectId(projList[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to load client portal directory data.');
    } finally {
      setLoading(false);
    }
  }, [fixedProjectId, isPortalManager, selectedProjectId]);

  const loadProjectBundle = useCallback(async () => {
    const pid = fixedProjectId || selectedProjectId;
    if (!pid) return;
    setBundleLoading(true);
    try {
      const data = await ClientPortalService.getProjectPortalBundle(pid, { isClientView: false });
      setBundle(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to load project protection records.');
    } finally {
      setBundleLoading(false);
    }
  }, [fixedProjectId, selectedProjectId]);

  useEffect(() => {
    loadDirectoryData();
  }, [loadDirectoryData]);

  useEffect(() => {
    if (fixedProjectId || selectedProjectId) {
      loadProjectBundle();
    }
  }, [fixedProjectId, selectedProjectId, loadProjectBundle]);

  const refreshAll = async () => {
    await Promise.all([loadDirectoryData(), loadProjectBundle()]);
  };

  const isCommercialTab = activeTab === 'brief' || activeTab === 'quotations' || activeTab === 'weekly';
  const isProtectionTab =
    activeTab === 'prework' ||
    activeTab === 'progress' ||
    activeTab === 'completions' ||
    activeTab === 'damage' ||
    activeTab === 'variations' ||
    activeTab === 'tickets';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#18b892]">
              Davejoe Client Experience & Project Protection
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {mode === 'qc'
              ? 'Pre-Work Surface QC, Area Verification & Damage Protection'
              : mode === 'supervisor'
                ? 'Site Area Completions, Progress & Condition Evidence'
                : 'Client Portal & Project Protection Control'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!fixedProjectId && projects.length > 0 && activeTab !== 'accounts' && activeTab !== 'corporate-portfolio' && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              aria-label="Select project"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 max-w-xs"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} — {p.name}
                </option>
              ))}
            </select>
          )}

          {isLeadership && (
            <Link
              to="/client"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#18b892]" /> Preview Client Portal
            </Link>
          )}

          <button
            type="button"
            onClick={refreshAll}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${bundleLoading || loading ? 'animate-spin text-[#18b892]' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Horizontal Tab Bar */}
      <div className="bg-white rounded-xl border border-slate-200/90 px-3 py-2 flex items-center gap-1 overflow-x-auto">
        {availableTabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#18b892]/12 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#18b892]' : 'text-slate-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#18b892] shrink-0" />
          {notice}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#18b892]" />
        </div>
      ) : activeTab === 'accounts' ? (
        <ClientPortalAccountsPanel
          accounts={accounts}
          projects={projects}
          accessList={accessList}
          invitations={invitations}
          currentUserId={user?.id}
          onRefresh={refreshAll}
          onSuccess={showSuccess}
          onError={setError}
        />
      ) : activeTab === 'corporate-portfolio' ? (
        <CorporateAuthorityPortfolioPanel
          canManageGovernance={isPortalManager}
          onSelectProject={(pid) => {
            setSelectedProjectId(pid);
            setActiveTab('work-packages');
          }}
        />
      ) : activeTab === 'work-packages' && (fixedProjectId || selectedProjectId) ? (
        <WorkPackagesControlPanel
          projectId={fixedProjectId || selectedProjectId}
          projectLabel={
            projects.find((p) => p.id === (fixedProjectId || selectedProjectId))?.project_code
          }
          canManage={isPortalManager || currentRoleKey === 'technical' || currentRoleKey === 'supervisor'}
          canApprove={isPortalManager}
        />
      ) : !bundle ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
          Select a project above to manage its client portal records and project protection workflows.
        </div>
      ) : isCommercialTab ? (
        <ClientPortalCommercialPanel
          bundle={bundle}
          accounts={accounts}
          activeSubTab={activeTab}
          currentUserId={user?.id}
          actorName={actorName}
          isLeadership={isLeadership}
          onRefresh={loadProjectBundle}
          onSuccess={showSuccess}
          onError={setError}
        />
      ) : isProtectionTab ? (
        <ClientPortalProtectionPanel
          bundle={bundle}
          activeSubTab={activeTab as ProtectionSubTab}
          currentUserId={user?.id}
          actorName={actorName}
          isLeadership={isLeadership}
          canVerifyQC={canVerifyQC}
          onRefresh={loadProjectBundle}
          onSuccess={showSuccess}
          onError={setError}
        />
      ) : null}
    </div>
  );
};
