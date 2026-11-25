import React, { useEffect, useState } from 'react';
import {
  Paperclip,
  Upload,
  FileText,
  Image as ImageIcon,
  Film,
  X,
  Check,
  Loader2,
  Download,
  Eye,
} from 'lucide-react';
import {
  ClientPortalService,
  MediaEvidenceItem,
  ProgressVerificationStage,
  VariationWorkflowStage,
  VARIATION_STAGE_SEQUENCE,
} from '../../services/clientPortalService';

// ==============================================================================
// CLEAN STATUS LABEL (Minimal, single-tone hairline — zero pill bloat)
// ==============================================================================
export const StatusText: React.FC<{
  label: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'slate' | 'sky';
}> = ({ label, tone = 'slate' }) => {
  const styles: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50/80 border-emerald-200/80',
    amber: 'text-amber-700 bg-amber-50/80 border-amber-200/80',
    rose: 'text-rose-700 bg-rose-50/80 border-rose-200/80',
    sky: 'text-sky-700 bg-sky-50/80 border-sky-200/80',
    slate: 'text-slate-600 bg-slate-50 border-slate-200/80',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium tracking-tight ${styles[tone]}`}
    >
      {label}
    </span>
  );
};

// ==============================================================================
// 5-STAGE VERIFIED PROGRESS STRIP (Never collapsed into generic "completed")
// ==============================================================================
const PROGRESS_STEPS: { key: ProgressVerificationStage; short: string }[] = [
  { key: 'reported_by_supervisor', short: '1. Supervisor' },
  { key: 'inspected_by_qc', short: '2. QC Inspected' },
  { key: 'verified_completed', short: '3. Verified' },
  { key: 'acknowledged_by_client', short: '4. Client Ack.' },
  { key: 'formally_handed_over', short: '5. Handed Over' },
];

export const ProgressStageTrack: React.FC<{ current: ProgressVerificationStage }> = ({ current }) => {
  const currentIdx = PROGRESS_STEPS.findIndex((s) => s.key === current);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 mt-3">
      {PROGRESS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        return (
          <div
            key={step.key}
            className={`px-2.5 py-1.5 rounded-md border text-[11px] flex items-center gap-1.5 ${
              active
                ? 'border-[#18b892] bg-[#18b892]/8 text-slate-900 font-semibold'
                : done
                  ? 'border-emerald-200/70 bg-emerald-50/40 text-emerald-800 font-medium'
                  : 'border-slate-200/70 bg-slate-50/60 text-slate-400'
            }`}
          >
            <span
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px] ${
                done ? 'bg-[#18b892] text-white' : 'bg-slate-200 text-slate-500'
              }`}
            >
              {done ? <Check className="w-2.5 h-2.5" strokeWidth={2.8} /> : idx + 1}
            </span>
            <span className="truncate">{step.short}</span>
          </div>
        );
      })}
    </div>
  );
};

// ==============================================================================
// 10-STEP VARIATION GOVERNANCE STEPPER
// ==============================================================================
export const VariationStepper: React.FC<{ stage: VariationWorkflowStage }> = ({ stage }) => {
  const stageToStep: Record<VariationWorkflowStage, number> = {
    request_received: 1,
    technical_assessment: 2,
    scope_quantity_verified: 3,
    cost_time_assessed: 4,
    internal_commercial_approved: 5,
    awaiting_client_approval: 6,
    client_approved: 6,
    client_rejected: 6,
    disputed: 6,
    work_instruction_issued: 7,
    in_execution: 8,
    technically_verified: 9,
    financially_reconciled: 10,
  };
  const currentStep = stageToStep[stage] || 1;
  const isBlocked = stage === 'client_rejected' || stage === 'disputed';

  const compactSteps = [
    { step: 1, label: 'Received' },
    { step: 2, label: 'Tech Assess' },
    { step: 3, label: 'Scope/Qty' },
    { step: 4, label: 'Cost/Time' },
    { step: 5, label: 'Mgmt Appr.' },
    { step: 6, label: 'Client Appr.' },
    { step: 7, label: 'Instruction' },
    { step: 8, label: 'Execution' },
    { step: 9, label: 'QC Verified' },
    { step: 10, label: 'Reconciled' },
  ];

  const activeMeta = VARIATION_STAGE_SEQUENCE.find((s) => s.key === stage);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Governance Step <span className="font-mono font-semibold text-slate-800">{currentStep}/10</span>
        </span>
        <span className={`font-medium ${isBlocked ? 'text-rose-700' : 'text-slate-700'}`}>
          {stage === 'client_rejected'
            ? 'Client Rejected'
            : stage === 'disputed'
              ? 'Disputed — Under Commercial Review'
              : activeMeta?.label || stage}
        </span>
      </div>
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-1">
        {compactSteps.map((s) => {
          const passed = s.step < currentStep || (s.step === currentStep && !isBlocked && stage !== 'awaiting_client_approval');
          const current = s.step === currentStep;
          return (
            <div key={s.step} className="space-y-1">
              <div
                className={`h-1.5 rounded-full ${
                  current && isBlocked
                    ? 'bg-rose-500'
                    : current && stage === 'awaiting_client_approval'
                      ? 'bg-amber-500'
                      : passed
                        ? 'bg-[#18b892]'
                        : current
                          ? 'bg-[#18b892]'
                          : 'bg-slate-200'
                }`}
              />
              <p className="text-[10px] text-slate-500 truncate">{s.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==============================================================================
// PRIVATE STORAGE EVIDENCE UPLOADER
// ==============================================================================
export const EvidenceUploader: React.FC<{
  projectId: string;
  category: string;
  uploadedByName?: string;
  items: MediaEvidenceItem[];
  onChange: (items: MediaEvidenceItem[]) => void;
  label?: string;
}> = ({ projectId, category, uploadedByName, items, onChange, label = 'Attach Photo / Video / PDF Evidence' }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !projectId) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded: MediaEvidenceItem[] = [];
      for (const file of files) {
        const item = await ClientPortalService.uploadEvidenceFile({
          projectId,
          category,
          file,
          uploadedByName,
        });
        uploaded.push(item);
      }
      onChange([...items, ...uploaded]);
    } catch (err: any) {
      setError(err?.message || 'Unable to upload file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer transition-colors">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#18b892]" /> : <Upload className="w-3.5 h-3.5 text-[#18b892]" />}
          <span>{uploading ? 'Uploading...' : label}</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,application/pdf"
            onChange={handleFiles}
            disabled={uploading || !projectId}
            className="hidden"
          />
        </label>
        <span className="text-[11px] text-slate-400">JPG, PNG, WebP, MP4, WebM, PDF · max 25MB</span>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item, idx) => (
            <div
              key={`${item.storage_path}-${idx}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-700"
            >
              <Paperclip className="w-3 h-3 text-slate-400" />
              <span className="max-w-[180px] truncate">{item.file_name}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// PRIVATE SIGNED-URL EVIDENCE GALLERY WITH IN-APP LIGHTBOX
// ==============================================================================
export const EvidenceMediaGallery: React.FC<{
  items: MediaEvidenceItem[];
  emptyText?: string;
}> = ({ items, emptyText }) => {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [previewItem, setPreviewItem] = useState<{ item: MediaEvidenceItem; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadUrls() {
      const next: Record<string, string> = {};
      for (const item of items || []) {
        if (!item.storage_path) continue;
        const url = await ClientPortalService.getSignedEvidenceUrl(item.storage_path);
        if (url) next[item.storage_path] = url;
      }
      if (active) setSignedUrls(next);
    }
    if (items && items.length > 0) {
      loadUrls();
    }
    return () => {
      active = false;
    };
  }, [items]);

  if (!items || items.length === 0) {
    return emptyText ? <p className="text-xs text-slate-400">{emptyText}</p> : null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {items.map((item, idx) => {
          const url = signedUrls[item.storage_path];
          const isImage = item.mime_type?.startsWith('image/');
          const isVideo = item.mime_type?.startsWith('video/');

          return (
            <div
              key={`${item.storage_path}-${idx}`}
              className="group relative rounded-lg border border-slate-200 bg-white overflow-hidden flex items-center gap-2 pr-2.5"
            >
              {isImage && url ? (
                <button
                  type="button"
                  onClick={() => setPreviewItem({ item, url })}
                  className="w-12 h-12 shrink-0 bg-slate-100 overflow-hidden cursor-pointer"
                >
                  <img src={url} alt={item.file_name} className="w-full h-full object-cover" />
                </button>
              ) : (
                <div className="w-10 h-10 shrink-0 bg-slate-50 flex items-center justify-center text-slate-500">
                  {isVideo ? <Film className="w-4 h-4" /> : isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
              )}

              <div className="min-w-0 py-1.5">
                <p className="text-xs font-medium text-slate-700 max-w-[150px] truncate">{item.file_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {url && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewItem({ item, url })}
                        className="text-[11px] font-medium text-[#18b892] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                      <a
                        href={url}
                        download={item.file_name}
                        className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-0.5"
                      >
                        <Download className="w-3 h-3" /> Save
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{previewItem.item.file_name}</p>
                {previewItem.item.caption && (
                  <p className="text-xs text-slate-500 truncate">{previewItem.item.caption}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewItem.url}
                  download={previewItem.item.file_name}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-50 overflow-auto flex-1 flex items-center justify-center">
              {previewItem.item.mime_type?.startsWith('image/') ? (
                <img
                  src={previewItem.url}
                  alt={previewItem.item.file_name}
                  className="max-h-[72vh] max-w-full rounded-lg object-contain"
                />
              ) : previewItem.item.mime_type?.startsWith('video/') ? (
                <video src={previewItem.url} controls className="max-h-[72vh] max-w-full rounded-lg" />
              ) : (
                <iframe
                  src={previewItem.url}
                  title={previewItem.item.file_name}
                  className="w-full h-[72vh] rounded-lg border border-slate-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
