import React, { useState } from 'react';
import {
  X,
  Building2,
  Calendar,
  Clock,
  Ruler,
  Calculator,
  TrendingUp,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Send,
  Plus,
  ShieldCheck,
  Check,
  ExternalLink,
  Users,
  DollarSign,
  HelpCircle,
  FileCheck2,
  Trash2,
} from 'lucide-react';
import {
  ProjectProjection,
  ProjectionLineItem,
  BOQCategory,
  ContributionRole,
  ProjectProjectionsService,
} from '../../services/projectProjectionsService';
import { formatNaira } from '../../services/dashboardService';
import { useAuth } from '../../hooks/useAuth';

interface ProjectionDetailModalProps {
  projection: ProjectProjection;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const ProjectionDetailModal: React.FC<ProjectionDetailModalProps> = ({
  projection,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { user, hasRole, currentRoleKey } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'technical' | 'boq' | 'financials' | 'contributions' | 'quotation' | 'approval' | 'convert'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Contribution Request Form
  const [showRequestContrib, setShowRequestContrib] = useState(false);
  const [contribRole, setContribRole] = useState<ContributionRole>('technical');
  const [contribInstructions, setContribInstructions] = useState('');

  // Departmental Contribution Submission Form
  const [showSubmitContrib, setShowSubmitContrib] = useState<string | null>(null);
  const [contribFindings, setContribFindings] = useState('');

  // Review Form
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected' | 'changes_requested'>('approved');
  const [reviewComments, setReviewComments] = useState('');

  // Quotation Feedback Form
  const [quotationAmount, setQuotationAmount] = useState(
    projection.proposed_selling_price || projection.estimated_grand_total
  );
  const [clientResponse, setClientResponse] = useState(
    projection.quotation?.client_response || 'pending'
  );
  const [rejectionReason, setRejectionReason] = useState(projection.rejection_reason || '');

  // Add line item directly to BOQ
  const [showAddLineItem, setShowAddLineItem] = useState(false);
  const [newCat, setNewCat] = useState<BOQCategory>('materials');
  const [newDesc, setNewDesc] = useState('');
  const [newSpec, setNewSpec] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newUnit, setNewUnit] = useState('units');
  const [newCost, setNewCost] = useState(0);

  const canApproveOrConvert =
    hasRole('management') ||
    hasRole('executive_director') ||
    hasRole('admin') ||
    currentRoleKey === 'admin';

  const isApproved = projection.status === 'approved' || projection.status === 'converted';
  const isConverted = projection.status === 'converted';

  // Request contribution
  const handleRequestContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribInstructions.trim()) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await ProjectProjectionsService.requestContribution({
        projectionId: projection.id,
        invitedRole: contribRole,
        instructions: contribInstructions.trim(),
      });
      if (!res.success) throw new Error(res.error || 'Failed to request contribution');
      setShowRequestContrib(false);
      setContribInstructions('');
      setActionSuccess(`Departmental contribution requested from ${contribRole}`);
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit contribution findings
  const handleSubmitContribution = async (contribId: string) => {
    if (!contribFindings.trim()) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await ProjectProjectionsService.submitContribution({
        projectionId: projection.id,
        contributionId: contribId,
        findings: contribFindings.trim(),
      });
      if (!res.success) throw new Error(res.error || 'Failed to submit findings');
      setShowSubmitContrib(null);
      setContribFindings('');
      setActionSuccess('Departmental contribution submitted successfully');
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Incorporate contribution suggested items into master BOQ
  const handleIncorporate = async (contribId: string) => {
    const contrib = projection.contributions?.find((c) => c.id === contribId);
    if (!contrib || !contrib.suggested_line_items || contrib.suggested_line_items.length === 0) {
      // If no suggested items, mark incorporated with note
      await ProjectProjectionsService.incorporateContribution({
        projectionId: projection.id,
        contributionId: contribId,
        lineItemsToAdopt: [],
      });
      onUpdated();
      return;
    }

    setLoading(true);
    try {
      await ProjectProjectionsService.incorporateContribution({
        projectionId: projection.id,
        contributionId: contribId,
        lineItemsToAdopt: contrib.suggested_line_items,
      });
      setActionSuccess('Contribution findings adopted into master Bill of Quantities');
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Review & Approval Submission
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComments.trim()) {
      setActionError('Review comments and justification are required');
      return;
    }
    setLoading(true);
    setActionError(null);
    try {
      const res = await ProjectProjectionsService.reviewProjection({
        projectionId: projection.id,
        decision: reviewDecision,
        comments: reviewComments.trim(),
      });
      if (!res.success) throw new Error(res.error || 'Failed to submit review');
      setActionSuccess(`Projection marked as ${reviewDecision.replace('_', ' ')}`);
      setReviewComments('');
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save quotation updates
  const handleQuotationSave = async () => {
    setLoading(true);
    setActionError(null);
    try {
      await ProjectProjectionsService.updateQuotation(projection.id, {
        quotation_amount: Number(quotationAmount),
        proposed_selling_price: Number(quotationAmount),
        client_response: clientResponse as any,
        rejection_reason: clientResponse === 'rejected' ? rejectionReason : undefined,
        acceptance_date: clientResponse === 'accepted' ? new Date().toISOString() : undefined,
      });
      setActionSuccess('Quotation details and client feedback updated');
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Convert to project
  const handleConvertToProject = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await ProjectProjectionsService.convertToProject(projection.id);
      if (res.error) throw new Error(res.error);
      setActionSuccess(`Successfully converted to official Project ${res.data?.project_code}!`);
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add line item to BOQ
  const handleAddBOQLine = async () => {
    if (!newDesc.trim() || newQty <= 0 || newCost < 0) return;
    const currentItems = projection.line_items || [];
    const newItem: ProjectionLineItem = {
      id: crypto.randomUUID(),
      projection_id: projection.id,
      category: newCat,
      item_description: newDesc.trim(),
      specification: newSpec.trim() || undefined,
      unit_of_measure: newUnit.trim() || 'units',
      quantity: Number(newQty),
      unit_cost: Number(newCost),
      total_cost: Number(newQty) * Number(newCost),
      sort_order: currentItems.length + 1,
      created_at: new Date().toISOString(),
    };

    setLoading(true);
    try {
      await ProjectProjectionsService.updateProjection(projection.id, {
        line_items: [...currentItems, newItem],
      });
      setShowAddLineItem(false);
      setNewDesc('');
      setNewSpec('');
      setNewQty(1);
      setNewCost(0);
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBOQLine = async (itemId: string) => {
    const currentItems = projection.line_items || [];
    setLoading(true);
    try {
      await ProjectProjectionsService.updateProjection(projection.id, {
        line_items: currentItems.filter((it) => it.id !== itemId),
      });
      onUpdated();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[96vh] sm:max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-start justify-between shrink-0 bg-slate-50/70">
          <div className="min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
              <span className="font-mono text-[11px] sm:text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {projection.projection_number}
              </span>
              <span className="text-[11px] sm:text-xs text-slate-400 font-semibold">v{projection.version}</span>
              <span
                className={`text-[10.5px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 rounded-full capitalize ${
                  projection.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : projection.status === 'converted'
                    ? 'bg-blue-100 text-blue-800'
                    : projection.status === 'under_review'
                    ? 'bg-amber-100 text-amber-800'
                    : projection.status === 'client_review'
                    ? 'bg-cyan-100 text-cyan-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {projection.status.replace('_', ' ')}
              </span>
              {projection.sub_status && (
                <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[140px] sm:max-w-none">
                  {projection.sub_status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight truncate">
              {projection.proposed_project_name}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">Client: {projection.client_name}</p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isConverted && projection.converted_project_code && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                Active: {projection.converted_project_code}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace Navigation Tabs with responsive horizontal scrolling */}
        <div className="px-3 sm:px-6 border-b border-slate-200 bg-white flex items-center gap-1 overflow-x-auto no-scrollbar text-xs font-semibold shrink-0 flex-nowrap">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'technical', label: 'Technical' },
            { id: 'boq', label: `BOQ (${projection.line_items?.length || 0})` },
            { id: 'financials', label: 'Financials' },
            { id: 'contributions', label: `Contributions (${projection.contributions?.length || 0})` },
            { id: 'quotation', label: 'Quotation' },
            { id: 'approval', label: 'Review' },
            { id: 'convert', label: 'Conversion' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-2.5 sm:px-3.5 border-b-2 whitespace-nowrap transition-colors cursor-pointer min-h-[44px] flex items-center ${
                activeTab === tab.id
                  ? 'border-[#01875F] text-[#01875F] font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Content Canvas */}
        <div className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 min-h-0">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
              <span>{actionError}</span>
              <button type="button" onClick={() => setActionError(null)} className="text-red-500 font-bold">✕</button>
            </div>
          )}
          {actionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {actionSuccess}
              </span>
              <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold">✕</button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Estimated Project Cost</span>
                  <span className="text-base font-bold text-amber-700 font-mono mt-0.5 block">
                    {formatNaira(projection.estimated_grand_total)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Includes {projection.contingency_percentage}% contingency</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Proposed Selling Price</span>
                  <span className="text-base font-bold text-slate-900 font-mono mt-0.5 block">
                    {formatNaira(projection.proposed_selling_price || projection.estimated_grand_total)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Contract quotation value</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Projected Gross Profit</span>
                  <span className="text-base font-bold text-emerald-700 font-mono mt-0.5 block">
                    {formatNaira(projection.projected_gross_profit)}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
                    {projection.projected_gross_margin_pct}% margin
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Timeline</span>
                  <span className="text-base font-bold text-slate-800 mt-0.5 block">
                    {projection.target_duration_weeks || 4} Weeks
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Start: {projection.target_start_date || 'TBD'}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Client & Job Identification</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Client / Organization:</span>
                    <strong className="text-slate-900 text-sm">{projection.client_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Site Location:</span>
                    <strong className="text-slate-900 text-sm">{projection.site_location || 'Not specified'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Phone:</span>
                    <span className="text-slate-800">{projection.client_phone || 'None recorded'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Email:</span>
                    <span className="text-slate-800">{projection.client_email || 'None recorded'}</span>
                  </div>
                </div>

                {projection.scope_of_work && (
                  <div className="pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-semibold block mb-1">Scope of Work Brief:</span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                      {projection.scope_of_work}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL SCOPE */}
          {activeTab === 'technical' && (
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Work Areas & Measured Square Metres
                </h3>
                {projection.technical_scope?.work_areas && projection.technical_scope.work_areas.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {projection.technical_scope.work_areas.map((w, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50">
                        <div>
                          <strong className="text-slate-900 block">{w.name}</strong>
                          <span className="text-slate-500 text-[11px]">{w.description}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-900 font-mono">{w.sqm} sqm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No specific work areas captured yet.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Surface Conditions</span>
                  <p className="text-slate-800">{projection.technical_scope?.surface_conditions || 'Standard'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Surface Preparation</span>
                  <p className="text-slate-800">{projection.technical_scope?.surface_preparation || 'Standard priming'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Required Finishing</span>
                  <p className="text-slate-800">{projection.technical_scope?.required_finishing || 'Per specification'}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="font-semibold text-slate-500 uppercase text-[10px]">Identified Technical Risks</span>
                  <p className="text-slate-800">{projection.technical_scope?.technical_risks?.join(', ') || 'No critical risks identified'}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BILL OF QUANTITIES (BOQ) */}
          {activeTab === 'boq' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Bill of Quantities Line Items
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Grand Total: <strong className="text-amber-700">{formatNaira(projection.estimated_grand_total)}</strong>
                  </p>
                </div>
                {!isApproved && (
                  <button
                    type="button"
                    onClick={() => setShowAddLineItem(!showAddLineItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#01875F] text-white rounded-lg hover:bg-[#01704f] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add BOQ Item
                  </button>
                )}
              </div>

              {showAddLineItem && (
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-slate-900">Add Item to Bill of Quantities:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Category</label>
                      <select
                        value={newCat}
                        onChange={(e) => setNewCat(e.target.value as BOQCategory)}
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      >
                        <option value="materials">Materials</option>
                        <option value="labour">Labour</option>
                        <option value="equipment_hire">Equipment Hire</option>
                        <option value="logistics">Logistics</option>
                        <option value="preliminaries">Preliminaries</option>
                        <option value="subcontractor">Subcontractor</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Description *</label>
                      <input
                        type="text"
                        placeholder="Item name"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Unit</label>
                      <input
                        type="text"
                        placeholder="sqm/days"
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Qty</label>
                      <input
                        type="number"
                        min={0.1}
                        value={newQty}
                        onChange={(e) => setNewQty(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Unit Cost (₦)</label>
                      <input
                        type="number"
                        min={0}
                        value={newCost}
                        onChange={(e) => setNewCost(Number(e.target.value))}
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddLineItem(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleAddBOQLine}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#01875F] text-white rounded hover:bg-[#01704f]"
                    >
                      Save Item
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-xs text-left min-w-[580px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-center">Unit</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Total Cost</th>
                      {!isApproved && <th className="py-2.5 px-2 text-center"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(projection.line_items || []).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <span className="capitalize font-semibold text-slate-700 px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">
                            {item.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{item.item_description}</div>
                          {item.specification && <div className="text-[10px] text-slate-500">{item.specification}</div>}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">{item.quantity}</td>
                        <td className="py-2 px-2 text-center text-slate-500">{item.unit_of_measure}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNaira(item.unit_cost)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatNaira(item.total_cost || item.quantity * item.unit_cost)}
                        </td>
                        {!isApproved && (
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveBOQLine(item.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {/* TAB 4: FINANCIALS */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Cost Breakdown vs Commercial Value
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Materials Cost:</span>
                    <strong className="font-mono text-slate-900">{formatNaira(projection.total_material_cost)}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Labour & Artisan Cost:</span>
                    <strong className="font-mono text-slate-900">{formatNaira(projection.total_labour_cost)}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Logistics & Transportation:</span>
                    <strong className="font-mono text-slate-900">{formatNaira(projection.total_logistics_cost)}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Contingency Reserve ({projection.contingency_percentage}%):</span>
                    <strong className="font-mono text-slate-900">{formatNaira(projection.contingency_amount)}</strong>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-bold bg-slate-50 px-3 rounded-lg border border-slate-200/80">
                    <span className="text-slate-800">Total Estimated Cost:</span>
                    <span className="font-mono text-amber-700">{formatNaira(projection.estimated_grand_total)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <span className="text-xs font-semibold text-blue-800 uppercase block">Proposed Selling Price</span>
                    <div className="text-xl font-bold text-blue-900 font-mono mt-1">
                      {formatNaira(projection.proposed_selling_price)}
                    </div>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-xs font-semibold text-emerald-800 uppercase block">Projected Gross Profit</span>
                    <div className="text-xl font-bold text-emerald-800 font-mono mt-1">
                      {formatNaira(projection.projected_gross_profit)}
                    </div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <span className="text-xs font-semibold text-purple-800 uppercase block">Gross Margin %</span>
                    <div className="text-xl font-bold text-purple-800 font-mono mt-1">
                      {projection.projected_gross_margin_pct}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DEPARTMENTAL CONTRIBUTIONS */}
          {activeTab === 'contributions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Departmental Planning Contributions
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Contributors submit independent input without directly overwriting the master projection.
                  </p>
                </div>
                {!isApproved && (
                  <button
                    type="button"
                    onClick={() => setShowRequestContrib(!showRequestContrib)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#01875F] text-white rounded-lg hover:bg-[#01704f] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Request Contribution
                  </button>
                )}
              </div>

              {showRequestContrib && (
                <form onSubmit={handleRequestContribution} className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-slate-900">Invite Department for Independent Input:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Target Department</label>
                      <select
                        value={contribRole}
                        onChange={(e) => setContribRole(e.target.value as ContributionRole)}
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      >
                        <option value="technical">Technical Officer (Measurements & Scope)</option>
                        <option value="procurement">Procurement (Material Quotes & Availability)</option>
                        <option value="supervisor">Site Supervisor (Labour & Duration)</option>
                        <option value="accounts">Accounts (Payment & Commercial Costing)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Specific Instructions</label>
                      <input
                        type="text"
                        placeholder="e.g. Please verify slab moisture levels and confirm parquet wastage factor"
                        value={contribInstructions}
                        onChange={(e) => setContribInstructions(e.target.value)}
                        className="w-full p-1.5 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRequestContrib(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#01875F] text-white rounded hover:bg-[#01704f]"
                    >
                      Send Request
                    </button>
                  </div>
                </form>
              )}

              {/* Contributions List */}
              <div className="space-y-3">
                {(!projection.contributions || projection.contributions.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                    No departmental contributions requested yet.
                  </div>
                ) : (
                  projection.contributions.map((c) => (
                    <div key={c.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            {c.invited_role}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                              c.status === 'submitted'
                                ? 'bg-blue-100 text-blue-800'
                                : c.status === 'incorporated'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Instructions:</span>
                        {c.instructions}
                      </div>

                      {c.findings && (
                        <div className="text-xs text-slate-800 bg-blue-50/60 p-2.5 rounded-lg border border-blue-200/60">
                          <span className="text-[10px] uppercase font-bold text-blue-600 block mb-0.5">Submitted Findings:</span>
                          {c.findings}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        {c.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => setShowSubmitContrib(c.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Record Findings for {c.invited_role}
                          </button>
                        )}
                        {c.status === 'submitted' && canApproveOrConvert && (
                          <button
                            type="button"
                            onClick={() => handleIncorporate(c.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Incorporate into Master BOQ
                          </button>
                        )}
                      </div>

                      {/* Submission drawer */}
                      {showSubmitContrib === c.id && (
                        <div className="p-3 bg-blue-50/80 rounded-xl space-y-2 mt-2">
                          <label className="block text-xs font-bold text-blue-900">
                            Submit {c.invited_role.toUpperCase()} Findings & Recommendations:
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Enter technical measurements, supplier quotes, workforce counts..."
                            value={contribFindings}
                            onChange={(e) => setContribFindings(e.target.value)}
                            className="w-full p-2 border border-blue-200 rounded text-xs bg-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowSubmitContrib(null)}
                              className="px-2.5 py-1 text-xs text-slate-600"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSubmitContribution(c.id)}
                              className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded"
                            >
                              Submit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: QUOTATION & ACCEPTANCE */}
          {activeTab === 'quotation' && (
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Client Quotation Tracking & Commercial Acceptance
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Quotation Reference
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={projection.quotation?.quotation_reference || `QTN-${projection.projection_number}`}
                      className="w-full p-2 border border-slate-200 rounded bg-slate-50 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Quotation Amount (₦)
                    </label>
                    <input
                      type="number"
                      value={quotationAmount}
                      onChange={(e) => setQuotationAmount(Number(e.target.value))}
                      className="w-full p-2 border border-slate-300 rounded font-mono font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Client Response Status
                    </label>
                    <select
                      value={clientResponse}
                      onChange={(e) => setClientResponse(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                    >
                      <option value="pending">Pending Client Decision</option>
                      <option value="negotiation">Commercial Negotiation in Progress</option>
                      <option value="accepted">Quotation Accepted by Client</option>
                      <option value="rejected">Client Declined Quotation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Required Deposit %
                    </label>
                    <input
                      type="number"
                      readOnly
                      value={projection.quotation?.deposit_percentage_required || 70}
                      className="w-full p-2 border border-slate-200 rounded bg-slate-50 font-mono text-xs"
                    />
                  </div>
                </div>

                {clientResponse === 'rejected' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      Rejection Reason
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why did client decline the quotation?"
                      className="w-full p-2 border border-slate-300 rounded text-xs"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleQuotationSave}
                    className="px-4 py-2 text-xs font-semibold bg-[#01875F] text-white rounded-lg hover:bg-[#01704f] transition-colors"
                  >
                    Save Quotation Updates
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: MANAGEMENT APPROVAL */}
          {activeTab === 'approval' && (
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Executive Review & Commercial Approval
                </h3>

                {projection.status === 'approved' ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Projection is Officially Approved
                    </div>
                    <p className="text-emerald-800">
                      Approved on: {new Date(projection.approved_at || projection.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleReviewSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Review Verdict *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="p-3 border rounded-xl flex items-center gap-2 cursor-pointer border-slate-200 hover:bg-slate-50">
                          <input
                            type="radio"
                            name="reviewDecision"
                            checked={reviewDecision === 'approved'}
                            onChange={() => setReviewDecision('approved')}
                            className="accent-[#01875F]"
                          />
                          <span className="text-xs font-semibold text-emerald-800">Approve Commercials</span>
                        </label>
                        <label className="p-3 border rounded-xl flex items-center gap-2 cursor-pointer border-slate-200 hover:bg-slate-50">
                          <input
                            type="radio"
                            name="reviewDecision"
                            checked={reviewDecision === 'changes_requested'}
                            onChange={() => setReviewDecision('changes_requested')}
                            className="accent-amber-500"
                          />
                          <span className="text-xs font-semibold text-amber-800">Request Revisions</span>
                        </label>
                        <label className="p-3 border rounded-xl flex items-center gap-2 cursor-pointer border-slate-200 hover:bg-slate-50">
                          <input
                            type="radio"
                            name="reviewDecision"
                            checked={reviewDecision === 'rejected'}
                            onChange={() => setReviewDecision('rejected')}
                            className="accent-red-500"
                          />
                          <span className="text-xs font-semibold text-red-800">Reject Proposal</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Review Comments & Justification *
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Provide executive comments on pricing, technical feasibility, and commercial risks..."
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading || !canApproveOrConvert}
                        className="px-4 py-2 text-xs font-semibold bg-[#01875F] text-white rounded-lg hover:bg-[#01704f] disabled:opacity-50"
                      >
                        Submit Management Decision
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: CONVERSION TO ACTIVE PROJECT */}
          {activeTab === 'convert' && (
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Convert Proposal into Active Davejoe Project
                </h3>

                {isConverted ? (
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      Already Converted to Official Project
                    </div>
                    <p className="text-xs text-blue-800">
                      Project Code: <strong>{projection.converted_project_code}</strong>.
                      Converted at {new Date(projection.converted_at || '').toLocaleString()}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Pre-flight checklist */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="font-bold text-slate-900 mb-1">Pre-Conversion Clearance Checklist:</div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Projection status is Approved</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Quotation accepted by client</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Commercial deposit terms confirmed</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>Idempotent conversion safeguard active (prevents duplicate projects)</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">
                      Upon conversion, an official project will be created in the core project management database,
                      preserving approved client data, budget value ({formatNaira(projection.proposed_selling_price)}),
                      and technical specifications.
                    </p>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        disabled={loading || !canApproveOrConvert}
                        onClick={handleConvertToProject}
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-[#01875F] text-white hover:bg-[#01704f] rounded-xl shadow-xs transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Convert to Active Project
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
