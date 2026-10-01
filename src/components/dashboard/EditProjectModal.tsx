import React, { useState, useEffect } from 'react';
import { X, Edit3, AlertCircle } from 'lucide-react';
import {
  ProjectService,
  ClientRecord,
  ProjectRecord,
  ProjectStatus,
  ALL_PROJECT_STATUSES,
  PROJECT_STATUS_CONFIG,
} from '../../services/projectService';

interface EditProjectModalProps {
  project: ProjectRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: (updatedProject: ProjectRecord) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  project,
  isOpen,
  onClose,
  onProjectUpdated,
}) => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Form State
  const [projectCode, setProjectCode] = useState('');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [status, setStatus] = useState<ProjectStatus>('enquiry');
  const [currency, setCurrency] = useState('NGN');
  const [contractValue, setContractValue] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [actualCompletionDate, setActualCompletionDate] = useState('');

  // Submitting & Errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Populate form when project changes
  useEffect(() => {
    if (!project || !isOpen) return;

    setProjectCode(project.project_code || '');
    setName(project.name || '');
    setClientId(project.client_id || '');
    setDescription(project.description || '');
    setProjectType(project.project_type || '');
    setAddress(project.address || '');
    setCity(project.city || '');
    setState(project.state || '');
    setCountry(project.country || 'Nigeria');
    setStatus(project.status || 'enquiry');
    setCurrency(project.currency || 'NGN');
    setContractValue(project.contract_value != null ? String(project.contract_value) : '');
    setStartDate(project.start_date || '');
    setExpectedCompletionDate(project.expected_completion_date || '');
    setActualCompletionDate(project.actual_completion_date || '');
    setFormError(null);

    async function loadClients() {
      setLoadingClients(true);
      const res = await ProjectService.getClients();
      if (res.data) {
        setClients(res.data);
      }
      setLoadingClients(false);
    }

    loadClients();
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!projectCode.trim()) {
      setFormError('Project Code is required.');
      return;
    }

    if (!name.trim()) {
      setFormError('Project Name is required.');
      return;
    }

    if (!clientId) {
      setFormError('Client is required.');
      return;
    }

    setIsSubmitting(true);

    const valNum = contractValue.trim() ? Number(contractValue) : null;

    const res = await ProjectService.updateProject(project.id, {
      project_code: projectCode.trim(),
      name: name.trim(),
      client_id: clientId,
      description: description.trim() || null,
      project_type: projectType.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      country: country.trim() || 'Nigeria',
      status,
      currency: currency.trim() || 'NGN',
      contract_value: valNum != null && !isNaN(valNum) ? valNum : null,
      start_date: startDate || null,
      expected_completion_date: expectedCompletionDate || null,
      actual_completion_date: actualCompletionDate || null,
    });

    setIsSubmitting(false);

    if (res.error || !res.data) {
      setFormError(res.error || 'Failed to update project in database.');
    } else {
      onProjectUpdated(res.data);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Edit Project: {project.project_code}
              </h2>
              <p className="text-xs text-slate-500">
                Update legitimate project attributes in Supabase.
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{formError}</div>
            </div>
          )}

          {/* Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Project Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Client & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Client Organization <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={loadingClients}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#01875F]"
              >
                <option value="" disabled>
                  Select client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Project Status (DB Enum)
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#01875F]"
              >
                {ALL_PROJECT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {PROJECT_STATUS_CONFIG[st].label}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Status changes are recorded to history automatically via database triggers.
              </span>
            </div>
          </div>

          {/* Type & Contract Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Project Type
              </label>
              <input
                type="text"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Contract Value (₦)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="Leave blank for null"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Expected Completion
              </label>
              <input
                type="date"
                value={expectedCompletionDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Actual Completion
              </label>
              <input
                type="date"
                value={actualCompletionDate}
                onChange={(e) => setActualCompletionDate(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                State
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
            />
          </div>

          {/* Non-editable system info */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Project ID: <code className="font-mono text-slate-700">{project.id}</code></span>
            <span>Currency: <strong>{currency}</strong></span>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;
