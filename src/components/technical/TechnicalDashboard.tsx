import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Plus,
  RefreshCw,
  LogOut,
  FolderKanban,
  Search,
  Filter,
  FileCheck,
  Building2,
  Calendar,
  AlertOctagon,
  Wrench,
  RotateCcw,
} from 'lucide-react';
import { DailyAttendanceWidget } from '../attendance/DailyAttendanceWidget';
import { ProjectMaterialRemnantsModule } from '../remnants/ProjectMaterialRemnantsModule';
import { ToolsEquipmentModule } from '../tools/ToolsEquipmentModule';
import { TaskInstructionsPanel } from '../tasks/TaskInstructionsPanel';

export const TechnicalDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'inspections' | 'tasks' | 'tools' | 'remnants'>('inspections');
  const [inspections, setInspections] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'passed' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [inspectionType, setInspectionType] = useState('Structural & Concrete Integrity');
  const [resultStatus, setResultStatus] = useState<'passed' | 'failed' | 'pending'>('passed');
  const [severity, setSeverity] = useState<'normal' | 'high' | 'critical'>('normal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchInspections = async () => {
    try {
      const [inspRes, projRes] = await Promise.all([
        supabase
          .from('technical_inspections')
          .select(`
            id,
            inspection_type,
            status,
            result,
            scheduled_date,
            created_at,
            project_id,
            projects ( id, name )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('projects').select('id, name').order('name'),
      ]);

      setInspections(inspRes.data || []);
      setProjects(projRes.data || []);
    } catch (err) {
      console.warn('[TechnicalDashboard] Error loading inspections:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchInspections();
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedProjectId) {
      setFormError('Please select an active project.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('technical_inspections').insert({
        project_id: selectedProjectId,
        inspection_type: inspectionType,
        status: resultStatus === 'passed' ? 'completed' : 'pending',
        result: resultStatus,
        scheduled_date: new Date().toISOString().split('T')[0],
      });

      if (error) throw error;

      setModalOpen(false);
      setSelectedProjectId('');
      setNotes('');
      await fetchInspections();
    } catch (err: any) {
      console.error('[TechnicalDashboard] Error creating inspection:', err);
      setFormError(err?.message || 'Failed to submit inspection record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real KPI calculations from Supabase data
  const totalCount = inspections.length;
  const passedCount = inspections.filter(
    (i) => (i.result || i.status || '').toLowerCase() === 'passed'
  ).length;
  const criticalCount = inspections.filter((i) => {
    const s = (i.result || i.status || '').toLowerCase();
    return s === 'failed' || s === 'fail' || s === 'critical';
  }).length;
  const pendingCount = inspections.filter(
    (i) => (i.result || i.status || '').toLowerCase() === 'pending'
  ).length;

  const filteredInspections = inspections.filter((ins) => {
    const statusLower = (ins.result || ins.status || '').toLowerCase();
    if (filter === 'critical' && statusLower !== 'failed' && statusLower !== 'critical') return false;
    if (filter === 'passed' && statusLower !== 'passed') return false;
    if (filter === 'pending' && statusLower !== 'pending') return false;

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const projName = ins.projects?.name?.toLowerCase() || '';
      const type = (ins.inspection_type || '').toLowerCase();
      return projName.includes(term) || type.includes(term);
    }
    return true;
  });

  const inspectorName =
    profile?.display_name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : '') ||
    user?.email?.split('@')[0] ||
    'QC Officer';

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col text-slate-800 font-sans selection:bg-[#01875F]/20 selection:text-[#01875F]">
      {/* Top Header */}
      <header className="h-16 px-3 sm:px-8 border-b border-slate-200/80 bg-white flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white border border-slate-100 shrink-0">
            <img src="/brand/pwa-192x192.png" alt="Davejoe Interiors" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-slate-900 tracking-tight text-xs sm:text-base block leading-tight truncate">
              Davejoe Technical & QC Command
            </span>
            <span className="text-[9.5px] sm:text-[10px] font-semibold text-[#01875F] tracking-wider uppercase block truncate">
              Quality Assurance & Compliance
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
            <span className="hidden sm:inline ml-1.5">Refresh</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">{inspectorName}</span>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="p-3 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 flex-1 overflow-x-hidden">
        {/* Daily Timekeeping for QC Officer */}
        <DailyAttendanceWidget />

        {/* Operational Navigation Tabs */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1 overflow-x-auto no-scrollbar touch-pan-x flex-nowrap">
          {[
            { key: 'inspections', label: 'Technical Inspections', icon: ClipboardCheck },
            { key: 'tasks', label: 'Task Verification & Handovers', icon: FileCheck },
            { key: 'tools', label: 'Tools Return & Condition Audits', icon: Wrench },
            { key: 'remnants', label: 'Remnants Quality Review', icon: RotateCcw },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#01875F] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'inspections' && (
          <div className="space-y-6">
            {/* Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <ClipboardCheck className="w-6 h-6 text-[#01875F]" />
              <span>Technical Inspection & Quality Control</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Structural integrity, concrete core compression sign-offs, rebar audits, and milestone certifications.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Inspection</span>
          </button>
        </div>

        {/* Real KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Inspections
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? '...' : totalCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total recorded site audits</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Passed Certifications
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-700">
              {isLoading ? '...' : passedCount}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              {totalCount > 0 ? `${Math.round((passedCount / totalCount) * 100)}% pass yield` : 'No audits logged'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Critical Findings
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-red-600">
              {isLoading ? '...' : criticalCount}
            </div>
            <p className="text-[11px] text-red-600 font-medium mt-1">Requiring engineer rectification</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pending Verification
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-700">
              {isLoading ? '...' : pendingCount}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Awaiting client witness / lab retest</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by project or inspection type..."
              className="w-full pl-9 pr-3 h-9 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#01875F]"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                filter === 'all' ? 'bg-[#01875F] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({inspections.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('passed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                filter === 'passed' ? 'bg-[#01875F] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Passed ({passedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                filter === 'critical' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Critical ({criticalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                filter === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>
        </div>

        {/* Inspections Table & Mobile Cards */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Quality Inspection Records</h2>
            <span className="text-[11px] sm:text-xs text-slate-400">Total displayed: {filteredInspections.length}</span>
          </div>

          {filteredInspections.length === 0 ? (
            <div className="py-12 sm:py-16 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl space-y-2 p-4">
              <ClipboardCheck className="w-9 h-9 sm:w-10 sm:h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600 text-sm">No inspection records found in database</p>
              <p className="text-slate-400 max-w-sm mx-auto text-[11px] sm:text-xs">
                No technical inspection finding matches your filter criteria. Use "+ Record New Inspection" to log genuine on-site QC audits.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card List (< md) */}
              <div className="md:hidden space-y-3">
                {filteredInspections.map((ins) => {
                  const statusLower = (ins.result || ins.status || '').toLowerCase();
                  const isPassed = statusLower === 'passed' || statusLower === 'completed';
                  const isCritical = statusLower === 'failed' || statusLower === 'critical';
                  return (
                    <div
                      key={ins.id}
                      className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 leading-snug truncate">
                            {ins.projects?.name || 'Assigned Site'}
                          </h4>
                          <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                            {ins.inspection_type || 'General Quality Inspection'}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isPassed
                              ? 'bg-emerald-50 text-[#01875F] border border-emerald-200'
                              : isCritical
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isPassed ? <CheckCircle2 className="w-3 h-3" /> : isCritical ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          <span className="capitalize">{ins.result || ins.status || 'Pending'}</span>
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{ins.scheduled_date || new Date(ins.created_at).toLocaleDateString()}</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          ISO 9001 / Davejoe QA
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Project</th>
                      <th className="py-2.5 px-3">Inspection Type</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Result Status</th>
                      <th className="py-2.5 px-3">Compliance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInspections.map((ins) => {
                      const statusLower = (ins.result || ins.status || '').toLowerCase();
                      const isPassed = statusLower === 'passed' || statusLower === 'completed';
                      const isCritical = statusLower === 'failed' || statusLower === 'critical';
                      return (
                        <tr key={ins.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-900">
                            {ins.projects?.name || 'Assigned Site'}
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-medium">
                            {ins.inspection_type || 'General Quality Inspection'}
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {ins.scheduled_date || new Date(ins.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isPassed
                                  ? 'bg-emerald-50 text-[#01875F] border border-emerald-200'
                                  : isCritical
                                    ? 'bg-red-50 text-red-600 border border-red-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isPassed ? <CheckCircle2 className="w-3 h-3" /> : isCritical ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              <span className="capitalize">{ins.result || ins.status || 'Pending'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                            ISO 9001 / Davejoe QA
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        </div>
        )}

        {/* Tab 2: Task Verification & Quality Review */}
        {activeTab === 'tasks' && <TaskInstructionsPanel />}

        {/* Tab 3: Tools & Equipment Return Condition Audits */}
        {activeTab === 'tools' && <ToolsEquipmentModule />}

        {/* Tab 4: Material Remnants Quality Inspection */}
        {activeTab === 'remnants' && <ProjectMaterialRemnantsModule />}
      </main>

      {/* Record Inspection Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[96vh] sm:max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Record Technical Inspection</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateInspection} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto min-h-0">
                {formError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Project Site *</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#01875F]"
                >
                  <option value="">Choose active project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Inspection Type *</label>
                <select
                  value={inspectionType}
                  onChange={(e) => setInspectionType(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#01875F]"
                >
                  <option value="Concrete Compressive Core Testing">Concrete Compressive Core Testing</option>
                  <option value="Foundation Raft Rebar Spacing & Cover">Foundation Raft Rebar Spacing & Cover</option>
                  <option value="Plumbing Pressure & Leakage Test">Plumbing Pressure & Leakage Test</option>
                  <option value="MEP Conduit Embedment Inspection">MEP Conduit Embedment Inspection</option>
                  <option value="Waterproofing & Membrane Integrity">Waterproofing & Membrane Integrity</option>
                  <option value="Finishing & Snagging Inspection">Finishing & Snagging Inspection</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Audit Finding Result *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setResultStatus('passed')}
                    className={`py-2 rounded-xl border font-bold text-xs ${
                      resultStatus === 'passed'
                        ? 'bg-emerald-50 border-emerald-500 text-[#01875F]'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Passed
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultStatus('failed')}
                    className={`py-2 rounded-xl border font-bold text-xs ${
                      resultStatus === 'failed'
                        ? 'bg-red-50 border-red-500 text-red-600'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Failed
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultStatus('pending')}
                    className={`py-2 rounded-xl border font-bold text-xs ${
                      resultStatus === 'pending'
                        ? 'bg-amber-50 border-amber-500 text-amber-700'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Pending
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technical Notes / Evidence</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on cylinder strength, rebar gauge, test pressure, or required corrective action..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#01875F]"
                />
              </div>

              </div>

              <div className="p-3.5 sm:p-4 bg-slate-50/80 border-t border-slate-100 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] px-5 py-2.5 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl font-semibold disabled:opacity-60 shadow-2xs cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Submit Certification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
