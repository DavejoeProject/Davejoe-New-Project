import React, { useState, useEffect } from 'react';
import { X, Building2, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  ProjectService,
  ClientRecord,
  ProjectRecord,
  ProjectStatus,
  ALL_PROJECT_STATUSES,
  PROJECT_STATUS_CONFIG,
} from '../../services/projectService';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (newProject: ProjectRecord) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);

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

  // Submitting & Errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Client Creation
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [addingClientError, setAddingClientError] = useState<string | null>(null);
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Load real clients on open
  useEffect(() => {
    if (!isOpen) {
      setFormError(null);
      setIsAddingClient(false);
      return;
    }

    async function loadClients() {
      setLoadingClients(true);
      setClientsError(null);
      const res = await ProjectService.getClients();
      if (res.error) {
        setClientsError(res.error);
      } else {
        setClients(res.data);
        if (res.data.length > 0 && !clientId) {
          setClientId(res.data[0].id);
        }
      }
      setLoadingClients(false);
    }

    loadClients();
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Quick Client Creation
  const handleQuickAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      setAddingClientError('Client name is required.');
      return;
    }

    setIsSubmittingClient(true);
    setAddingClientError(null);

    const res = await ProjectService.createClient({
      name: newClientName.trim(),
      email: newClientEmail.trim() || undefined,
      phone: newClientPhone.trim() || undefined,
    });

    setIsSubmittingClient(false);

    if (res.error || !res.data) {
      setAddingClientError(res.error || 'Failed to register client.');
    } else {
      setClients((prev) => [...prev, res.data!]);
      setClientId(res.data.id);
      setIsAddingClient(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientPhone('');
    }
  };

  // Handle Form Submission
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
      setFormError('A valid Client must be selected. Client ID cannot be null.');
      return;
    }

    setIsSubmitting(true);

    const valNum = contractValue.trim() ? Number(contractValue) : null;

    const res = await ProjectService.createProject({
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
    });

    setIsSubmitting(false);

    if (res.error || !res.data) {
      setFormError(res.error || 'Failed to create project in database.');
    } else {
      onProjectCreated(res.data);
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
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Create New Project
              </h2>
              <p className="text-xs text-slate-500">
                Register a new project in the Davejoe enterprise database.
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

          {/* Section: Core Identification (Required) */}
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
                placeholder="e.g. PRJ-001"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F] focus:ring-2 focus:ring-[#01875F]/20"
              />
              <span className="text-[10.5px] text-slate-400 mt-1 block">Unique project code identifier</span>
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
                placeholder="e.g. Davejoe Corporate Renovation"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F] focus:ring-2 focus:ring-[#01875F]/20"
              />
            </div>
          </div>

          {/* Section: Client Relationship (Required: client_id is NOT NULL) */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800">
                Client Organization <span className="text-red-500">*</span>
              </label>
              {!isAddingClient && (
                <button
                  type="button"
                  onClick={() => setIsAddingClient(true)}
                  className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Quick Add Client</span>
                </button>
              )}
            </div>

            {loadingClients ? (
              <div className="text-xs text-slate-400 py-2">Loading clients from database...</div>
            ) : clientsError ? (
              <div className="text-xs text-red-600 font-medium">{clientsError}</div>
            ) : clients.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                <p className="font-semibold">No clients available</p>
                <p className="text-[11px] text-amber-700">
                  Because <code>client_id</code> is required by the database, a client must exist before a project can be created. Click "Quick Add Client" above to create one now.
                </p>
              </div>
            ) : (
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-[#01875F] focus:ring-2 focus:ring-[#01875F]/20"
              >
                <option value="" disabled>
                  Select client organization
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.email ? `(${c.email})` : c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Quick Add Client Sub-Form */}
            {isAddingClient && (
              <div className="mt-3 p-3.5 bg-white rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Add Real Client</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingClient(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>

                {addingClientError && (
                  <p className="text-xs text-red-600 font-medium">{addingClientError}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Client / Company Name *"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="h-8 px-2.5 text-xs border border-slate-200 rounded"
                  />
                  <input
                    type="email"
                    placeholder="Email (Optional)"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    className="h-8 px-2.5 text-xs border border-slate-200 rounded"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (Optional)"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="h-8 px-2.5 text-xs border border-slate-200 rounded"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleQuickAddClient}
                    disabled={isSubmittingClient}
                    className="px-3 py-1 bg-[#01875F] text-white rounded text-xs font-semibold hover:bg-[#016f4e] disabled:opacity-60 cursor-pointer"
                  >
                    {isSubmittingClient ? 'Saving...' : 'Save & Select Client'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section: Status & Financial Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Initial Status
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
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Project Type
              </label>
              <input
                type="text"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                placeholder="e.g. Commercial Fit-Out"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
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
                placeholder="₦ e.g. 25000000"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Section: Timeline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Expected Completion Date
              </label>
              <input
                type="date"
                value={expectedCompletionDate}
                onChange={(e) => setExpectedCompletionDate(e.target.value)}
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Section: Location */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Site Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 14 Marina Street"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
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
                placeholder="e.g. Lagos"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
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
                placeholder="e.g. Lagos State"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          {/* Section: Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Project Scope &amp; Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline project brief, design requirements, and architectural scope..."
              className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#01875F]"
            />
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
              className="px-5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? 'Saving Project...' : 'Save & Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
