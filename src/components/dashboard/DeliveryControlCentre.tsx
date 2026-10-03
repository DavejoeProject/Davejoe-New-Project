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
} from 'lucide-react';
import {
  MaterialDeliveriesService,
  MaterialDeliveryRecord,
} from '../../services/materialDeliveriesService';
import { formatNigerianDate, formatNaira } from '../../services/materialsService';

interface DeliveryControlCentreProps {
  deliveryId?: string;
  onBack?: () => void;
}

export const DeliveryControlCentre: React.FC<DeliveryControlCentreProps> = ({
  deliveryId: propId,
  onBack,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ deliveryId?: string }>();
  const activeId = propId || params.deliveryId;

  const [delivery, setDelivery] = useState<MaterialDeliveryRecord | null>(null);
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
            className="px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
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

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* Header */}
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
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Deliveries / {delivery.delivery_code}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <Truck className="w-6 h-6 text-[#01875F]" />
              <span>Delivery {delivery.delivery_code}</span>
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <span>Destination:</span>
              <strong className="text-slate-800">{delivery.destination || 'Project Site'}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchDelivery(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Operational Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
            Logistics & Site Dispatch
          </h3>

          <div className="space-y-2">
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

      {/* Delivered Items */}
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
    </div>
  );
};

export default DeliveryControlCentre;
