import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Briefcase, Mail, ShieldCheck, CheckCircle2, Clock, KeyRound, Shield } from 'lucide-react';
import { StandardRoleKey, ROLE_CONFIGS } from '../services/authService';

interface RoleDashboardPlaceholderProps {
  roleKey: StandardRoleKey;
}

export const RoleDashboardPlaceholder: React.FC<RoleDashboardPlaceholderProps> = ({ roleKey }) => {
  const { user, profile, permissions, currentRoleKey, logout } = useAuth();
  const navigate = useNavigate();
  const roleConfig = ROLE_CONFIGS[roleKey];

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const displayName =
    profile?.display_name ||
    (profile?.first_name || profile?.last_name
      ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
      : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User');

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—';
  const jobTitle = profile?.job_title || roleConfig.label;
  const status = profile?.status || 'Active';
  const isManagement = currentRoleKey === 'management';

  return (
    <div className="min-h-screen bg-[#f7faf9] text-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#18B892] flex items-center justify-center shadow-xs">
              <span className="text-white font-bold text-base tracking-wider">DJ</span>
            </div>
            <div>
              <span className="font-bold text-slate-800 tracking-tight text-sm sm:text-base">
                DAVEJOE
              </span>
              <span className="hidden sm:inline text-xs text-slate-400 font-medium ml-2">
                Management System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{roleConfig.label}</span>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Welcome Banner */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#18B892]/10 text-[#18B892] text-xs font-semibold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                {roleConfig.label} Dashboard
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Welcome, {displayName}!
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                You are securely logged into the Davejoe Management Tool.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-xl px-4 py-2.5 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Supabase RLS & RBAC Enforced</span>
            </div>
          </div>
        </div>

        {/* User Profile & Permissions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7">
            <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-[#18B892]" />
              User Profile Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-xs font-medium text-slate-400 block mb-1">Display Name</span>
                <span className="font-semibold text-slate-800">{displayName}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-xs font-medium text-slate-400 block mb-1">First & Last Name</span>
                <span className="font-semibold text-slate-800">{fullName}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-xs font-medium text-slate-400 block mb-1">Job Title</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {jobTitle}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                <span className="text-xs font-medium text-slate-400 block mb-1">Email Address</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{user?.email || '—'}</span>
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 sm:col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-400 block mb-0.5">Account Status</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium text-slate-400 block mb-0.5">Assigned Route</span>
                  <code className="text-xs font-mono font-semibold text-[#18B892] bg-[#18B892]/10 px-2 py-0.5 rounded">
                    {roleConfig.route}
                  </code>
                </div>
              </div>
            </div>

            {/* Granular Active Permissions */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#18B892]" />
                Assigned Granular Permissions ({permissions.length})
              </h3>

              <div className="flex flex-wrap gap-1.5">
                {isManagement || permissions.includes('*') ? (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md text-xs font-mono font-semibold">
                    * (Global Management Wildcard Access)
                  </span>
                ) : permissions.length > 0 ? (
                  permissions.map((p) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-mono"
                    >
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Standard role permissions active via PostgreSQL RLS
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Security & Module Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 mb-4">
                <Shield className="w-5 h-5 text-[#18B892]" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Hardened Security Active</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                This workspace is protected by PostgreSQL Row Level Security, permission-based authorization, and an append-only audit trail.
              </p>

              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>RLS Authorization Boundary</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Immutable Audit Logging</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Isolated Search Paths</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 block truncate">
                Auth UID: <span className="font-mono text-slate-600">{user?.id || '—'}</span>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
