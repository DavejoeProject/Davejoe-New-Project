import React, { useState, useEffect, useCallback } from 'react';
import {
  Handshake,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit3,
  UserX,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Phone,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  VendorPartnerRecord,
  VendorsPartnersMetrics,
  VendorsPartnersService,
  VendorPartnerStatus,
} from '../../services/vendorsPartnersService';
import { maskBankAccountNumber } from '../../services/workforceDirectoryService';
import { VendorPartnerFormModal } from './VendorPartnerFormModal';
import { VendorPartnerProfile } from './VendorPartnerProfile';

interface VendorsPartnersModuleProps {
  onBackToDashboard?: () => void;
}

const formatTypeLabel = (val: string): string => {
  const norm = (val || 'vendor').toLowerCase();
  if (norm === 'both') return 'Vendor & Partner';
  if (norm === 'partner') return 'Partner';
  return 'Vendor';
};

export const VendorsPartnersModule: React.FC<VendorsPartnersModuleProps> = ({
  onBackToDashboard,
}) => {
  const { user, currentRoleKey, hasPermission } = useAuth();

  const canManage =
    currentRoleKey === 'admin' ||
    currentRoleKey === 'management' ||
    hasPermission('vendors_partners.manage');

  const canView =
    canManage ||
    currentRoleKey === 'executive_director' ||
    hasPermission('vendors_partners.view');

  const canViewFinancials =
    currentRoleKey === 'admin' ||
    currentRoleKey === 'management' ||
    hasPermission('vendors_partners.view_financials');

  const canViewDocuments =
    currentRoleKey === 'admin' ||
    currentRoleKey === 'management' ||
    hasPermission('vendors_partners.view_documents');

  const [records, setRecords] = useState<VendorPartnerRecord[]>([]);
  const [metrics, setMetrics] = useState<VendorsPartnersMetrics>({
    totalCount: 0,
    activeCount: 0,
    vendorOnlyCount: 0,
    partnerOnlyCount: 0,
    bothCount: 0,
    cacUploadedCount: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'vendor' | 'partner' | 'both'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');

  // Sub-views & Modal
  const [selectedRecord, setSelectedRecord] = useState<VendorPartnerRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VendorPartnerRecord | null>(null);

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

  const handleToggleStatus = async (
    record: VendorPartnerRecord,
    nextStatus: VendorPartnerStatus
  ) => {
    const res = await VendorsPartnersService.updateStatus(
      record.id,
      nextStatus,
      user?.id,
      record.status
    );
    if (res.error) {
      setErrorMsg(res.error);
      return;
    }
    showToast(`${record.business_name || record.full_name} status changed to ${nextStatus}.`);
    fetchDirectory(true);
  };

  if (!canView) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900">Access Restricted</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          You do not hold the required authorization to access the Vendors &amp; Partners Directory.
        </p>
      </div>
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
          canManage={canManage}
          canViewFinancials={canViewFinancials}
          canViewDocuments={canViewDocuments}
          actorUserId={user?.id}
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
                Commercial suppliers, trade partners, settlement accounts, and private CAC compliance records.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => fetchDirectory(true)}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? 'animate-spin text-[#18b892]' : ''}`} />
                <span>Refresh</span>
              </button>

              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setIsFormOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl shadow-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Register Vendor / Partner</span>
                </button>
              )}
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Total Registered</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.totalCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-emerald-700">Active</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {metrics.activeCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Vendors</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-800 mt-1">
                {metrics.vendorOnlyCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-500">Partners</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-800 mt-1">
                {metrics.partnerOnlyCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-[#18b892]">Both</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.bothCount}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <div className="text-xs font-semibold text-slate-600">CAC On File</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {metrics.cacUploadedCount}
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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
            ) : records.length === 0 ? (
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
                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRecord(null);
                      setIsFormOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl cursor-pointer"
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
                        <th className="py-3 px-4">Business / Contact</th>
                        <th className="py-3 px-4">Classification</th>
                        <th className="py-3 px-4">Phone &amp; Email</th>
                        <th className="py-3 px-4">Settlement Account</th>
                        <th className="py-3 px-4">CAC</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.map((r) => {
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
                                <div className="text-slate-500 truncate max-w-[200px]">
                                  {r.email_address}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                              {!canViewFinancials ? (
                                <span className="text-slate-400">Restricted</span>
                              ) : r.bank_name ? (
                                <div>
                                  <div className="font-medium text-slate-800">{r.bank_name}</div>
                                  <div className="font-mono tabular-nums text-slate-500">
                                    {maskBankAccountNumber(r.account_number)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">Not set</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                              {r.cac_certificate_path ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                  <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>On file</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </td>
                            <td className={`py-3.5 px-4 text-xs font-semibold capitalize whitespace-nowrap ${statusColor}`}>
                              {r.status}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(r)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                  <span>Profile</span>
                                </button>
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRecord(r);
                                        setIsFormOpen(true);
                                      }}
                                      title="Edit"
                                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    {r.status === 'active' ? (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStatus(r, 'inactive')}
                                        title="Deactivate"
                                        className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                      >
                                        <UserX className="w-3.5 h-3.5" />
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleStatus(r, 'active')}
                                        title="Reactivate"
                                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
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
                  {records.map((r) => (
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
                          <span>View Profile</span>
                        </button>
                        {canManage && (
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
              </>
            )}
          </div>
        </>
      )}

      {/* Registration / Edit Modal */}
      <VendorPartnerFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingRecord(null);
        }}
        editingRecord={editingRecord}
        actorUserId={user?.id}
        onSaved={(msg) => {
          showToast(msg);
          fetchDirectory(true);
        }}
      />
    </div>
  );
};
