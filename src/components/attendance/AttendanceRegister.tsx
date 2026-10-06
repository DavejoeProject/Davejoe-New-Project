import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  UserCheck,
  LogOut,
  AlertCircle,
  Eye,
  Building,
  User,
  Users,
  ChevronRight,
} from 'lucide-react';
import {
  AttendanceService,
  AttendanceRecordItem,
  AttendanceSummaryMetrics,
  AttendanceStatus,
  ALL_ATTENDANCE_STATUSES,
  ATTENDANCE_STATUS_CONFIG,
  getNigerianTodayIso,
  formatTimeFromIso,
} from '../../services/attendanceService';
import { formatNigerianDate } from '../../services/materialsService';
import { AttendanceDetailDrawer } from './AttendanceDetailDrawer';
import { ClockInWorkerModal } from '../supervisor/ClockInWorkerModal';
import { ClockOutWorkerModal } from '../supervisor/ClockOutWorkerModal';
import { RecordAttendanceModal } from '../supervisor/RecordAttendanceModal';
import { SupervisorProjectItem } from '../../services/siteSupervisorService';
import { supabase } from '../../lib/supabase';

interface AttendanceRegisterProps {
  initialTab?: 'today' | 'history';
  onBackToDashboard?: () => void;
  hideTopNav?: boolean;
}

export const AttendanceRegister: React.FC<AttendanceRegisterProps> = ({
  initialTab = 'today',
  onBackToDashboard,
  hideTopNav = false,
}) => {
  const todayIso = getNigerianTodayIso();

  // Tab & Filters
  const [activeDateTab, setActiveDateTab] = useState<'today' | 'history'>(initialTab);
  const [dateFilter, setDateFilter] = useState<string>(initialTab === 'today' ? todayIso : '');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data states
  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [metrics, setMetrics] = useState<AttendanceSummaryMetrics>({
    totalExpected: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    halfDayCount: 0,
    excusedCount: 0,
    currentlyOnSiteCount: 0,
    clockedOutCount: 0,
  });

  const [availableProjects, setAvailableProjects] = useState<SupervisorProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals & Drawers
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecordItem | null>(null);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState<boolean>(false);
  const [isClockOutModalOpen, setIsClockOutModalOpen] = useState<boolean>(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);

  // Load projects list for dropdown filter and modals
  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase.from('projects').select('*').order('name');
      if (data) {
        setAvailableProjects(
          data.map((p: any) => ({
            id: p.id,
            project_code: p.project_code || 'PRJ',
            name: p.name,
            description: p.description,
            status: p.status || 'active',
            start_date: p.start_date,
            expected_completion_date: p.expected_completion_date,
            address: p.address,
            city: p.city,
            state: p.state,
            contract_value: p.contract_value ? Number(p.contract_value) : null,
            workforce_count: 0,
            today_attendance_count: 0,
            open_tasks_count: 0,
          }))
        );
      }
    }
    loadProjects();
  }, []);

  // Fetch Attendance Records
  const fetchAttendance = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      const targetDate = activeDateTab === 'today' ? todayIso : dateFilter;

      const res = await AttendanceService.getAttendanceRegister({
        date: targetDate || undefined,
        projectId: projectFilter !== 'all' ? projectFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setRecords(res.records);
        setMetrics(res.metrics);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    },
    [activeDateTab, dateFilter, projectFilter, statusFilter, searchQuery, todayIso]
  );

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleTabChange = (tab: 'today' | 'history') => {
    setActiveDateTab(tab);
    if (tab === 'today') {
      setDateFilter(todayIso);
    } else {
      setDateFilter('');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Module Header */}
      {!hideTopNav && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                OPERATIONS &bull; WORKFORCE TIMEKEEPING
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <CalendarCheck className="w-6 h-6 text-[#01875F]" />
              <span>Attendance &amp; Timekeeping Register</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Live on-site muster, gate arrivals, departures, and historical time records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchAttendance(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClockInModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Clock In Worker</span>
            </button>

            <button
              type="button"
              onClick={() => setIsClockOutModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Clock Out Worker</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Record Attendance</span>
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Muster
          </span>
          <span className="text-xl font-bold text-slate-900 font-mono">
            {metrics.totalExpected}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Recorded items</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
            Present
          </span>
          <span className="text-xl font-bold text-emerald-700 font-mono">
            {metrics.presentCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">On time</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-600 block mb-1">
            Late
          </span>
          <span className="text-xl font-bold text-amber-700 font-mono">
            {metrics.lateCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Delayed arrival</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
            Absent
          </span>
          <span className="text-xl font-bold text-rose-700 font-mono">
            {metrics.absentCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">No-show</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-sky-600 block mb-1">
            Half Day
          </span>
          <span className="text-xl font-bold text-sky-700 font-mono">
            {metrics.halfDayCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Partial shift</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#01875F] block mb-1">
            On Site Now
          </span>
          <span className="text-xl font-bold text-[#01875F] font-mono">
            {metrics.currentlyOnSiteCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Active shift</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
            Departed
          </span>
          <span className="text-xl font-bold text-slate-700 font-mono">
            {metrics.clockedOutCount}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Clocked out</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* Date Tabs (Today vs History) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleTabChange('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeDateTab === 'today'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Today ({formatNigerianDate(todayIso)})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('history')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeDateTab === 'history'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Historical Ledger
            </button>
          </div>

          {activeDateTab === 'history' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Filter Date:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#01875F]/20 focus:border-[#01875F]"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Clear date
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dropdown Filters & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Project Selector */}
          <div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#01875F]/20 focus:border-[#01875F]"
            >
              <option value="all">All Projects</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.project_code}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#01875F]/20 focus:border-[#01875F]"
            >
              <option value="all">All Attendance Statuses</option>
              {ALL_ATTENDANCE_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {ATTENDANCE_STATUS_CONFIG[st].label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search worker, trade, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#01875F]/20 focus:border-[#01875F]"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchAttendance()}
            className="text-xs font-bold text-rose-700 underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Querying attendance records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">No attendance records found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeDateTab === 'today'
                ? 'No workers have clocked in or been recorded on site yet today.'
                : 'No historical attendance records match the selected filters.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsClockInModalOpen(true)}
                className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                Clock In Worker
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                  <th className="py-3 px-4">Artisan / Worker</th>
                  <th className="py-3 px-4">Trade &amp; Code</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Clock In</th>
                  <th className="py-3 px-4">Clock Out</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {records.map((r) => {
                  const prof = r.workforce_members?.profiles;
                  const name =
                    prof?.display_name ||
                    `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() ||
                    `Artisan ${r.workforce_members?.workforce_code || '---'}`;
                  const config = ATTENDANCE_STATUS_CONFIG[r.status] || ATTENDANCE_STATUS_CONFIG.present;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRecord(r)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold text-xs shrink-0">
                            {name[0] || 'A'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-[#01875F] transition-colors block">
                              {name}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-600 block">
                          {r.workforce_members?.workforce_code || '---'}
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          {r.workforce_members?.trade || 'Artisan'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {r.projects?.name || 'Assigned Project'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 block">
                          {r.projects?.project_code || 'PRJ'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {formatNigerianDate(r.attendance_date)}
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-emerald-700">
                        {formatTimeFromIso(r.clock_in_time)}
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-slate-600">
                        {r.is_clocked_out ? (
                          formatTimeFromIso(r.clock_out_time)
                        ) : (
                          <span className="text-slate-300">--:--</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.badgeClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dotClasses}`} />
                          {config.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(r);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#01875F] hover:bg-[#E6F4EA] transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <AttendanceDetailDrawer
        isOpen={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
      />

      <ClockInWorkerModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        onSuccess={() => fetchAttendance(true)}
        projects={availableProjects}
      />

      <ClockOutWorkerModal
        isOpen={isClockOutModalOpen}
        onClose={() => setIsClockOutModalOpen(false)}
        onSuccess={() => fetchAttendance(true)}
        todayAttendance={records}
      />

      <RecordAttendanceModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={() => fetchAttendance(true)}
        projects={availableProjects}
      />
    </div>
  );
};
