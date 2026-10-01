import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Clock, AlertTriangle, Activity, Phone, Tag } from 'lucide-react';
import {
  ProjectWorkforceItem,
  WorkerDetailRecords,
  ProjectControlService,
} from '../../services/projectControlService';
import { formatDateNigerian } from '../../services/dashboardService';

interface WorkerDetailModalProps {
  projectId: string;
  assignment: ProjectWorkforceItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkerDetailModal: React.FC<WorkerDetailModalProps> = ({
  projectId,
  assignment,
  isOpen,
  onClose,
}) => {
  const [details, setDetails] = useState<WorkerDetailRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'productivity' | 'overtime' | 'conduct'>('attendance');

  useEffect(() => {
    if (!isOpen || !assignment) return;
    setLoading(true);

    async function load() {
      const res = await ProjectControlService.getWorkerDetailForProject(
        projectId,
        assignment!.workforce_member_id
      );
      if (res.data) {
        setDetails(res.data);
      }
      setLoading(false);
    }

    load();
  }, [isOpen, assignment, projectId]);

  if (!isOpen || !assignment) return null;

  const wf = assignment.workforce_members;
  const prof = wf?.profiles;
  const workerName =
    prof?.display_name ||
    (prof?.first_name || prof?.last_name
      ? `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim()
      : `Worker ${wf?.workforce_code || ''}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {wf?.workforce_code || '—'}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {wf?.trade || 'Artisan'}
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

        {/* Worker Summary Bar */}
        <div className="px-6 py-3 bg-slate-50/40 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Status</span>
            <span className="font-semibold text-emerald-700 capitalize">{wf?.status || 'Active'}</span>
          </div>
          <div>
            <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Type</span>
            <span className="font-semibold text-slate-800">{wf?.workforce_type || 'Artisan'}</span>
          </div>
          <div>
            <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Assigned Start</span>
            <span className="font-mono text-slate-700">
              {assignment.start_date ? formatDateNigerian(assignment.start_date) : '—'}
            </span>
          </div>
          <div>
            <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Phone</span>
            <span className="font-mono text-slate-700">{wf?.phone || '—'}</span>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2 overflow-x-auto">
          {[
            { key: 'attendance', label: 'Attendance', count: details?.attendance.length ?? 0 },
            { key: 'productivity', label: 'Productivity', count: details?.productivity.length ?? 0 },
            { key: 'overtime', label: 'Overtime', count: details?.overtime.length ?? 0 },
            { key: 'conduct', label: 'Conduct', count: details?.conduct.length ?? 0 },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-[#01875F] text-[#01875F]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-6 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : activeTab === 'attendance' ? (
            details?.attendance.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No attendance records for this worker on this project.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {details?.attendance.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-medium text-slate-900">
                        {formatDateNigerian(a.attendance_date)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'productivity' ? (
            details?.productivity.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No productivity entries recorded for this worker on this project.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {details?.productivity.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">
                        {p.count != null ? `${p.count} ${p.unit_of_measure || 'units'}` : 'Task activity'}
                      </div>
                      {p.notes && <p className="text-[11px] text-slate-400">{p.notes}</p>}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">
                      {p.work_date ? formatDateNigerian(p.work_date) : formatDateNigerian(p.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'overtime' ? (
            details?.overtime.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No overtime requests logged for this worker on this project.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {details?.overtime.map((o) => (
                  <div key={o.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{o.requested_hours} Hours</span>
                      {o.reason && <p className="text-[11px] text-slate-400">{o.reason}</p>}
                    </div>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 capitalize">
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : details?.conduct.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No conduct or disciplinary reports for this worker on this project.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {details?.conduct.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-red-700 capitalize">{c.severity} Infraction</span>
                    {c.action_taken && <p className="text-[11px] text-slate-500 mt-0.5">Action: {c.action_taken}</p>}
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {formatDateNigerian(c.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
