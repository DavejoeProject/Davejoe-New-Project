import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  Building2,
  Ruler,
  Calculator,
  TrendingUp,
  FileText,
  AlertCircle,
  HelpCircle,
  Package,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  ProjectProjectionsService,
  BOQCategory,
  ProjectionLineItem,
  TechnicalScopeDetails,
} from '../../services/projectProjectionsService';
import { formatNaira } from '../../services/dashboardService';

interface CreateProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateProjectionModal: React.FC<CreateProjectionModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clients list from database
  const [existingClients, setExistingClients] = useState<Array<{ id: string; name: string; phone?: string; email?: string }>>([]);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');

  // STEP 1 Form
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [proposedProjectName, setProposedProjectName] = useState('');
  const [siteLocation, setSiteLocation] = useState('');
  const [projectType, setProjectType] = useState('Interior Finishing & Fit-out');
  const [scopeOfWork, setScopeOfWork] = useState('');
  const [sourceEnquiry, setSourceEnquiry] = useState('');
  const [targetStartDate, setTargetStartDate] = useState('');
  const [targetDurationWeeks, setTargetDurationWeeks] = useState(4);

  // STEP 2 Form: Technical Scope & Work Areas
  const [workAreas, setWorkAreas] = useState<Array<{ name: string; description: string; sqm: number }>>([
    { name: 'Main Living Area', description: 'Engineered wood flooring installation & skirting', sqm: 65 },
  ]);
  const [surfaceConditions, setSurfaceConditions] = useState('Standard screeded slab with minor surface variations');
  const [surfacePreparation, setSurfacePreparation] = useState('Self-leveling screed primer and moisture barrier application');
  const [requiredFinishing, setRequiredFinishing] = useState('Engineered hardwood parquet with acoustic underlay');
  const [technicalRisks, setTechnicalRisks] = useState('Moisture levels on ground floor slab require damp-proof membrane');
  const [specialEquipment, setSpecialEquipment] = useState('Industrial floor grinder, moisture meter, laser level');

  // STEP 3 Form: BOQ Line Items
  const [lineItems, setLineItems] = useState<Array<Omit<ProjectionLineItem, 'id' | 'projection_id' | 'created_at'>>>([
    {
      category: 'materials',
      item_description: 'Engineered Oak Wood Planks (15mm x 190mm)',
      specification: 'Grade A European Oak, UV Matt Lacquered',
      unit_of_measure: 'sqm',
      quantity: 75,
      unit_cost: 38500,
      total_cost: 75 * 38500,
      sort_order: 1,
      notes: 'Includes 15% cutting and pattern waste reserve',
    },
    {
      category: 'materials',
      item_description: 'Acoustic Soundproofing Underlayment & Vapour Barrier',
      specification: '3mm High-Density Rubberized Cork Underlay',
      unit_of_measure: 'rolls',
      quantity: 5,
      unit_cost: 45000,
      total_cost: 5 * 45000,
      sort_order: 2,
      notes: 'Moisture resistant membrane',
    },
    {
      category: 'labour',
      item_description: 'Skilled Floor Master Artisan & Helper Team',
      specification: 'Flooring preparation, laser alignment and laying',
      unit_of_measure: 'days',
      quantity: 12,
      unit_cost: 35000,
      total_cost: 12 * 35000,
      sort_order: 3,
      notes: '2 Lead artisans + 2 assistants for 12 working days',
    },
    {
      category: 'logistics',
      item_description: 'Transport & Site Delivery from Central Logistics Depot',
      specification: 'Dedicated flatbed transit with waterproof tarping',
      unit_of_measure: 'trips',
      quantity: 2,
      unit_cost: 75000,
      total_cost: 2 * 75000,
      sort_order: 4,
      notes: 'Offloading and ground-floor distribution included',
    },
  ]);

  // STEP 4 Form: Pricing & Financials
  const [contingencyPercentage, setContingencyPercentage] = useState(7.5);
  const [proposedSellingPrice, setProposedSellingPrice] = useState<number>(0);

  // New BOQ item inputs
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<BOQCategory>('materials');
  const [newItemSpec, setNewItemSpec] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('units');
  const [newItemCost, setNewItemCost] = useState(0);

  // Fetch real clients from Supabase
  useEffect(() => {
    async function loadClients() {
      try {
        const { data } = await supabase.from('clients').select('id, name, phone, email').order('name');
        if (data) setExistingClients(data);
      } catch (e) {
        console.warn('Failed to load clients:', e);
      }
    }
    loadClients();
  }, []);

  // Sync client details when selecting existing client
  const handleSelectClient = (cId: string) => {
    setClientId(cId);
    const found = existingClients.find((c) => c.id === cId);
    if (found) {
      setClientName(found.name);
      setClientPhone(found.phone || '');
      setClientEmail(found.email || '');
    }
  };

  // Add work area
  const handleAddWorkArea = () => {
    setWorkAreas([...workAreas, { name: '', description: '', sqm: 0 }]);
  };

  const handleRemoveWorkArea = (idx: number) => {
    setWorkAreas(workAreas.filter((_, i) => i !== idx));
  };

  // Add BOQ item
  const handleAddLineItem = () => {
    if (!newItemDesc.trim() || newItemQty <= 0 || newItemCost < 0) return;
    const item: Omit<ProjectionLineItem, 'id' | 'projection_id' | 'created_at'> = {
      category: newItemCategory,
      item_description: newItemDesc.trim(),
      specification: newItemSpec.trim() || undefined,
      unit_of_measure: newItemUnit.trim() || 'units',
      quantity: Number(newItemQty),
      unit_cost: Number(newItemCost),
      total_cost: Number(newItemQty) * Number(newItemCost),
      sort_order: lineItems.length + 1,
    };
    setLineItems([...lineItems, item]);
    setNewItemDesc('');
    setNewItemSpec('');
    setNewItemQty(1);
    setNewItemCost(0);
  };

  const handleRemoveLineItem = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  // Calculated totals
  const materialCost = lineItems
    .filter((i) => i.category === 'materials')
    .reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const labourCost = lineItems
    .filter((i) => i.category === 'labour')
    .reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const equipmentCost = lineItems
    .filter((i) => i.category === 'equipment_hire')
    .reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const logisticsCost = lineItems
    .filter((i) => i.category === 'logistics')
    .reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
  const otherCost = lineItems
    .filter((i) => !['materials', 'labour', 'equipment_hire', 'logistics'].includes(i.category))
    .reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  const directCost = materialCost + labourCost + equipmentCost + logisticsCost + otherCost;
  const contingencyAmount = Math.round(directCost * (contingencyPercentage / 100));
  const estimatedGrandTotal = directCost + contingencyAmount;

  // Set default proposed price if 0
  useEffect(() => {
    if (proposedSellingPrice === 0 && estimatedGrandTotal > 0) {
      setProposedSellingPrice(Math.round(estimatedGrandTotal * 1.35));
    }
  }, [estimatedGrandTotal, proposedSellingPrice]);

  const projectedGrossProfit = Math.max(0, proposedSellingPrice - estimatedGrandTotal);
  const projectedGrossMarginPct =
    proposedSellingPrice > 0
      ? Math.round((projectedGrossProfit / proposedSellingPrice) * 1000) / 10
      : 0;

  // Submit projection
  const handleSubmit = async (submitForReview: boolean) => {
    setError(null);
    if (!proposedProjectName.trim()) {
      setError('Proposed project name is required');
      setStep(1);
      return;
    }
    if (!clientName.trim()) {
      setError('Client name is required');
      setStep(1);
      return;
    }
    if (lineItems.length === 0) {
      setError('At least one BOQ line item is required');
      setStep(3);
      return;
    }

    setSubmitting(true);
    try {
      const technical_scope: TechnicalScopeDetails = {
        work_areas: workAreas,
        total_sqm: workAreas.reduce((acc, a) => acc + (Number(a.sqm) || 0), 0),
        surface_conditions: surfaceConditions,
        surface_preparation: surfacePreparation,
        required_finishing: requiredFinishing,
        technical_risks: technicalRisks ? [technicalRisks] : [],
        special_equipment: specialEquipment ? [specialEquipment] : [],
      };

      const res = await ProjectProjectionsService.createProjection({
        title: proposedProjectName.trim(),
        proposed_project_name: proposedProjectName.trim(),
        client_id: clientId || undefined,
        client_name: clientName.trim(),
        client_email: clientEmail || undefined,
        client_phone: clientPhone || undefined,
        client_address: clientAddress || undefined,
        site_location: siteLocation || undefined,
        scope_of_work: scopeOfWork || undefined,
        target_duration_weeks: targetDurationWeeks,
        target_start_date: targetStartDate || undefined,
        technical_scope,
        line_items: lineItems,
        contingency_percentage: contingencyPercentage,
        proposed_selling_price: proposedSellingPrice,
        notes: sourceEnquiry ? `Source Enquiry: ${sourceEnquiry}` : undefined,
      });

      if (res.error) throw new Error(res.error);

      // If requested, set status to under review / awaiting contributions
      if (submitForReview && res.data) {
        await ProjectProjectionsService.updateProjection(res.data.id, {
          status: 'under_review',
          sub_status: 'awaiting_contributions',
        });
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create projection');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#01875F]" />
              New Project Projection & Cost Estimation
            </h2>
            <p className="text-xs text-slate-500">
              Step {step} of 5 — {step === 1 && 'Client & Job Identification'}
              {step === 2 && 'Technical Scope & Measurements'}
              {step === 3 && 'Bill of Quantities (BOQ)'}
              {step === 4 && 'Cost Projection & Commercial Pricing'}
              {step === 5 && 'Executive Review & Submission'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 pt-3 pb-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs font-semibold shrink-0">
          {[
            { num: 1, label: 'Client & Job' },
            { num: 2, label: 'Technical Scope' },
            { num: 3, label: 'BOQ Builder' },
            { num: 4, label: 'Financials' },
            { num: 5, label: 'Review' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setStep(s.num)}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
                step === s.num
                  ? 'bg-[#01875F] text-white shadow-2xs'
                  : step > s.num
                  ? 'text-[#01875F] bg-[#01875F]/10'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold bg-white/20">
                {step > s.num ? <Check className="w-3 h-3" /> : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: CLIENT & JOB INFORMATION */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-700">Client Source:</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="clientMode"
                    checked={clientMode === 'existing'}
                    onChange={() => setClientMode('existing')}
                    className="accent-[#01875F]"
                  />
                  Select Existing Client ({existingClients.length})
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="radio"
                    name="clientMode"
                    checked={clientMode === 'new'}
                    onChange={() => {
                      setClientMode('new');
                      setClientId('');
                    }}
                    className="accent-[#01875F]"
                  />
                  New Prospective Client
                </label>
              </div>

              {clientMode === 'existing' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Select Client Account *
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => handleSelectClient(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  >
                    <option value="">-- Choose Existing Client --</option>
                    {existingClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Client / Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chevron Nigeria Ltd / Mr. Tunde Adeleke"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Proposed Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Eko Atlantic Luxury Penthouse Fit-Out"
                    value={proposedProjectName}
                    onChange={(e) => setProposedProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. +234 803 123 4567"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Project Type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  >
                    <option>Interior Finishing & Fit-out</option>
                    <option>Hardwood & Parquet Flooring</option>
                    <option>Full Architectural Renovation</option>
                    <option>Commercial Office Space</option>
                    <option>Hospitality & Hotel Fit-out</option>
                    <option>Residential Luxury Villa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Site Location / Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Tower A, Victoria Island, Lagos"
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Source Enquiry / Referral</label>
                  <input
                    type="text"
                    placeholder="e.g. Direct Referral from Arc. Somoye / Website Enquiry #1042"
                    value={sourceEnquiry}
                    onChange={(e) => setSourceEnquiry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Scope of Requested Work</label>
                <textarea
                  rows={2}
                  placeholder="Detailed description of client's requirements, architectural brief and requested deliverables..."
                  value={scopeOfWork}
                  onChange={(e) => setScopeOfWork(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Target Commencement Date</label>
                  <input
                    type="date"
                    value={targetStartDate}
                    onChange={(e) => setTargetStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Estimated Duration (Weeks)</label>
                  <input
                    type="number"
                    min={1}
                    value={targetDurationWeeks}
                    onChange={(e) => setTargetDurationWeeks(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TECHNICAL SCOPE & MEASUREMENTS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Work Areas & Measured Dimensions
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Record each room or site section with measured square metres
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddWorkArea}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#01875F] text-white hover:bg-[#01704f] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Work Area
                </button>
              </div>

              <div className="space-y-2.5">
                {workAreas.map((area, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Area Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Master Bedroom"
                        value={area.name}
                        onChange={(e) => {
                          const updated = [...workAreas];
                          updated[idx].name = e.target.value;
                          setWorkAreas(updated);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Technical Scope</label>
                      <input
                        type="text"
                        placeholder="e.g. Parquet flooring with perimeter cork expansion joints"
                        value={area.description}
                        onChange={(e) => {
                          const updated = [...workAreas];
                          updated[idx].description = e.target.value;
                          setWorkAreas(updated);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Area (sqm)</label>
                      <input
                        type="number"
                        min={0}
                        value={area.sqm}
                        onChange={(e) => {
                          const updated = [...workAreas];
                          updated[idx].sqm = Number(e.target.value);
                          setWorkAreas(updated);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      {workAreas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkArea(idx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-900">Total Measured Area:</span>
                  <span className="font-bold text-emerald-800 text-sm">
                    {workAreas.reduce((sum, a) => sum + (Number(a.sqm) || 0), 0)} sqm
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Existing Surface Conditions
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Existing screed is dry but has 3mm undulations requiring self-leveling"
                    value={surfaceConditions}
                    onChange={(e) => setSurfaceConditions(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Surface Preparation Requirements
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Floor grinding, moisture test, polyurethane primer and leveling compound"
                    value={surfacePreparation}
                    onChange={(e) => setSurfacePreparation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Required Finishing Specifications
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Italian Porcelain 120x60cm / 15mm French Oak Parquet"
                    value={requiredFinishing}
                    onChange={(e) => setRequiredFinishing(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Identified Technical Risks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rising dampness from sub-base / site access window restrictions"
                    value={technicalRisks}
                    onChange={(e) => setTechnicalRisks(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INTERACTIVE BILL OF QUANTITIES (BOQ) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Interactive Bill of Quantities (BOQ)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add line items across Materials, Labour, Equipment, and Logistics
                  </p>
                </div>
              </div>

              {/* Add item row */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-800">Add Line Item to Estimate:</div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Category</label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value as BOQCategory)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="materials">Materials</option>
                      <option value="labour">Labour & Artisans</option>
                      <option value="equipment_hire">Equipment Hire</option>
                      <option value="logistics">Logistics & Transport</option>
                      <option value="preliminaries">Preliminaries</option>
                      <option value="subcontractor">Subcontractor</option>
                      <option value="other">Other Costs</option>
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Description *</label>
                    <input
                      type="text"
                      placeholder="e.g. 15mm French Oak Parquet Planks"
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Unit</label>
                    <input
                      type="text"
                      placeholder="sqm / bags / days"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Qty</label>
                    <input
                      type="number"
                      min={0.1}
                      step="any"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">Unit Cost (₦)</label>
                    <input
                      type="number"
                      min={0}
                      value={newItemCost}
                      onChange={(e) => setNewItemCost(Number(e.target.value))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-xs text-slate-600 font-medium">
                    Line Total: <strong className="text-slate-900">{formatNaira(newItemQty * newItemCost)}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#01875F] text-white hover:bg-[#01704f] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>
              </div>

              {/* BOQ Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-center">Unit</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Total Cost</th>
                      <th className="py-2.5 px-2 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3">
                          <span className="capitalize font-semibold text-slate-700 px-1.5 py-0.5 rounded bg-slate-100 text-[10px]">
                            {item.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{item.item_description}</div>
                          {item.specification && (
                            <div className="text-[10px] text-slate-500">{item.specification}</div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">{item.quantity}</td>
                        <td className="py-2 px-2 text-center text-slate-500">{item.unit_of_measure}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatNaira(item.unit_cost)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                          {formatNaira(item.quantity * item.unit_cost)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Subtotal summaries */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Materials</span>
                  <span className="font-bold text-slate-900">{formatNaira(materialCost)}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Labour</span>
                  <span className="font-bold text-slate-900">{formatNaira(labourCost)}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Logistics</span>
                  <span className="font-bold text-slate-900">{formatNaira(logisticsCost)}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Equipment / Other</span>
                  <span className="font-bold text-slate-900">{formatNaira(equipmentCost + otherCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: COST PROJECTION & COMMERCIAL PRICING */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="p-5 bg-gradient-to-r from-slate-50 to-emerald-50/40 rounded-xl border border-slate-200/90 space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#01875F]" />
                  Consolidated Cost Structure & Contingency
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-600">Total Direct Project Cost (Materials, Labour, Logistics):</span>
                    <strong className="font-mono text-slate-900">{formatNaira(directCost)}</strong>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">Contingency Reserve:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={25}
                          step={0.5}
                          value={contingencyPercentage}
                          onChange={(e) => setContingencyPercentage(Number(e.target.value))}
                          className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs font-bold bg-white"
                        />
                        <span className="text-slate-500">%</span>
                      </div>
                    </div>
                    <strong className="font-mono text-slate-900">{formatNaira(contingencyAmount)}</strong>
                  </div>

                  <div className="flex justify-between py-2 text-sm font-bold text-slate-900 bg-white/70 px-3 rounded-lg border border-slate-200/70">
                    <span>Total Estimated Project Cost:</span>
                    <span className="font-mono text-amber-700">{formatNaira(estimatedGrandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Commercial Contract Pricing */}
              <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#01875F]" />
                  Commercial Pricing & Profitability Analysis
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Proposed Contract Selling Price (₦) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={proposedSellingPrice}
                    onChange={(e) => setProposedSellingPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-base font-bold font-mono focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    This is the proposed quotation amount to be presented to the client.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200">
                    <span className="text-xs font-semibold text-emerald-800 uppercase block">Projected Gross Profit</span>
                    <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
                      {formatNaira(projectedGrossProfit)}
                    </div>
                    <span className="text-[11px] text-emerald-600 mt-0.5 block">
                      Contract Selling Price minus Estimated Total Cost
                    </span>
                  </div>

                  <div className="p-4 bg-purple-50/70 rounded-xl border border-purple-200">
                    <span className="text-xs font-semibold text-purple-800 uppercase block">Projected Gross Margin</span>
                    <div className="text-xl font-bold text-purple-700 font-mono mt-1">
                      {projectedGrossMarginPct}%
                    </div>
                    <span className="text-[11px] text-purple-600 mt-0.5 block">
                      {projectedGrossMarginPct >= 25 ? 'Meets company profitability guideline' : 'Attention: Below standard 25% target'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PLANNING REVIEW & SUBMISSION */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <h3 className="font-bold text-slate-900 text-sm">{proposedProjectName}</h3>
                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>Client: <strong className="text-slate-800">{clientName}</strong></div>
                  <div>Location: <strong className="text-slate-800">{siteLocation || 'TBD'}</strong></div>
                  <div>Duration: <strong className="text-slate-800">{targetDurationWeeks} Weeks</strong></div>
                  <div>Commencement: <strong className="text-slate-800">{targetStartDate || 'TBD'}</strong></div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Cost</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{formatNaira(estimatedGrandTotal)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Contract Price</span>
                  <span className="text-sm font-bold text-blue-700 font-mono">{formatNaira(proposedSellingPrice)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Gross Profit</span>
                  <span className="text-sm font-bold text-emerald-700 font-mono">{formatNaira(projectedGrossProfit)}</span>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Gross Margin</span>
                  <span className="text-sm font-bold text-purple-700 font-mono">{projectedGrossMarginPct}%</span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-700" />
                  Pre-Project Gateway Rule:
                </div>
                <p>
                  Creating this projection does <strong>NOT</strong> make it an active project. It will enter the
                  commercial review pipeline for departmental contributions (Technical, Procurement, Site Supervisor, Accounts)
                  and require executive management approval before client presentation and final conversion.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Step
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#01875F] text-white hover:bg-[#01704f] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Next Step
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(false)}
                  className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#01875F] hover:bg-[#01704f] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit for Contributions'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
