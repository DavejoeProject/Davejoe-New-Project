import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Building,
  Calendar,
  User,
  MapPin,
  FileText,
  Boxes,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Receipt,
  Activity,
  CheckCircle2,
  Package,
} from 'lucide-react';
import {
  MaterialDeliveriesService,
  MaterialDeliveryRecord,
  MaterialReceiptRecord,
} from '../../services/materialDeliveriesService';
import { formatNigerianDate } from '../../services/materialsService';

interface DeliveryControlCentreProps {
  deliveryId?: string;
  onBack?: () => void;
}

type DeliveryTab = 'overview' | 'items' | 'receipts' | 'activity';

export const DeliveryControlCentre: React.FC<DeliveryControlCentreProps> = ({
  deliveryId: propId,
  onBack,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ deliveryId?: string }>();
  const activeId = propId || params.deliveryId;

  const [delivery, setDelivery] = useState<MaterialDeliveryRecord | null>(null);
  const [linkedReceipts, setLinkedReceipts] = useState<MaterialReceiptRecord[]>([]);
  const [activeTab, setActiveTab] = useState<DeliveryTab>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchDelivery = useCallback(
    async (isManual: boolean = false) => {
      if (!activeId) {
        setErrorMessage('No delivery ID provided.');
        setIsLoading(false);
        return;
      }

      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      try {
        const res = await MaterialDeliveriesService.getDeliveryById(activeId);
        if (res.error) {
          setErrorMessage(res.error);
        } else if (!res.data) {
          setErrorMessage('Delivery record not found.');
        } else {
          setDelivery(res.data);

          // Fetch linked receipts if reference exists
          const searchTerms = [res.data.delivery_code, res.data.acknowledgement_reference]
            .filter(Boolean)
            .join(' ');
          
          if (searchTerms) {
            const receiptsRes = await MaterialDeliveriesService.getMaterialReceipts({
              search: res.data.delivery_code,
            });
            if (!receiptsRes.error && receiptsRes.data) {
              setLinkedReceipts(receiptsRes.data);
            }
          }
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Unable to load delivery.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeId]
  );

  useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate('/management/materials/deliveries');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 pb-16 animate-pulse">
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <div className="h-4 bg-slate-100 rounded w-32" />
          <div className="h-8 bg-slate-100 rounded w-64" />
        </div>
      </div>
    );
  }

  if (errorMessage || !delivery) {
    return (
      <div className="space-y-6 pb-16">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Deliveries</span>
        </button>

        <div className="bg-white rounded-xl border border-red-200 p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load delivery</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchDelivery()}
            className="px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const deliveredByName = delivery.delivered_by_profile
    ? `${delivery.delivered_by_profile.first_name || ''} ${delivery.delivered_by_profile.last_name || ''}`.trim() ||
      delivery.delivered_by_profile.display_name ||
      'Executive User'
    : 'Not recorded';

  const receivedByName = delivery.received_by_profile
    ? `${delivery.received_by_profile.first_name || ''} ${delivery.received_by_profile.last_name || ''}`.trim() ||
      delivery.received_by_profile.display_name ||
      'Site Supervisor'
    : 'Not recorded';

  // Activity audit timeline
  const activityEvents: Array<{ title: string; date: string; description: string }> = [];
  if (delivery.created_at) {
    activityEvents.push({
      title: 'Delivery Dispatched & Logged',
      date: delivery.created_at,
      description: `Dispatched to site by ${deliveredByName}`,
    });
  }
  if (delivery.delivery_date && delivery.delivery_date !== delivery.created_at) {
    activityEvents.push({
      title: 'Site Delivery Scheduled',
      date: delivery.delivery_date,
      description: `Target Arrival at ${delivery.destination || 'Project Site'}`,
    });
  }
  if (delivery.acknowledgement_reference) {
    activityEvents.push({
      title: 'Gate Pass / Acknowledgement Recorded',
      date: delivery.updated_at || delivery.created_at,
      description: `Waybill / Acknowledgment Ref: ${delivery.acknowledgement_reference}`,
    });
  }
  linkedReceipts.forEach((r) => {
    activityEvents.push({
      title: `Material Receipt Verified (${r.receipt_code})`,
      date: r.received_date || r.created_at,
      description: `Waybill: ${r.delivery_reference || 'N/A'} - Recorded by ${
        r.received_by_profile?.display_name || 'Inspector'
      }`,
    });
  });
  activityEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header & Breadcrumbs */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-3 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Deliveries</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Materials / Deliveries / {delivery.delivery_code}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-[#01875F]" />
                <span>Site Dispatched</span>
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <Truck className="w-6 h-6 text-[#01875F]" />
              <span>Delivery {delivery.delivery_code}</span>
            </h1>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-700">Project:</strong>{' '}
                {delivery.projects ? (
                  <Link
                    to={`/management/projects/${delivery.project_id}`}
                    className="text-[#01875F] hover:underline font-medium inline-flex items-center gap-0.5"
                  >
                    <span>{delivery.projects.project_code} • {delivery.projects.name}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                ) : (
                  'Not recorded'
                )}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-700">Destination:</strong>{' '}
                {delivery.destination || 'Project Site'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-700">Date:</strong>{' '}
                {formatNigerianDate(delivery.delivery_date)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchDelivery(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors self-start sm:self-center cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. Control Centre Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-1.5 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {[
          { key: 'overview', label: 'Delivery Overview', icon: FileText },
          { key: 'items', label: `Line Items (${delivery.items?.length || 0})`, icon: Boxes },
          { key: 'receipts', label: `Linked Receipts (${linkedReceipts.length})`, icon: Receipt },
          { key: 'activity', label: 'Activity Log', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as DeliveryTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#01875F] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* TAB: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Logistics & Site Dispatch
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Delivery Reference:</span>
                <span className="font-mono font-bold text-slate-900">{delivery.delivery_code}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Destination Project:</span>
                {delivery.projects ? (
                  <Link
                    to={`/management/projects/${delivery.project_id}`}
                    className="font-semibold text-slate-800 hover:text-[#01875F] hover:underline inline-flex items-center gap-1"
                  >
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>{delivery.projects.project_code} • {delivery.projects.name}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </Link>
                ) : (
                  <span className="text-slate-400">Not recorded</span>
                )}
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Delivery Date:</span>
                <span className="font-mono text-slate-800 font-semibold">
                  {formatNigerianDate(delivery.delivery_date)}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Destination Bay:</span>
                <span className="text-slate-800">{delivery.destination || 'Not provided'}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Acknowledgement Ref:</span>
                <span className="font-mono text-slate-800">
                  {delivery.acknowledgement_reference || 'Not recorded'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Custody & Sign-Off
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Delivered By:</span>
                <span className="font-semibold text-slate-800">{deliveredByName}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Received By:</span>
                <span className="font-semibold text-slate-800">{receivedByName}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Logged On:</span>
                <span className="font-mono text-slate-700">
                  {formatNigerianDate(delivery.created_at)}
                </span>
              </div>

              {delivery.notes && (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Site Notes
                  </span>
                  <p className="p-2.5 bg-slate-50 rounded border border-slate-200/70 text-slate-800 text-[11px]">
                    {delivery.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: LINE ITEMS */}
      {activeTab === 'items' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Delivered Material Items
            </h3>
            <span className="font-mono text-xs font-bold text-slate-800">
              {delivery.items?.length || 0} Line Items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3 text-right">Quantity</th>
                  <th className="py-3 px-3">Unit</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {delivery.items?.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {it.material ? (
                          <Link
                            to="/management/materials/directory"
                            className="hover:text-[#01875F] hover:underline"
                          >
                            {it.material.name}
                          </Link>
                        ) : (
                          'Material Item'
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 text-[11px]">
                        {it.material?.material_code || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-600">
                      {it.material?.category || 'General'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(it.quantity).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono">
                      {it.material?.unit_of_measure || 'units'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {it.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: LINKED RECEIPTS */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Verified Material Gate Receipts
              </h3>
              <p className="text-[11px] text-slate-400">
                Warehouse gate receipts and waybill verifications linked to this delivery consignment.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-slate-800">
              {linkedReceipts.length} Linked Records
            </span>
          </div>

          {linkedReceipts.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No matching material receipt records found for this delivery reference.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {linkedReceipts.map((r) => (
                <div key={r.id} className="p-4 bg-white space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{r.receipt_code}</span>
                      <span className="text-slate-400 ml-2">
                        Waybill: <strong>{r.delivery_reference || 'Not recorded'}</strong>
                      </span>
                    </div>
                    <span className="font-mono text-slate-500">
                      {formatNigerianDate(r.received_date)}
                    </span>
                  </div>

                  {r.purchase_orders && (
                    <div className="text-[11px] text-slate-600">
                      <span>Purchase Order: </span>
                      <Link
                        to={`/management/materials/procurement/${r.purchase_orders.id}`}
                        className="text-[#01875F] hover:underline font-mono font-semibold"
                      >
                        {r.purchase_orders.purchase_code}
                      </Link>
                    </div>
                  )}

                  {r.items && r.items.length > 0 && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-[11px] space-y-1">
                      {r.items.map((it) => (
                        <div key={it.id} className="flex justify-between text-slate-700">
                          <span>
                            {it.material?.name || 'Material'}: {it.quantity_received} received
                          </span>
                          <span className="font-mono text-emerald-700">
                            Accepted: {it.accepted_quantity} | Rejected: {it.rejected_quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Activity className="w-4 h-4 text-[#01875F]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Delivery Logistics Audit Trail
            </h3>
          </div>

          {activityEvents.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No delivery activity recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {activityEvents.map((evt, idx) => (
                <div key={idx} className="p-3.5 bg-white flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{evt.title}</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{evt.description}</p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {formatNigerianDate(evt.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryControlCentre;
