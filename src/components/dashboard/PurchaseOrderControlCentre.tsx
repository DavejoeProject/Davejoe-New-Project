import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  Building,
  Truck,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  Package,
  Boxes,
  Receipt,
  FileText,
  AlertCircle,
  DollarSign,
  Activity,
  User,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import {
  PurchaseOrderRecord,
  ProcurementService,
  PURCHASE_ORDER_STATUS_CONFIG,
  MaterialReceiptRecord,
} from '../../services/procurementService';
import {
  formatNaira,
  formatNigerianDate,
} from '../../services/materialsService';
import { ApprovePurchaseOrderModal } from './ApprovePurchaseOrderModal';
import { RejectPurchaseOrderModal } from './RejectPurchaseOrderModal';

interface PurchaseOrderControlCentreProps {
  purchaseOrderId?: string;
  onBack?: () => void;
}

type TabType =
  | 'overview'
  | 'line-items'
  | 'supplier'
  | 'material-request'
  | 'deliveries'
  | 'financial'
  | 'activity';

export const PurchaseOrderControlCentre: React.FC<PurchaseOrderControlCentreProps> = ({
  purchaseOrderId: propOrderId,
  onBack,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ purchaseOrderId?: string }>();
  const activeOrderId = propOrderId || params.purchaseOrderId;

  const [order, setOrder] = useState<PurchaseOrderRecord | null>(null);
  const [deliveries, setDeliveries] = useState<MaterialReceiptRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals
  const [isApproveOpen, setIsApproveOpen] = useState<boolean>(false);
  const [isRejectOpen, setIsRejectOpen] = useState<boolean>(false);

  const fetchOrderDetails = useCallback(
    async (isManual: boolean = false) => {
      if (!activeOrderId) {
        setErrorMessage('No purchase order ID was provided.');
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
        const [orderRes, delivRes] = await Promise.all([
          ProcurementService.getPurchaseOrderById(activeOrderId),
          ProcurementService.getPurchaseOrderDeliveries(activeOrderId),
        ]);

        if (orderRes.error) {
          setErrorMessage(orderRes.error);
        } else if (!orderRes.data) {
          setErrorMessage('Purchase order record not found.');
        } else {
          setOrder(orderRes.data);
          setDeliveries(delivRes.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to retrieve purchase order.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeOrderId]
  );

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/management/materials/procurement');
    }
  };

  const handleApproved = (updated: PurchaseOrderRecord) => {
    setOrder(updated);
  };

  const handleRejected = (updated: PurchaseOrderRecord) => {
    setOrder(updated);
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
          <div className="h-40 bg-slate-50 rounded" />
        </div>
      </div>
    );
  }

  if (errorMessage || !order) {
    return (
      <div className="space-y-6 pb-16">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Procurement</span>
        </button>

        <div className="bg-white rounded-xl border border-red-200 p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load purchase order</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {errorMessage || 'The purchase order could not be located in the database.'}
          </p>
          <button
            type="button"
            onClick={() => fetchOrderDetails()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = PURCHASE_ORDER_STATUS_CONFIG[order.status] || {
    label: order.status,
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  };

  const isAwaitingApproval = order.status === 'submitted' || order.status === 'draft';

  const orderedByName = order.ordered_profile
    ? `${order.ordered_profile.first_name || ''} ${order.ordered_profile.last_name || ''}`.trim() ||
      order.ordered_profile.display_name ||
      'Executive User'
    : 'Not provided';

  const approvedByName = order.approved_profile
    ? `${order.approved_profile.first_name || ''} ${order.approved_profile.last_name || ''}`.trim() ||
      order.approved_profile.display_name ||
      'Executive User'
    : order.approved_by ? 'Authorized Executive' : 'Not provided';

  // Build real activity timeline
  const activityEvents: Array<{ title: string; date: string; description: string }> = [];
  if (order.created_at) {
    activityEvents.push({
      title: 'Purchase Order Logged',
      date: order.created_at,
      description: `Drafted by ${orderedByName}`,
    });
  }
  if (order.ordered_at) {
    activityEvents.push({
      title: 'Order Submitted',
      date: order.ordered_at,
      description: 'Submitted to management for commercial approval',
    });
  }
  if (order.approved_at) {
    activityEvents.push({
      title: order.status === 'rejected' ? 'Order Rejected' : 'Commercial Approval Granted',
      date: order.approved_at,
      description: `Actioned by ${approvedByName}`,
    });
  }
  deliveries.forEach((d) => {
    activityEvents.push({
      title: `Material Receipt Logged (${d.receipt_code})`,
      date: d.received_date || d.created_at,
      description: `Waybill Ref: ${d.delivery_reference || 'Not recorded'}`,
    });
  });
  activityEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Breadcrumbs & Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-3 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Procurement</span>
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Procurement / {order.purchase_code}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.badgeClasses}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClasses}`} />
                {statusConfig.label}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-[#01875F]" />
              <span>Purchase Order {order.purchase_code}</span>
            </h1>

            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-700">Vendor:</strong>{' '}
                {order.suppliers?.name || 'Not provided'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-700">Project:</strong>{' '}
                {order.projects ? (
                  <Link
                    to={`/management/projects/${order.project_id}`}
                    className="text-[#01875F] hover:underline inline-flex items-center gap-0.5 font-medium"
                  >
                    <span>{order.projects.project_code} • {order.projects.name}</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </Link>
                ) : (
                  'Not provided'
                )}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => fetchOrderDetails(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {isAwaitingApproval && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Reject PO</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsApproveOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve Purchase Order</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Control Centre Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-1.5 flex items-center gap-1 overflow-x-auto custom-scrollbar">
        {[
          { key: 'overview', label: 'Overview', icon: FileText },
          { key: 'line-items', label: `Line Items (${order.items?.length || 0})`, icon: Boxes },
          { key: 'supplier', label: 'Supplier Details', icon: Truck },
          { key: 'material-request', label: 'Source Requisition', icon: Receipt },
          { key: 'deliveries', label: `Deliveries & Receipts (${deliveries.length})`, icon: Package },
          { key: 'financial', label: 'Financial Control', icon: DollarSign },
          { key: 'activity', label: 'Activity Log', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as TabType)}
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Procurement Summary */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Procurement Operational Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Purchase Code:</span>
                    <span className="font-mono font-bold text-slate-900">{order.purchase_code}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Supplier:</span>
                    <span className="font-semibold text-slate-800">
                      {order.suppliers?.name || 'Not provided'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Project:</span>
                    <span className="font-semibold text-slate-800">
                      {order.projects?.project_code} • {order.projects?.name}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Ordered By:</span>
                    <span className="font-semibold text-slate-800">{orderedByName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Purchase Date:</span>
                    <span className="font-mono text-slate-700">
                      {formatNigerianDate(order.purchase_date)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Expected Delivery:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {order.expected_delivery_date
                        ? formatNigerianDate(order.expected_delivery_date)
                        : 'Not provided'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Approved By:</span>
                    <span className="font-semibold text-slate-800">{approvedByName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Approved Date:</span>
                    <span className="font-mono text-slate-700">
                      {order.approved_at ? formatNigerianDate(order.approved_at) : 'Awaiting Action'}
                    </span>
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="pt-2">
                  <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Commercial & Operational Notes
                  </span>
                  <p className="p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-800 text-xs leading-relaxed whitespace-pre-wrap">
                    {order.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Right 1 Col: Cost Summary */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Cost Summary
              </h3>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatNaira(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Delivery:</span>
                  <span>{formatNaira(order.delivery_cost)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Other Costs:</span>
                  <span>{formatNaira(order.other_cost)}</span>
                </div>
                <div className="border-t border-slate-300 pt-2 flex justify-between text-base font-bold text-slate-900">
                  <span>TOTAL:</span>
                  <span>{formatNaira(order.total_cost)}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-[11px] text-emerald-900">
                All procurement totals are recorded and settled in Nigerian Naira (₦).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: LINE ITEMS */}
      {activeTab === 'line-items' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Procurement Line Items
            </h3>
            <span className="text-xs font-mono font-bold text-slate-800">
              {order.items?.length || 0} Line Items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3 text-right">Ordered Qty</th>
                  <th className="py-3 px-3 text-right">Received Qty</th>
                  <th className="py-3 px-3 text-right">Outstanding</th>
                  <th className="py-3 px-3">Unit</th>
                  <th className="py-3 px-3 text-right">Unit Cost</th>
                  <th className="py-3 px-4 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items?.map((item) => {
                  const ordered = Number(item.ordered_quantity);
                  const received = Number(item.received_quantity || 0);
                  const outstanding = Math.max(0, ordered - received);
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
                        {item.notes && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Note: {item.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80 text-[11px]">
                          {item.material?.material_code || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {ordered.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-teal-700">
                        {received.toLocaleString()}
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
                        {formatNaira(item.total_cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>{order.items?.length || 0} line items recorded</span>
            <span className="font-bold font-mono text-slate-900">
              Subtotal: {formatNaira(order.subtotal)}
            </span>
          </div>
        </div>
      )}

      {/* TAB: SUPPLIER */}
      {activeTab === 'supplier' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#01875F]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Supplier & Vendor Profile
            </h3>
          </div>

          {order.suppliers ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Supplier Name:</span>
                  <span className="font-bold text-slate-900">{order.suppliers.name}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Supplier Code:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {order.suppliers.supplier_code}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                  <span className="text-slate-500">Status:</span>
                  <span className="capitalize font-semibold text-emerald-700">
                    {order.suppliers.status}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Contact Person:</span>
                  <span className="font-semibold text-slate-800">
                    {order.suppliers.contact_person || 'Not provided'}
                  </span>
                </div>
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-mono text-slate-800">{order.suppliers.phone || 'Not provided'}</span>
                </div>
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-800">{order.suppliers.email || 'Not provided'}</span>
                </div>
                <div className="flex items-start gap-2 pt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-slate-500">Address:</span>
                  <span className="text-slate-800">{order.suppliers.address || 'Not provided'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No supplier information available.
            </div>
          )}
        </div>
      )}

      {/* TAB: MATERIAL REQUEST */}
      {activeTab === 'material-request' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#01875F]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Source Material Requisition
            </h3>
          </div>

          {order.material_requests ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {order.material_requests.request_code}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {order.material_requests.justification || 'Site Requisition'}
                  </p>
                </div>
                <Link
                  to={`/management/materials/requests/${order.material_requests.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01875F] text-white rounded-lg text-xs font-semibold hover:bg-[#016f4e] transition-colors"
                >
                  <span>Open Request Control Centre</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {order.material_requests.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Requester</span>
                  <span className="font-semibold text-slate-800">
                    {order.material_requests.requester
                      ? `${order.material_requests.requester.first_name || ''} ${order.material_requests.requester.last_name || ''}`.trim() ||
                        order.material_requests.requester.display_name
                      : 'Not provided'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Requested Date</span>
                  <span className="font-mono text-slate-800">
                    {formatNigerianDate(order.material_requests.requested_date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Required On Site</span>
                  <span className="font-mono text-slate-800">
                    {formatNigerianDate(order.material_requests.required_by_date)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              Procurement not linked to a material request.
            </div>
          )}
        </div>
      )}

      {/* TAB: DELIVERIES */}
      {activeTab === 'deliveries' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Linked Delivery Receipts & Waybills
              </h3>
              <p className="text-[11px] text-slate-400">
                Verification of physical gate deliveries against ordered commitments.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-slate-800">
              {deliveries.length} Delivery Records
            </span>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No delivery receipts recorded yet for this purchase order.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {deliveries.map((d) => (
                <div key={d.id} className="p-4 bg-white space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{d.receipt_code}</span>
                      <span className="text-slate-400 ml-2">
                        Waybill Ref: <strong>{d.delivery_reference || 'Not recorded'}</strong>
                      </span>
                    </div>
                    <span className="font-mono text-slate-500">
                      {formatNigerianDate(d.received_date)}
                    </span>
                  </div>

                  {d.items && d.items.length > 0 && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-[11px] space-y-1">
                      {d.items.map((it) => (
                        <div key={it.id} className="flex justify-between text-slate-700">
                          <span>
                            {it.material?.name || 'Material Item'}: {it.quantity_received}{' '}
                            {it.material?.unit_of_measure} received
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

      {/* TAB: FINANCIAL */}
      {activeTab === 'financial' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#01875F]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Financial Breakdown & Commercial Settlement
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3 font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Material Subtotal:</span>
                <span className="font-bold text-slate-800">{formatNaira(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Freight & Delivery Cost:</span>
                <span>{formatNaira(order.delivery_cost)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Other Logistics / Taxes:</span>
                <span>{formatNaira(order.other_cost)}</span>
              </div>
              <div className="border-t border-slate-300 pt-2 flex justify-between text-base font-bold text-slate-900">
                <span>Total Commitment:</span>
                <span>{formatNaira(order.total_cost)}</span>
              </div>
            </div>

            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs text-slate-600">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                Accounting Notes
              </span>
              <p className="leading-relaxed">
                Purchase Order commitments are reflected in the executive management financial ledger. Disbursements require delivery waybill matching and physical receipt verification.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#01875F]" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Procurement Audit & Activity Log
            </h3>
          </div>

          {activityEvents.length === 0 ? (
            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
              No procurement activity recorded yet.
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

      {/* Modals */}
      <ApprovePurchaseOrderModal
        order={order}
        isOpen={isApproveOpen}
        onClose={() => setIsApproveOpen(false)}
        onApproved={handleApproved}
      />

      <RejectPurchaseOrderModal
        order={order}
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        onRejected={handleRejected}
      />
    </div>
  );
};

export default PurchaseOrderControlCentre;
