import React, { useState, useEffect } from 'react';
import { X, UserPlus, AlertCircle, Users, Phone, Shield, FileText } from 'lucide-react';
import {
  WorkforceService,
  WorkforceStatus,
  ALL_WORKFORCE_STATUSES,
  WORKFORCE_STATUS_CONFIG,
  ProfileRecord,
} from '../../services/workforceService';

interface AddWorkforceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (message: string) => void;
}

const COMMON_TRADES = [
  'Mason / Bricklayer',
  'Carpenter & Joiner',
  'Electrician (MEP)',
  'Plumber & Pipefitter',
  'Steel Fixer & Welder',
  'Painter & Finisher',
  'Tile & Granite Fitter',
  'HVAC Technician',
  'Plasterer / POP Artisan',
  'Roofer',
  'Heavy Equipment Operator',
  'General Site Laborer',
];

export const AddWorkforceModal: React.FC<AddWorkforceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [workforceCode, setWorkforceCode] = useState('');
  const [trade, setTrade] = useState('');
  const [status, setStatus] = useState<WorkforceStatus>('active');
  const [phone, setPhone] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');

  const [availableProfiles, setAvailableProfiles] = useState<ProfileRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Reset fields
    setWorkforceCode('');
    setTrade('');
    setStatus('active');
    setPhone('');
    setEmergencyContactName('');
    setEmergencyContactPhone('');
    setNotes('');
    setSelectedProfileId('');
    setErrorMessage(null);

    // Fetch existing user profiles if any exist in the database for optional linking
    async function loadProfiles() {
      const res = await WorkforceService.getAvailableProfiles();
      if (res.data) {
        setAvailableProfiles(res.data);
      }
    }
    loadProfiles();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!workforceCode.trim()) {
      setErrorMessage('Workforce Code is required (e.g. WF-101).');
      return;
    }

    if (!trade.trim()) {
      setErrorMessage('Trade / Craft is required (e.g. Mason, Electrician).');
      return;
    }

    setIsSubmitting(true);

    const res = await WorkforceService.createWorkforceMember({
      workforce_code: workforceCode.trim().toUpperCase(),
      trade: trade.trim(),
      status,
      phone: phone.trim() || null,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      notes: notes.trim() || null,
      profile_id: selectedProfileId || null,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      onCreated(`Workforce member ${workforceCode.trim().toUpperCase()} registered successfully.`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Add Workforce Member
              </h2>
              <p className="text-xs text-slate-500">
                Register an artisan or field personnel to the organization roster.
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
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Section 1: Identification & Trade */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Core Identification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Workforce Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WF-101 or ART-042"
                  value={workforceCode}
                  onChange={(e) => setWorkforceCode(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F] uppercase font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Must be unique across the organization.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as WorkforceStatus)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
                >
                  {ALL_WORKFORCE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {WORKFORCE_STATUS_CONFIG[st].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Trade / Craft <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mason, Electrician, Plumber"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                list="trades-list"
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
              <datalist id="trades-list">
                {COMMON_TRADES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="text-[11px] text-slate-400 self-center mr-1">Suggestions:</span>
                {['Mason', 'Carpenter', 'Electrician', 'Plumber', 'Steel Fixer', 'Painter'].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setTrade(suggestion)}
                      className="px-2 py-0.5 rounded text-[10.5px] bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60 transition-colors cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Emergency Information */}
          <div className="pt-2 border-t border-slate-100 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Contact & Emergency Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
                />
              </div>

              {availableProfiles.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Link App User Profile (Optional)
                  </label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#01875F] cursor-pointer"
                  >
                    <option value="">No linked user account (Artisan)</option>
                    {availableProfiles.map((p) => {
                      const name =
                        p.display_name ||
                        (p.first_name || p.last_name
                          ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
                          : p.id);
                      return (
                        <option key={p.id} value={p.id}>
                          {name} {p.job_title ? `(${p.job_title})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Next of Kin or Spouse"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={emergencyContactPhone}
                  onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Notes & Records */}
          <div className="pt-2 border-t border-slate-100 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Notes & Background</span>
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Personnel Notes
              </label>
              <textarea
                rows={2}
                placeholder="Specializations, safety inductions, site preferences, or internal remarks..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F] resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <span>Register Workforce Member</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
