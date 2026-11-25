import React, { useState } from 'react';
import { FileText, Palette, CalendarCheck, Plus, RefreshCw, CheckCircle2, Send } from 'lucide-react';
import {
  ClientPortalService,
  ClientAccount,
  ProjectPortalBundle,
  ProjectDeliveryModel,
  MediaEvidenceItem,
  ClientQuotationContract,
  ProjectSpecification,
  formatCurrency,
  formatShortDate,
} from '../../services/clientPortalService';
import { StatusText, EvidenceUploader } from './ClientPortalShared';

export const ClientPortalCommercialPanel: React.FC<{
  bundle: ProjectPortalBundle;
  accounts: ClientAccount[];
  activeSubTab: 'brief' | 'quotations' | 'weekly';
  currentUserId?: string;
  actorName: string;
  isLeadership: boolean;
  onRefresh: () => Promise<void>;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}> = ({ bundle, accounts, activeSubTab, currentUserId, actorName, isLeadership, onRefresh, onSuccess, onError }) => {
  const [saving, setSaving] = useState(false);

  // Project portal settings
  const [linkedClientId, setLinkedClientId] = useState(bundle.project.client_id || '');
  const [deliveryModel, setDeliveryModel] = useState<ProjectDeliveryModel>(
    bundle.project.project_delivery_model || 'direct_residential'
  );
  const [visibleStage, setVisibleStage] = useState(bundle.project.client_visible_stage || '');
  const [verifiedPct, setVerifiedPct] = useState(String(bundle.project.verified_progress_pct ?? 0));
  const [contactName, setContactName] = useState(bundle.project.official_contact_name || '');
  const [contactPhone, setContactPhone] = useState(bundle.project.official_contact_phone || '');
  const [contactEmail, setContactEmail] = useState(bundle.project.official_contact_email || '');
  const [contractRef, setContractRef] = useState(bundle.project.contract_reference || '');

  // Work package & Specification forms
  const [wpTitle, setWpTitle] = useState('');
  const [wpScopeType, setWpScopeType] = useState<'residential_room' | 'commercial_floor' | 'commercial_zone' | 'elevation' | 'work_package'>('residential_room');
  const [wpFloor, setWpFloor] = useState('');

  const [specArea, setSpecArea] = useState('');
  const [specWorkPkgId, setSpecWorkPkgId] = useState('');
  const [specMaterial, setSpecMaterial] = useState('');
  const [specManufacturer, setSpecManufacturer] = useState('');
  const [specColourName, setSpecColourName] = useState('');
  const [specColourCode, setSpecColourCode] = useState('');
  const [specHex, setSpecHex] = useState('#e8e5dc');
  const [specFinish, setSpecFinish] = useState('Silk Matt');
  const [specPrep, setSpecPrep] = useState('Sanding, primer & 2-coat skim screeding');
  const [specCoats, setSpecCoats] = useState('2');
  const [specSampleRef, setSpecSampleRef] = useState('');
  const [specNotes, setSpecNotes] = useState('');
  const [specAttachments, setSpecAttachments] = useState<MediaEvidenceItem[]>([]);

  // Quotation form
  const [qType, setQType] = useState<ClientQuotationContract['document_type']>('quotation');
  const [qTitle, setQTitle] = useState('');
  const [qScope, setQScope] = useState('');
  const [qExclusions, setQExclusions] = useState('');
  const [qPaymentTerms, setQPaymentTerms] = useState('50% mobilisation · 30% mid-progress · 20% verified handover');
  const [qSubtotal, setQSubtotal] = useState('');
  const [qTax, setQTax] = useState('0');
  const [qValidUntil, setQValidUntil] = useState('');
  const [qSubcontractConf, setQSubcontractConf] = useState(false);
  const [qFiles, setQFiles] = useState<MediaEvidenceItem[]>([]);

  // Weekly Summary form
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [wsTitle, setWsTitle] = useState(`Weekly Progress Summary — ${bundle.project.name}`);
  const [wsStart, setWsStart] = useState(weekAgo);
  const [wsEnd, setWsEnd] = useState(today);
  const [wsExecNotes, setWsExecNotes] = useState('');
  const [wsUpcoming, setWsUpcoming] = useState('');
  const [wsPendingDecisions, setWsPendingDecisions] = useState('');

  const handleSaveProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ClientPortalService.updateProjectPortalSettings(bundle.project.id, {
        client_id: linkedClientId || null,
        project_delivery_model: deliveryModel,
        client_visible_stage: visibleStage || null,
        verified_progress_pct: Math.max(0, Math.min(100, Number(verifiedPct || 0))),
        official_contact_name: contactName || null,
        official_contact_phone: contactPhone || null,
        official_contact_email: contactEmail || null,
        contract_reference: contractRef || null,
      });
      await onRefresh();
      onSuccess('Project portal settings saved.');
    } catch (err: any) {
      onError(err?.message || 'Unable to update project portal settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateWorkPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ClientPortalService.createWorkPackage({
        project_id: bundle.project.id,
        title: wpTitle,
        scope_type: wpScopeType,
        floor_level: wpFloor || undefined,
        created_by: currentUserId,
      });
      setWpTitle('');
      setWpFloor('');
      await onRefresh();
      onSuccess('Work package added to project brief.');
    } catch (err: any) {
      onError(err?.message || 'Unable to create work package.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ClientPortalService.createSpecification({
        project_id: bundle.project.id,
        work_package_id: specWorkPkgId || null,
        area_label: specArea,
        material_product: specMaterial,
        manufacturer: specManufacturer || undefined,
        colour_name: specColourName || undefined,
        colour_code: specColourCode || undefined,
        preview_hex: specHex || undefined,
        finish_type: specFinish || undefined,
        surface_preparation: specPrep || undefined,
        number_of_coats: specCoats ? Number(specCoats) : null,
        approved_sample_ref: specSampleRef || undefined,
        technical_notes: specNotes || undefined,
        attachments: specAttachments,
        status: 'awaiting_approval',
        prepared_by: currentUserId,
        prepared_by_name: actorName,
      });
      setSpecArea('');
      setSpecMaterial('');
      setSpecColourName('');
      setSpecColourCode('');
      setSpecSampleRef('');
      setSpecNotes('');
      setSpecAttachments([]);
      await onRefresh();
      onSuccess('Specification submitted to client for formal approval.');
    } catch (err: any) {
      onError(err?.message || 'Unable to create specification.');
    } finally {
      setSaving(false);
    }
  };

  const handleReviseSpec = async (prior: ProjectSpecification) => {
    setSaving(true);
    try {
      await ClientPortalService.createSpecificationRevision(prior, {
        material_product: prior.material_product,
        colour_name: prior.colour_name || undefined,
        colour_code: prior.colour_code || undefined,
        preview_hex: prior.preview_hex || undefined,
        finish_type: prior.finish_type || undefined,
        surface_preparation: prior.surface_preparation || undefined,
        number_of_coats: prior.number_of_coats,
        technical_notes: `${prior.technical_notes || ''} [Revision v${prior.version_number + 1} prepared by ${actorName}]`.trim(),
        prepared_by: currentUserId,
        prepared_by_name: actorName,
      });
      await onRefresh();
      onSuccess(`Revision v${prior.version_number + 1} issued for ${prior.spec_code}.`);
    } catch (err: any) {
      onError(err?.message || 'Unable to issue specification revision.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientId = bundle.project.client_id || linkedClientId;
    if (!clientId) {
      onError('Link this project to a Client Account first in the Brief & Setup tab.');
      return;
    }
    setSaving(true);
    try {
      const subtotalNum = Number(qSubtotal || 0);
      const taxNum = Number(qTax || 0);
      const firstDoc = qFiles[0];
      await ClientPortalService.createQuotationContract({
        project_id: bundle.project.id,
        client_id: clientId,
        document_type: qType,
        title: qTitle,
        scope_summary: qScope,
        exclusions: qExclusions || undefined,
        payment_terms: qPaymentTerms || undefined,
        subtotal: subtotalNum,
        tax_amount: taxNum,
        total_amount: subtotalNum + taxNum,
        is_subcontract_confidential: qSubcontractConf,
        document_storage_path: firstDoc?.storage_path || null,
        document_file_name: firstDoc?.file_name || null,
        valid_until: qValidUntil || null,
        status: 'issued',
        prepared_by: currentUserId,
      });
      setQTitle('');
      setQScope('');
      setQExclusions('');
      setQSubtotal('');
      setQTax('0');
      setQFiles([]);
      await onRefresh();
      onSuccess('Commercial quotation/contract issued to authorized client contacts.');
    } catch (err: any) {
      onError(err?.message || 'Unable to issue quotation.');
    } finally {
      setSaving(false);
    }
  };

  const handleReviseQuotation = async (orig: ClientQuotationContract) => {
    setSaving(true);
    try {
      await ClientPortalService.createQuotationRevision(orig, {
        title: `${orig.title} (Rev ${orig.version_number + 1})`,
        scope_summary: orig.scope_summary,
        exclusions: orig.exclusions || undefined,
        payment_terms: orig.payment_terms || undefined,
        subtotal: orig.subtotal,
        tax_amount: orig.tax_amount,
        total_amount: orig.total_amount,
        prepared_by: currentUserId,
      });
      await onRefresh();
      onSuccess(`Revised quotation v${orig.version_number + 1} issued; prior version marked superseded.`);
    } catch (err: any) {
      onError(err?.message || 'Unable to issue revised quotation.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    setSaving(true);
    try {
      await ClientPortalService.generateDraftWeeklySummary({
        projectId: bundle.project.id,
        weekStartDate: wsStart,
        weekEndDate: wsEnd,
        summaryTitle: wsTitle,
        executiveNotes: wsExecNotes,
        upcomingActivities: wsUpcoming,
        pendingClientDecisions: wsPendingDecisions,
        preparedByUserId: currentUserId,
        preparedByName: actorName,
      });
      setWsExecNotes('');
      setWsUpcoming('');
      setWsPendingDecisions('');
      await onRefresh();
      onSuccess('Draft Weekly Summary compiled from live project database records. Review before releasing.');
    } catch (err: any) {
      onError(err?.message || 'Unable to generate weekly summary.');
    } finally {
      setSaving(false);
    }
  };

  const handleWeeklyStage = async (summaryId: string, nextStatus: 'reviewed' | 'released') => {
    if (!currentUserId) return;
    setSaving(true);
    try {
      await ClientPortalService.reviewOrReleaseWeeklySummary({
        summaryId,
        nextStatus,
        actorUserId: currentUserId,
        actorName,
      });
      await onRefresh();
      onSuccess(
        nextStatus === 'released'
          ? 'Weekly summary released to the Client Portal.'
          : 'Weekly summary marked as leadership-reviewed.'
      );
    } catch (err: any) {
      onError(err?.message || 'Unable to update weekly summary status.');
    } finally {
      setSaving(false);
    }
  };

  if (activeSubTab === 'brief') {
    return (
      <div className="space-y-6">
        {/* Project Portal Settings */}
        <form onSubmit={handleSaveProjectSettings} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Project Portal Configuration & Official Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Linked Client Account</label>
              <select
                value={linkedClientId}
                onChange={(e) => setLinkedClientId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="">Unlinked</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.company_name || a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Model</label>
              <select
                value={deliveryModel}
                onChange={(e) => setDeliveryModel(e.target.value as ProjectDeliveryModel)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="direct_residential">Direct Residential</option>
                <option value="diaspora_remote">Diaspora / Remote Homeowner</option>
                <option value="direct_corporate">Direct Corporate</option>
                <option value="main_contractor_subcontract">Main Contractor Subcontract</option>
                <option value="multi_party_commercial">Multi-Party Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client-Visible Stage</label>
              <input
                type="text"
                value={visibleStage}
                onChange={(e) => setVisibleStage(e.target.value)}
                placeholder="e.g. Surface Prep & Prime Coats"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Verified Progress (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={verifiedPct}
                onChange={(e) => setVerifiedPct(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Davejoe Contact</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Coordinator Name"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contract Reference</label>
              <input
                type="text"
                value={contractRef}
                onChange={(e) => setContractRef(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer"
            >
              Save Portal Configuration
            </button>
          </div>
        </form>

        {/* Work Package Builder */}
        <form onSubmit={handleCreateWorkPackage} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-900">
            Add Work Package / Room / Floor Zone ({bundle.workPackages.length} configured)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={wpTitle}
              onChange={(e) => setWpTitle(e.target.value)}
              placeholder="e.g. Master Suite / Floor 2 East Wing"
              className="sm:col-span-2 h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <select
              value={wpScopeType}
              onChange={(e) => setWpScopeType(e.target.value as any)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            >
              <option value="residential_room">Residential Room</option>
              <option value="commercial_floor">Commercial Floor</option>
              <option value="commercial_zone">Commercial Zone</option>
              <option value="elevation">Elevation / Facade</option>
              <option value="work_package">General Work Package</option>
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={wpFloor}
                onChange={(e) => setWpFloor(e.target.value)}
                placeholder="Floor / Level"
                className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
              <button
                type="submit"
                disabled={saving}
                className="px-3 h-9 rounded-lg bg-[#18b892] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </form>

        {/* New Colour & Specification Entry */}
        <form onSubmit={handleCreateSpec} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#18b892]" /> Submit Colour / Material Specification for Client Approval
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Area / Elevation *</label>
              <input
                type="text"
                required
                value={specArea}
                onChange={(e) => setSpecArea(e.target.value)}
                placeholder="e.g. Living Room Feature Wall"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Package</label>
              <select
                value={specWorkPkgId}
                onChange={(e) => setSpecWorkPkgId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="">Unassigned</option>
                {bundle.workPackages.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.package_code} · {w.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Material / Product *</label>
              <input
                type="text"
                required
                value={specMaterial}
                onChange={(e) => setSpecMaterial(e.target.value)}
                placeholder="e.g. Dulux Trade Diamond Matt"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
              <input
                type="text"
                value={specManufacturer}
                onChange={(e) => setSpecManufacturer(e.target.value)}
                placeholder="e.g. Dulux / Jotun / Caplux"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Colour Name & Code</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={specColourName}
                  onChange={(e) => setSpecColourName(e.target.value)}
                  placeholder="Warm Linen"
                  className="flex-1 h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  value={specColourCode}
                  onChange={(e) => setSpecColourCode(e.target.value)}
                  placeholder="30YY 72/074"
                  className="w-28 h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ref Swatch / Finish / Coats</label>
              <div className="flex gap-1.5">
                <input
                  type="color"
                  value={specHex}
                  onChange={(e) => setSpecHex(e.target.value)}
                  title="Visual reference only"
                  className="w-9 h-9 rounded border border-slate-200 p-0.5 cursor-pointer"
                />
                <input
                  type="text"
                  value={specFinish}
                  onChange={(e) => setSpecFinish(e.target.value)}
                  placeholder="Finish"
                  className="flex-1 h-9 px-2.5 rounded-lg border border-slate-200 text-xs"
                />
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={specCoats}
                  onChange={(e) => setSpecCoats(e.target.value)}
                  className="w-16 h-9 px-2 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={specPrep}
              onChange={(e) => setSpecPrep(e.target.value)}
              placeholder="Surface preparation method..."
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <input
              type="text"
              value={specSampleRef}
              onChange={(e) => setSpecSampleRef(e.target.value)}
              placeholder="Approved physical sample board reference (e.g. SB-04)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
            />
          </div>
          <textarea
            rows={2}
            value={specNotes}
            onChange={(e) => setSpecNotes(e.target.value)}
            placeholder="Technical notes or exclusions..."
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
          />
          <EvidenceUploader
            projectId={bundle.project.id}
            category="spec_samples"
            uploadedByName={actorName}
            items={specAttachments}
            onChange={setSpecAttachments}
            label="Attach Physical Sample Board Photos / Datasheets"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              Submit Specification for Approval
            </button>
          </div>
        </form>

        {/* Existing Specifications List */}
        <div className="bg-white rounded-xl border border-slate-200/90 divide-y divide-slate-100">
          <div className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            Specification Register ({bundle.specifications.length})
          </div>
          {bundle.specifications.map((s) => (
            <div key={s.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                {s.preview_hex && (
                  <div className="w-7 h-7 rounded border border-slate-300 shrink-0" style={{ backgroundColor: s.preview_hex }} />
                )}
                <div>
                  <p className="font-semibold text-slate-900">
                    <span className="font-mono text-slate-500 mr-1.5">
                      {s.spec_code} v{s.version_number}
                    </span>
                    {s.area_label} — {s.material_product} {s.colour_name ? `(${s.colour_name})` : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Sample Ref: {s.approved_sample_ref || 'None'} · {s.approved_by_name ? `Decided by ${s.approved_by_name}` : 'Awaiting client'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusText
                  label={s.status.replace(/_/g, ' ').toUpperCase()}
                  tone={s.status === 'approved' ? 'emerald' : s.status === 'rejected' ? 'rose' : 'amber'}
                />
                {(s.status === 'approved' || s.status === 'rejected') && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleReviseSpec(s)}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Issue v{s.version_number + 1}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeSubTab === 'quotations') {
    return (
      <div className="space-y-6">
        <form onSubmit={handleCreateQuotation} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#18b892]" /> Issue Quotation or Contract Document
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Document Type</label>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value as any)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              >
                <option value="quotation">Quotation</option>
                <option value="revised_quotation">Revised Quotation</option>
                <option value="contract">Contract Agreement</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                required
                value={qTitle}
                onChange={(e) => setQTitle(e.target.value)}
                placeholder="e.g. Interior Painting & Decorative Wall Finishes Proposal"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subtotal (NGN) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={qSubtotal}
                onChange={(e) => setQSubtotal(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">VAT / Tax (NGN)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={qTax}
                onChange={(e) => setQTax(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Valid Until</label>
              <input
                type="date"
                value={qValidUntil}
                onChange={(e) => setQValidUntil(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
              />
            </div>
          </div>
          <textarea
            rows={2}
            required
            value={qScope}
            onChange={(e) => setQScope(e.target.value)}
            placeholder="Detailed scope of works..."
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={qExclusions}
              onChange={(e) => setQExclusions(e.target.value)}
              placeholder="Exclusions (e.g. scaffolding above 4m, structural plastering)"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
            <input
              type="text"
              value={qPaymentTerms}
              onChange={(e) => setQPaymentTerms(e.target.value)}
              placeholder="Payment terms"
              className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={qSubcontractConf}
              onChange={(e) => setQSubcontractConf(e.target.checked)}
              className="accent-[#18b892]"
            />
            Mark as Subcontract Confidential (hidden from property owners when hide_subcontract_pricing is enabled)
          </label>
          <EvidenceUploader
            projectId={bundle.project.id}
            category="quotations"
            uploadedByName={actorName}
            items={qFiles}
            onChange={setQFiles}
            label="Attach Official Quotation PDF"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
            >
              Issue Commercial Document
            </button>
          </div>
        </form>

        <div className="bg-white rounded-xl border border-slate-200/90 divide-y divide-slate-100">
          <div className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            Quotations & Contracts Register ({bundle.quotations.length})
          </div>
          {bundle.quotations.map((q) => (
            <div key={q.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <p className="font-semibold text-slate-900">
                  <span className="font-mono text-slate-500 mr-1.5">
                    {q.reference_no} v{q.version_number}
                  </span>
                  {q.title}
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatCurrency(q.total_amount, q.currency)} · {q.is_subcontract_confidential ? 'Subcontract Confidential · ' : ''}
                  {q.decided_by_name ? `Decided by ${q.decided_by_name}` : q.viewed_at ? 'Viewed by client (not accepted)' : 'Issued'}
                </p>
                {q.decision_comments && <p className="text-[11px] text-amber-800 mt-0.5">Client note: "{q.decision_comments}"</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusText
                  label={q.status.replace(/_/g, ' ').toUpperCase()}
                  tone={q.status === 'accepted' ? 'emerald' : q.status === 'declined' ? 'rose' : 'amber'}
                />
                {['revision_requested', 'clarification_requested', 'declined'].includes(q.status) && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleReviseQuotation(q)}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer"
                  >
                    Issue Rev v{q.version_number + 1}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Weekly Summaries Tab
  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerateWeekly} className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-[#18b892]" /> Generate Weekly Remote Client Summary (Live DB Data)
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatically snapshots verified progress, area completions, releases, and pending approvals from live project records. Drafts must be reviewed before release.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Summary Title</label>
            <input
              type="text"
              required
              value={wsTitle}
              onChange={(e) => setWsTitle(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Week Start</label>
            <input
              type="date"
              required
              value={wsStart}
              onChange={(e) => setWsStart(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Week End</label>
            <input
              type="date"
              required
              value={wsEnd}
              onChange={(e) => setWsEnd(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs"
            />
          </div>
        </div>
        <textarea
          rows={2}
          value={wsExecNotes}
          onChange={(e) => setWsExecNotes(e.target.value)}
          placeholder="Executive summary notes for the client..."
          className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={wsUpcoming}
            onChange={(e) => setWsUpcoming(e.target.value)}
            placeholder="Upcoming activities for next week..."
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
          <input
            type="text"
            value={wsPendingDecisions}
            onChange={(e) => setWsPendingDecisions(e.target.value)}
            placeholder="Pending client decisions required..."
            className="h-9 px-3 rounded-lg border border-slate-200 text-xs"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#18b892] text-white text-xs font-semibold cursor-pointer"
          >
            Compile Draft Weekly Summary
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {bundle.weeklySummaries.map((sum) => (
          <div key={sum.id} className="bg-white rounded-xl border border-slate-200/90 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900">{sum.summary_title}</p>
                <StatusText
                  label={sum.status.toUpperCase()}
                  tone={sum.status === 'released' ? 'emerald' : sum.status === 'reviewed' ? 'sky' : 'amber'}
                />
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {formatShortDate(sum.week_start_date)} – {formatShortDate(sum.week_end_date)} · Verified:{' '}
                {sum.snapshot_data?.verified_progress_pct ?? 0}% · QC Areas: {sum.snapshot_data?.areas_qc_verified ?? 0} ·
                Released: {sum.snapshot_data?.areas_released ?? 0}
              </p>
              {sum.executive_notes && <p className="text-xs text-slate-600">{sum.executive_notes}</p>}
            </div>

            <div className="flex items-center gap-2">
              {sum.status === 'draft' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleWeeklyStage(sum.id, 'reviewed')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#18b892]" /> Mark Reviewed
                </button>
              )}
              {sum.status === 'reviewed' && isLeadership && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleWeeklyStage(sum.id, 'released')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#18b892] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" /> Release to Client Portal
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
