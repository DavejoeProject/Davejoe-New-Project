import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Package,
  FileText,
  Phone,
  Mail,
  User,
  Briefcase,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  AssignedProjectsService,
  AssignedProjectSummary,
  AssignedProjectFullDetails,
} from '../../services/assignedProjectsService';
import { formatNigerianDate } from '../../services/materialsService';

interface AssignedProjectDetailModalProps {
  project: AssignedProjectSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onClockIn?: (project: AssignedProjectSummary) => Promise<void>;
  isClockingIn?: boolean;
  isAlreadyClockedInToday?: boolean;
  clockInError?: string | null;
  clockInSuccess?: string | null;
}

type DetailTab = 'overview' | 'team' | 'tasks' | 'materials' | 'notes';

export const AssignedProjectDetailModal: React.FC<AssignedProjectDetailModalProps> = ({
  project,
  isOpen,
  onClose,
  onClockIn,
  isClockingIn = false,
  isAlreadyClockedInToday = false,
  clockInError = null,
  clockInSuccess = null,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [details, setDetails] = useState<AssignedProjectFullDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!project?.project_id) return;
    setLoading(true);
    setError(null);
    const res = await AssignedProjectsService.getAssignedProjectDetails(project.project_id);
    if (res.error) {
      setError(res.error);
    } else {
      setDetails(res.data);
    }
    setLoading(false);
  }, [project?.project_id]);

  useEffect(() => {
    if (isOpen && project?.project_id) {
      setActiveTab('overview');
      void loadDetails();
    }
  }, [isOpen, project?.project_id, loadDetails]);

  if (!isOpen || !project) return null;

  const p = details?.project;
  const fullAddress = [
    p?.address ?? project.address,
    p?.city ?? project.city,
    p?.state ?? project.state,
    p?.country ?? project.country,
  ]
    .filter(Boolean)
    .join(', ');

  const clientName = p?.client_name ?? project.client_name;
  const clientContact = p?.client_contact_person ?? project.client_contact_person;
  const clientPhone = p?.client_phone ?? project.client_phone;
  const clientEmail = p?.client_email ?? project.client_email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/55 backdrop-blur-2xs">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-[#18b892] bg-[#E6F4EA] px-2.5 py-0.5 rounded-md border border-[#18b892]/20">
                {project.project_code}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 uppercase">
                {(p?.status || project.status).replace(/_/g, ' ')}
              </span>
              {(p?.project_type || project.project_type) && (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {p?.project_type || project.project_type}
                </span>
              )}
              {project.is_starting_today ? (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Starts Today &bull; Clock In Ready
                </span>
              ) : project.is_upcoming && project.effective_start_date ? (
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Scheduled: Starts {formatNigerianDate(project.effective_start_date)}
                </span>
              ) : null}
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              {p?.name || project.name}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadDetails()}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="Refresh project details"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#18b892]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="px-5 py-2.5 border-b border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {[
            { key: 'overview' as DetailTab, label: 'Overview & Schedule', icon: Building2 },
            {
              key: 'team' as DetailTab,
              label: `Team Roster (${details?.team.length ?? project.workforce_count})`,
              icon: Users,
            },
            {
              key: 'tasks' as DetailTab,
              label: `Tasks & Specs (${details?.tasks.length ?? project.open_tasks_count})`,
              icon: CheckCircle2,
            },
            {
              key: 'materials' as DetailTab,
              label: `Materials / BOQ (${details?.materials.length ?? project.materials_count})`,
              icon: Package,
            },
            {
              key: 'notes' as DetailTab,
              label: `Site Notes (${details?.notes.length ?? 0})`,
              icon: FileText,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#18b892] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-5 bg-[#f8faf9]">
          {clockInError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{clockInError}</span>
            </div>
          )}

          {clockInSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#18b892]" />
              <span>{clockInSuccess}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{error}</span>
            </div>
          )}

          {loading && !details ? (
            <div className="py-14 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#18b892]" />
              <span>Loading complete project briefing...</span>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* Description */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Project Scope &amp; Brief
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {p?.description ||
                        project.description ||
                        'No extended brief description recorded for this project yet.'}
                    </p>
                  </div>

                  {/* Schedule & Role Assignment Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#18b892]" />
                        <span>Schedule &amp; Site Location</span>
                      </h3>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Site Location</span>
                          <span className="font-semibold text-slate-900 text-right flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{fullAddress || 'Address not specified'}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Project Start Date</span>
                          <span className="font-mono font-bold text-slate-900">
                            {(p?.start_date || project.start_date)
                              ? formatNigerianDate(p?.start_date || project.start_date)
                              : 'Immediate / Unscheduled'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Target Completion</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {(p?.expected_completion_date || project.expected_completion_date)
                              ? formatNigerianDate(
                                  p?.expected_completion_date || project.expected_completion_date
                                )
                              : 'Pending schedule'}
                          </span>
                        </div>
                        {(p?.actual_completion_date || project.actual_completion_date) && (
                          <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                            <span className="text-slate-500 font-medium">Actual Completion</span>
                            <span className="font-mono font-semibold text-emerald-700">
                              {formatNigerianDate(
                                p?.actual_completion_date || project.actual_completion_date
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-3.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-[#18b892]" />
                        <span>Your Assignment &amp; Client</span>
                      </h3>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Your Role on Project</span>
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-[#18b892] border border-[#18b892]/20 font-bold">
                            {project.role_on_project || 'Assigned Project Personnel'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Assignment Start</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {project.effective_start_date
                              ? formatNigerianDate(project.effective_start_date)
                              : 'Active Immediately'}
                          </span>
                        </div>
                        {project.assignment_end_date && (
                          <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                            <span className="text-slate-500 font-medium">Assignment End</span>
                            <span className="font-mono font-semibold text-slate-800">
                              {formatNigerianDate(project.assignment_end_date)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                          <span className="text-slate-500 font-medium">Client</span>
                          <span className="font-semibold text-slate-900">
                            {clientName || 'Davejoe Internal / Client Confidential'}
                          </span>
                        </div>
                        {clientContact && (
                          <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100">
                            <span className="text-slate-500 font-medium">Client Contact</span>
                            <span className="text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {clientContact}
                            </span>
                          </div>
                        )}
                        {(clientPhone || clientEmail) && (
                          <div className="flex flex-wrap items-center justify-end gap-3 pt-1 text-[11px] text-slate-600">
                            {clientPhone && (
                              <span className="inline-flex items-center gap-1 font-mono">
                                <Phone className="w-3 h-3 text-[#18b892]" />
                                {clientPhone}
                              </span>
                            )}
                            {clientEmail && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3 text-[#18b892]" />
                                {clientEmail}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {project.assignment_notes && (
                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 text-xs text-emerald-950 space-y-1">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-[#18b892] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Assignment Instructions / Notes</span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{project.assignment_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'team' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                  {(details?.team.length || 0) === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No other active personnel assignments recorded on this project yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase text-slate-400">
                            <th className="py-3 px-4">Code</th>
                            <th className="py-3 px-4">Name</th>
                            <th className="py-3 px-4">Trade / Dept</th>
                            <th className="py-3 px-4">Role on Project</th>
                            <th className="py-3 px-4">Contact</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {details?.team.map((member) => (
                            <tr key={member.assignment_id} className="hover:bg-slate-50/60">
                              <td className="py-3 px-4 font-mono font-bold text-slate-700">
                                {member.workforce_code}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {member.name}
                              </td>
                              <td className="py-3 px-4 text-slate-600">{member.trade}</td>
                              <td className="py-3 px-4 text-slate-700 font-medium">
                                {member.role_on_project}
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-500">
                                {member.phone || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#18b892] capitalize">
                                  {member.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {(details?.tasks.length || 0) === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 py-12 text-center text-xs text-slate-400">
                      No tasks or technical instructions recorded for this project yet.
                    </div>
                  ) : (
                    details?.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900">{task.title}</h4>
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 uppercase">
                              {task.priority}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                              {task.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-slate-600 leading-relaxed">{task.description}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                          {task.deliverable && (
                            <div>
                              <strong className="text-slate-800">Deliverable:</strong> {task.deliverable}
                            </div>
                          )}
                          {task.required_materials && (
                            <div>
                              <strong className="text-slate-800">Materials:</strong>{' '}
                              {task.required_materials}
                            </div>
                          )}
                          {task.required_tools && (
                            <div>
                              <strong className="text-slate-800">Tools:</strong> {task.required_tools}
                            </div>
                          )}
                          {task.required_ppe && (
                            <div>
                              <strong className="text-slate-800">PPE:</strong> {task.required_ppe}
                            </div>
                          )}
                        </div>
                        {task.safety_instructions && (
                          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-900">
                            <strong>Safety:</strong> {task.safety_instructions}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400 pt-1">
                          Due Date: {task.due_date ? formatNigerianDate(task.due_date) : 'Open'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'materials' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
                  {(details?.materials.length || 0) === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No materials or BOQ allocations linked to this project yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase text-slate-400">
                            <th className="py-3 px-4">Material</th>
                            <th className="py-3 px-4">Required Qty</th>
                            <th className="py-3 px-4">Approved Qty</th>
                            <th className="py-3 px-4">Purpose</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {details?.materials.map((mat) => (
                            <tr key={mat.id} className="hover:bg-slate-50/60">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                {mat.material_name}
                              </td>
                              <td className="py-3 px-4 font-mono">
                                {mat.required_quantity} {mat.unit_of_measure}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-[#18b892]">
                                {mat.approved_quantity != null
                                  ? `${mat.approved_quantity} ${mat.unit_of_measure}`
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-slate-600">{mat.purpose || '—'}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                                  {mat.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3">
                  {(details?.notes.length || 0) === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 py-12 text-center text-xs text-slate-400">
                      No project notes or daily reports filed yet.
                    </div>
                  ) : (
                    details?.notes.map((note) => {
                      let displayBody = note.content || '';
                      try {
                        if (displayBody.startsWith('{')) {
                          const parsed = JSON.parse(displayBody);
                          displayBody = parsed.work_completed || displayBody;
                        }
                      } catch {
                        // Raw text fallback
                      }
                      return (
                        <div
                          key={note.id}
                          className="bg-white p-4 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">
                              {note.title || 'Project Site Note'}
                            </h4>
                            <span className="font-mono text-[11px] text-slate-400">
                              {formatNigerianDate(note.created_at)}
                            </span>
                          </div>
                          <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {displayBody}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {project.is_upcoming && project.effective_start_date ? (
              <span>
                Scheduled start:{' '}
                <strong className="text-amber-700">
                  {formatNigerianDate(project.effective_start_date)}
                </strong>{' '}
                (Clock-in unlocks on start day)
              </span>
            ) : project.can_clock_in_today ? (
              <span className="text-emerald-700 font-medium">
                Eligible for daily attendance clock-in today
              </span>
            ) : (
              <span>Project status: {project.status.replace(/_/g, ' ')}</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>

            {onClockIn && !isAlreadyClockedInToday && (
              <button
                type="button"
                disabled={isClockingIn || !project.can_clock_in_today}
                onClick={() => void onClockIn(project)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  project.can_clock_in_today
                    ? 'bg-[#18b892] hover:bg-[#139c7b] text-white cursor-pointer shadow-2xs disabled:opacity-50'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {isClockingIn
                    ? 'Clocking In...'
                    : project.can_clock_in_today
                    ? 'Clock In for This Project'
                    : `Opens ${project.effective_start_date ? formatNigerianDate(project.effective_start_date) : 'Later'}`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
