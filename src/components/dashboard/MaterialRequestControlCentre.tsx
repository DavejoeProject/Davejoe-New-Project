import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Building,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Package,
  Boxes,
  Truck,
  AlertCircle,
} from 'lucide-react';
import {
  MaterialRequestRecord,
  MaterialRequestsService,
  REQUEST_STATUS_CONFIG,
  REQUEST_PRIORITY_CONFIG,
} from '../../services/materialRequestsService';
import {
  formatNaira,
  formatNigerianDate,
} from '../../services/materialsService';
import { ApproveMaterialRequestModal } from './ApproveMaterialRequestModal';
import { RejectMaterialRequestModal } from './RejectMaterialRequestModal';

interface MaterialRequestControlCentreProps {
  requestId?: string;
  onBack?: () => void;
}

export const MaterialRequestControlCentre: React.FC<MaterialRequestControlCentreProps> = ({
  requestId: propRequestId,
  onBack,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ requestId?: string }>();
  const activeRequestId = propRequestId || params.requestId;

  const [request, setRequest] = useState<MaterialRequestRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);

  const fetchRequestDetails = useCallback(
    async (isManual: boolean = false) => {
      if (!activeRequestId) {
        setErrorMessage('No material request ID was provided.');
        setIsLoading(false);
        return;
      }

      if (isManual) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const res = await MaterialRequestsService.getMaterialRequestById(activeRequestId);
        if (res.error) {
          setErrorMessage(res.error);
        } else if (!res.data) {
          setErrorMessage('Material request not found.');
        } else {
          setRequest(res.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to retrieve material request.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeRequestId]
  );

  useEffect(() => {
    fetchRequestDetails();
  }, [fetchRequestDetails]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/management/materials/requests');
    }
  };

  const handleApproved = (updated: MaterialRequestRecord) => {
    setRequest(updated);
  };

  const handleRejected = (updated: MaterialRequestRecord) => {
    setRequest(updated);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16 animate-pulse">
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <div className="h-4 bg-slate-100 rounded w-32" />
          <div className="h-8 bg-slate-100 rounded w-64" />
          <div className="h-4 bg-slate-100 rounded w-96" />
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
          <div className="h-32 bg-slate-50 rounded" />
        </div>
      </div>
    );
  }

  if (errorMessage || !request) {
    return (
      <div className="space-y-6 pb-16">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Requests</span>
        </button>

        <div className="bg-white rounded-xl border border-red-200 p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load material request</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {errorMessage || 'The requested material requisition could not be located in the database.'}
          </p>
          <button
            type="button"
            onClick={() => fetchRequestDetails()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = REQUEST_STATUS_CONFIG[request.status] || {
    label: request.status,
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  };

  const priorityConfig = REQUEST_PRIORITY_CONFIG[request.priority] || {
    label: request.priority,
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const isPendingReview = ['submitted', 'under_review', 'draft'].includes(request.status);
  const isApproved = ['approved', 'partially_fulfilled', 'fulfilled'].includes(request.status);

  const requesterName = request.requester
    ? `${request.requester.first_name || ''} ${request.requester.last_name || ''}`.trim() ||
      request.requester.display_name ||
      'Executive User'
    : 'Not recorded';

  const reviewerName = request.reviewer
    ? `${request.reviewer.first_name || ''} ${request.reviewer.last_name || ''}`.trim() ||
      request.reviewer.display_name ||
      'Executive User'
    : null;

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header & Quick Actions */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-3 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Material Requests</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                {request.request_code}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.badgeClasses}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClasses}`} />
                {statusConfig.label}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${priorityConfig.badgeClasses}`}
              >
                Priority: {priorityConfig.label}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#01875F]" />
              <span>{request.justification || 'Material Requisition'}</span>
            </h1>

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
              <span>Project:</span>
              {request.projects ? (
                <Link
                  to={`/management/projects/${request.project_id}`}
                  className="font-semibold text-slate-800 hover:text-[#01875F] hover:underline inline-flex items-center gap-1"
                >
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {request.projects.project_code} • {request.projects.name}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </Link>
              ) : (
                <span className="text-slate-400">Not linked</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchRequestDetails(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {isPendingReview && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsApproveOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Request</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Requisition KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            ESTIMATED VALUE
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
            {formatNaira(request.totalEstimatedValue)}
          </span>
          <span className="text-[11px] text-slate-500">Based on catalog rates</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL ITEMS
          </span>
          <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
            {request.items?.length || 0}
          </span>
          <span className="text-[11px] text-slate-500">Distinct catalog lines</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            REQUIRED ON SITE
          </span>
          <span className="text-sm font-bold text-slate-800 mt-1.5 block">
            {formatNigerianDate(request.required_by_date)}
          </span>
          <span className="text-[11px] text-slate-500">Site deployment milestone</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            SUBMITTED DATE
          </span>
          <span className="text-sm font-bold text-slate-800 mt-1.5 block">
            {formatNigerianDate(request.requested_date || request.created_at)}
          </span>
          <span className="text-[11px] text-slate-500">By {requesterName}</span>
        </div>
      </div>

      {/* 3. Requisition Operational Overview */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
          Requisition Operational Context
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
          <div className="space-y-3">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block">Justification</span>
              <p className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-800 mt-1 leading-relaxed">
                {request.justification || 'Not provided'}
              </p>
            </div>

            {request.notes && (
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block">Notes & Logistics</span>
                <p className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-800 mt-1 leading-relaxed">
                  {request.notes}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Authorization & Review Audit
            </span>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Requested By:</span>
                <span className="font-semibold text-slate-800">{requesterName}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Reviewed By:</span>
                <span className="font-semibold text-slate-800">
                  {reviewerName || 'Awaiting Review'}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Reviewed At:</span>
                <span className="font-mono text-slate-700">
                  {formatNigerianDate(request.reviewed_at)}
                </span>
              </div>

              {request.approved_at && (
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-emerald-700 font-semibold">Approved At:</span>
                  <span className="font-mono text-emerald-800 font-semibold">
                    {formatNigerianDate(request.approved_at)}
                  </span>
                </div>
              )}

              {request.rejection_reason && (
                <div className="pt-1">
                  <span className="text-rose-700 font-bold block mb-1">Rejection Reason:</span>
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] leading-relaxed">
                    {request.rejection_reason}
                  </div>
                </div>
              )}

              {request.fulfilled_at && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-teal-700 font-semibold">Fulfilled At:</span>
                  <span className="font-mono text-teal-800 font-semibold">
                    {formatNigerianDate(request.fulfilled_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Requested Material Line Items */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Requested Material Items
            </h3>
            <p className="text-[11px] text-slate-400">
              Quantities authorized by management and operational fulfillment status.
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-slate-800">
            {request.items?.length || 0} Line Items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Material</th>
                <th className="py-3 px-3">Code</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Requested</th>
                <th className="py-3 px-3 text-right">Approved</th>
                <th className="py-3 px-3 text-right">Fulfilled</th>
                <th className="py-3 px-3 text-right">Outstanding</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3 text-right">Unit Rate</th>
                <th className="py-3 px-4 text-right">Est. Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {request.items?.map((item) => {
                const requested = Number(item.requested_quantity);
                const approved =
                  item.approved_quantity !== null && item.approved_quantity !== undefined
                    ? Number(item.approved_quantity)
                    : null;
                const fulfilled = Number(item.fulfilled_quantity || 0);
                const outstanding = approved !== null ? Math.max(0, approved - fulfilled) : requested - fulfilled;
                const unit = item.material?.unit_of_measure || 'units';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {item.material ? (
                          <Link
                            to="/management/materials/directory"
                            className="hover:text-[#01875F] hover:underline"
                          >
                            {item.material.name}
                          </Link>
                        ) : (
                          'Material Item'
                        )}
                      </div>
                      {item.material?.specification && (
                        <div className="text-[10.5px] text-slate-400 font-normal">
                          {item.material.specification}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">
                          Note: {item.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 text-[11px]">
                        {item.material?.material_code || '—'}
                      </span>
                    </td>

                    <td className="py-3 px-3 capitalize text-slate-600">
                      {item.material?.category || 'General'}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {requested.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold">
                      {approved !== null ? (
                        <span className="text-emerald-700">{approved.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {fulfilled.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold">
                      <span className={outstanding > 0 ? 'text-amber-600' : 'text-slate-500'}>
                        {outstanding.toLocaleString()}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-500 font-mono">
                      {unit}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {formatNaira(item.unit_cost)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatNaira(item.estimated_total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>{request.items?.length || 0} line items recorded</span>
          <span className="font-bold font-mono text-slate-900">
            Total Requisition: {formatNaira(request.totalEstimatedValue)}
          </span>
        </div>
      </div>

      {/* 5. Downstream Fulfilment Context */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#01875F]" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
            Downstream Procurement & Fulfilment
          </h3>
        </div>
        <p className="text-xs text-slate-500">
          Requisition status drives subsequent Purchase Orders and site dispatch waybills.
        </p>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 mt-2">
          Procurement not yet linked
        </div>
      </div>

      {/* Modals */}
      <ApproveMaterialRequestModal
        request={request}
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onApproved={handleApproved}
      />

      <RejectMaterialRequestModal
        request={request}
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        onRejected={handleRejected}
      />
    </div>
  );
};

export default MaterialRequestControlCentre;
