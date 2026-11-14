import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  HardHat,
  Phone,
  MapPin,
  Shield,
  Landmark,
  Calendar,
  FolderKanban,
  Edit3,
  Plus,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  WorkforceDirectoryRecord,
  WorkforceProtectedDetails,
  WorkforceDirectoryService,
  maskBankAccountNumber,
  ContractWorkforceStatus,
} from '../../services/workforceDirectoryService';
import { formatDateNigerian } from '../../services/dashboardService';
import { ConfirmActionModal } from '../common/ConfirmActionModal';

interface WorkforceDirectoryProfileProps {
  memberId: string;
  canUpdate: boolean;
  canAssign: boolean;
  canViewBanking: boolean;
  initialFocus?: 'profile' | 'history';
  onBack: () => void;
  onEdit: (member: WorkforceDirectoryRecord) => void;
  onAssignProject: (member: WorkforceDirectoryRecord) => void;
  onStatusUpdated: (message: string) => void;
  refreshTrigger?: number;
}

export const WorkforceDirectoryProfile: React.FC<WorkforceDirectoryProfileProps> = ({
  memberId,
  canUpdate,
  canAssign,
  canViewBanking,
  initialFocus = 'profile',
  onBack,
  onEdit,
  onAssignProject,
  onStatusUpdated,
  refreshTrigger = 0,
}) => {
  const [member, setMember] = useState<WorkforceDirectoryRecord | null>(null);
  const [protectedDetails, setProtectedDetails] = useState<WorkforceProtectedDetails | null>(null);
  const [protectedRestricted, setProtectedRestricted] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFullAccount, setShowFullAccount] = useState(false);
  const [isActionBusy, setIsActionBusy] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);

  const historySectionRef = useRef<HTMLDivElement | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    const res = await WorkforceDirectoryService.getMemberById(memberId);
    if (res.error) {
      setErrorMsg(res.error);
      setIsLoading(false);
      return;
    }

    setMember(res.data);

    if (canViewBanking) {
      const protRes = await WorkforceDirectoryService.getWorkforceProtectedDetails(memberId);
      if (protRes.data) {
        setProtectedDetails(protRes.data);
        setProtectedRestricted(false);
      } else if (protRes.restricted) {
        setProtectedRestricted(true);
      }
    } else {
      setProtectedDetails(null);
      setProtectedRestricted(true);
    }

    setIsLoading(false);
  }, [memberId, canViewBanking]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, refreshTrigger]);

  useEffect(() => {
    if (!isLoading && initialFocus === 'history' && historySectionRef.current) {
      historySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isLoading, initialFocus]);

  const requestStatusChange = (nextStatus: ContractWorkforceStatus) => {
    if (!member || member.status === nextStatus) return;

    const variant =
      nextStatus === 'suspended' ? 'danger' : nextStatus === 'inactive' ? 'warning' : 'primary';
    const verb =
      nextStatus === 'active'
        ? 'Activate'
        : nextStatus === 'suspended'
        ? 'Suspend'
        : 'Deactivate';

    setConfirmState({
      title: `${verb} Workforce Member`,
      message: `Are you sure you want to change ${member.full_name}'s status from "${member.status}" to "${nextStatus}"? Historical assignments and audit records will be preserved.`,
      confirmLabel: verb,
      variant,
      onConfirm: async () => {
        setIsActionBusy(true);
        const res = await WorkforceDirectoryService.updateStatus(
          member.id,
          nextStatus,
          member.status
        );
        setIsActionBusy(false);
        setConfirmState(null);
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        onStatusUpdated(`${member.full_name} marked as ${nextStatus}.`);
        await loadProfile();
      },
    });
  };

  const requestAssignmentOutcome = (
    assignmentId: string,
    projectName: string,
    nextStatus: 'completed' | 'cancelled'
  ) => {
    setConfirmState({
      title: nextStatus === 'completed' ? 'Complete Project Assignment' : 'Cancel Project Assignment',
      message: `Confirm marking ${member?.full_name}'s assignment on "${projectName}" as ${nextStatus}? This preserves the assignment in Assignment History.`,
      confirmLabel: nextStatus === 'completed' ? 'Mark Completed' : 'Cancel Assignment',
      variant: nextStatus === 'cancelled' ? 'warning' : 'primary',
      onConfirm: async () => {
        setIsActionBusy(true);
        const res = await WorkforceDirectoryService.updateAssignmentStatus(
          assignmentId,
          nextStatus
        );
        setIsActionBusy(false);
        setConfirmState(null);
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        onStatusUpdated(`Project assignment marked as ${nextStatus}. Historical record preserved.`);
        await loadProfile();
      },
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-slate-100 rounded" />
        <div className="h-24 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  if (errorMsg || !member) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#18b892] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Back to Workforce Directory</span>
        </button>
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg || 'Workforce profile could not be loaded.'}</span>
        </div>
      </div>
    );
  }

  const allAssignments = member.assignments || [];
  const currentAssignments = allAssignments.filter(
    (a) => (a.assignment_status || '').toLowerCase() === 'active'
  );
  const previousAssignments = allAssignments.filter(
    (a) => (a.assignment_status || '').toLowerCase() !== 'active'
  );

  const statusColor =
    member.status === 'active'
      ? 'text-emerald-700'
      : member.status === 'suspended'
      ? 'text-red-700'
      : 'text-slate-600';

  const displayNok = protectedDetails?.next_of_kin ?? member.next_of_kin;
  const displayNokPhone = protectedDetails?.next_of_kin_phone ?? member.next_of_kin_phone;
  const displayBankName = protectedDetails?.bank_name ?? member.bank_name;
  const displayAccountName = protectedDetails?.account_name ?? member.account_name;
  const displayAccountNumber = protectedDetails?.account_number ?? member.account_number;

  return (
    <div className="space-y-6 pb-8">
      {/* Top Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18b892] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>Back to Workforce Directory</span>
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
                <HardHat className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 truncate">{member.full_name}</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>Contract Workforce</span>
                  <span aria-hidden="true">·</span>
                  <span className={`font-semibold capitalize ${statusColor}`}>
                    {member.status}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Registered {formatDateNigerian(member.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canAssign && (
              <button
                type="button"
                onClick={() => onAssignProject(member)}
                disabled={member.status !== 'active'}
                title={
                  member.status !== 'active'
                    ? 'Reactivate worker before assigning to a project'
                    : 'Assign to Project'
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Assign to Project</span>
              </button>
            )}

            {canUpdate && (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(member)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-4 h-4 shrink-0" />
                  <span>Edit Details</span>
                </button>

                <select
                  aria-label="Change workforce status"
                  value={member.status}
                  disabled={isActionBusy}
                  onChange={(e) =>
                    requestStatusChange(e.target.value as ContractWorkforceStatus)
                  }
                  className="px-3.5 py-2 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#18b892] cursor-pointer"
                >
                  <option value="active">Status: Active</option>
                  <option value="inactive">Status: Inactive</option>
                  <option value="suspended">Status: Suspended</option>
                </select>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Profile Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact & Registration Notes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#18b892] shrink-0" />
            <span>Contact &amp; Location</span>
          </h3>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-slate-400">Phone Number</dt>
              <dd className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                {member.phone_number}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Residential Address</dt>
              <dd className="text-slate-700 mt-0.5 flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{member.address || 'Not provided'}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Registration Notes</dt>
              <dd className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {member.registration_notes || 'No registration notes recorded.'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-400">Registration Date</dt>
              <dd className="font-mono tabular-nums text-slate-700 mt-0.5">
                {formatDateNigerian(member.created_at)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Next of Kin (Protected) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#18b892] shrink-0" />
            <span>Next of Kin</span>
          </h3>
          {!canViewBanking || protectedRestricted ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Next of kin details are restricted to authorized workforce &amp; administrative personnel.
              </span>
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-400">Next of Kin Name</dt>
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
                <dt className="text-xs font-medium text-slate-400">System Account Link</dt>
                <dd className="text-xs text-slate-500 mt-0.5">
                  External contract artisan — no login credentials
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/* Banking Information (Protected) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#18b892] shrink-0" />
              <span>Banking Details</span>
            </h3>
            {canViewBanking && !protectedRestricted && displayAccountNumber && (
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

          {!canViewBanking || protectedRestricted ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Banking details require <code className="font-mono">workforce.banking.view</code> authorization.
              </span>
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
                <dd className="text-slate-700 mt-0.5">{displayAccountName || 'Not recorded'}</dd>
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

      {/* Current Project Assignments */}
      <div
        ref={historySectionRef}
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-[#18b892] shrink-0" />
              <span>Current Project Assignments ({currentAssignments.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Active site deployments for this contract worker.
            </p>
          </div>
          {canAssign && member.status === 'active' && (
            <button
              type="button"
              onClick={() => onAssignProject(member)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#18b892] bg-emerald-50 hover:bg-emerald-100 border border-[#18b892]/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Assign Project</span>
            </button>
          )}
        </div>

        {currentAssignments.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No active project assignments right now.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-4">Project</th>
                  <th className="py-2.5 px-4">Assigned Date</th>
                  <th className="py-2.5 px-4">Expected Completion</th>
                  <th className="py-2.5 px-4">Notes</th>
                  {canAssign && <th className="py-2.5 pl-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 pr-4 font-semibold text-slate-900">
                      <div>{a.project?.name || 'Project'}</div>
                      {a.project?.project_code && (
                        <div className="text-xs font-mono text-slate-400">
                          {a.project.project_code}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {formatDateNigerian(a.assigned_at)}
                    </td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                      {a.expected_end_date ? formatDateNigerian(a.expected_end_date) : 'Open-ended'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                      {a.assignment_notes || '—'}
                    </td>
                    {canAssign && (
                      <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isActionBusy}
                            onClick={() =>
                              requestAssignmentOutcome(
                                a.id,
                                a.project?.name || 'Project',
                                'completed'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Complete</span>
                          </button>
                          <button
                            type="button"
                            disabled={isActionBusy}
                            onClick={() =>
                              requestAssignmentOutcome(
                                a.id,
                                a.project?.name || 'Project',
                                'cancelled'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                          >
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Previous Project Assignments History */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Previous Project Assignments ({previousAssignments.length})</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Preserved historical record of completed and cancelled assignments.
          </p>
        </div>

        {previousAssignments.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No previous assignments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-4">Project</th>
                  <th className="py-2.5 px-4">Assigned</th>
                  <th className="py-2.5 px-4">Ended</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 pl-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previousAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-4 font-semibold text-slate-800">
                      {a.project?.name || 'Project'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                      {formatDateNigerian(a.assigned_at)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                      {a.actual_end_date ? formatDateNigerian(a.actual_end_date) : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold capitalize text-slate-700 whitespace-nowrap">
                      {a.assignment_status}
                    </td>
                    <td className="py-3 pl-4 text-xs text-slate-500">
                      {a.assignment_notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmActionModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant || 'warning'}
        isBusy={isActionBusy}
        onConfirm={() => {
          if (confirmState) confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};
