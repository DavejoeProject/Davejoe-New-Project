import React from 'react';
import {
  X,
  User,
  Phone,
  Briefcase,
  AlertTriangle,
  FolderKanban,
  Calendar,
  FileText,
  Shield,
  Edit3,
  UserPlus,
} from 'lucide-react';
import {
  WorkforceMemberRecord,
  WORKFORCE_STATUS_CONFIG,
} from '../../services/workforceService';
import { formatDateNigerian } from '../../services/dashboardService';

interface WorkforceDetailModalProps {
  member: WorkforceMemberRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEdit: (member: WorkforceMemberRecord) => void;
  onOpenAssign: (member: WorkforceMemberRecord) => void;
}

export const WorkforceDetailModal: React.FC<WorkforceDetailModalProps> = ({
  member,
  isOpen,
  onClose,
  onOpenEdit,
  onOpenAssign,
}) => {
  if (!isOpen || !member) return null;

  const prof = member.profiles;
  const workerName =
    prof?.display_name ||
    (prof?.first_name || prof?.last_name
      ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
      : `Artisan ${member.workforce_code}`);

  const statusCfg = WORKFORCE_STATUS_CONFIG[member.status] || {
    label: member.status,
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClasses: 'bg-slate-400',
  };

  const assignments = member.assignments || [];
  const activeAssignment = member.active_assignment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-base shadow-2xs">
              {prof?.avatar_url ? (
                <img
                  src={prof.avatar_url}
                  alt={workerName}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {member.workforce_code}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusCfg.badgeClasses}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClasses}`} />
                  {statusCfg.label}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {member.trade}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight mt-1">
                {workerName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Quick Metrics & Current Deployment */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              CURRENT DEPLOYMENT STATUS
            </span>
            {activeAssignment ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {activeAssignment.projects?.project_code || '—'}
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {activeAssignment.projects?.name || 'Project'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Role: <span className="font-medium text-slate-700">{activeAssignment.role_on_project || member.trade}</span>
                      {activeAssignment.start_date && (
                        <span> &bull; Started: {formatDateNigerian(activeAssignment.start_date)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-center">
                  Actively Deployed
                </span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Available / Unassigned
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Not currently linked to any active construction site roster.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAssign(member);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Deploy to Project</span>
                </button>
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Contact Details */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#01875F]" />
                <span>Contact Details</span>
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Phone Number:</span>
                  <span className="font-medium text-slate-800 font-mono">
                    {member.phone || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Emergency Contact:</span>
                  <span className="font-medium text-slate-800">
                    {member.emergency_contact_name || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Emergency Phone:</span>
                  <span className="font-medium text-slate-800 font-mono">
                    {member.emergency_contact_phone || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Profile & System Details */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#01875F]" />
                <span>Roster &amp; Profile</span>
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Registered On:</span>
                  <span className="font-medium text-slate-800">
                    {formatDateNigerian(member.created_at)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Linked Account:</span>
                  <span className="font-medium text-slate-800">
                    {prof?.job_title ? `${prof.job_title} (Profile)` : prof ? 'Linked Profile' : 'Standalone Artisan'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Trade Specialty:</span>
                  <span className="font-medium text-slate-800">{member.trade}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {member.notes && (
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#01875F]" />
                <span>Notes & Remarks</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                {member.notes}
              </p>
            </div>
          )}

          {/* Project Assignments History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#01875F]" />
                <span>Project Assignment History ({assignments.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAssign(member);
                }}
                className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Assign to Project</span>
              </button>
            </div>

            {assignments.length === 0 ? (
              <div className="p-6 bg-slate-50/50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                No site assignments recorded in the database yet.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {assignments.map((assign) => (
                  <div
                    key={assign.id}
                    className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {assign.projects?.project_code || 'PRJ'}
                        </span>
                        <span className="font-bold text-slate-900">
                          {assign.projects?.name || 'Project'}
                        </span>
                        {assign.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Completed
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-3 text-[11.5px]">
                        <span>Role: {assign.role_on_project || member.trade}</span>
                        {assign.start_date && (
                          <span>From: {formatDateNigerian(assign.start_date)}</span>
                        )}
                        {assign.end_date && <span>To: {formatDateNigerian(assign.end_date)}</span>}
                      </div>
                      {assign.notes && (
                        <p className="text-[11px] text-slate-400 mt-1 italic">
                          Notes: {assign.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenEdit(member);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
            <span>Edit Member</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
