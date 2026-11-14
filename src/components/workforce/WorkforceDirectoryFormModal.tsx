import React, { useState, useEffect } from 'react';
import {
  X,
  HardHat,
  AlertCircle,
  CheckCircle2,
  User,
  Phone,
  MapPin,
  Landmark,
  Shield,
  FileText,
} from 'lucide-react';
import {
  WorkforceDirectoryRecord,
  WorkforceDirectoryInput,
  WorkforceDirectoryService,
  ContractWorkforceStatus,
} from '../../services/workforceDirectoryService';

interface WorkforceDirectoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingMember?: WorkforceDirectoryRecord | null;
  onSaved: (message: string) => void;
}

export const WorkforceDirectoryFormModal: React.FC<WorkforceDirectoryFormModalProps> = ({
  isOpen,
  onClose,
  editingMember,
  onSaved,
}) => {
  const isEditing = Boolean(editingMember);

  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nextOfKin, setNextOfKin] = useState('');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [registrationNotes, setRegistrationNotes] = useState('');
  const [status, setStatus] = useState<ContractWorkforceStatus>('active');

  const [isLoadingProtected, setIsLoadingProtected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isOpen) return;

    if (editingMember) {
      setFullName(editingMember.full_name || '');
      setAddress(editingMember.address || '');
      setPhoneNumber(editingMember.phone_number || '');
      setNextOfKin(editingMember.next_of_kin || '');
      setNextOfKinPhone(editingMember.next_of_kin_phone || '');
      setBankName(editingMember.bank_name || '');
      setAccountName(editingMember.account_name || '');
      setAccountNumber(editingMember.account_number || '');
      setRegistrationNotes(editingMember.registration_notes || '');
      const norm = (editingMember.status || 'active').toLowerCase();
      setStatus(
        norm === 'inactive' || norm === 'suspended' ? (norm as ContractWorkforceStatus) : 'active'
      );

      // Load protected banking and next-of-kin columns via server-side RPC
      setIsLoadingProtected(true);
      WorkforceDirectoryService.getWorkforceProtectedDetails(editingMember.id).then((res) => {
        if (!active) return;
        setIsLoadingProtected(false);
        if (res.data) {
          setNextOfKin(res.data.next_of_kin || '');
          setNextOfKinPhone(res.data.next_of_kin_phone || '');
          setBankName(res.data.bank_name || '');
          setAccountName(res.data.account_name || '');
          setAccountNumber(res.data.account_number || '');
        }
      });
    } else {
      setFullName('');
      setAddress('');
      setPhoneNumber('');
      setNextOfKin('');
      setNextOfKinPhone('');
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setRegistrationNotes('');
      setStatus('active');
      setIsLoadingProtected(false);
    }
    setErrorMsg(null);

    return () => {
      active = false;
    };
  }, [isOpen, editingMember]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Full Name is required.');
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMsg('Phone Number is required.');
      return;
    }
    if (accountNumber.trim() && !/^\d{6,20}$/.test(accountNumber.trim())) {
      setErrorMsg('Account Number must contain between 6 and 20 numeric digits.');
      return;
    }

    setIsSubmitting(true);

    const payload: WorkforceDirectoryInput = {
      full_name: fullName,
      address,
      phone_number: phoneNumber,
      next_of_kin: nextOfKin,
      next_of_kin_phone: nextOfKinPhone,
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      registration_notes: registrationNotes,
      status,
    };

    const res = editingMember
      ? await WorkforceDirectoryService.updateMember(editingMember.id, payload, editingMember)
      : await WorkforceDirectoryService.createMember(payload);

    setIsSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    onSaved(
      editingMember
        ? `Updated contract workforce profile for ${fullName.trim()}.`
        : `Registered ${fullName.trim()} to Workforce Directory.`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
              <HardHat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {isEditing ? 'Edit Contract Workforce Member' : 'Register Contract Workforce Member'}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                External artisans and contract tradesmen — no system login account required.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 01. Personal & Contact Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <User className="w-3.5 h-3.5 text-[#18b892]" />
              <span>01. Personal &amp; Contact Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Chukwuma Okafor"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0803 456 7890"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 14 Ogudu Road, Ojota, Lagos"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>
            </div>
          </div>

          {/* 02. Next of Kin */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Shield className="w-3.5 h-3.5 text-[#18b892]" />
                <span>02. Next of Kin</span>
              </div>
              {isLoadingProtected && (
                <span className="text-xs text-slate-400">Loading protected fields...</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Next of Kin
                </label>
                <input
                  type="text"
                  value={nextOfKin}
                  onChange={(e) => setNextOfKin(e.target.value)}
                  placeholder="e.g. Ngozi Okafor"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Next of Kin Phone Number
                </label>
                <input
                  type="tel"
                  value={nextOfKinPhone}
                  onChange={(e) => setNextOfKinPhone(e.target.value)}
                  placeholder="e.g. 0809 111 2233"
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>
            </div>
          </div>

          {/* 03. Banking Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <Landmark className="w-3.5 h-3.5 text-[#18b892]" />
              <span>03. Banking Details (Protected)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Zenith Bank"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Account Name
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Account Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                  placeholder="10-digit NUBAN"
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>
            </div>
          </div>

          {/* 04. Registration Notes & Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <FileText className="w-3.5 h-3.5 text-[#18b892]" />
              <span>04. Registration Notes &amp; Status</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={isEditing ? '' : 'sm:col-span-2'}>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Registration Notes
                </label>
                <textarea
                  rows={2}
                  value={registrationNotes}
                  onChange={(e) => setRegistrationNotes(e.target.value)}
                  placeholder="Trade skill, experience, guarantor reference, or field notes..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892] resize-none"
                />
              </div>

              {isEditing && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ContractWorkforceStatus)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingProtected}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : isEditing
                  ? 'Save Changes'
                  : 'Register Workforce Member'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
