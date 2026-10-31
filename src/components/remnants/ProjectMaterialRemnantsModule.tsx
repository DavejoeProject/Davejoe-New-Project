import React, { useState, useEffect } from 'react';
import {
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building,
  User,
  Clock,
  ArrowRight,
  ShieldCheck,
  X,
  MapPin,
} from 'lucide-react';
import {
  ProjectMaterialRemnantsService,
  ProjectMaterialRemnantItem,
  CreateRemnantInput,
  RemnantCondition,
  RemnantVerificationStatus,
} from '../../services/projectMaterialRemnantsService';
import { formatNigerianDate } from '../../services/materialsService';
import { supabase } from '../../lib/supabase';

interface ProjectMaterialRemnantsModuleProps {
  initialProjectId?: string;
  onRefreshParent?: () => void;
}

export const ProjectMaterialRemnantsModule: React.FC<ProjectMaterialRemnantsModuleProps> = ({
  initialProjectId,
  onRefreshParent,
}) => {
  const [remnants, setRemnants] = useState<ProjectMaterialRemnantItem[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; name: string; category?: string; unit_of_measure?: string }>>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || 'all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ProjectMaterialRemnantItem | null>(null);

  // Form state
  const [formProject, setFormProject] = useState(initialProjectId || '');
  const [formMaterialName, setFormMaterialName] = useState('');
  const [formCategory, setFormCategory] = useState('Timber & Board');
  const [formUnit, setFormUnit] = useState('pieces');
  const [formQtyDelivered, setFormQtyDelivered] = useState<number>(10);
  const [formQtyConsumed, setFormQtyConsumed] = useState<number>(6);
  const [formQtyRemaining, setFormQtyRemaining] = useState<number>(4);
  const [formQtyReturned, setFormQtyReturned] = useState<number>(4);
  const [formQtyRetained, setFormQtyRetained] = useState<number>(0);
  const [formCondition, setFormCondition] = useState<RemnantCondition>('good');
  const [formDestination, setFormDestination] = useState('Central Warehouse, Ikeja');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRemnants = async () => {
    try {
      const [remRes, projRes, matRes] = await Promise.all([
        ProjectMaterialRemnantsService.getRemnants({
          projectId: selectedProjectId,
          status: statusFilter,
        }),
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('materials').select('id, name, category, unit_of_measure').order('name'),
      ]);
      setRemnants(remRes.data || []);
      setProjects(projRes.data || []);
      setMaterials(matRes.data || []);
    } catch (err) {
      console.warn('[RemnantsModule] fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRemnants();
  }, [selectedProjectId, statusFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRemnants();
    if (onRefreshParent) onRefreshParent();
  };

  const handleCreateRemnant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formProject) {
      setFormError('Please select a project.');
      return;
    }
    if (!formMaterialName.trim()) {
      setFormError('Material name is required.');
      return;
    }
    if (formQtyRemaining <= 0) {
      setFormError('Quantity remaining must be greater than zero.');
      return;
    }

    setSubmitting(true);
    try {
      const input: CreateRemnantInput = {
        project_id: formProject,
        material_id: selectedMaterialId || undefined,
        material_name: formMaterialName.trim(),
        category: formCategory,
        unit_of_measure: formUnit,
        quantity_delivered: formQtyDelivered,
        quantity_consumed: formQtyConsumed,
        quantity_remaining: formQtyRemaining,
        quantity_returned_to_stock: formQtyReturned,
        quantity_retained_on_site: formQtyRetained,
        condition: formCondition,
        destination_location: formDestination,
        notes: formNotes,
      };

      const res = await ProjectMaterialRemnantsService.createRemnant(input);
      if (res.error) {
        setFormError(res.error);
      } else {
        setRecordModalOpen(false);
        setSelectedMaterialId('');
        setFormMaterialName('');
        setFormNotes('');
        await fetchRemnants();
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit remnant record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (remnantId: string, status: RemnantVerificationStatus) => {
    try {
      await ProjectMaterialRemnantsService.updateRemnantStatus({
        remnantId,
        status,
        reviewerComments: `Status updated to ${status} by authorized reviewer.`,
      });
      await fetchRemnants();
      if (detailItem?.id === remnantId) {
        setDetailItem(null);
      }
    } catch (err) {
      console.warn('Status update error:', err);
    }
  };

  // Computed metrics
  const totalRemnants = remnants.length;
  const returnedCount = remnants.filter((r) => r.quantity_returned_to_stock > 0).length;
  const retainedCount = remnants.filter((r) => r.quantity_retained_on_site > 0).length;
  const pendingCount = remnants.filter((r) => r.verification_status === 'pending_verification').length;

  const filteredRemnants = remnants.filter((r) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      r.material_name.toLowerCase().includes(term) ||
      (r.project?.name || '').toLowerCase().includes(term) ||
      (r.destination_location || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Row */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            <Layers className="w-4 h-4 text-[#01875F]" />
            <span>Site Surplus & Material Movements</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Material Remnants & Reconciliation
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Account for unused jobsite extras, surplus materials, recovery transfers, and verified warehouse handovers.
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
            onClick={() => setRecordModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Site Remnant</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Remnants
          </span>
          <div className="text-2xl font-bold text-slate-900">{totalRemnants}</div>
          <p className="text-[11px] text-slate-500 mt-1">Recorded across projects</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Returned to Stock
          </span>
          <div className="text-2xl font-bold text-emerald-700">{returnedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Confirmed store returns</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Retained On Site
          </span>
          <div className="text-2xl font-bold text-blue-700">{retainedCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Surplus kept for next phase</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Pending Verification
          </span>
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting custody sign-off</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search material or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
            />
          </div>

          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F] max-w-[200px] truncate"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'pending_verification', 'verified', 'disputed'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#01875F] text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st === 'all'
                ? 'All Status'
                : st === 'pending_verification'
                ? 'Pending'
                : st === 'verified'
                ? 'Verified'
                : 'Disputed'}
            </button>
          ))}
        </div>
      </div>

      {/* Remnant Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading remnant records...</div>
        ) : filteredRemnants.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No material remnants recorded for this criteria.
          </div>
        ) : (
          <div className="overflow-x-auto touch-pan-x -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-400 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="py-3 px-4">Material & Project</th>
                  <th className="py-3 px-4">Remaining / Delivered</th>
                  <th className="py-3 px-4">Disposal / Destination</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRemnants.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{r.material_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3 text-[#01875F]" />
                        <span>{r.project?.name || 'Project Site'}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#01875F]">
                        {r.quantity_remaining} {r.unit_of_measure}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        of {r.quantity_delivered} delivered ({r.quantity_consumed} used)
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">
                        {r.destination_location || 'Central Warehouse'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r.quantity_returned_to_stock > 0
                          ? `${r.quantity_returned_to_stock} returned to stock`
                          : `${r.quantity_retained_on_site} retained on site`}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.condition === 'good'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.condition === 'fair'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {r.condition}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.verification_status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.verification_status === 'pending_verification'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {r.verification_status === 'verified' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {r.verification_status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailItem(r)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-[#01875F] hover:text-white transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Remnant Modal */}
      {recordModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#01875F]/10 text-[#01875F] flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Site Material Remnant</h3>
                  <p className="text-xs text-slate-500">Document surplus stock, location, and custody handover</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRecordModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRemnant} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Project Site *
                </label>
                <select
                  required
                  value={formProject}
                  onChange={(e) => setFormProject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {materials.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Select from Materials Catalog (Optional)
                  </label>
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => {
                      const mId = e.target.value;
                      setSelectedMaterialId(mId);
                      const found = materials.find((m) => m.id === mId);
                      if (found) {
                        setFormMaterialName(found.name);
                        if (found.category) setFormCategory(found.category);
                        if (found.unit_of_measure) setFormUnit(found.unit_of_measure);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
                  >
                    <option value="">-- Or enter custom material details below --</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit_of_measure || 'units'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Material Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 18mm Marine Plywood"
                    value={formMaterialName}
                    onChange={(e) => {
                      setFormMaterialName(e.target.value);
                      if (selectedMaterialId) setSelectedMaterialId('');
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
                  >
                    <option value="Timber & Board">Timber & Board</option>
                    <option value="Finishing Paint">Finishing Paint</option>
                    <option value="Hardware & Fittings">Hardware & Fittings</option>
                    <option value="Electrical & MEP">Electrical & MEP</option>
                    <option value="Plumbing">Plumbing</option>
                    <option value="Tiles & Ceramics">Tiles & Ceramics</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Delivered</label>
                  <input
                    type="number"
                    min="0"
                    value={formQtyDelivered}
                    onChange={(e) => setFormQtyDelivered(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Consumed</label>
                  <input
                    type="number"
                    min="0"
                    value={formQtyConsumed}
                    onChange={(e) => setFormQtyConsumed(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#01875F] mb-1">Remaining *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formQtyRemaining}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFormQtyRemaining(v);
                      setFormQtyReturned(v);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-emerald-50 border border-emerald-300 rounded-xl font-bold text-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Physical Condition
                  </label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as RemnantCondition)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
                  >
                    <option value="good">Good (Re-usable)</option>
                    <option value="fair">Fair (Minor Scuffs)</option>
                    <option value="damaged">Damaged</option>
                    <option value="spoiled">Spoiled / Off-Spec</option>
                    <option value="scrap">Scrap Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Destination Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDestination}
                    onChange={(e) => setFormDestination(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Handover Notes & Custody Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Details of bundle, storage rack number, or authorized custodian..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#01875F]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRecordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#01875F] hover:bg-[#00704e] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Confirm Remnant Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Remnant Detail Modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#01875F]/10 text-[#01875F] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Remnant Inspection & Handover</h3>
                  <p className="text-xs text-slate-500">{detailItem.material_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Project:</span>
                  <span className="font-bold text-slate-800">{detailItem.project?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining Quantity:</span>
                  <span className="font-bold text-[#01875F]">
                    {detailItem.quantity_remaining} {detailItem.unit_of_measure}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Physical Condition:</span>
                  <span className="font-bold uppercase text-slate-800">{detailItem.condition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-bold text-slate-800">{detailItem.destination_location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Handover Date:</span>
                  <span className="text-slate-700">{formatNigerianDate(detailItem.handover_timestamp)}</span>
                </div>
              </div>

              {detailItem.notes && (
                <div className="p-3 bg-white rounded-xl border border-slate-100 text-slate-600">
                  <span className="font-bold block text-slate-700 mb-0.5">Notes:</span>
                  {detailItem.notes}
                </div>
              )}

              {/* Status Action Controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  Status: <strong className="uppercase">{detailItem.verification_status}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {detailItem.verification_status !== 'verified' && (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(detailItem.id, 'verified')}
                      className="px-3 py-1.5 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl font-bold cursor-pointer transition-colors"
                    >
                      Verify Handover
                    </button>
                  )}
                  {detailItem.verification_status !== 'disputed' && (
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate(detailItem.id, 'disputed')}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold cursor-pointer transition-colors"
                    >
                      Dispute
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
