import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  ArrowRight,
  X,
  FileCheck,
} from 'lucide-react';
import {
  ToolsEquipmentService,
  CompanyToolItem,
  ToolAssignmentItem,
  ToolStatus,
  ToolCondition,
  ToolOwnership,
} from '../../services/toolsEquipmentService';
import { formatNigerianDate } from '../../services/materialsService';
import { supabase } from '../../lib/supabase';

interface ToolsEquipmentModuleProps {
  onRefreshParent?: () => void;
}

export const ToolsEquipmentModule: React.FC<ToolsEquipmentModuleProps> = ({ onRefreshParent }) => {
  const [tools, setTools] = useState<CompanyToolItem[]>([]);
  const [assignments, setAssignments] = useState<ToolAssignmentItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'register' | 'assignments'>('register');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedToolForAssign, setSelectedToolForAssign] = useState<CompanyToolItem | null>(null);
  const [selectedAssignmentForReturn, setSelectedAssignmentForReturn] = useState<ToolAssignmentItem | null>(null);

  // Form states: Register
  const [regAssetTag, setRegAssetTag] = useState('');
  const [regName, setRegName] = useState('');
  const [regCategory, setRegCategory] = useState('Power Tools');
  const [regMakeModel, setRegMakeModel] = useState('');
  const [regSerial, setRegSerial] = useState('');
  const [regOwnership, setRegOwnership] = useState<ToolOwnership>('company_owned');
  const [regLocation, setRegLocation] = useState('Central Store');
  const [regCondition, setRegCondition] = useState<ToolCondition>('good');

  // Form states: Assign
  const [assignProject, setAssignProject] = useState('');
  const [assignUser, setAssignUser] = useState('');
  const [assignExpectedDate, setAssignExpectedDate] = useState('');
  const [assignAccessories, setAssignAccessories] = useState('');

  // Form states: Return
  const [retCondition, setRetCondition] = useState<ToolCondition>('good');
  const [retMissingParts, setRetMissingParts] = useState('');
  const [retDamageNotes, setRetDamageNotes] = useState('');
  const [retFollowUp, setRetFollowUp] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchToolsData = async () => {
    try {
      const [toolRes, assignRes, projRes, userRes] = await Promise.all([
        ToolsEquipmentService.getTools({ status: statusFilter }),
        ToolsEquipmentService.getAssignments(),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('profiles').select('id, display_name, first_name, last_name').order('first_name'),
      ]);

      setTools(toolRes.data || []);
      setAssignments(assignRes.data || []);
      setProjects(projRes.data || []);
      setUsers(
        (userRes.data || []).map((u: any) => ({
          id: u.id,
          display_name: u.display_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Staff Member',
        }))
      );
    } catch (err) {
      console.warn('[ToolsEquipmentModule] fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchToolsData();
  }, [statusFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchToolsData();
    if (onRefreshParent) onRefreshParent();
  };

  const handleRegisterTool = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!regAssetTag.trim() || !regName.trim()) {
      setFormError('Asset tag and tool name are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await ToolsEquipmentService.registerTool({
        asset_tag: regAssetTag,
        name: regName,
        category: regCategory,
        make_model: regMakeModel,
        serial_number: regSerial,
        ownership: regOwnership,
        current_location: regLocation,
        physical_condition: regCondition,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setRegisterModalOpen(false);
        setRegAssetTag('');
        setRegName('');
        await fetchToolsData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to register equipment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToolForAssign) return;
    setFormError(null);

    setSubmitting(true);
    try {
      const res = await ToolsEquipmentService.assignTool({
        tool_id: selectedToolForAssign.id,
        project_id: assignProject || undefined,
        issued_to_user_id: assignUser || undefined,
        expected_return_date: assignExpectedDate || undefined,
        accessories_included: assignAccessories || undefined,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setAssignModalOpen(false);
        setSelectedToolForAssign(null);
        await fetchToolsData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to dispatch equipment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentForReturn) return;
    setFormError(null);

    setSubmitting(true);
    try {
      const res = await ToolsEquipmentService.returnTool({
        assignment_id: selectedAssignmentForReturn.id,
        tool_id: selectedAssignmentForReturn.tool_id,
        return_condition: retCondition,
        missing_parts: retMissingParts,
        damage_notes: retDamageNotes,
        follow_up_action: retFollowUp,
      });

      if (res.error) {
        setFormError(res.error);
      } else {
        setReturnModalOpen(false);
        setSelectedAssignmentForReturn(null);
        await fetchToolsData();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to record return.');
    } finally {
      setSubmitting(false);
    }
  };

  const availableCount = tools.filter((t) => t.status === 'available').length;
  const assignedCount = tools.filter((t) => t.status === 'assigned').length;
  const maintenanceCount = tools.filter((t) => t.status === 'under_maintenance' || t.status === 'damaged').length;
  const missingCount = tools.filter((t) => t.status === 'missing').length;

  const filteredTools = tools.filter((t) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      t.asset_tag.toLowerCase().includes(term) ||
      (t.make_model || '').toLowerCase().includes(term) ||
      t.current_location.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            <Wrench className="w-4 h-4 text-[#01875F]" />
            <span>Company Assets & Equipment Deployment</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Tools & Equipment Accountability
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Asset register, custody dispatches, project assignments, return condition inspections, and missing asset escalation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setRegisterModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Tool</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Available in Store
          </span>
          <div className="text-2xl font-bold text-emerald-700">{availableCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Ready for deployment</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Currently Issued
          </span>
          <div className="text-2xl font-bold text-blue-700">{assignedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Active on jobsites</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Under Maintenance
          </span>
          <div className="text-2xl font-bold text-amber-600">{maintenanceCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Inspection or repair</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Missing / Unresolved
          </span>
          <div className="text-2xl font-bold text-rose-700">{missingCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Open accountability cases</p>
        </div>
      </div>

      {/* Tabs & Search Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 border-b md:border-b-0 pb-2 md:pb-0 border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'register' ? 'bg-[#01875F] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Asset Catalogue ({tools.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'assignments' ? 'bg-[#01875F] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Active Assignments ({assignments.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tag or equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
            />
          </div>

          {activeTab === 'register' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
            >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="under_maintenance">Maintenance</option>
              <option value="missing">Missing</option>
            </select>
          )}
        </div>
      </div>

      {/* Main View: Register vs Assignments */}
      {activeTab === 'register' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading equipment register...</div>
          ) : filteredTools.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">No equipment records found.</div>
          ) : (
            <div className="overflow-x-auto touch-pan-x -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-4">Asset Tag & Name</th>
                    <th className="py-3 px-4">Category & Model</th>
                    <th className="py-3 px-4">Current Location / Custodian</th>
                    <th className="py-3 px-4">Condition</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTools.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] font-bold text-[#01875F] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 mr-2">
                          {t.asset_tag}
                        </span>
                        <span className="font-bold text-slate-900">{t.name}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div>{t.category}</div>
                        <div className="text-[11px] text-slate-400">{t.make_model || 'Standard'}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{t.current_location}</div>
                        <div className="text-[11px] text-slate-400">
                          {t.custodian?.display_name ? `Custodian: ${t.custodian.display_name}` : 'In Central Custody'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.physical_condition === 'good'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.physical_condition === 'fair'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {t.physical_condition.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.status === 'assigned'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : t.status === 'under_maintenance'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {t.status === 'available' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedToolForAssign(t);
                              setAssignModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#01875F] text-white hover:bg-[#00704e] transition-colors cursor-pointer"
                          >
                            Assign Tool
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {assignments.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">No active tool assignments.</div>
          ) : (
            <div className="overflow-x-auto touch-pan-x -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-4">Equipment</th>
                    <th className="py-3 px-4">Assigned To</th>
                    <th className="py-3 px-4">Project</th>
                    <th className="py-3 px-4">Issue Date / Expected Return</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{a.tool?.name || 'Equipment Item'}</div>
                        <div className="font-mono text-[11px] text-[#01875F]">{a.tool?.asset_tag}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{a.recipient?.display_name || 'Staff Member'}</div>
                        <div className="text-[11px] text-slate-400">Qty: {a.quantity_issued}</div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {a.project?.name || 'General Project Site'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div>{formatNigerianDate(a.issue_date)}</div>
                        <div className="text-[11px] text-slate-400">
                          Due: {a.expected_return_date ? formatNigerianDate(a.expected_return_date) : 'Open Ended'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                          {a.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {a.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssignmentForReturn(a);
                              setReturnModalOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                          >
                            Return & Inspect
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Register Tool Modal */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#01875F]/10 text-[#01875F] flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Register Company Tool / Asset</h3>
                  <p className="text-xs text-slate-500">Record physical asset, category, and storage origin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegisterModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterTool} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{formError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Asset Tag *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DJ-TL-015"
                    value={regAssetTag}
                    onChange={(e) => setRegAssetTag(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={regCategory}
                    onChange={(e) => setRegCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Power Tools">Power Tools</option>
                    <option value="Hand Tools">Hand Tools</option>
                    <option value="Measurement">Measurement</option>
                    <option value="Access & Scaffolding">Access & Scaffolding</option>
                    <option value="Finishing Equipment">Finishing Equipment</option>
                    <option value="Heavy Equipment">Heavy Equipment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tool / Equipment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bosch Rotary Hammer Drill 800W"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Make & Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GBH 2-26 DRE"
                    value={regMakeModel}
                    onChange={(e) => setRegMakeModel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    placeholder="Optional manufacturer serial"
                    value={regSerial}
                    onChange={(e) => setRegSerial(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ownership
                  </label>
                  <select
                    value={regOwnership}
                    onChange={(e) => setRegOwnership(e.target.value as ToolOwnership)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="company_owned">Company Owned</option>
                    <option value="rented">Rented Equipment</option>
                    <option value="leased">Leased Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Location
                  </label>
                  <input
                    type="text"
                    value={regLocation}
                    onChange={(e) => setRegLocation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRegisterModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#01875F] hover:bg-[#00704e] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Save to Asset Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Tool Modal */}
      {assignModalOpen && selectedToolForAssign && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#01875F]/10 text-[#01875F] flex items-center justify-center font-bold">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assign Tool & Dispatch Custody</h3>
                  <p className="text-xs text-slate-500">{selectedToolForAssign.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignTool} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Recipient Custodian *
                </label>
                <select
                  required
                  value={assignUser}
                  onChange={(e) => setAssignUser(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Select Recipient Staff / Artisan</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Assigned Project Site
                </label>
                <select
                  value={assignProject}
                  onChange={(e) => setAssignProject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="">Select Project Site (Optional)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Expected Return Date
                  </label>
                  <input
                    type="date"
                    value={assignExpectedDate}
                    onChange={(e) => setAssignExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Accessories Included
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2x batteries, chuck key"
                    value={assignAccessories}
                    onChange={(e) => setAssignAccessories(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#01875F] hover:bg-[#00704e] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Dispatching...' : 'Confirm Custody Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Tool & Inspection Modal */}
      {returnModalOpen && selectedAssignmentForReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tool Return & Condition Inspection</h3>
                  <p className="text-xs text-slate-500">{selectedAssignmentForReturn.tool?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnTool} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Physical Return Condition *
                </label>
                <select
                  value={retCondition}
                  onChange={(e) => setRetCondition(e.target.value as ToolCondition)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="good">Good (Clean, functional, ready to issue)</option>
                  <option value="fair">Fair (Normal work wear, fully operational)</option>
                  <option value="damaged">Damaged (Requires repair before re-issue)</option>
                  <option value="faulty">Faulty / Electrical / Mechanical Malfunction</option>
                  <option value="incomplete">Incomplete (Missing accessories)</option>
                  <option value="missing">Missing / Stolen / Lost Asset</option>
                </select>
              </div>

              {retCondition !== 'good' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Damage Notes / Inspection Observations
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Describe cracks, motor smell, cable wear, or missing parts..."
                      value={retDamageNotes}
                      onChange={(e) => setRetDamageNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Missing Parts / Accessories
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Battery pack #2 missing"
                      value={retMissingParts}
                      onChange={(e) => setRetMissingParts(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Follow-up Action
                </label>
                <input
                  type="text"
                  placeholder="e.g. Store in Central Rack B, send to Makita service center..."
                  value={retFollowUp}
                  onChange={(e) => setRetFollowUp(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReturnModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#01875F] hover:bg-[#00704e] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Inspecting...' : 'Confirm Return & Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
