import React, { useState, useEffect } from 'react';
import { X, Edit3, AlertCircle, Phone, FileText } from 'lucide-react';
import {
  WorkforceService,
  WorkforceMemberRecord,
  WorkforceStatus,
  ALL_WORKFORCE_STATUSES,
  WORKFORCE_STATUS_CONFIG,
  ProfileRecord,
} from '../../services/workforceService';

interface EditWorkforceModalProps {
  member: WorkforceMemberRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (message: string) => void;
}

export const EditWorkforceModal: React.FC<EditWorkforceModalProps> = ({
  member,
  isOpen,
  onClose,
  onUpdated,
}) => {
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
    if (!isOpen || !member) return;

    setTrade(member.trade || '');
    setStatus(member.status || 'active');
    setPhone(member.phone || '');
    setEmergencyContactName(member.emergency_contact_name || '');
    setEmergencyContactPhone(member.emergency_contact_phone || '');
    setNotes(member.notes || '');
    setSelectedProfileId(member.profile_id || '');
    setErrorMessage(null);

    async function loadProfiles() {
      const res = await WorkforceService.getAvailableProfiles();
      if (res.data) {
        setAvailableProfiles(res.data);
      }
    }
    loadProfiles();
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!trade.trim()) {
      setErrorMessage('Trade / Craft cannot be blank.');
      return;
    }

    setIsSubmitting(true);

    const res = await WorkforceService.updateWorkforceMember(member.id, {
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
      onUpdated(`Workforce member ${member.workforce_code} updated successfully.`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center font-bold">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Edit Workforce Member</span>
                <span className="font-mono text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {member.workforce_code}
                </span>
              </h2>
              <p className="text-xs text-slate-500">Update status, contact details, or artisan trade.</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Trade / Craft <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>

            {availableProfiles.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Linked User Profile
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
                value={emergencyContactPhone}
                onChange={(e) => setEmergencyContactPhone(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Personnel Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#01875F] resize-none"
            />
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
                  <span>Updating...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
