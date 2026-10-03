import React, { useState, useEffect } from 'react';
import { X, Edit2, AlertCircle, Loader2, Info } from 'lucide-react';
import {
  MaterialRecord,
  MaterialUpdateInput,
  MaterialsService,
  MaterialStatus,
  ALL_MATERIAL_STATUSES,
  MATERIAL_STATUS_CONFIG,
} from '../../services/materialsService';

interface EditMaterialModalProps {
  material: MaterialRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onMaterialUpdated: (updatedMaterial: MaterialRecord) => void;
  existingCategories?: string[];
}

const COMMON_UNITS = [
  'bags',
  'kg',
  'tons',
  'pieces',
  'meters',
  'liters',
  'units',
  'trips',
  'rolls',
  'boxes',
  'bundles',
  'sqm',
  'cbm',
];

export const EditMaterialModal: React.FC<EditMaterialModalProps> = ({
  material,
  isOpen,
  onClose,
  onMaterialUpdated,
  existingCategories = [],
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [specification, setSpecification] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('pieces');
  const [customUnit, setCustomUnit] = useState('');
  const [standardUnitCost, setStandardUnitCost] = useState<string>('0');
  const [reorderLevel, setReorderLevel] = useState<string>('0');
  const [status, setStatus] = useState<MaterialStatus>('active');
  const [storageLocation, setStorageLocation] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (material) {
      setName(material.name || '');
      setCategory(material.category || 'General');
      setCustomCategory('');
      setBrand(material.brand || '');
      setSpecification(material.specification || '');

      if (COMMON_UNITS.includes(material.unit_of_measure)) {
        setUnitOfMeasure(material.unit_of_measure);
        setCustomUnit('');
      } else {
        setUnitOfMeasure('__custom__');
        setCustomUnit(material.unit_of_measure || '');
      }

      setStandardUnitCost(
        material.standard_unit_cost !== null ? String(material.standard_unit_cost) : '0'
      );
      setReorderLevel(
        material.reorder_level !== null ? String(material.reorder_level) : '0'
      );
      setStatus(material.status || 'active');
      setStorageLocation(material.storage_location || '');
      setDescription(material.description || '');
      setNotes(material.notes || '');
      setErrorMessage(null);
    }
  }, [material]);

  if (!isOpen || !material) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    const finalCategory = category === '__custom__' ? customCategory.trim() : category.trim();
    const finalUnit = unitOfMeasure === '__custom__' ? customUnit.trim() : unitOfMeasure.trim();

    if (!trimmedName) {
      setErrorMessage('Material name cannot be empty.');
      return;
    }
    if (!finalUnit) {
      setErrorMessage('Unit of measure cannot be empty.');
      return;
    }

    const numCost = parseFloat(standardUnitCost);
    if (isNaN(numCost) || numCost < 0) {
      setErrorMessage('Standard unit cost must be a non-negative number.');
      return;
    }

    const numReorder = parseFloat(reorderLevel);
    if (isNaN(numReorder) || numReorder < 0) {
      setErrorMessage('Reorder level must be a non-negative number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: MaterialUpdateInput = {
        name: trimmedName,
        category: finalCategory || 'General',
        brand: brand.trim() || null,
        specification: specification.trim() || null,
        unit_of_measure: finalUnit,
        standard_unit_cost: numCost,
        reorder_level: numReorder,
        status,
        storage_location: storageLocation.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
      };

      const result = await MaterialsService.updateMaterial(material.id, updateData);

      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }

      if (result.data) {
        onMaterialUpdated(result.data);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update material.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Edit Material</h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {material.material_code}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Update catalog definitions, standard unit costs, and inventory thresholds.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Read-Only Operational Stock & Code Notice */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-2.5 text-slate-600 text-[11px]">
            <Info className="w-4 h-4 text-[#01875F] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">
                Operational Stock Balance:{' '}
                <span className="font-mono text-slate-900 font-bold">
                  {material.current_stock.toLocaleString()} {material.unit_of_measure}
                </span>
              </p>
              <p className="text-slate-500 mt-0.5">
                Current stock is operational ledger data and cannot be manually overwritten here. Stock balances are updated strictly through deliveries, site disbursements, and verified physical counts.
              </p>
            </div>
          </div>

          {/* Row 1: Code (Read-Only) & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4 space-y-1.5">
              <label className="font-semibold text-slate-500 block">Material Code</label>
              <input
                type="text"
                disabled
                value={material.material_code}
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-mono text-xs text-slate-500 cursor-not-allowed select-none"
              />
              <span className="text-[10px] text-slate-400">Fixed catalog key</span>
            </div>

            <div className="sm:col-span-8 space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Material Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Material Name"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Row 2: Category & Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Category</label>
              <div className="space-y-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                >
                  <option value="Civil Works">Civil Works</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Mechanical & Plumbing">Mechanical & Plumbing</option>
                  <option value="Finishing & Tiling">Finishing & Tiling</option>
                  <option value="Structural Steel">Structural Steel</option>
                  <option value="General">General</option>
                  {existingCategories
                    .filter((c) => !['Civil Works', 'Electrical', 'Mechanical & Plumbing', 'Finishing & Tiling', 'Structural Steel', 'General'].includes(c))
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  <option value="__custom__">+ Enter custom category...</option>
                </select>

                {category === '__custom__' && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter custom category"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Brand / Manufacturer</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Dangote, BUA, Lafarge"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Row 3: Unit of Measure & Specification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">
                Unit of Measure <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <select
                  value={unitOfMeasure}
                  onChange={(e) => setUnitOfMeasure(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  <option value="__custom__">+ Custom unit...</option>
                </select>

                {unitOfMeasure === '__custom__' && (
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="Enter unit of measure"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Specification</label>
              <input
                type="text"
                value={specification}
                onChange={(e) => setSpecification(e.target.value)}
                placeholder="e.g. 50kg bag, Grade 42.5N"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Row 4: Pricing & Reorder Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200/70">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Standard Cost (₦)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={standardUnitCost}
                onChange={(e) => setStandardUnitCost(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
              <span className="text-[10px] text-slate-400">Unit base reference in ₦</span>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Reorder Level</label>
              <input
                type="number"
                min="0"
                step="any"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
              <span className="text-[10px] text-slate-400">Low stock trigger limit</span>
            </div>
          </div>

          {/* Row 5: Status & Storage Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Catalog Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MaterialStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              >
                {ALL_MATERIAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {MATERIAL_STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Storage Location</label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="e.g. Central Yard, Shed B, Bin 14"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Row 6: Description & Notes */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="General description of the material..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 block">Operational Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special handling rules or notes..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F] focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white hover:bg-[#016f4e] text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMaterialModal;
