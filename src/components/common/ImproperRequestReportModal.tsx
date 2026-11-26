import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldAlert,
  Lock,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck2,
  Send,
} from 'lucide-react';
import {
  ConductDisclosureService,
  DISCLOSURE_CATEGORY_OPTIONS,
  DISCLOSURE_STATUS_META,
  WorkerConductDisclosure,
  WorkerDisclosureCategory,
} from '../../services/conductDisclosureService';
import {
  MediaEvidenceItem,
  formatDateTime,
} from '../../services/clientPortalService';
import {
  EvidenceUploader,
  EvidenceMediaGallery,
  StatusText,
} from '../client-portal/ClientPortalShared';

export interface DisclosureProjectOption {
  id: string;
  name: string;
  project_code?: string | null;
}

interface ImproperRequestReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: DisclosureProjectOption[];
  reporterName: string;
}

export const ImproperRequestReportModal: React.FC<ImproperRequestReportModalProps> = ({
  isOpen,
  onClose,
  projects,
  reporterName,
}) => {
  const [activeView, setActiveView] = useState<'submit' | 'my_reports'>('submit');

  // Form state
  const [projectId, setProjectId] = useState<string>('');
  const [category, setCategory] = useState<WorkerDisclosureCategory>('unauthorised_payment_request');
  const [incidentDate, setIncidentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [subjectDescription, setSubjectDescription] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [anonymousToSiteTeam, setAnonymousToSiteTeam] = useState<boolean>(true);
  const [evidenceMedia, setEvidenceMedia] = useState<MediaEvidenceItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  // Reporter's own disclosures
  const [myDisclosures, setMyDisclosures] = useState<WorkerConductDisclosure[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);

  const loadMyDisclosures = useCallback(async () => {
    setLoadingList(true);
    const res = await ConductDisclosureService.listDisclosures();
    setMigrationPending(res.migrationPending);
    if (!res.error) {
      setMyDisclosures(res.items);
    }
    setLoadingList(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessRef(null);
      loadMyDisclosures();
    }
  }, [isOpen, loadMyDisclosures]);

  if (!isOpen) return null;

  const selectedCategoryMeta = DISCLOSURE_CATEGORY_OPTIONS.find((c) => c.value === category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 15) {
      setErrorMsg('Please provide a clear factual description (at least 15 characters) so Leadership can investigate.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessRef(null);

    try {
      const created = await ConductDisclosureService.submitDisclosure({
        project_id: projectId || null,
        disclosure_category: category,
        subject_description: subjectDescription,
        incident_date: incidentDate,
        description,
        evidence_media: evidenceMedia,
        is_anonymous_to_site_team: anonymousToSiteTeam,
      });

      setSuccessRef(created.disclosure_ref);
      setProjectId('');
      setSubjectDescription('');
      setDescription('');
      setEvidenceMedia([]);
      await loadMyDisclosures();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit confidential disclosure.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-4 select-text"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/70">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Confidential Conduct & Improper Request Disclosure
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Routes directly to Management & Executive Director. Hidden from site teams, supervisors named in the report, and clients.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-navigation tabs */}
        <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveView('submit')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeView === 'submit'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Submit Confidential Report
          </button>
          <button
            type="button"
            onClick={() => setActiveView('my_reports')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              activeView === 'my_reports'
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>My Submitted Reports</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
              {myDisclosures.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {migrationPending && (
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confidential Disclosure Vault Setup Pending</p>
                <p className="mt-0.5 text-amber-800">
                  Database migration <span className="font-mono">20261126000001_v3_r1a_security_guards_and_confidential_storage.sql</span> has not been executed in Supabase yet.
                </p>
              </div>
            </div>
          )}

          {activeView === 'submit' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3 text-xs text-rose-900 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Protected Leadership Channel</p>
                  <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                    Attachments are stored in the isolated private evidence vault. Only Davejoe Management, Executive Director, or an independently assigned investigator can access your submission.
                  </p>
                </div>
              </div>

              {successRef && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Confidential Disclosure Logged ({successRef})</p>
                    <p className="text-emerald-800 mt-0.5">
                      Management and Executive Director have been notified securely. You can track the review status under &ldquo;My Submitted Reports&rdquo;.
                    </p>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Concern Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as WorkerDisclosureCategory)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                  >
                    {DISCLOSURE_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {selectedCategoryMeta && (
                    <p className="text-[11px] text-slate-500 mt-1">{selectedCategoryMeta.helper}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Incident Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={incidentDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Related Project (Optional)
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800"
                  >
                    <option value="">General / Not tied to one project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code ? `${p.project_code} — ` : ''}
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Person(s) Involved (Optional)
                  </label>
                  <input
                    type="text"
                    value={subjectDescription}
                    onChange={(e) => setSubjectDescription(e.target.value)}
                    placeholder="Name, role, or party (e.g. client rep, supervisor, trade)"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Factual Description of Incident *
                </label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe clearly what was requested or observed, when and where it happened, and any witnesses or amounts mentioned..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={anonymousToSiteTeam}
                  onChange={(e) => setAnonymousToSiteTeam(e.target.checked)}
                  className="mt-0.5 accent-rose-600"
                />
                <span>
                  <strong className="text-slate-900">Keep my identity strictly shielded from site teams</strong>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Your account is logged for audit verification by Leadership, but never disclosed to site supervisors, artisans, or clients.
                  </span>
                </span>
              </label>

              <EvidenceUploader
                projectId={projectId || 'general'}
                category="worker_disclosures"
                uploadedByName={reporterName}
                items={evidenceMedia}
                onChange={setEvidenceMedia}
                isConfidential={true}
                label="Attach Confidential Evidence (Photo / Audio / Video / PDF)"
              />

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || migrationPending}
                  className="px-4 h-9 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting Securely...' : 'Submit Confidential Disclosure'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {loadingList ? (
                <p className="text-xs text-slate-400 py-8 text-center">Loading your disclosures...</p>
              ) : myDisclosures.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-xl space-y-1.5">
                  <FileCheck2 className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-600">No confidential disclosures submitted yet.</p>
                  <p className="text-[11px] text-slate-400">
                    Any report you submit appears here so you can follow Leadership review status privately.
                  </p>
                </div>
              ) : (
                myDisclosures.map((d) => {
                  const statusMeta = DISCLOSURE_STATUS_META[d.status] || { label: d.status, tone: 'slate' };
                  const catLabel =
                    DISCLOSURE_CATEGORY_OPTIONS.find((c) => c.value === d.disclosure_category)?.label ||
                    d.disclosure_category;
                  return (
                    <div
                      key={d.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-[11px] text-slate-500">
                            {d.disclosure_ref} · Incident {d.incident_date}
                            {d.project_name ? ` · ${d.project_name}` : ''}
                          </p>
                          <h4 className="text-xs font-bold text-slate-900 mt-0.5">{catLabel}</h4>
                        </div>
                        <StatusText label={statusMeta.label} tone={statusMeta.tone} />
                      </div>
                      <p className="text-slate-600 leading-relaxed">{d.description}</p>
                      <EvidenceMediaGallery items={d.evidence_media || []} />
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
                        <Clock className="w-3 h-3" />
                        <span>Submitted {formatDateTime(d.created_at)}</span>
                      </div>
                      {d.resolution_summary && (
                        <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/70 p-2.5 text-xs text-emerald-900">
                          <strong>Leadership Outcome:</strong> {d.resolution_summary}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
