import React, { useState } from 'react';
import {
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  GitBranch,
  MessageSquareWarning,
  CheckCircle2,
  Send,
  Lock,
} from 'lucide-react';
import {
  ClientPortalService,
  ProjectPortalBundle,
  PreworkSurfaceInspection,
  ProjectAreaCompletion,
  SubsequentDamageIncident,
  ReworkClassification,
  VariationWorkflowStage,
  MediaEvidenceItem,
  REWORK_CLASSIFICATION_LABELS,
  AREA_RELEASE_STANDARD_LABEL,
  formatCurrency,
  formatShortDate,
  formatDateTime,
} from '../../services/clientPortalService';
import {
  StatusText,
  ProgressStageTrack,
  VariationStepper,
  EvidenceUploader,
  EvidenceMediaGallery,
} from './ClientPortalShared';

export type ProtectionSubTab = 'prework' | 'progress' | 'completions' | 'damage' | 'variations' | 'tickets';

export const ClientPortalProtectionPanel: React.FC<{
  bundle: ProjectPortalBundle;
  activeSubTab: ProtectionSubTab;
  currentUserId?: string;
  actorName: string;
  isLeadership: boolean;
  canVerifyQC: boolean;
  onRefresh: () => Promise<void>;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({
  bundle,
  activeSubTab,
  currentUserId,
  actorName,
  isLeadership,
  canVerifyQC,
  onRefresh,
  onSuccess,
  onError,
}) => {
  const [saving, setSaving] = useState(false);

  // Pre-work inspection form
  const [pwArea, setPwArea] = useState('');
  const [pwSubstrate, setPwSubstrate] = useState('Sand-cement plaster');
  const [pwCondition, setPwCondition] = useState('');
  const [pwScreeding, setPwScreeding] = useState('');
  const [pwCracks, setPwCracks] = useState(false);
  const [pwDamp, setPwDamp] = useState(false);
  const [pwUneven, setPwUneven] = useState(false);
  const [pwDamage, setPwDamage] = useState(false);
  const [pwObs, setPwObs] = useState('');
  const [pwCorrection, setPwCorrection] = useState('');
  const [pwResp, setPwResp] = useState<PreworkSurfaceInspection['scope_responsibility']>('under_review');
  const [pwCost, setPwCost] = useState('0');
  const [pwDays, setPwDays] = useState('0');
  const [pwMedia, setPwMedia] = useState<MediaEvidenceItem[]>([]);

  // 5-Stage Progress form
  const [pgTitle, setPgTitle] = useState('');
  const [pgStage, setPgStage] = useState('');
  const [pgType, setPgType] = useState<'milestone' | 'completed_activity' | 'work_in_progress' | 'upcoming_activity' | 'pending_client_decision' | 'delay' | 'technical_concern'>('work_in_progress');
  const [pgPct, setPgPct] = useState('25');
  const [pgSummary, setPgSummary] = useState('');
  const [pgDelay, setPgDelay] = useState('');
  const [pgMedia, setPgMedia] = useState<MediaEvidenceItem[]>([]);

  // Area Completion form
  const [acArea, setAcArea] = useState('');
  const [acSpecId, setAcSpecId] = useState('');
  const [acWork, setAcWork] = useState('');
  const [acQty, setAcQty] = useState('');
  const [acUnit, setAcUnit] = useState('sqm');
  const [acTeam, setAcTeam] = useState('');
  const [acMedia, setAcMedia] = useState<MediaEvidenceItem[]>([]);
  const [qcNotesMap, setQcNotesMap] = useState<Record<string, string>>({});
  const [releaseFormId, setReleaseFormId] = useState<string | null>(null);
  const [relCondition, setRelCondition] = useState('All surfaces inspected, uniform finish verified, clean and free of defects.');
  const [relSnags, setRelSnags] = useState('None');
  const [relReceiver, setRelReceiver] = useState('');
  const [relProtection, setRelProtection] = useState('Floor masking & corner edge guards installed');
  const [relFormalHandover, setRelFormalHandover] = useState(false);

  // Subsequent Damage form
  const [dmAreaCompId, setDmAreaCompId] = useState('');
  const [dmDate, setDmDate] = useState(new Date().toISOString().slice(0, 10));
  const [dmDesc, setDmDesc] = useState('');
  const [dmCause, setDmCause] = useState('');
  const [dmTrades, setDmTrades] = useState('');
  const [dmClass, setDmClass] = useState<ReworkClassification>('damage_by_another_trade');
  const [dmCorrection, setDmCorrection] = useState('');
  const [dmCost, setDmCost] = useState('0');
  const [dmDays, setDmDays] = useState('0');
  const [dmMedia, setDmMedia] = useState<MediaEvidenceItem[]>([]);

  // Variation form
  const [varTitle, setVarTitle] = useState('');
  const [varClass, setVarClass] = useState<ReworkClassification>('client_requested_change');
  const [varOrigSpec, setVarOrigSpec] = useState('');
  const [varRevSpec, setVarRevSpec] = useState('');
  const [varChargeable, setVarChargeable] = useState(true);
  const [varCost, setVarCost] = useState('0');
  const [varDays, setVarDays] = useState('0');
  const [varContractType, setVarContractType] = useState<'standard' | 'pending_valuation' | 'disputed' | 'instructed_unpriced'>('standard');
  const [varSubcontractConf, setVarSubcontractConf] = useState(false);

  // Ticket triage notes
  const [ticketResMap, setTicketResMap] = useState<Record<string, string>>({});

  // --- Handlers ---
  const handleCreatePrework = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ClientPortalService.createPreworkInspection({
        project_id: bundle.project.id,
        area_label: pwArea,
        inspector_id: currentUserId,
        inspector_name: actorName,
        substrate_type: pwSubstrate,
        substrate_condition: pwCondition,
        screeding_plastering_quality: pwScreeding,
        has_cracks: pwCracks,
        has_dampness: pwDamp,
        has_unevenness: pwUneven,
        has_damage: pwDamage,
        other_contractor_observation: pwObs,
        recommended_correction: pwCorrection,
        scope_responsibility: pwResp,
        estimated_cost_impact: Number(pwCost || 0),
        estimated_time_impact_days: Number(pwDays || 0),
        evidence_media: pwMedia,
      });
      setPwArea('');
      setPwCondition('');
      setPwScreeding('');
      setPwObs('');
      setPwCorrection('');
      setPwCracks(false);
      setPwDamp(false);
      setPwUneven(false);
      setPwDamage(false);
      setPwMedia([]);
      await onRefresh();
      onSuccess('Pre-work surface inspection recorded and published to Client Portal.');
    } catch (err: any) {
      onError(err?.message || 'Unable to log pre-work surface inspection.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ClientPortalService.createProgressUpdate({
        project_id: bundle.project.id,
        title: pgTitle,
        stage_name: pgStage || undefined,
        activity_type: pgType,
        progress_percent: Number(pgPct || 0),
        summary: pgSummary,
        delay_reason: pgDelay || undefined,
        media_items: pgMedia,
        reported_by: currentUserId,
        reported_by_name: actorName,
      });
      setPgTitle('');
      setPgSummary('');
      setPgDelay('');
      setPgMedia([]);
      await onRefresh();
      onSuccess('Progress update logged at Stage 1 (Reported by Site Supervisor).');
    } catch (err: any) {
      onError(err?.message || 'Unable to log progress update.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceProgress = async (id: string, nextStage: 'inspected_by_qc' | 'verified_completed' | 'formally_handed_over') => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      await ClientPortalService.advanceProgressVerificationStage({
        updateId: id,
        nextStage,
        actorUserId: currentUserId,
        actorName,
      });
      await onRefresh();
      onSuccess(`Progress verification stage updated to ${nextStage.replace(/_/g, ' ')}.`);
    } catch (err: any) {
      onError(err?.message || 'Unable to advance verification stage.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAreaCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const linkedSpec = bundle.specifications.find((s) => s.id === acSpecId);
      const photos = acMedia.filter((m) => !m.mime_type.startsWith('video/'));
      const videos = acMedia.filter((m) => m.mime_type.startsWith('video/'));
      await ClientPortalService.createAreaCompletion({
        project_id: bundle.project.id,
        specification_id: acSpecId || null,
        specification_version: linkedSpec?.version_number || null,
        area_location: acArea,
        work_performed: acWork,
        quantity_completed: acQty ? Number(acQty) : null,
        unit_of_measure: acUnit,
        site_supervisor_id: currentUserId,
        site_supervisor_name: actorName,
        assigned_team_summary: acTeam || undefined,
        completion_photos: photos,
        completion_videos: videos,
      });
      setAcArea('');
      setAcWork('');
      setAcQty('');
      setAcTeam('');
      setAcMedia([]);
      await onRefresh();
      onSuccess('Area completion record created and queued for Technical / QC verification.');
    } catch (err: any) {
      onError(err?.message || 'Unable to create area completion record.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyQC = async (comp: ProjectAreaCompletion, outcome: 'pass' | 'conditional_pass' | 'fail') => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      await ClientPortalService.verifyAreaCompletionQC({
        completion: comp,
        outcome,
        qcNotes: qcNotesMap[comp.id] || (outcome === 'pass' ? 'Verified compliant with approved specification.' : 'QC defects noted.'),
        inspectorId: currentUserId,
        inspectorName: actorName,
      });
      await onRefresh();
      onSuccess(
        outcome === 'fail'
          ? `QC Fail recorded for ${comp.completion_ref} and linked snag task automatically created.`
          : `Internal QC verification (${outcome.replace('_', ' ')}) recorded.`
      );
    } catch (err: any) {
      onError(err?.message || 'Unable to record QC verification.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRelease = async (completionId: string) => {
    if (!currentUserId || !relReceiver.trim()) {
      onError('Specify the receiving client / main-contractor representative.');
      return;
    }
    setSaving(true);
    try {
      await ClientPortalService.releaseAreaForSubsequentTrades({
        completionId,
        conditionAtRelease: relCondition,
        outstandingSnags: relSnags,
        receivingRepresentative: relReceiver,
        protectionMeasures: relProtection,
        formalHandoverOccurred: relFormalHandover,
        releasedByUserId: currentUserId,
        releasedByName: actorName,
      });
      setReleaseFormId(null);
      setRelReceiver('');
      await onRefresh();
      onSuccess(`Recorded: "${AREA_RELEASE_STANDARD_LABEL}".`);
    } catch (err: any) {
      onError(err?.message || 'Unable to release area.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    const linkedArea = bundle.areaCompletions.find((a) => a.id === dmAreaCompId);
    if (!linkedArea) {
      onError('Select the verified Area Completion Record affected by subsequent damage.');
      return;
    }
    setSaving(true);
    try {
      await ClientPortalService.createSubsequentDamageIncident({
        project_id: bundle.project.id,
        area_completion_id: linkedArea.id,
        discovered_date: dmDate,
        area_location: linkedArea.area_location,
        description: dmDesc,
        known_or_suspected_cause: dmCause,
        relevant_contractors_activities: dmTrades,
        damage_media: dmMedia,
        reported_by: currentUserId,
        reported_by_name: actorName,
        rework_classification: dmClass,
        proposed_correction: dmCorrection,
        estimated_cost_impact: Number(dmCost || 0),
        estimated_time_impact_days: Number(dmDays || 0),
      });
      setDmDesc('');
      setDmCause('');
      setDmTrades('');
      setDmCorrection('');
      setDmCost('0');
      setDmDays('0');
      setDmMedia([]);
      await onRefresh();
      onSuccess('Subsequent damage incident logged and linked to original area completion evidence.');
    } catch (err: any) {
      onError(err?.message || 'Unable to log subsequent damage incident.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertDamageToVariation = async (inc: SubsequentDamageIncident) => {
    setSaving(true);
    try {
      const isDefect = inc.rework_classification === 'davejoe_workmanship_defect';
      await ClientPortalService.createVariation({
        project_id: inc.project_id,
        source_damage_incident_id: inc.id,
        title: `Remediation for ${inc.incident_ref} — ${inc.area_location}`,
        rework_classification: inc.rework_classification,
        original_spec_summary: `Verified area completion at ${inc.area_location} prior to incident ${inc.incident_ref}`,
        revised_spec_summary: inc.proposed_correction || inc.description,
        is_chargeable: !isDefect,
        estimated_cost: isDefect ? 0 : Number(inc.estimated_cost_impact || 0),
        time_impact_days: Number(inc.estimated_time_impact_days || 0),
        requested_by: currentUserId,
        requested_by_name: actorName,
      });
      await onRefresh();
      onSuccess(`Variation created and linked to ${inc.incident_ref}.`);
    } catch (err: any) {
      onError(err?.message || 'Unable to create linked variation.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVariation = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDefect = varClass === 'davejoe_workmanship_defect';
    setSaving(true);
    try {
      await ClientPortalService.createVariation({
        project_id: bundle.project.id,
        title: varTitle,
        rework_classification: varClass,
        original_spec_summary: varOrigSpec,
        revised_spec_summary: varRevSpec,
        is_chargeable: isDefect ? false : varChargeable,
        estimated_cost: isDefect ? 0 : Number(varCost || 0),
        time_impact_days: Number(varDays || 0),
        contract_variation_type: varContractType,
        is_subcontract_confidential: varSubcontractConf,
        requested_by: currentUserId,
        requested_by_name: actorName,
      });
      setVarTitle('');
      setVarOrigSpec('');
      setVarRevSpec('');
      setVarCost('0');
      setVarDays('0');
      await onRefresh();
      onSuccess('Variation created at Governance Step 1 (Request Received).');
    } catch (err: any) {
      onError(err?.message || 'Unable to create variation.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceVariation = async (id: string, nextStage: VariationWorkflowStage, reconciledAmount?: number) => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      await ClientPortalService.advanceVariationStage({
        variationId: id,
        nextStage,
        actorUserId: currentUserId,
        actorName,
        reconciledAmount,
      });
      await onRefresh();
      onSuccess(`Variation moved to "${nextStage.replace(/_/g, ' ')}".`);
    } catch (err: any) {
      onError(err?.message || 'Governance check blocked this variation transition.');
    } finally {
      setSaving(false);
    }
  };

  const handleTicketUpdate = async (id: string, status: 'in_review' | 'action_in_progress' | 'resolved' | 'closed') => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      await ClientPortalService.updateRequestComplaintStatus({
        recordId: id,
        status,
        resolution_summary: status === 'resolved' || status === 'closed' ? ticketResMap[id] : undefined,
        internal_notes: status !== 'resolved' && status !== 'closed' ? ticketResMap[id] : undefined,
        actorUserId: currentUserId,
        actorName,
      });
      await onRefresh();
      onSuccess(`Ticket status updated to ${status.replace(/_/g, ' ')}.`);
    } catch (err: any) {
      onError(err?.message || 'Unable to update ticket (check confidentiality / conflict-of-interest rules).');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // RENDER BY SUB-TAB
  // ============================================================================
  if (activeSubTab === 'prework') {
    return (
      <div className="space-y-6">
        {canVerifyQC && (
          <form onSubmit={handleCreatePrework} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#18b892]" /> Record Pre-Work Surface Inspection (Technical / QC)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={pwArea}
                onChange={(e) => setPwArea(e.target.value)}
                placeholder="Area / Wall / Elevation *"
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
              <input
                type="text"
                value={pwSubstrate}
                onChange={(e) => setPwSubstrate(e.target.value)}
                placeholder="Substrate type (e.g. Plaster, POP, Gypsum)"
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
              <input
                type="text"
                value={pwScreeding}
                onChange={(e) => setPwScreeding(e.target.value)}
                placeholder="Screeding / Plastering quality"
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <input
              type="text"
              required
              value={pwCondition}
              onChange={(e) => setPwCondition(e.target.value)}
              placeholder="Overall substrate condition assessment *"
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <div className="flex flex-wrap gap-4 text-xs text-slate-700">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={pwCracks} onChange={(e) => setPwCracks(e.target.checked)} className="accent-[#18b892]" /> Cracks
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={pwDamp} onChange={(e) => setPwDamp(e.target.checked)} className="accent-[#18b892]" /> Dampness / Moisture
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={pwUneven} onChange={(e) => setPwUneven(e.target.checked)} className="accent-[#18b892]" /> Unevenness
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={pwDamage} onChange={(e) => setPwDamage(e.target.checked)} className="accent-[#18b892]" /> Existing Surface Damage
              </label>
            </div>
            <textarea
              rows={2}
              value={pwObs}
              onChange={(e) => setPwObs(e.target.value)}
              placeholder="Factual observation of prior/other-contractor substrate work (objective observations only — never automatic liability claim)..."
              className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
            />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                value={pwCorrection}
                onChange={(e) => setPwCorrection(e.target.value)}
                placeholder="Recommended correction"
                className="sm:col-span-2 h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
              <select
                value={pwResp}
                onChange={(e) => setPwResp(e.target.value as any)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="under_review">Scope: Under Review</option>
                <option value="davejoe">Scope: Davejoe</option>
                <option value="client">Scope: Client</option>
                <option value="main_contractor">Scope: Main Contractor</option>
                <option value="other_trade">Scope: Other Trade</option>
                <option value="shared">Scope: Shared</option>
              </select>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min="0"
                  value={pwCost}
                  onChange={(e) => setPwCost(e.target.value)}
                  placeholder="Est. Cost"
                  className="flex-1 h-9 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
                <input
                  type="number"
                  min="0"
                  value={pwDays}
                  onChange={(e) => setPwDays(e.target.value)}
                  placeholder="Days"
                  className="w-16 h-9 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>
            <EvidenceUploader
              projectId={bundle.project.id}
              category="prework_qc"
              uploadedByName={actorName}
              items={pwMedia}
              onChange={setPwMedia}
              label="Attach Pre-Work Substrate Photos / Videos"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
              >
                Log Pre-Work Surface Inspection
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {bundle.preworkInspections.map((ins) => (
            <div key={ins.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-slate-500 mr-2">{ins.inspection_ref}</span>
                  <strong className="text-sm text-slate-900">{ins.area_label}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <StatusText
                    label={ins.clearance_to_proceed ? 'Cleared to Proceed' : 'Hold / Pending Clearance'}
                    tone={ins.clearance_to_proceed ? 'emerald' : 'amber'}
                  />
                  {canVerifyQC && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        await ClientPortalService.togglePreworkClearance(ins.id, !ins.clearance_to_proceed);
                        await onRefresh();
                        onSuccess('Pre-work clearance updated.');
                      }}
                      className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 cursor-pointer"
                    >
                      {ins.clearance_to_proceed ? 'Revoke Clearance' : 'Grant Clearance'}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-slate-700">{ins.substrate_condition}</p>
              <p className="text-slate-500">
                Client Decision: <strong className="capitalize text-slate-800">{ins.client_decision.replace(/_/g, ' ')}</strong>
                {ins.client_decision_notes ? ` — "${ins.client_decision_notes}"` : ''}
              </p>
              <EvidenceMediaGallery items={ins.evidence_media || []} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSubTab === 'progress') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleCreateProgress} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">Log Progress Update (Enters at Stage 1: Reported by Supervisor)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={pgTitle}
              onChange={(e) => setPgTitle(e.target.value)}
              placeholder="Milestone / Activity title *"
              className="sm:col-span-2 h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <select
              value={pgType}
              onChange={(e) => setPgType(e.target.value as any)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            >
              <option value="work_in_progress">Work in Progress</option>
              <option value="completed_activity">Completed Activity</option>
              <option value="milestone">Major Milestone</option>
              <option value="upcoming_activity">Upcoming Activity</option>
              <option value="pending_client_decision">Pending Client Decision</option>
              <option value="delay">Delay Notice</option>
              <option value="technical_concern">Technical Concern</option>
            </select>
            <input
              type="number"
              min={0}
              max={100}
              value={pgPct}
              onChange={(e) => setPgPct(e.target.value)}
              placeholder="% Complete"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={pgStage}
              onChange={(e) => setPgStage(e.target.value)}
              placeholder="Stage / Zone name"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <input
              type="text"
              value={pgDelay}
              onChange={(e) => setPgDelay(e.target.value)}
              placeholder="Delay reason (optional)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <textarea
            rows={2}
            required
            value={pgSummary}
            onChange={(e) => setPgSummary(e.target.value)}
            placeholder="Factual summary of work performed..."
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
          />
          <EvidenceUploader
            projectId={bundle.project.id}
            category="progress_media"
            uploadedByName={actorName}
            items={pgMedia}
            onChange={setPgMedia}
            label="Attach Progress Photos / Videos"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              Log Stage 1 Update
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {bundle.progressUpdates.map((up) => (
            <div key={up.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{up.title}</h4>
                  <p className="text-xs text-slate-500">
                    Reported by {up.reported_by_name || 'Site Supervisor'} · {formatDateTime(up.reported_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {up.verification_stage === 'reported_by_supervisor' && canVerifyQC && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleAdvanceProgress(up.id, 'inspected_by_qc')}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      Mark Stage 2: QC Inspected
                    </button>
                  )}
                  {up.verification_stage === 'inspected_by_qc' && canVerifyQC && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleAdvanceProgress(up.id, 'verified_completed')}
                      className="px-3 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
                    >
                      Mark Stage 3: Verified Completed
                    </button>
                  )}
                  {up.verification_stage === 'acknowledged_by_client' && isLeadership && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleAdvanceProgress(up.id, 'formally_handed_over')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Mark Stage 5: Formally Handed Over
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-600">{up.summary}</p>
              <ProgressStageTrack current={up.verification_stage} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSubTab === 'completions') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleCreateAreaCompletion} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#18b892]" /> Record Area Completion & Condition Evidence
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={acArea}
              onChange={(e) => setAcArea(e.target.value)}
              placeholder="Area / Room / Floor Zone *"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <select
              value={acSpecId}
              onChange={(e) => setAcSpecId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            >
              <option value="">Link Approved Specification (optional)</option>
              {bundle.specifications
                .filter((s) => s.status === 'approved')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.spec_code} v{s.version_number} — {s.area_label}
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={acTeam}
              onChange={(e) => setAcTeam(e.target.value)}
              placeholder="Assigned team / artisans summary"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={acWork}
              onChange={(e) => setAcWork(e.target.value)}
              placeholder="Work performed (coats, finish, detailing) *"
              className="sm:col-span-2 h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <input
              type="number"
              step="0.01"
              value={acQty}
              onChange={(e) => setAcQty(e.target.value)}
              placeholder="Quantity completed"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
            />
            <input
              type="text"
              value={acUnit}
              onChange={(e) => setAcUnit(e.target.value)}
              placeholder="Unit (sqm, rooms)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <EvidenceUploader
            projectId={bundle.project.id}
            category="area_completions"
            uploadedByName={actorName}
            items={acMedia}
            onChange={setAcMedia}
            label="Upload Timestamped Completion Photos & Walkthrough Videos"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              Submit Area Completion for QC
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {bundle.areaCompletions.map((comp) => (
            <div key={comp.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-slate-500">
                    {comp.completion_ref} · {formatShortDate(comp.completion_date)} · Supervisor:{' '}
                    {comp.site_supervisor_name || 'Assigned'}
                  </p>
                  <h4 className="text-sm font-bold text-slate-900 mt-0.5">{comp.area_location}</h4>
                  <p className="text-slate-600 mt-0.5">{comp.work_performed}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusText
                    label={`QC: ${comp.qc_outcome.replace(/_/g, ' ').toUpperCase()}`}
                    tone={comp.qc_outcome === 'pass' ? 'emerald' : comp.qc_outcome === 'fail' ? 'rose' : 'amber'}
                  />
                  <StatusText
                    label={`Client Ack: ${comp.client_acknowledgement_status.replace(/_/g, ' ')}`}
                    tone={comp.client_acknowledgement_status === 'acknowledged' ? 'emerald' : 'slate'}
                  />
                </div>
              </div>

              <EvidenceMediaGallery items={[...(comp.completion_photos || []), ...(comp.completion_videos || [])]} />

              {/* Internal QC Verification Controls */}
              {canVerifyQC && (comp.qc_outcome === 'pending' || comp.qc_outcome === 'fail') && (
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={qcNotesMap[comp.id] || ''}
                    onChange={(e) => setQcNotesMap((prev) => ({ ...prev, [comp.id]: e.target.value }))}
                    placeholder="Technical / QC inspection notes (auto-creates snag task on Fail)..."
                    className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleVerifyQC(comp, 'pass')}
                    className="px-3 h-8 rounded-lg bg-[#18b892] text-white font-semibold cursor-pointer"
                  >
                    QC Pass
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleVerifyQC(comp, 'conditional_pass')}
                    className="px-3 h-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-semibold cursor-pointer"
                  >
                    Conditional Pass
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleVerifyQC(comp, 'fail')}
                    className="px-3 h-8 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-semibold cursor-pointer"
                  >
                    QC Fail (+Snag)
                  </button>
                </div>
              )}

              {/* Submit to Client & Area Release Actions */}
              {(comp.qc_outcome === 'pass' || comp.qc_outcome === 'conditional_pass') && (
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {comp.client_acknowledgement_status === 'not_submitted' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        await ClientPortalService.submitAreaForClientAcknowledgement(comp.id);
                        await onRefresh();
                        onSuccess('Area completion submitted to Client Portal for external acknowledgement.');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-[#18b892]" /> Request Client Acknowledgement
                    </button>
                  )}

                  {!comp.area_released && (
                    <button
                      type="button"
                      onClick={() => setReleaseFormId(releaseFormId === comp.id ? null : comp.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                    >
                      Release Area for Subsequent Trades
                    </button>
                  )}
                </div>
              )}

              {comp.area_released && (
                <div className="rounded-lg bg-emerald-50/70 border border-emerald-200 p-3 text-emerald-900">
                  <p className="font-bold">{comp.release_label || AREA_RELEASE_STANDARD_LABEL}</p>
                  <p className="mt-0.5">
                    Receiving Rep: <strong>{comp.receiving_representative}</strong> · Released{' '}
                    {formatDateTime(comp.released_at)} · Formal Handover: {comp.formal_handover_occurred ? 'Yes' : 'No'}
                  </p>
                </div>
              )}

              {releaseFormId === comp.id && !comp.area_released && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <p className="font-bold text-slate-900">{AREA_RELEASE_STANDARD_LABEL}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={relReceiver}
                      onChange={(e) => setRelReceiver(e.target.value)}
                      placeholder="Receiving client / main-contractor representative *"
                      className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                    />
                    <input
                      type="text"
                      value={relSnags}
                      onChange={(e) => setRelSnags(e.target.value)}
                      placeholder="Outstanding snags at release"
                      className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                    />
                  </div>
                  <input
                    type="text"
                    value={relCondition}
                    onChange={(e) => setRelCondition(e.target.value)}
                    placeholder="Verified condition at release"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <input
                    type="text"
                    value={relProtection}
                    onChange={(e) => setRelProtection(e.target.value)}
                    placeholder="Protection measures & coordination notes"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                  />
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={relFormalHandover}
                      onChange={(e) => setRelFormalHandover(e.target.checked)}
                      className="accent-[#18b892]"
                    />
                    Formal Client Handover Occurred (leave unchecked if releasing only for subsequent trades)
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReleaseFormId(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSubmitRelease(comp.id)}
                      className="px-4 py-1.5 rounded-lg bg-[#18b892] text-white font-semibold cursor-pointer"
                    >
                      Confirm Area Release
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSubTab === 'damage') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleCreateDamage} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Log Subsequent Damage / Rework Incident (Linked to Verified Area)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Preserves factual comparison against the original completion record. Never automatically declares another party liable.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              required
              value={dmAreaCompId}
              onChange={(e) => setDmAreaCompId(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            >
              <option value="">Select Original Area Completion Record *</option>
              {bundle.areaCompletions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.completion_ref} — {a.area_location}
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              value={dmDate}
              onChange={(e) => setDmDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <select
              value={dmClass}
              onChange={(e) => setDmClass(e.target.value as ReworkClassification)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            >
              {(Object.keys(REWORK_CLASSIFICATION_LABELS) as ReworkClassification[]).map((k) => (
                <option key={k} value={k}>
                  {REWORK_CLASSIFICATION_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={2}
            required
            value={dmDesc}
            onChange={(e) => setDmDesc(e.target.value)}
            placeholder="Factual description of observed subsequent damage *"
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={dmCause}
              onChange={(e) => setDmCause(e.target.value)}
              placeholder="Known or suspected cause"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <input
              type="text"
              value={dmTrades}
              onChange={(e) => setDmTrades(e.target.value)}
              placeholder="Relevant contractors / site activities in the area"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              value={dmCorrection}
              onChange={(e) => setDmCorrection(e.target.value)}
              placeholder="Proposed remedial scope"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <input
              type="number"
              min="0"
              value={dmCost}
              onChange={(e) => setDmCost(e.target.value)}
              placeholder="Est. Cost Impact (NGN)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
            />
            <input
              type="number"
              min="0"
              value={dmDays}
              onChange={(e) => setDmDays(e.target.value)}
              placeholder="Est. Time Impact (Days)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
            />
          </div>
          <EvidenceUploader
            projectId={bundle.project.id}
            category="subsequent_damage"
            uploadedByName={actorName}
            items={dmMedia}
            onChange={setDmMedia}
            label="Upload Subsequent Damage Evidence Photos / Videos"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              Log Linked Subsequent Damage Record
            </button>
          </div>
        </form>

        <div className="space-y-3">
          {bundle.damageIncidents.map((inc) => (
            <div key={inc.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-slate-500 mr-2">{inc.incident_ref}</span>
                  <strong className="text-sm text-slate-900">{inc.area_location}</strong>
                  <span className="text-slate-400 ml-2">Discovered {formatShortDate(inc.discovered_date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusText label={REWORK_CLASSIFICATION_LABELS[inc.rework_classification]} tone="amber" />
                  {!inc.linked_variation_id && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleConvertDamageToVariation(inc)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                    >
                      Convert to Linked Variation
                    </button>
                  )}
                </div>
              </div>
              <p className="text-slate-700">{inc.description}</p>
              {inc.external_response && (
                <p className="text-emerald-800 bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5">
                  <strong>Client / Main-Contractor Response:</strong> {inc.external_response}
                </p>
              )}
              <EvidenceMediaGallery items={inc.damage_media || []} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSubTab === 'variations') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleCreateVariation} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#18b892]" /> Create Variation / Rework Instruction (10-Step Governance)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Davejoe workmanship defects are automatically non-chargeable. Chargeable variations require Management / Executive Director internal commercial approval before reaching the client.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={varTitle}
              onChange={(e) => setVarTitle(e.target.value)}
              placeholder="Variation title *"
              className="sm:col-span-2 h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <select
              value={varClass}
              onChange={(e) => {
                const next = e.target.value as ReworkClassification;
                setVarClass(next);
                if (next === 'davejoe_workmanship_defect') {
                  setVarChargeable(false);
                  setVarCost('0');
                }
              }}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            >
              {(Object.keys(REWORK_CLASSIFICATION_LABELS) as ReworkClassification[]).map((k) => (
                <option key={k} value={k}>
                  {REWORK_CLASSIFICATION_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <textarea
              rows={2}
              required
              value={varOrigSpec}
              onChange={(e) => setVarOrigSpec(e.target.value)}
              placeholder="Original specification / scope summary *"
              className="p-2.5 rounded-lg border border-slate-200 text-xs"
            />
            <textarea
              rows={2}
              required
              value={varRevSpec}
              onChange={(e) => setVarRevSpec(e.target.value)}
              placeholder="Revised specification / rework scope *"
              className="p-2.5 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
            <select
              value={varContractType}
              onChange={(e) => setVarContractType(e.target.value as any)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            >
              <option value="standard">Standard Priced Variation</option>
              <option value="pending_valuation">Pending Valuation</option>
              <option value="instructed_unpriced">Instructed — Unpriced</option>
              <option value="disputed">Disputed</option>
            </select>
            <input
              type="number"
              min="0"
              disabled={varClass === 'davejoe_workmanship_defect' || !varChargeable}
              value={varCost}
              onChange={(e) => setVarCost(e.target.value)}
              placeholder="Estimated Cost (NGN)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono disabled:bg-slate-100"
            />
            <input
              type="number"
              min="0"
              value={varDays}
              onChange={(e) => setVarDays(e.target.value)}
              placeholder="Time Impact (Days)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
            />
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                disabled={varClass === 'davejoe_workmanship_defect'}
                checked={varClass === 'davejoe_workmanship_defect' ? false : varChargeable}
                onChange={(e) => setVarChargeable(e.target.checked)}
                className="accent-[#18b892]"
              />
              Chargeable to Client
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={varSubcontractConf}
                onChange={(e) => setVarSubcontractConf(e.target.checked)}
                className="accent-[#18b892]"
              />
              Subcontract Confidential Pricing
            </label>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              Register Variation
            </button>
          </div>
        </form>

        <div className="space-y-4">
          {bundle.variations.map((v) => {
            const nextActionMap: Partial<
              Record<VariationWorkflowStage, { next: VariationWorkflowStage; label: string; leadershipOnly?: boolean }>
            > = {
              request_received: { next: 'technical_assessment', label: 'Step 2: Complete Technical Assessment' },
              technical_assessment: { next: 'scope_quantity_verified', label: 'Step 3: Verify Scope & Quantity' },
              scope_quantity_verified: { next: 'cost_time_assessed', label: 'Step 4: Complete Cost & Time Assessment' },
              cost_time_assessed: {
                next: 'internal_commercial_approved',
                label: 'Step 5: Management Internal Commercial Approval',
                leadershipOnly: v.is_chargeable,
              },
              internal_commercial_approved: { next: 'awaiting_client_approval', label: 'Step 6: Send to Client for Approval' },
              client_approved: { next: 'work_instruction_issued', label: 'Step 7: Issue Revised Work Instruction' },
              work_instruction_issued: { next: 'in_execution', label: 'Step 8: Mark In Execution' },
              in_execution: { next: 'technically_verified', label: 'Step 9: Mark Technical / QC Verified' },
              technically_verified: {
                next: 'financially_reconciled',
                label: 'Step 10: Financially Reconcile',
                leadershipOnly: true,
              },
            };
            const nextAction = nextActionMap[v.workflow_stage];

            return (
              <div key={v.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-slate-500">
                      {v.variation_ref} · {REWORK_CLASSIFICATION_LABELS[v.rework_classification]}
                    </p>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{v.title}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono text-slate-900">
                      {v.is_chargeable ? formatCurrency(v.estimated_cost, v.currency) : 'Non-Chargeable (₦0)'}
                    </p>
                    <p className="text-[11px] text-slate-500">+{v.time_impact_days}d impact</p>
                  </div>
                </div>

                <VariationStepper stage={v.workflow_stage} />

                {nextAction && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                    {nextAction.leadershipOnly && !isLeadership ? (
                      <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" /> Awaiting Management / Executive Director commercial governance approval.
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          handleAdvanceVariation(
                            v.id,
                            nextAction.next,
                            nextAction.next === 'financially_reconciled' ? v.estimated_cost : undefined
                          )
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        {nextAction.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Requests & Complaints Triage Tab
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <MessageSquareWarning className="w-4 h-4 text-[#18b892]" /> Client Requests & Complaints Triage (
          {bundle.requestsComplaints.length})
        </h4>
        <p className="text-xs text-slate-500 mt-0.5">
          Confidential Management escalations are restricted strictly to Management & Executive Director. Conflict-of-interest rules prevent named personnel from viewing or closing complaints about themselves.
        </p>
      </div>

      {bundle.requestsComplaints.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No client requests or complaints visible on this project.
        </div>
      ) : (
        bundle.requestsComplaints.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-slate-500">
                  {t.reference_no} · {t.record_kind.toUpperCase()} · {t.category.replace(/_/g, ' ')} · By{' '}
                  {t.submitted_by_name} on {formatDateTime(t.created_at)}
                </p>
                <h5 className="text-sm font-bold text-slate-900 mt-0.5">{t.subject}</h5>
              </div>
              <div className="flex items-center gap-1.5">
                {t.is_confidential_management && <StatusText label="Confidential Management" tone="rose" />}
                <StatusText
                  label={t.status.replace(/_/g, ' ').toUpperCase()}
                  tone={t.status === 'resolved' || t.status === 'closed' ? 'emerald' : 'amber'}
                />
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed">{t.description}</p>
            <EvidenceMediaGallery items={t.attachments || []} />

            {t.status !== 'closed' && (!t.is_confidential_management || isLeadership) && (
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={ticketResMap[t.id] || ''}
                  onChange={(e) => setTicketResMap((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  placeholder="Add internal triage note or client-facing resolution summary..."
                  className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-xs"
                />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleTicketUpdate(t.id, 'action_in_progress')}
                  className="px-3 h-8 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold cursor-pointer"
                >
                  Mark In Progress
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleTicketUpdate(t.id, 'resolved')}
                  className="px-3 h-8 rounded-lg bg-[#18b892] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
