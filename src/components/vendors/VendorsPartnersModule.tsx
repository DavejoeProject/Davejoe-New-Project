import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Handshake,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit3,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Phone,
  FileCheck2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  ExternalLink,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  VendorPartnerRecord,
  VendorsPartnersMetrics,
  VendorsPartnersService,
  VendorPartnerStatus,
} from '../../services/vendorsPartnersService';
import { formatDateNigerian } from '../../services/dashboardService';
import { VendorPartnerFormModal } from './VendorPartnerFormModal';
import { VendorPartnerProfile } from './VendorPartnerProfile';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import { AccessDenied } from '../AccessDenied';

interface VendorsPartnersModuleProps {
  onBackToDashboard?: () => void;
}

type SortField = 'name' | 'record_type' | 'created_at' | 'status';

const formatTypeLabel = (val: string): string => {
  const norm = (val || 'vendor').toLowerCase();
  if (norm === 'both') return 'Vendor & Partner';
  if (norm === 'partner') return 'Partner';
  return 'Vendor';
};

export const VendorsPartnersModule: React.FC<VendorsPartnersModuleProps> = ({
  onBackToDashboard,
}) => {
  const { hasAnyPermission } = useAuth();

  // Strict RBAC permissions matching public.permissions & SQL RLS/RPC enforcement (no executive_director bypass)
  const canCreate = hasAnyPermission(['Create Vendors', 'vendors.create']);
  const canUpdate = hasAnyPermission(['Update Vendors', 'vendors.update']);
  const canViewFinancials = hasAnyPermission(['View Vendor Banking', 'vendors.banking.view']);
  const canViewDocuments = hasAnyPermission(['View Vendor Documents', 'vendors.documents.view']);
  const canView =
    canCreate || canUpdate || hasAnyPermission(['View Vendors', 'vendors.view']);

  const [records, setRecords] = useState<VendorPartnerRecord[]>([]);
  const [metrics, setMetrics] = useState<VendorsPartnersMetrics>({
    totalCount: 0,
    activeCount: 0,
    totalVendorsCount: 0,
    totalPartnersCount: 0,
    vendorOnlyCount: 0,
    partnerOnlyCount: 0,
    bothCount: 0,
    cacUploadedCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters, Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'vendor' | 'partner' | 'both'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>(
    'all'
  );
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sub-views & Modal
  const [selectedRecord, setSelectedRecord] = useState<VendorPartnerRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VendorPartnerRecord | null>(null);

  // Direct CAC quick preview
  const [quickPreview, setQuickPreview] = useState<{
    title: string;
    url: string;
    isPdf: boolean;
  } | null>(null);
  const [isFetchingDocId, setIsFetchingDocId] = useState<string | null>(null);

  // Confirmation dialog
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchDirectory = useCallback(
    async (manual = false) => {
      if (manual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMsg(null);

      const res = await VendorsPartnersService.listVendorsPartners({
        search: searchQuery,
        recordType: typeFilter,
        status: statusFilter,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setRecords(res.data);
        setMetrics(res.metrics);
        if (selectedRecord) {
          const updated = res.data.find((r) => r.id === selectedRecord.id) || null;
          if (updated) setSelectedRecord(updated);
        }
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [searchQuery, typeFilter, statusFilter, selectedRecord?.id]
  );

  useEffect(() => {
    if (canView) {
      fetchDirectory();
    } else {
      setIsLoading(false);
    }
  }, [fetchDirectory, canView]);

  // Reset pagination on filter/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, statusFilter, sortField, sortDir, pageSize]);

  const sortedRecords = useMemo(() => {
    const copy = [...records];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        const nameA = (a.business_name || a.full_name || '').toLowerCase();
        const nameB = (b.business_name || b.full_name || '').toLowerCase();
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === 'record_type') {
        cmp = (a.record_type || '').localeCompare(b.record_type || '');
      } else if (sortField === 'status') {
        cmp = (a.status || '').localeCompare(b.status || '');
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [records, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRecords = sortedRecords.slice((safePage - 1) * pageSize, safePage * pageSize);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const requestStatusChange = (
    record: VendorPartnerRecord,
    nextStatus: VendorPartnerStatus
  ) => {
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
      }" to "${nextStatus}"? Historical procurement and audit records remain intact.`,
      confirmLabel: verb,
      variant,
      onConfirm: async () => {
        setIsConfirmBusy(true);
        const res = await VendorsPartnersService.updateStatus(
          record.id,
          nextStatus,
          record.status
        );
        setIsConfirmBusy(false);
        setConfirmState(null);
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        showToast(`${record.business_name || record.full_name} status changed to ${nextStatus}.`);
        fetchDirectory(true);
      },
    });
  };

  const handleQuickViewCac = async (record: VendorPartnerRecord) => {
    if (!record.cac_certificate_path || !canViewDocuments) return;
    setIsFetchingDocId(record.id);
    setErrorMsg(null);
    const res = await VendorsPartnersService.getSignedCacUrl(record.cac_certificate_path);
    setIsFetchingDocId(null);

    if (res.error || !res.signedUrl) {
      setErrorMsg(res.error || 'Unable to generate secure CAC Certificate link.');
      return;
    }

    setQuickPreview({
      title: record.business_name || record.full_name,
      url: res.signedUrl,
      isPdf: record.cac_certificate_path.toLowerCase().endsWith('.pdf'),
    });
  };

  if (!canView) {
    return (
      <AccessDenied
        isModuleRestricted
        title="Vendors & Partners Access Restricted"
        message="You do not hold the required database permission (View Vendors) to access the Vendors & Partners Directory."
        onBack={onBackToDashboard}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-semibold">
          <CheckCircle2 className="w-4 h-4 text-[#18b892] shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {selectedRecord ? (
        <VendorPartnerProfile
          record={selectedRecord}
          canUpdate={canUpdate}
          canViewFinancials={canViewFinancials}
          canViewDocuments={canViewDocuments}
          onBack={() => {
            setSelectedRecord(null);
            fetchDirectory(true);
          }}
          onEdit={(rec) => {
            setEditingRecord(rec);
            setIsFormOpen(true);
          }}
          onStatusUpdated={(msg) => {
            showToast(msg);
            fetchDirectory(true);
          }}
        />
      ) : (
        <>
          {/* Header */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {onBackToDashboard && (
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18b892] hover:underline cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Back to Dashboard</span>
                </button>
              )}
              <div className="flex items-center gap-2.5">
                <Handshake className="w-6 h-6 text-[#18b892] shrink-0" />
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                  Vendors &amp; Partners Directory
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                Commercial suppliers, trade partners, protected settlement accounts, and private CAC compliance records.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => fetchDirectory(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin text-[#18b892]' : ''}`}
                />
                <span>Refresh</span>
              </button>

              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setIsFormOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Add Vendor / Partner</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Total Records</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.totalCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Total Vendors</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.totalVendorsCount}
              </div>
              {metrics.bothCount > 0 && (
                <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                  Includes {metrics.bothCount} dual Vendor &amp; Partner
                </div>
              )}
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Total Partners</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.totalPartnersCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-emerald-700">Active Records</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {metrics.activeCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
              <div className="text-xs font-semibold text-[#18b892]">CAC On File</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.cacUploadedCount}
              </div>
            </div>
          </div>

          {/* Search, Filters & Sort */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by full name, business name, phone, or email..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
                {(
                  [
                    { key: 'all', label: 'All Types' },
                    { key: 'vendor', label: 'Vendor' },
                    { key: 'partner', label: 'Partner' },
                    { key: 'both', label: 'Both' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTypeFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      typeFilter === tab.key
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'suspended')
                }
                aria-label="Filter by status"
                className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#18b892] cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>

              <div className="inline-flex items-center gap-1.5">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  aria-label="Sort vendor and partner records"
                  className="px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#18b892] cursor-pointer"
                >
                  <option value="created_at">Sort: Date Registered</option>
                  <option value="name">Sort: Business / Name</option>
                  <option value="record_type">Sort: Classification</option>
                  <option value="status">Sort: Status</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  title={sortDir === 'asc' ? 'Ascending order' : 'Descending order'}
                  className="px-2.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <span className="uppercase">{sortDir}</span>
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Table & Mobile Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-xl" />
                ))}
              </div>
            ) : sortedRecords.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-3">
                <Handshake className="w-9 h-9 text-slate-300 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    No vendors or partners match your filter
                  </p>
                  <p className="text-xs text-slate-500">
                    Register approved suppliers and business partners along with contact, banking, and CAC documentation.
                  </p>
                </div>
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRecord(null);
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Register First Vendor / Partner</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleSort('name')}
                            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                          >
                            <span>Business / Contact</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleSort('record_type')}
                            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                          >
                            <span>Classification</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-4">Phone &amp; Email</th>
                        <th className="py-3 px-4">Banking</th>
                        <th className="py-3 px-4">CAC</th>
                        <th className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleSort('created_at')}
                            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                          >
                            <span>Registered</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => toggleSort('status')}
                            className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                          >
                            <span>Status</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedRecords.map((r) => {
                        const statusColor =
                          r.status === 'active'
                            ? 'text-emerald-700'
                            : r.status === 'suspended'
                            ? 'text-red-700'
                            : 'text-slate-500';

                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => setSelectedRecord(r)}
                                className="font-bold text-slate-900 hover:text-[#18b892] text-left cursor-pointer"
                              >
                                {r.business_name || r.full_name}
                              </button>
                              {r.business_name && (
                                <div className="text-xs text-slate-500 truncate max-w-[220px]">
                                  Contact: {r.full_name}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">
                              {formatTypeLabel(r.record_type)}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600">
                              <div className="font-mono tabular-nums text-slate-800 whitespace-nowrap">
                                {r.phone_number}
                              </div>
                              {r.email_address && (
                                <div className="text-slate-500 truncate max-w-[190px]">
                                  {r.email_address}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                              {!canViewFinancials ? (
                                <span className="inline-flex items-center gap-1 text-slate-400">
                                  <Lock className="w-3 h-3 shrink-0" />
                                  <span>Restricted</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(r)}
                                  className="text-xs font-semibold text-[#18b892] hover:underline cursor-pointer"
                                >
                                  View Banking
                                </button>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                              {r.cac_certificate_path ? (
                                canViewDocuments ? (
                                  <button
                                    type="button"
                                    disabled={isFetchingDocId === r.id}
                                    onClick={() => handleQuickViewCac(r)}
                                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline cursor-pointer disabled:opacity-50"
                                  >
                                    <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      {isFetchingDocId === r.id ? 'Loading...' : 'View CAC'}
                                    </span>
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                    <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>On file</span>
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                              {formatDateNigerian(r.created_at)}
                            </td>
                            <td
                              className={`py-3.5 px-4 text-xs font-semibold capitalize whitespace-nowrap ${statusColor}`}
                            >
                              {canUpdate ? (
                                <select
                                  aria-label={`Change status for ${
                                    r.business_name || r.full_name
                                  }`}
                                  value={r.status}
                                  onChange={(e) =>
                                    requestStatusChange(
                                      r,
                                      e.target.value as VendorPartnerStatus
                                    )
                                  }
                                  className={`px-2 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg capitalize cursor-pointer ${statusColor}`}
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="suspended">Suspended</option>
                                </select>
                              ) : (
                                r.status
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(r)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                  <span>Details</span>
                                </button>
                                {canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRecord(r);
                                      setIsFormOpen(true);
                                    }}
                                    title="Edit Vendor / Partner"
                                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {paginatedRecords.map((r) => (
                    <div key={r.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(r)}
                            className="font-bold text-slate-900 hover:text-[#18b892] text-left cursor-pointer"
                          >
                            {r.business_name || r.full_name}
                          </button>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {formatTypeLabel(r.record_type)}
                            {r.business_name ? ` · ${r.full_name}` : ''}
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold capitalize shrink-0 ${
                            r.status === 'active'
                              ? 'text-emerald-700'
                              : r.status === 'suspended'
                              ? 'text-red-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {r.phone_number}
                        </span>
                        {r.cac_certificate_path && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 font-semibold">CAC On File</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(r)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Details</span>
                        </button>
                        {canViewDocuments && r.cac_certificate_path && (
                          <button
                            type="button"
                            disabled={isFetchingDocId === r.id}
                            onClick={() => handleQuickViewCac(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg cursor-pointer"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>View CAC</span>
                          </button>
                        )}
                        {canUpdate && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRecord(r);
                              setIsFormOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Footer */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums">
                      Showing {(safePage - 1) * pageSize + 1}–
                      {Math.min(safePage * pageSize, sortedRecords.length)} of{' '}
                      {sortedRecords.length} records
                    </span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      aria-label="Rows per page"
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <option value={10}>10 / page</option>
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>
                    <span className="px-2 font-mono tabular-nums font-semibold">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer disabled:opacity-40"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Quick CAC Signed URL Preview Modal */}
      {quickPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  CAC Certificate — {quickPreview.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Signed private link active for 5 minutes.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={quickPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#18b892] bg-emerald-50 hover:bg-emerald-100 rounded-lg whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Tab</span>
                </a>
                <button
                  type="button"
                  onClick={() => setQuickPreview(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[420px]">
              {quickPreview.isPdf ? (
                <iframe
                  src={quickPreview.url}
                  title="CAC Certificate Preview"
                  className="w-full h-[68vh] rounded-xl border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={quickPreview.url}
                  alt="CAC Certificate"
                  className="max-w-full max-h-[70vh] rounded-xl border border-slate-200 object-contain bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Registration / Edit Modal */}
      <VendorPartnerFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRecord(null);
        }}
        editingRecord={editingRecord}
        onSaved={(msg) => {
          showToast(msg);
          fetchDirectory(true);
        }}
      />

      {/* Confirmation Dialog */}
      <ConfirmActionModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant || 'warning'}
        isBusy={isConfirmBusy}
        onConfirm={() => {
          if (confirmState) confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};
