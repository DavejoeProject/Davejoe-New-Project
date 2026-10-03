import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Truck,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  Eye,
  Building,
  Receipt,
  X,
  Boxes,
  Package,
} from 'lucide-react';
import {
  MaterialDeliveriesService,
  MaterialDeliveryRecord,
  MaterialReceiptRecord,
  DeliveriesSummary,
} from '../../services/materialDeliveriesService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { formatNigerianDate } from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { RecordDeliveryModal } from './RecordDeliveryModal';
import { RecordReceiptModal } from './RecordReceiptModal';

interface DeliveriesModuleProps {
  onBackToDashboard?: () => void;
}

export const DeliveriesModule: React.FC<DeliveriesModuleProps> = () => {
  const navigate = useNavigate();

  // Active section tab: 'deliveries' vs 'receipts'
  const [activeSection, setActiveSection] = useState<'deliveries' | 'receipts'>('deliveries');

  // Data states
  const [deliveries, setDeliveries] = useState<MaterialDeliveryRecord[]>([]);
  const [receipts, setReceipts] = useState<MaterialReceiptRecord[]>([]);
  const [summary, setSummary] = useState<DeliveriesSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);

  // Flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Modals
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    MaterialRequestsService.getProjectsForDropdown().then((res) => {
      setProjects(res.data);
    });
  }, []);

  const fetchData = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      try {
        const [sumRes, delRes, recRes] = await Promise.all([
          MaterialDeliveriesService.getDeliveriesSummary(),
          MaterialDeliveriesService.getMaterialDeliveries({
            search: debouncedSearch,
            projectId: projectFilter,
          }),
          MaterialDeliveriesService.getMaterialReceipts({
            search: debouncedSearch,
          }),
        ]);

        if (sumRes.error) {
          console.error('[Deliveries] Summary error:', sumRes.error);
        } else {
          setSummary(sumRes.data);
        }

        if (delRes.error) {
          setErrorMessage(delRes.error);
        } else {
          setDeliveries(delRes.data);
        }

        if (recRes.data) {
          setReceipts(recRes.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load deliveries data from database.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, projectFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setProjectFilter('all');
  };

  const hasActiveFilters = debouncedSearch.trim() !== '' || projectFilter !== 'all';

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                MATERIALS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Truck className="w-7 h-7 text-[#01875F]" />
              <span>Deliveries</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Track material deliveries, receipts and receiving discrepancies across projects.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-[#01875F]" />
              <span>Record Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDeliveryModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Delivery</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="deliveries" />

      {/* 3. Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL DELIVERIES
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalDeliveries ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Site dispatches recorded</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            RECEIPTS LOGGED
          </span>
          <span className="text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalReceipts ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Vendor shipments verified</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            DELIVERED ITEMS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalItemsDelivered ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Movements to projects</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            REJECTED QUANTITIES
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.totalRejectedQuantity ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !summary ? '...' : (summary?.totalRejectedQuantity ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Off-spec / damaged at intake</span>
        </div>
      </div>

      {/* 4. Sub-Section Switcher & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveSection('deliveries')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'deliveries'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Site Deliveries ({deliveries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('receipts')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'receipts'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vendor Receipts ({receipts.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, ref, or project..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>

            {activeSection === 'deliveries' && (
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_code} • {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filters active</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-[#01875F] font-semibold hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* 5. Content View */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 animate-pulse space-y-3">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-24 bg-slate-50 rounded" />
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200 p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load deliveries.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activeSection === 'deliveries' ? (
        deliveries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No deliveries recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Material dispatches to project sites will appear here.
            </p>
            <button
              type="button"
              onClick={() => setIsDeliveryModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Record Delivery</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Delivery Code</th>
                    <th className="py-3.5 px-3">Project</th>
                    <th className="py-3.5 px-3">Delivery Date</th>
                    <th className="py-3.5 px-3">Destination</th>
                    <th className="py-3.5 px-3">Delivered By</th>
                    <th className="py-3.5 px-3">Received By</th>
                    <th className="py-3.5 px-3">Waybill Ref</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map((del) => (
                    <tr
                      key={del.id}
                      onClick={() => navigate(`/management/materials/deliveries/${del.id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-[#01875F]">
                          {del.delivery_code}
                        </span>
                        {del.items && (
                          <div className="text-[10px] text-slate-400">
                            {del.items.length} line item{del.items.length === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                        {del.projects ? (
                          <Link
                            to={`/management/projects/${del.project_id}`}
                            className="font-medium text-slate-800 hover:text-[#01875F] hover:underline"
                          >
                            <span className="font-mono text-[11px] text-slate-500 mr-1">
                              {del.projects.project_code}
                            </span>
                            <span>{del.projects.name}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">Not linked</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {formatNigerianDate(del.delivery_date)}
                      </td>

                      <td className="py-3.5 px-3 text-slate-700">
                        {del.destination || 'Project Site'}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600">
                        {del.delivered_by_profile
                          ? `${del.delivered_by_profile.first_name || ''} ${del.delivered_by_profile.last_name || ''}`.trim() ||
                            del.delivered_by_profile.display_name
                          : '—'}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600">
                        {del.received_by_profile
                          ? `${del.received_by_profile.first_name || ''} ${del.received_by_profile.last_name || ''}`.trim() ||
                            del.received_by_profile.display_name
                          : '—'}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-500">
                        {del.acknowledgement_reference || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/management/materials/deliveries/${del.id}`)}
                          className="p-1.5 text-slate-500 hover:text-[#01875F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="View Delivery"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Receipts Section */
        receipts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-3 border border-[#01875F]/20">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No material receipts recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Material receipts recorded against vendor purchase orders will appear here.
            </p>
            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Record Receipt</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Receipt Code</th>
                    <th className="py-3.5 px-3">Purchase Order</th>
                    <th className="py-3.5 px-3">Supplier</th>
                    <th className="py-3.5 px-3">Received Date</th>
                    <th className="py-3.5 px-3">Delivery Ref</th>
                    <th className="py-3.5 px-3">Verified By</th>
                    <th className="py-3.5 px-4 text-right">Items Verified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {rec.receipt_code}
                      </td>

                      <td className="py-3.5 px-3">
                        {rec.purchase_orders ? (
                          <Link
                            to={`/management/materials/procurement/${rec.purchase_orders.id}`}
                            className="font-mono font-semibold text-[#01875F] hover:underline"
                          >
                            {rec.purchase_orders.purchase_code}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Direct Intake</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-slate-700 font-medium">
                        {rec.suppliers ? rec.suppliers.name : 'Vendor'}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        {formatNigerianDate(rec.received_date)}
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-500">
                        {rec.delivery_reference || '—'}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600">
                        {rec.received_by_profile
                          ? `${rec.received_by_profile.first_name || ''} ${rec.received_by_profile.last_name || ''}`.trim() ||
                            rec.received_by_profile.display_name
                          : 'Store Officer'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-800">
                        {rec.items?.length || 0} Line{rec.items?.length === 1 ? '' : 's'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modals */}
      <RecordDeliveryModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
        onDeliveryCreated={() => fetchData(true)}
      />

      <RecordReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onReceiptCreated={() => fetchData(true)}
      />
    </div>
  );
};

export default DeliveriesModule;
