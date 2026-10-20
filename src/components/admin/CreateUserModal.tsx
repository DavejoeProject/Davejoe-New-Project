import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Lock,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import { AdminService, AdminRoleItem } from '../../services/adminService';
import { ROLE_DEFINITIONS } from '../RoleSelect';

interface CreateUserModalProps {
  allRoles: AdminRoleItem[];
  onClose: () => void;
  onUserCreated: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  allRoles,
  onClose,
  onUserCreated,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRoleSlugs, setSelectedRoleSlugs] = useState<string[]>([]);
  const [accountStatus, setAccountStatus] = useState<'active' | 'pending'>('active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    email: string;
    password?: string;
    roles: string[];
    userId: string;
    status: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate secure password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let generated = 'Dj@';
    for (let i = 0; i < 9; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
  };

  const handleToggleRole = (slug: string) => {
    setSelectedRoleSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid corporate or personnel email address.');
      return;
    }

    if (selectedRoleSlugs.length === 0) {
      setError('Please assign at least one role to the new user account.');
      return;
    }

    const effectivePassword =
      password.trim() || `Davejoe${Math.floor(100000 + Math.random() * 900000)}!`;

    setIsSubmitting(true);
    try {
      const result = await AdminService.createUser({
        email: cleanEmail,
        password: effectivePassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        roleSlugs: selectedRoleSlugs,
        status: accountStatus,
      });

      setCreatedResult({
        email: cleanEmail,
        password: effectivePassword,
        roles: result.assigned_roles,
        userId: result.user_id,
        status: accountStatus,
      });
      onUserCreated();
    } catch (err: any) {
      console.error('[CreateUserModal] Error creating user:', err);
      setError(err?.message || 'Failed to create user account. Please check parameters.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdResult) return;
    const text = `Davejoe Management Tool Account\nEmail: ${createdResult.email}\nTemporary Password: ${createdResult.password}\nAssigned Roles: ${createdResult.roles.join(', ')}\nSign in URL: https://davejoe.app/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#01875F]/10 text-[#01875F] flex items-center justify-center font-bold shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="create-user-title" className="text-base font-bold text-slate-900 tracking-tight">
                Create User & Assign Roles
              </h3>
              <p className="text-xs text-slate-500">
                Authorized Leadership Workspace (Management / CEO & Executive Director)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {createdResult ? (
            /* Success confirmation screen */
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#01875F] mx-auto" />
                <h4 className="text-base font-bold text-emerald-950">
                  User Account Successfully Created
                </h4>
                <p className="text-xs text-emerald-700 max-w-md mx-auto">
                  The account has been created and persisted with authoritative role assignments in Supabase.
                </p>
              </div>

              {/* Credential summary card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 font-sans">
                  <span className="text-slate-500 font-semibold">User ID</span>
                  <span className="text-slate-900 text-[11px] truncate max-w-[240px]">
                    {createdResult.userId}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 font-sans">
                  <span className="text-slate-500 font-semibold">Email</span>
                  <span className="text-slate-900 font-bold">{createdResult.email}</span>
                </div>
                {createdResult.password && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-200/60 font-sans">
                    <span className="text-slate-500 font-semibold">Initial Password</span>
                    <span className="text-[#01875F] font-bold tracking-wider">
                      {createdResult.password}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 font-sans">
                  <span className="text-slate-500 font-semibold">Assigned Roles</span>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[240px]">
                    {createdResult.roles.map((r) => (
                      <span
                        key={r}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100/70 text-[#01875F]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Credentials Copied!' : 'Copy Credentials'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Personal Details */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Personal Details
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      First Name *
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Tunde"
                        className="w-full pl-8.5 pr-3 h-9 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Adebayo"
                      className="w-full px-3 h-9 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@davejoe.com"
                        className="w-full pl-8.5 pr-3 h-9 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Phone Number (Optional)
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+234 800 000 0000"
                        className="w-full pl-8.5 pr-3 h-9 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Configuration */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password Setup
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[11px] font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    Generate Secure Password
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave empty to auto-generate a secure password"
                    className="w-full pl-8.5 pr-10 h-9 bg-slate-50/70 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Nine Roles Multi-Select Checkboxes */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Select Assigned Roles ({selectedRoleSlugs.length} selected)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Both leadership roles can grant all 9 roles
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {ROLE_DEFINITIONS.map((r) => {
                    const isChecked = selectedRoleSlugs.includes(r.slug);
                    const RoleIcon = r.icon;
                    return (
                      <label
                        key={r.slug}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#01875F]/10 border-[#01875F] text-slate-900 font-semibold'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRole(r.slug)}
                          className="mt-0.5 rounded text-[#01875F] focus:ring-[#01875F] h-3.5 w-3.5 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <RoleIcon className={`w-3.5 h-3.5 ${isChecked ? 'text-[#01875F]' : 'text-slate-400'}`} />
                            <span className="truncate">{r.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                            {r.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Initial Account Status Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Initial Account Status
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Controls immediate login &amp; workspace access
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAccountStatus('active')}
                    className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      accountStatus === 'active'
                        ? 'border-[#01875F] bg-emerald-50/50 text-[#01875F] font-bold ring-1 ring-[#01875F]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-slate-900">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active (Recommended)
                    </span>
                    <span className="text-[11px] font-normal text-slate-500 block mt-1">
                      Staff account can sign in immediately to their assigned dashboards.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountStatus('pending')}
                    className={`p-3 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                      accountStatus === 'pending'
                        ? 'border-amber-500 bg-amber-50/50 text-amber-800 font-bold ring-1 ring-amber-500'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 font-bold text-slate-900">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Pending Activation
                    </span>
                    <span className="text-[11px] font-normal text-slate-500 block mt-1">
                      Staff account is registered but requires administrator activation before login.
                    </span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#01875F] hover:bg-[#00704e] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-60"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Creating Account...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
