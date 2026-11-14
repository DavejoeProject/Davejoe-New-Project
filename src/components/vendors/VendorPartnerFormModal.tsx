import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Handshake,
  AlertCircle,
  CheckCircle2,
  User,
  Building2,
  Mail,
  Phone,
  Shield,
  Landmark,
  FileUp,
  FileCheck2,
} from 'lucide-react';
import {
  VendorPartnerRecord,
  VendorPartnerInput,
  VendorPartnerType,
  VendorPartnerStatus,
  VendorsPartnersService,
} from '../../services/vendorsPartnersService';

interface VendorPartnerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRecord?: VendorPartnerRecord | null;
  actorUserId?: string;
  onSaved: (message: string) => void;
}

export const VendorPartnerFormModal: React.FC<VendorPartnerFormModalProps> = ({
  isOpen,
  onClose,
  editingRecord,
  actorUserId,
  onSaved,
}) => {
  const isEditing = Boolean(editingRecord);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nextOfKin, setNextOfKin] = useState('');
  const [nextOfKinPhone, setNextOfKinPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [recordType, setRecordType] = useState<VendorPartnerType>('vendor');
  const [status, setStatus] = useState<VendorPartnerStatus>('active');
  const [notes, setNotes] = useState('');
  const [cacFile, setCacFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingRecord) {
        setFullName(editingRecord.full_name || '');
        setBusinessName(editingRecord.business_name || '');
        setEmailAddress(editingRecord.email_address || '');
        setPhoneNumber(editingRecord.phone_number || '');
        setNextOfKin(editingRecord.next_of_kin || '');
        setNextOfKinPhone(editingRecord.next_of_kin_phone || '');
        setBankName(editingRecord.bank_name || '');
        setAccountName(editingRecord.account_name || '');
        setAccountNumber(editingRecord.account_number || '');
        const normType = (editingRecord.record_type || 'vendor').toLowerCase();
        setRecordType(
          normType === 'partner' || normType === 'both' ? (normType as VendorPartnerType) : 'vendor'
        );
        const normStatus = (editingRecord.status || 'active').toLowerCase();
        setStatus(
          normStatus === 'inactive' || normStatus === 'suspended'
            ? (normStatus as VendorPartnerStatus)
            : 'active'
        );
        setNotes(editingRecord.notes || '');
      } else {
        setFullName('');
        setBusinessName('');
        setEmailAddress('');
        setPhoneNumber('');
        setNextOfKin('');
        setNextOfKinPhone('');
        setBankName('');
        setAccountName('');
        setAccountNumber('');
        setRecordType('vendor');
        setStatus('active');
        setNotes('');
      }
      setCacFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setErrorMsg(null);
    }
  }, [isOpen, editingRecord]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setCacFile(null);
      return;
    }

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('CAC Certificate must be a PDF, JPG, PNG, or WebP document.');
      e.target.value = '';
      setCacFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('CAC Certificate file must not exceed 5 MB.');
      e.target.value = '';
      setCacFile(null);
      return;
    }

    setCacFile(file);
  };

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
    if (emailAddress.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress.trim())) {
      setErrorMsg('Please enter a valid Email Address.');
      return;
    }
    if (accountNumber.trim() && !/^\d{6,20}$/.test(accountNumber.trim())) {
      setErrorMsg('Account Number must contain between 6 and 20 numeric digits.');
      return;
    }

    setIsSubmitting(true);

    const payload: VendorPartnerInput = {
      full_name: fullName,
      business_name: businessName,
      email_address: emailAddress,
      phone_number: phoneNumber,
      next_of_kin: nextOfKin,
      next_of_kin_phone: nextOfKinPhone,
      bank_name: bankName,
      account_name: accountName,
      account_number: accountNumber,
      record_type: recordType,
      status,
      notes,
    };

    const res = editingRecord
      ? await VendorsPartnersService.updateVendorPartner(
          editingRecord.id,
          payload,
          cacFile,
          actorUserId,
          editingRecord
        )
      : await VendorsPartnersService.createVendorPartner(payload, cacFile, actorUserId);

    setIsSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    const displayLabel = businessName.trim() || fullName.trim();
    onSaved(
      editingRecord
        ? `Updated vendor/partner profile for ${displayLabel}.`
        : `Registered ${displayLabel} to Vendors & Partners Directory.`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-2xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#18b892]/10 text-[#18b892] flex items-center justify-center shrink-0 border border-[#18b892]/20">
              <Handshake className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {isEditing ? 'Edit Vendor / Partner' : 'Register Vendor / Partner'}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                External suppliers, commercial partners, and service contractors.
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Classification Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Classification <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { value: 'vendor', label: 'Vendor' },
                  { value: 'partner', label: 'Partner' },
                  { value: 'both', label: 'Both (Vendor & Partner)' },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRecordType(option.value)}
                  className={`px-3 py-2.5 text-xs sm:text-sm font-semibold rounded-xl border transition-colors cursor-pointer text-center ${
                    recordType === option.value
                      ? 'bg-[#18b892] text-white border-[#18b892] shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Primary Contact & Business Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <User className="w-3.5 h-3.5 text-[#18b892]" />
              <span>Contact & Business Information</span>
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
                  placeholder="Primary contact full name"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Business Name
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Registered company / trading name"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                  />
                </div>
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
                    placeholder="e.g. 0803 123 4567"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="contact@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Next of Kin */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <Shield className="w-3.5 h-3.5 text-[#18b892]" />
              <span>Next of Kin</span>
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
                  placeholder="Next of kin full name"
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
                  placeholder="e.g. 0809 000 1122"
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                />
              </div>
            </div>
          </div>

          {/* Banking Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <Landmark className="w-3.5 h-3.5 text-[#18b892]" />
              <span>Settlement Banking Details (Confidential)</span>
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
                  placeholder="e.g. Access Bank"
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
                  placeholder="Corporate / personal account name"
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

          {/* CAC Certificate Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
              <FileUp className="w-3.5 h-3.5 text-[#18b892]" />
              <span>CAC Certificate (Optional — Private Encrypted Storage)</span>
            </div>

            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">
                    {cacFile
                      ? `Selected: ${cacFile.name}`
                      : editingRecord?.cac_certificate_path
                      ? 'Existing CAC Certificate on file (upload a new file to replace)'
                      : 'Upload Corporate Affairs Commission (CAC) Certificate'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Accepted formats: PDF, JPG, PNG, WebP · Max size 5 MB · Stored privately (no public URL).
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-[#18b892] bg-white border border-[#18b892]/30 hover:bg-emerald-50 rounded-xl cursor-pointer transition-colors whitespace-nowrap shrink-0">
                  <FileUp className="w-4 h-4 shrink-0" />
                  <span>{cacFile || editingRecord?.cac_certificate_path ? 'Replace File' : 'Choose File'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>

              {(cacFile || editingRecord?.cac_certificate_path) && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium pt-1">
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {cacFile
                      ? `${cacFile.name} (${Math.max(1, Math.round(cacFile.size / 1024))} KB)`
                      : `Stored path: ${editingRecord?.cac_certificate_path}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={isEditing ? '' : 'sm:col-span-2'}>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Notes / Supply Scope
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specialty, supplied materials, service terms..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892] resize-none"
              />
            </div>

            {isEditing && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Directory Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as VendorPartnerStatus)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#18b892]/25 focus:border-[#18b892]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#18b892] hover:bg-[#139c7b] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : isEditing
                  ? 'Save Changes'
                  : 'Register Vendor / Partner'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
