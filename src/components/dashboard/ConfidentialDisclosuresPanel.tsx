import React, { useEffect, useState, useCallback } from 'react';
import {
  Lock,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  Calendar,
} from 'lucide-react';
import {
  ConductDisclosureService,
  DISCLOSURE_CATEGORY_OPTIONS,
  DISCLOSURE_STATUS_META,
  WorkerConductDisclosure,
  WorkerDisclosureStatus,
} from '../../services/conductDisclosureService';
import { formatDateTime } from '../../services/clientPortalService';
import { EvidenceMediaGallery, StatusText } from '../client-portal/ClientPortalShared';

export const ConfidentialDisclosuresPanel: React.FC = () => {
  const [disclosures, setDisclosures] = useState<WorkerConductDisclosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [resolutionMap, setResolutionMap] = useState<Record<string, string>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadDisclosures = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await ConductDisclosureService.listDisclosures();
    setMigrationPending(res.migrationPending);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setDisclosures(res.items);
      const nextNotes: Record<string, string> = {};
      const nextRes: Record<string, string> = {};
      for (const item of res.items) {
        nextNotes[item.id] = item.investigation_notes || '';
        nextRes[item.id] = item.resolution_summary || '';
      }
      setNotesMap(nextNotes);
      setResolutionMap(nextRes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDisclosures();
  }, [loadDisclosures]);

  const handleUpdate = async (disclosureId: string, nextStatus: WorkerDisclosureStatus) => {
    setSavingId(disclosureId);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await ConductDisclosureService.updateDisclosureInvestigation({
        disclosureId,
        status: nextStatus,
        investigation_notes: notesMap[disclosureId] || '',
        resolution_summary: resolutionMap[disclosureId] || '',
      });
      setFeedbackMsg(`Disclosure updated to "${DISCLOSURE_STATUS_META[nextStatus].label}".`);
      await loadDisclosures();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to update disclosure investigation.');
    } finally {
      setSavingId(null);
    }
  };

  const filtered = disclosures.filter((d) => statusFilter === 'all' || d.status === statusFilter);
  const openCount = disclosures.filter((d) => d.status === 'submitted' || d.status === 'under_investigation').length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-rose-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Confidential Worker Conduct Disclosures
              </h3>
              <StatusText
                label={`${openCount} Active`}
                tone={openCount > 0 ? 'rose' : 'emerald'}
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Leadership-restricted whistleblower inbox for unauthorised payment requests, side-job solicitations, material diversion, and QC/spec bypass reports. Protected by row-level conflict-of-interest walls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
          >
            <option value="all">All Statuses ({disclosures.length})</option>
            <option value="submitted">Submitted</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="action_taken">Action Taken</option>
            <option value="closed">Closed</option>
            <option value="unsubstantiated">Unsubstantiated</option>
          </select>
          <button
            type="button"
            onClick={loadDisclosures}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#18b892] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {migrationPending && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Release 1A Migration Pending in Supabase</p>
            <p className="mt-0.5 text-amber-800">
              Execute <span className="font-mono">supabase/migrations/20261126000001_v3_r1a_security_guards_and_confidential_storage.sql</span> in the Supabase SQL Editor to activate the confidential disclosures table and private storage vault.
            </p>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-400">
          Loading confidential disclosures...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-10 text-center space-y-1.5">
          <ShieldAlert className="w-7 h-7 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">No confidential worker disclosures match this filter.</p>
          <p className="text-xs text-slate-400">
            Reports submitted by site supervisors, artisans, or staff appear here immediately with encrypted private evidence.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const statusMeta = DISCLOSURE_STATUS_META[item.status] || { label: item.status, tone: 'slate' };
            const catMeta = DISCLOSURE_CATEGORY_OPTIONS.find((c) => c.value === item.disclosure_category);
            const isClosed =
              item.status === 'action_taken' || item.status === 'closed' || item.status === 'unsubstantiated';

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-3.5 text-xs shadow-2xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] text-slate-500">
                      {item.disclosure_ref}
                      {item.project_code ? ` · ${item.project_code}` : ''}
                      {item.project_name ? ` (${item.project_name})` : ' · General / Cross-Project'}
                    </p>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {catMeta?.label || item.disclosure_category}
                    </h4>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        Reported by <strong className="text-slate-700">{item.reported_by_name || 'Staff Member'}</strong>
                        {item.reporter_role ? ` (${item.reporter_role})` : ''}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Incident: {item.incident_date}
                      </span>
                      <span>Logged: {formatDateTime(item.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.is_anonymous_to_site_team && (
                      <StatusText label="Shielded from Site Team" tone="rose" />
                    )}
                    <StatusText label={statusMeta.label} tone={statusMeta.tone} />
                  </div>
                </div>

                {item.subject_description && (
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Person(s) / Party Named:</span>{' '}
                    {item.subject_description}
                  </div>
                )}

                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{item.description}</p>

                <EvidenceMediaGallery items={item.evidence_media || []} />

                {/* Leadership Investigation & Triage Controls */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Internal Leadership Investigation Notes (Private)
                      </label>
                      <textarea
                        rows={2}
                        value={notesMap[item.id] ?? ''}
                        onChange={(e) =>
                          setNotesMap((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Document verification findings, interviews, or evidence review..."
                        className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Outcome / Resolution Summary (Visible to Reporter)
                      </label>
                      <textarea
                        rows={2}
                        value={resolutionMap[item.id] ?? ''}
                        onChange={(e) =>
                          setResolutionMap((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Summarize action taken or investigation conclusion..."
                        className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-400">
                      {item.resolved_at && item.resolved_by_name
                        ? `Resolved by ${item.resolved_by_name} on ${formatDateTime(item.resolved_at)}`
                        : 'Original disclosure text and evidence are locked immutable.'}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={savingId === item.id}
                        onClick={() => handleUpdate(item.id, 'under_investigation')}
                        className="px-3 h-8 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Mark Under Investigation
                      </button>
                      <button
                        type="button"
                        disabled={savingId === item.id}
                        onClick={() => handleUpdate(item.id, 'action_taken')}
                        className="px-3 h-8 rounded-lg bg-[#18b892] hover:bg-[#149f7e] text-white font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Record Action Taken
                      </button>
                      {!isClosed && (
                        <>
                          <button
                            type="button"
                            disabled={savingId === item.id}
                            onClick={() => handleUpdate(item.id, 'unsubstantiated')}
                            className="px-3 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Unsubstantiated
                          </button>
                          <button
                            type="button"
                            disabled={savingId === item.id}
                            onClick={() => handleUpdate(item.id, 'closed')}
                            className="px-3 h-8 rounded-lg border border-slate-300 bg-slate-800 hover:bg-slate-900 text-white font-semibold cursor-pointer disabled:opacity-50"
                          >
                            Close Case
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
