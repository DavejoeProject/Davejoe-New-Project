import React from 'react';
import { X, Calendar, Clock, MapPin, Building, User, ShieldCheck } from 'lucide-react';
import { AttendanceRecordItem, ATTENDANCE_STATUS_CONFIG, formatTimeFromIso } from '../../services/attendanceService';
import { formatNigerianDate } from '../../services/materialsService';

interface AttendanceDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecordItem | null;
}

export const AttendanceDetailDrawer: React.FC<AttendanceDetailDrawerProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  if (!isOpen || !record) return null;

  const statusConfig = ATTENDANCE_STATUS_CONFIG[record.status] || ATTENDANCE_STATUS_CONFIG.present;
  const prof = record.workforce_members?.profiles;
  const workerName =
    prof?.display_name ||
    `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
    `Artisan ${record.workforce_members?.workforce_code || '---'}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-sm">
              {workerName[0] || 'A'}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">{workerName}</h3>
              <p className="text-xs text-slate-500 font-mono">
                Code: {record.workforce_members?.workforce_code || '---'} &bull; {record.workforce_members?.trade || 'Artisan'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Banner */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Attendance State
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.badgeClasses}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusConfig.dotClasses}`} />
                {statusConfig.label}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Shift Status
              </span>
              <span className="text-xs font-bold text-slate-800">
                {record.is_clocked_out ? 'Clocked Out (Shift Ended)' : 'Currently On Site'}
              </span>
            </div>
          </div>

          {/* Timekeeping Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#01875F]" />
              Timekeeping Audit
            </h4>
            <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">Date:</span>
                <span className="text-xs font-bold text-slate-800">
                  {formatNigerianDate(record.attendance_date)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">Clock In:</span>
                <span className="text-xs font-bold font-mono text-emerald-700">
                  {formatTimeFromIso(record.clock_in_time)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">Clock Out:</span>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {formatTimeFromIso(record.clock_out_time)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">GPS Verification:</span>
                <span className="text-xs font-medium text-slate-700">
                  {record.latitude && record.longitude ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <MapPin className="w-3 h-3" />
                      Captured ({record.latitude.toFixed(3)}, {record.longitude.toFixed(3)})
                    </span>
                  ) : (
                    <span className="text-slate-400">Gate Verified</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#01875F]" />
              Project Assignment
            </h4>
            <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Project Name:</span>
                <span className="font-bold text-slate-900">{record.projects?.name || 'Unassigned Project'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Project Code:</span>
                <span className="font-mono font-bold text-slate-800">{record.projects?.project_code || 'PRJ'}</span>
              </div>
            </div>
          </div>

          {/* Audit Ledger */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#01875F]" />
              Audit Verification
            </h4>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Record ID:</span>
                <span className="font-mono text-[11px] text-slate-600">{record.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Created Timestamp:</span>
                <span className="font-mono text-[11px] text-slate-600">{record.created_at}</span>
              </div>
              {record.updated_at && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Updated Timestamp:</span>
                  <span className="font-mono text-[11px] text-slate-600">{record.updated_at}</span>
                </div>
              )}
              {record.recorded_by && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Recorded By (UID):</span>
                  <span className="font-mono text-[11px] text-slate-600">{record.recorded_by}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
