import React, { useState, useEffect, useCallback } from 'react';
import {
  FileQuestion,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserCheck,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  FolderKanban,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Send,
  User,
  History,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  ServiceRequestsService,
  ServiceRequestRecord,
  ServiceRequestStatus,
  SERVICE_REQUEST_STATUSES,
  CreateServiceRequestInput,
  ServiceRequestHistoryItem,
} from '../../services/serviceRequestsService';
import { WorkforceService, ProfileRecord } from '../../services/workforceService';

interface ServiceRequestsModuleProps {
  onBackToDashboard?: () => void;
  readOnly?: boolean;
}

export const ServiceRequestsModule: React.FC<ServiceRequestsModuleProps> = ({
  onBackToDashboard,
}) => {
  const { user, profile, currentRoleKey } = useAuth();
  const isLeadership = currentRoleKey === 'management' || currentRoleKey === 'executive_director';
  const isAdmin = currentRoleKey === 'admin' || isLeadership;

  const [requests, setRequests] = useState<ServiceRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');

  // Modals & Panels
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestRecord | null>(null);
  const [requestHistory, setRequestHistory] = useState<ServiceRequestHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Management Action Form State
  const [assigneeId, setAssigneeId] = useState('');
  const [assignedRole, setAssignedRole] = useState('supervisor');
  const [targetStatus, setTargetStatus] = useState<ServiceRequestStatus>('under_review');
  const [managementNote, setManagementNote] = useState('');
  const [inspectionNote, setInspectionNote] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isConvertingProject, setIsConvertingProject] = useState(false);

  // Assignable staff list
  const [staffList, setStaffList] = useState<ProfileRecord[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadRequests = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    const res = await ServiceRequestsService.getServiceRequests({
      search: searchQuery,
      status: statusFilter,
      serviceType: serviceTypeFilter,
    });

    if (res.error) setErrorMessage(res.error);
    else setRequests(res.data);

    setIsLoading(false);
    setIsRefreshing(false);
  }, [searchQuery, statusFilter, serviceTypeFilter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    // Load staff profiles for assignment
    WorkforceService.getAvailableProfiles().then((res) => {
      if (res.data) setStaffList(res.data);
    });
  }, []);

  const handleOpenDetail = async (req: ServiceRequestRecord) => {
    setSelectedRequest(req);
    setTargetStatus(req.status);
    setAssigneeId(req.assigned_to || '');
    setAssignedRole(req.assigned_role || 'supervisor');
    setManagementNote(req.management_comments || '');
    setInspectionNote(req.inspection_notes || '');

    setIsLoadingHistory(true);
    const hist = await ServiceRequestsService.getRequestHistory(req.id);
    setRequestHistory(hist);
    setIsLoadingHistory(false);
  };

  const handleUpdateStatusAndAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setIsSubmittingAction(true);
    const res = await ServiceRequestsService.updateServiceRequest(
      selectedRequest.id,
      {
        status: targetStatus,
        assigned_to: assigneeId || null,
        assigned_role: assignedRole || null,
        management_comments: managementNote.trim() || null,
        inspection_notes: inspectionNote.trim() || null,
      },
      user?.id
    );
    setIsSubmittingAction(false);

    if (res.success) {
      showToast('Service request updated successfully.');
      loadRequests(true);
      setSelectedRequest((prev) =>
        prev
          ? {
              ...prev,
              status: targetStatus,
              assigned_to: assigneeId || null,
              assigned_role: assignedRole || null,
              management_comments: managementNote.trim() || null,
              inspection_notes: inspectionNote.trim() || null,
            }
          : null
      );
    } else {
      showToast(res.error || 'Failed to update request.');
    }
  };

  const handleConvertToProject = async () => {
    if (!selectedRequest) return;
    if (
      !window.confirm(
        `Are you sure you want to convert service request [${selectedRequest.request_number}] into an active project?`
      )
    ) {
      return;
    }

    setIsConvertingProject(true);
    const res = await ServiceRequestsService.convertToProject(selectedRequest.id, user?.id);
    setIsConvertingProject(false);

    if (res.project_id) {
      showToast(`Service request successfully converted to Project!`);
      loadRequests(true);
      setSelectedRequest(null);
    } else {
      showToast(res.error || 'Conversion failed.');
    }
  };

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#18b892]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
            <FileQuestion className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#18b892] block mb-0.5">
              CUSTOMER COMMERCIAL INTAKE
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Walk-In Service Requests
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Register and track walk-in client enquiries, technical scoping, management review, and project conversions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => loadRequests(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 h-10 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-[#18b892] shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>+ New Service Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          <input
            type="text"
            placeholder="Search by customer name, phone, request code, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#18b892] transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
            >
              <option value="all">All Statuses ({requests.length})</option>
              {SERVICE_REQUEST_STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold text-slate-600 shrink-0">Service:</span>
            <select
              value={serviceTypeFilter}
              onChange={(e) => setServiceTypeFilter(e.target.value)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-[#18b892] cursor-pointer"
            >
              <option value="all">All Services</option>
              <option value="Interior Design & Fit-out">Interior Design &amp; Fit-out</option>
              <option value="POP & Wall Screeding">POP &amp; Wall Screeding</option>
              <option value="Painting & Surface Coating">Painting &amp; Coating</option>
              <option value="Custom Cabinetry & Woodwork">Cabinetry &amp; Woodwork</option>
              <option value="Flooring & Tiling">Flooring &amp; Tiling</option>
              <option value="Full Turnkey Renovation">Full Turnkey Renovation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 shadow-2xs animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg border border-slate-100" />
            ))}
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 shadow-2xs text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center mx-auto mb-4 border border-[#18b892]/20">
            <FileQuestion className="w-7 h-7 shrink-0" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Service Requests Recorded</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
            Walk-in client enquiries and technical inspection requests registered by the Admin will appear here for review.
          </p>
          {isAdmin && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#18b892] hover:bg-[#139c7b] text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span>+ Register First Walk-In Request</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 min-w-[130px]">Request Code</th>
                  <th className="py-3.5 px-3 min-w-[180px]">Customer &amp; Contact</th>
                  <th className="py-3.5 px-3 min-w-[170px]">Requested Service</th>
                  <th className="py-3.5 px-3 min-w-[180px]">Location / Address</th>
                  <th className="py-3.5 px-3 min-w-[120px]">Enquiry Date</th>
                  <th className="py-3.5 px-3 min-w-[130px]">Status</th>
                  <th className="py-3.5 px-3 min-w-[150px]">Assigned Personnel</th>
                  <th className="py-3.5 px-4 text-right min-w-[120px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const statusObj =
                    SERVICE_REQUEST_STATUSES.find((s) => s.value === req.status) || {
                      label: req.status,
                      badgeClasses: 'bg-slate-100 text-slate-700',
                    };

                  return (
                    <tr
                      key={req.id}
                      onClick={() => handleOpenDetail(req)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-800 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/80 text-xs whitespace-nowrap group-hover:text-[#18b892] group-hover:border-[#18b892]/30 transition-colors">
                          {req.request_number}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 text-sm">{req.customer_name}</div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{req.phone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-medium text-slate-800 text-sm">{req.service_type}</span>
                        {req.estimated_budget && (
                          <div className="text-xs text-[#18b892] font-mono font-bold mt-0.5">
                            Est: ₦{Number(req.estimated_budget).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-slate-600 truncate max-w-[200px] text-xs sm:text-sm" title={req.project_address}>
                          {req.project_address}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-600 text-xs">
                        {req.enquiry_date}
                      </td>
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${statusObj.badgeClasses}`}
                        >
                          {statusObj.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        {req.assignee ? (
                          <div className="flex items-center gap-1.5 text-slate-800 font-medium text-xs sm:text-sm">
                            <UserCheck className="w-4 h-4 text-[#18b892] shrink-0" />
                            <span className="truncate max-w-[140px]">{req.assignee.display_name || 'Staff Member'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(req)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#18b892] bg-[#18b892]/10 hover:bg-[#18b892]/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>Review</span>
                          <span className="shrink-0">&rarr;</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-xs sm:text-sm text-slate-500 flex items-center justify-between">
            <span>
              Showing <strong className="text-slate-800">{requests.length}</strong> request{requests.length === 1 ? '' : 's'}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Davejoe Client Commercial Intake
            </span>
          </div>
        </div>
      )}

      {/* CREATE MODAL (FOR ADMIN) */}
      {isCreateModalOpen && (
        <CreateServiceRequestModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(msg) => {
            showToast(msg);
            loadRequests(true);
          }}
        />
      )}

      {/* DETAIL & MANAGEMENT REVIEW DRAWER / MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden select-auto">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  Service Request Dossier
                </span>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>{selectedRequest.request_number}</span>
                  <span className="text-xs font-normal text-slate-500">
                    ({selectedRequest.customer_name})
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Customer Info Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                  CLIENT DETAILS &amp; LOCATION
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Customer Name</span>
                    <span className="font-bold text-slate-900">{selectedRequest.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Contact Phone</span>
                    <span className="font-mono font-semibold text-slate-900 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-[#18b892]" />
                      {selectedRequest.phone}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Service Requested</span>
                    <span className="font-semibold text-slate-900">{selectedRequest.service_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Estimated Budget</span>
                    <span className="font-bold text-[#18b892]">
                      {selectedRequest.estimated_budget
                        ? `₦${Number(selectedRequest.estimated_budget).toLocaleString()}`
                        : 'Not specified'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Project Location / Site Address</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {selectedRequest.project_address}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scope & Requirements Description */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Requirements Description
                </span>
                <div className="p-3.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedRequest.requirements_description}
                </div>
              </div>

              {selectedRequest.internal_notes && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Internal Admin Notes
                  </span>
                  <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 whitespace-pre-wrap">
                    {selectedRequest.internal_notes}
                  </div>
                </div>
              )}

              {/* MANAGEMENT ACTION FORM (FOR LEADERSHIP OR REVIEW) */}
              <div className="p-5 bg-white rounded-xl border-2 border-[#18b892]/20 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#18b892]" />
                    <span>Management Review &amp; Assignment</span>
                  </h3>
                  <span className="text-[10px] font-bold text-[#18b892] uppercase">
                    Status: {selectedRequest.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <form onSubmit={handleUpdateStatusAndAssign} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Update Status</label>
                      <select
                        value={targetStatus}
                        onChange={(e) => setTargetStatus(e.target.value as ServiceRequestStatus)}
                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#18b892]"
                      >
                        {SERVICE_REQUEST_STATUSES.map((st) => (
                          <option key={st.value} value={st.value}>
                            {st.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Assign Staff / Supervisor
                      </label>
                      <select
                        value={assigneeId}
                        onChange={(e) => setAssigneeId(e.target.value)}
                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#18b892]"
                      >
                        <option value="">-- Select Personnel --</option>
                        {staffList.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.display_name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || st.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Inspection / Technical Assessment Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      placeholder="Specify site visit instructions, measurement checklist, structural tests..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#18b892]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Management Comments &amp; Quotation Directives
                    </label>
                    <textarea
                      rows={2}
                      value={managementNote}
                      onChange={(e) => setManagementNote(e.target.value)}
                      placeholder="Record pricing directives, approval notes, or client conditions..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#18b892]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingAction}
                      className="px-4 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingAction ? 'Saving Changes...' : 'Save & Update Dossier'}
                    </button>

                    {/* Convert to Project action if approved and not yet converted */}
                    {selectedRequest.status !== 'converted_to_project' && isLeadership && (
                      <button
                        type="button"
                        onClick={handleConvertToProject}
                        disabled={isConvertingProject}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <FolderKanban className="w-3.5 h-3.5 text-[#18b892]" />
                        <span>{isConvertingProject ? 'Converting...' : 'Convert to Project'}</span>
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* AUDIT TIMELINE */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>Dossier History &amp; Actions Log</span>
                </span>
                {isLoadingHistory ? (
                  <div className="text-xs text-slate-400">Loading history...</div>
                ) : requestHistory.length === 0 ? (
                  <div className="p-3 bg-slate-50 text-slate-400 text-xs rounded-lg border border-slate-100">
                    Created on {selectedRequest.created_at?.split('T')[0]}.
                  </div>
                ) : (
                  <div className="space-y-2 border-l-2 border-slate-200 pl-4 ml-1">
                    {requestHistory.map((h) => (
                      <div key={h.id} className="relative text-xs">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#18b892] absolute -left-[21px] top-1" />
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-700 capitalize">{h.action.replace(/_/g, ' ')}</span>
                          <span>{h.created_at?.split('T')[0]}</span>
                        </div>
                        <p className="text-slate-600 mt-0.5">{h.notes || 'Status changed'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// CREATE SERVICE REQUEST MODAL
// ==============================================================================
interface CreateServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (msg: string) => void;
}

const CreateServiceRequestModal: React.FC<CreateServiceRequestModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<CreateServiceRequestInput>({
    customer_name: '',
    phone: '',
    email: '',
    project_address: '',
    service_type: 'Interior Design & Fit-out',
    requirements_description: '',
    estimated_budget: null,
    internal_notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.customer_name.trim()) {
      setError('Please enter the customer name.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Please enter the customer contact phone.');
      return;
    }
    if (!formData.project_address.trim()) {
      setError('Please enter the site location or project address.');
      return;
    }
    if (!formData.requirements_description.trim()) {
      setError('Please provide a description of the customer requirements.');
      return;
    }

    setIsSubmitting(true);
    const res = await ServiceRequestsService.createServiceRequest(formData, user?.id);
    setIsSubmitting(false);

    if (res.data) {
      onCreated(`Service Request [${res.data.request_number}] submitted for Management review.`);
      onClose();
    } else {
      setError(res.error || 'Failed to submit request.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto select-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Register Walk-In Service Request</h2>
            <p className="text-xs text-slate-500">
              Record new customer enquiry directly into the system for leadership review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Customer Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Chief Adeleke Johnson"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="e.g. 0803 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                placeholder="client@example.com"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Requested Service *</label>
              <select
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              >
                <option value="Interior Design & Fit-out">Interior Design &amp; Fit-out</option>
                <option value="POP & Wall Screeding">POP &amp; Wall Screeding</option>
                <option value="Painting & Surface Coating">Painting &amp; Surface Coating</option>
                <option value="Custom Cabinetry & Woodwork">Custom Cabinetry &amp; Woodwork</option>
                <option value="Flooring & Tiling">Flooring &amp; Tiling</option>
                <option value="Full Turnkey Renovation">Full Turnkey Renovation</option>
                <option value="Architectural Diffusers & Vases">Architectural Diffusers &amp; Vases</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Site Location / Project Address *</label>
            <input
              type="text"
              required
              placeholder="e.g. Plot 14, Admiralty Way, Lekki Phase 1, Lagos"
              value={formData.project_address}
              onChange={(e) => setFormData({ ...formData, project_address: e.target.value })}
              className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Requirements Description *</label>
            <textarea
              required
              rows={3}
              placeholder="Detail client specifications, measurements, room dimensions, special colour requests..."
              value={formData.requirements_description}
              onChange={(e) => setFormData({ ...formData, requirements_description: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Estimated Budget (₦)</label>
              <input
                type="number"
                placeholder="e.g. 3500000"
                value={formData.estimated_budget || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_budget: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Internal Admin Notes</label>
              <input
                type="text"
                placeholder="Walk-in referral, urgency, client availability..."
                value={formData.internal_notes || ''}
                onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#18b892]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#18b892] hover:bg-[#139c7b] text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
