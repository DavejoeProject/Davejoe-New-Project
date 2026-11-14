import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Handshake,
  Building2,
  Mail,
  Phone,
  Shield,
  Landmark,
  FileText,
  Download,
  Eye,
  EyeOff,
  Edit3,
  AlertCircle,
  ExternalLink,
  X,
  Lock,
} from 'lucide-react';
import {
  VendorPartnerRecord,
  VendorProtectedDetails,
  VendorPartnerStatus,
  VendorsPartnersService,
} from '../../services/vendorsPartnersService';
import { maskBankAccountNumber } from '../../services/workforceDirectoryService';
import { formatDateNigerian } from '../../services/dashboardService';
import { ConfirmActionModal } from '../common/ConfirmActionModal';

interface VendorPartnerProfileProps {
  record: VendorPartnerRecord;
  canUpdate: boolean;
  canViewFinancials: boolean;
  canViewDocuments: boolean;
  onBack: () => void;
  onEdit: (record: VendorPartnerRecord) => void;
  onStatusUpdated: (message: string) => void;
}

const formatRecordTypeLabel = (type: string): string => {
  const norm = (type || 'vendor').toLowerCase();
  if (norm === 'both') return 'Vendor & Partner';
  if (norm === 'partner') return 'Partner';
  return 'Vendor';
};

export const VendorPartnerProfile: React.FC<VendorPartnerProfileProps> = ({
  record,
  canUpdate,
  canViewFinancials,
  canViewDocuments,
  onBack,
  onEdit,
  onStatusUpdated,
}) => {
  const [protectedDetails, setProtectedDetails] = useState<VendorProtectedDetails | null>(null);
  const [protectedRestricted, setProtectedRestricted] = useState(false);
  const [isLoadingProtected, setIsLoadingProtected] = useState(false);

  const [showFullAccount, setShowFullAccount] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isFetchingDoc, setIsFetchingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);

  const loadProtected = useCallback(async () => {
    if (!canViewFinancials) {
      setProtectedDetails(null);
      setProtectedRestricted(true);
      setIsLoadingProtected(false);
      return;
    }

    setIsLoadingProtected(true);
    const protRes = await VendorsPartnersService.getVendorProtectedDetails(record.id);
    if (protRes.data) {
      setProtectedDetails(protRes.data);
      setProtectedRestricted(false);
    } else if (protRes.restricted) {
      setProtectedDetails(null);
      setProtectedRestricted(true);
    } else {
      setProtectedDetails(null);
      setProtectedRestricted(false);
    }
    setIsLoadingProtected(false);
  }, [record.id, canViewFinancials]);

  useEffect(() => {
    loadProtected();
  }, [loadProtected]);

  const requestStatusChange = (nextStatus: VendorPartnerStatus) => {
    if (record.status === nextStatus) return;

    const variant =
      nextStatus === 'suspended' ? 'danger' : nextStatus === 'inactive' ? 'warning' : 'primary';
    const verb =
      nextStatus === 'active'
        ? 'Activate'
        : nextStatus === 'suspended'
        ? 'Suspend'
        : 'Deactivate';

    setConfirmState({
      title: `${verb} Vendor / Partner`,
      message: `Confirm changing ${record.business_name || record.full_name}'s status from "${
        record.status
      }" to "${nextStatus}"? Audit history will be preserved.`,
      confirmLabel: verb,
      variant,
      onConfirm: async () => {
        setIsUpdatingStatus(true);
        setDocError(null);
        const res = await VendorsPartnersService.updateStatus(
          record.id,
          nextStatus,
          record.status
        );
        setIsUpdatingStatus(false);
        setConfirmState(null);
        if (res.error) {
          setDocError(res.error);
          return;
        }
        onStatusUpdated(
          `${record.business_name || record.full_name} marked as ${nextStatus}.`
        );
      },
    });
  };

  const handleOpenCacPreview = async () => {
    if (!record.cac_certificate_path) return;
    setIsFetchingDoc(true);
    setDocError(null);
    const res = await VendorsPartnersService.getSignedCacUrl(record.cac_certificate_path);
    setIsFetchingDoc(false);

    if (res.error || !res.signedUrl) {
      setDocError(res.error || 'Unable to generate secure CAC Certificate link.');
      return;
    }
    setSignedPreviewUrl(res.signedUrl);
  };

  const handleDownloadCac = async () => {
    if (!record.cac_certificate_path) return;
    setIsFetchingDoc(true);
    setDocError(null);
    const res = await VendorsPartnersService.getSignedCacUrl(record.cac_certificate_path);
    if (res.error || !res.signedUrl) {
      setIsFetchingDoc(false);
      setDocError(res.error || 'Unable to download CAC Certificate.');
      return;
    }

    try {
      const response = await fetch(res.signedUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch certificate file from private storage.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filePart = record.cac_certificate_path.split('/').pop() || 'cac-certificate';
      link.href = objectUrl;
      link.download = filePart;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setDocError(err?.message || 'Unable to download certificate.');
    } finally {
      setIsFetchingDoc(false);
    }
  };

  const statusColor =
    record.status === 'active'
      ? 'text-emerald-700'
      : record.status === 'suspended'
      ? 'text-red-700'
      : 'text-slate-500';

  const isPdfPath = (record.cac_certificate_path || '').toLowerCase().endsWith('.pdf');

  const displayNok = protectedDetails?.next_of_kin ?? record.next_of_kin;
  const displayNokPhone = protectedDetails?.next_of_kin_phone ?? record.next_of_kin_phone;
  const displayBankName = protectedDetails?.bank_name ?? record.bank_name;
  const displayAccountName = protectedDetails?.account_name ?? record.account_name;
  const displayAccountNumber = protectedDetails?.account_number ?? record.account_number;

  return (
    <div className="space-y-6 pb-8">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18b892] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Back to Vendors &amp; Partners</span>
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
                <Handshake className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 truncate">
                  {record.business_name || record.full_name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">
                    {formatRecordTypeLabel(record.record_type)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-semibold capitalize ${statusColor}`}>
                    {record.status}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Registered {formatDateNigerian(record.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {canUpdate && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Edit3 className="w-4 h-4 shrink-0" />
                <span>Edit Record</span>
              </button>

              <select
                aria-label="Change vendor or partner status"
                value={record.status}
                disabled={isUpdatingStatus}
                onChange={(e) => requestStatusChange(e.target.value as VendorPartnerStatus)}
                className="px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#18b892] cursor-pointer"
              >
                <option value="active">Status: Active</option>
                <option value="inactive">Status: Inactive</option>
                <option value="suspended">Status: Suspended</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {docError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{docError}</span>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Identity & Contact */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#18b892] shrink-0" />
            <span>Contact &amp; Business Details</span>
          </h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-400">Primary Contact Name</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">{record.full_name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Business Name</dt>
              <dd className="text-slate-700 mt-0.5">
                {record.business_name || 'Individual / Not provided'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Phone Number</dt>
              <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{record.phone_number}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Email Address</dt>
              <dd className="text-slate-700 mt-0.5 flex items-center gap-1.5 break-all">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{record.email_address || 'Not recorded'}</span>
              </dd>
            </div>
          </dl>
        </div>

        {/* Next of Kin & Operational Scope */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#18b892] shrink-0" />
            <span>Next of Kin &amp; Scope</span>
          </h3>

          {!canViewFinancials || protectedRestricted ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Next of kin contact details are restricted. Requires{' '}
                  <code className="font-mono">vendors.banking.view</code> authorization.
                </span>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">Operational Notes</div>
                <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {record.notes || 'No additional notes recorded.'}
                </div>
              </div>
            </div>
          ) : isLoadingProtected ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-400">Next of Kin</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {displayNok || 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400">Next of Kin Phone Number</dt>
                <dd className="font-mono tabular-nums text-slate-700 mt-0.5">
                  {displayNokPhone || 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400">Operational Notes</dt>
                <dd className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {record.notes || 'No additional notes recorded.'}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Settlement Banking Details */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#18b892] shrink-0" />
              <span>Banking Details</span>
            </h3>
            {canViewFinancials && !protectedRestricted && displayAccountNumber && (
              <button
                type="button"
                onClick={() => setShowFullAccount((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#18b892] hover:underline cursor-pointer whitespace-nowrap"
              >
                {showFullAccount ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    <span>Mask</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span>Reveal</span>
                  </>
                )}
              </button>
            )}
          </div>

          {!canViewFinancials || protectedRestricted ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Banking details require{' '}
                <code className="font-mono">vendors.banking.view</code> authorization.
              </span>
            </div>
          ) : isLoadingProtected ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-400">Bank Name</dt>
                <dd className="font-semibold text-slate-900 mt-0.5">
                  {displayBankName || 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400">Account Name</dt>
                <dd className="text-slate-700 mt-0.5">
                  {displayAccountName || 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400">Account Number</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                  {showFullAccount
                    ? displayAccountNumber || '—'
                    : maskBankAccountNumber(displayAccountNumber)}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {/* CAC Certificate Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#18b892] shrink-0" />
              <span>CAC Registration Certificate</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Stored in private <code className="font-mono">vendor-documents</code> storage bucket and served via short-lived signed access links.
            </p>
          </div>
        </div>

        {!canViewDocuments ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              Document inspection requires{' '}
              <code className="font-mono">vendors.documents.view</code> authorization.
            </span>
          </div>
        ) : !record.cac_certificate_path ? (
          <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No CAC Certificate uploaded for this vendor/partner yet.
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                {record.cac_certificate_path.split('/').pop()}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                Private path: {record.cac_certificate_path}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={isFetchingDoc}
                onClick={handleOpenCacPreview}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>{isFetchingDoc ? 'Generating Link...' : 'View Certificate'}</span>
              </button>
              <button
                type="button"
                disabled={isFetchingDoc}
                onClick={handleDownloadCac}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Download</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Secure In-App Signed Document Preview Modal */}
      {signedPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  CAC Certificate — {record.business_name || record.full_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Signed private link active for 5 minutes.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={signedPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18b892] bg-emerald-50 hover:bg-emerald-100 rounded-lg whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSignedPreviewUrl(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[420px]">
              {isPdfPath ? (
                <iframe
                  src={signedPreviewUrl}
                  title="CAC Certificate Preview"
                  className="w-full h-[68vh] rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={signedPreviewUrl}
                  alt="CAC Certificate"
                  className="max-w-full max-h-[70vh] rounded-xl border border-slate-200 object-contain bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmActionModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant || 'warning'}
        isBusy={isUpdatingStatus}
        onConfirm={() => {
          if (confirmState) confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};
