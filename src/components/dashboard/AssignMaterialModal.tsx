import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Package,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Boxes,
  Tag,
  DollarSign,
  Info,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  ProjectControlService,
  AssignMaterialPayload,
} from '../../services/projectControlService';
import {
  MaterialsService,
  MaterialRecord,
} from '../../services/materialsService';
import { formatNaira } from '../../services/dashboardService';
import { AddMaterialModal } from './AddMaterialModal';

interface AssignMaterialModalProps {
  projectId: string;
  projectName: string;
  projectCode?: string;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: () => void;
}

export const AssignMaterialModal: React.FC<AssignMaterialModalProps> = ({
  projectId,
  projectName,
  projectCode,
  isOpen,
  onClose,
  onAssigned,
}) => {
  const { user } = useAuth();

  // Materials Catalog State
  const [materials, setMaterials] = useState<MaterialRecord[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Form State
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [requiredQuantity, setRequiredQuantity] = useState<string>('10');
  const [approvedQuantity, setApprovedQuantity] = useState<string>('10');
  const [unitCost, setUnitCost] = useState<string>('0');
  const [purpose, setPurpose] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Nested Add New Material Modal State
  const [isAddNewMaterialOpen, setIsAddNewMaterialOpen] = useState<boolean>(false);

  // Load materials from master catalog
  const loadMaterials = async () => {
    setLoadingMaterials(true);
    setCatalogError(null);
    try {
      const res = await MaterialsService.getMaterials({ status: 'active' });
      if (res.error) {
        setCatalogError(res.error);
      } else {
        setMaterials(res.data || []);
        // Auto-select first material if none selected
        if (!selectedMaterialId && res.data && res.data.length > 0) {
          const first = res.data[0];
          setSelectedMaterialId(first.id);
          setUnitCost(String(first.standard_unit_cost || 0));
        }
      }
    } catch (err: any) {
      setCatalogError(err?.message || 'Failed to load materials catalog.');
    } finally {
      setLoadingMaterials(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setSearchFilter('');
    setCategoryFilter('all');
    loadMaterials();
  }, [isOpen]);

  // Selected Material Object
  const selectedMaterial = useMemo(() => {
    return materials.find((m) => m.id === selectedMaterialId) || null;
  }, [materials, selectedMaterialId]);

  // Update unit cost when selected material changes
  const handleSelectMaterial = (mat: MaterialRecord) => {
    setSelectedMaterialId(mat.id);
    setUnitCost(String(mat.standard_unit_cost || 0));
    setFormError(null);
  };

  // Derive available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    materials.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return Array.from(set).sort();
  }, [materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesCategory =
        categoryFilter === 'all' ||
        (m.category || '').toLowerCase() === categoryFilter.toLowerCase();
      const term = searchFilter.toLowerCase().trim();
      if (!term) return matchesCategory;
      const matchesText =
        m.name.toLowerCase().includes(term) ||
        (m.material_code && m.material_code.toLowerCase().includes(term)) ||
        (m.category && m.category.toLowerCase().includes(term)) ||
        (m.brand && m.brand.toLowerCase().includes(term));
      return matchesCategory && matchesText;
    });
  }, [materials, categoryFilter, searchFilter]);

  // Live total cost calculation
  const calculatedTotalCost = useMemo(() => {
    const qty = parseFloat(requiredQuantity) || 0;
    const cost = parseFloat(unitCost) || 0;
    return qty * cost;
  }, [requiredQuantity, unitCost]);

  // Handle Nested Material Creation
  const handleNewMaterialCreated = (newMat: MaterialRecord) => {
    setMaterials((prev) => [newMat, ...prev]);
    setSelectedMaterialId(newMat.id);
    setUnitCost(String(newMat.standard_unit_cost || 0));
    setIsAddNewMaterialOpen(false);
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedMaterialId) {
      setFormError('Please select a material from the catalog.');
      return;
    }

    const reqQty = parseFloat(requiredQuantity);
    if (isNaN(reqQty) || reqQty <= 0) {
      setFormError('Required quantity must be a positive number greater than 0.');
      return;
    }

    const appQty = approvedQuantity ? parseFloat(approvedQuantity) : reqQty;
    const numUnitCost = parseFloat(unitCost) || 0;

    setIsSubmitting(true);

    const payload: AssignMaterialPayload = {
      projectId,
      materialId: selectedMaterialId,
      requiredQuantity: reqQty,
      approvedQuantity: appQty,
      estimatedUnitCost: numUnitCost,
      estimatedTotalCost: reqQty * numUnitCost,
      purpose: purpose.trim() || `Material allocation for ${projectName}`,
      notes: notes.trim() || null,
      assignedBy: user?.id || null,
    };

    const res = await ProjectControlService.assignMaterialToProject(payload);

    setIsSubmitting(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      onAssigned();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
        <div
          className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20 shadow-2xs">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Assign Material to Project
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">{projectName}</span>
                  {projectCode && (
                    <>
                      <span>·</span>
                      <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-[11px] text-slate-600">
                        {projectCode}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="overflow-y-auto p-5 sm:p-6 space-y-6 text-xs text-slate-700 flex-1">
            {formError && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            {/* SECTION 1: MATERIAL SELECTION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#01875F]" />
                  <span>Select Material from Catalog</span>
                </label>

                {/* Quick Add New Material Shortcut */}
                <button
                  type="button"
                  onClick={() => setIsAddNewMaterialOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#01875F] bg-[#E6F4EA] hover:bg-[#d4ede0] rounded-md transition-colors cursor-pointer border border-[#01875F]/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add New Material</span>
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search material by name, code, brand..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                  />
                  {searchFilter && (
                    <button
                      type="button"
                      onClick={() => setSearchFilter('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] cursor-pointer"
                  >
                    <option value="all">All Categories ({materials.length})</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Material List / Selector Box */}
              {loadingMaterials ? (
                <div className="h-36 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 animate-pulse">
                  <span>Loading catalog materials...</span>
                </div>
              ) : catalogError ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-red-600">
                  <p className="font-semibold">{catalogError}</p>
                  <button
                    type="button"
                    onClick={loadMaterials}
                    className="mt-2 text-xs font-semibold underline"
                  >
                    Retry loading
                  </button>
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-slate-500 font-medium">No materials found matching your search.</p>
                  <button
                    type="button"
                    onClick={() => setIsAddNewMaterialOpen(true)}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#01875F] text-white rounded-lg text-xs font-semibold hover:bg-[#01704d]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create new material</span>
                  </button>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                  {filteredMaterials.map((mat) => {
                    const isSelected = mat.id === selectedMaterialId;
                    const stock = mat.current_stock ?? 0;
                    const isLowStock = mat.reorder_level && stock <= mat.reorder_level;

                    return (
                      <div
                        key={mat.id}
                        onClick={() => handleSelectMaterial(mat)}
                        className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#E6F4EA]/70 border-l-4 border-l-[#01875F]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">{mat.name}</span>
                            {mat.material_code && (
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {mat.material_code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="capitalize">{mat.category || 'General'}</span>
                            {mat.brand && (
                              <>
                                <span>·</span>
                                <span>{mat.brand}</span>
                              </>
                            )}
                            {mat.unit_of_measure && (
                              <>
                                <span>·</span>
                                <span>Unit: {mat.unit_of_measure}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-slate-800 text-xs">
                            {formatNaira(mat.standard_unit_cost || 0)}
                          </div>
                          <div
                            className={`text-[10px] font-medium ${
                              stock <= 0
                                ? 'text-amber-600'
                                : isLowStock
                                ? 'text-amber-500'
                                : 'text-slate-500'
                            }`}
                          >
                            Stock: {stock} {mat.unit_of_measure || 'units'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECTION 2: SELECTED MATERIAL SUMMARY CARD */}
            {selectedMaterial && (
              <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Selected Item Details
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {selectedMaterial.name}
                    </h4>
                    <p className="text-slate-600 text-xs mt-0.5">
                      {selectedMaterial.specification || selectedMaterial.description || 'Standard specification'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Standard Cost</span>
                    <div className="font-mono font-bold text-[#01875F] text-sm">
                      {formatNaira(selectedMaterial.standard_unit_cost || 0)}
                    </div>
                    <span className="text-[10.5px] text-slate-500">
                      per {selectedMaterial.unit_of_measure || 'unit'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Category: <strong className="text-slate-700 capitalize">{selectedMaterial.category || 'General'}</strong></span>
                  <span>Warehouse Stock: <strong className="text-slate-700">{selectedMaterial.current_stock ?? 0} {selectedMaterial.unit_of_measure || 'units'}</strong></span>
                  {selectedMaterial.storage_location && (
                    <span>Location: <strong className="text-slate-700">{selectedMaterial.storage_location}</strong></span>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 3: QUANTITIES & PRICING */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#01875F]" />
                <span>Quantity, Unit Cost & Budget Allocation</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Required Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Required Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      value={requiredQuantity}
                      onChange={(e) => {
                        setRequiredQuantity(e.target.value);
                        if (!approvedQuantity || approvedQuantity === requiredQuantity) {
                          setApprovedQuantity(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-semibold">
                      {selectedMaterial?.unit_of_measure || 'units'}
                    </span>
                  </div>
                </div>

                {/* Approved Quantity */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approved Quantity
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={approvedQuantity}
                      onChange={(e) => setApprovedQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-semibold">
                      {selectedMaterial?.unit_of_measure || 'units'}
                    </span>
                  </div>
                </div>

                {/* Unit Cost (₦) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Est. Unit Cost (₦)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                  />
                </div>
              </div>

              {/* Calculated Total Cost Highlight Banner */}
              <div className="p-3.5 bg-[#E6F4EA]/50 border border-[#01875F]/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#01875F]" />
                  <span className="text-xs font-semibold text-slate-700">
                    Calculated Requirement Total:
                  </span>
                </div>
                <div className="font-mono font-bold text-sm sm:text-base text-[#01875F]">
                  {formatNaira(calculatedTotalCost)}
                </div>
              </div>
            </div>

            {/* SECTION 4: PURPOSE & WORK AREA */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purpose / Work Area <span className="text-slate-400 font-normal">(e.g. Master Bedroom ceiling POP, Ground Floor screeding)</span>
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Wall screeding and prime coat for living area"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Special Notes / Site Logistics Instructions
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Must deliver in waterproof wrap. Verify batch number with site supervisor before unloading."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F] resize-none"
                />
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedMaterialId}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#01875F] hover:bg-[#01704d] text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Assigning Material...</span>
                </>
              ) : (
                <>
                  <Boxes className="w-4 h-4" />
                  <span>Assign Material to Project</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Nested Add Material Modal */}
      {isAddNewMaterialOpen && (
        <AddMaterialModal
          isOpen={isAddNewMaterialOpen}
          onClose={() => setIsAddNewMaterialOpen(false)}
          onMaterialCreated={handleNewMaterialCreated}
        />
      )}
    </>
  );
};

export default AssignMaterialModal;
