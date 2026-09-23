import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, Briefcase, Mail, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';
import { StandardRoleKey, ROLE_CONFIGS } from '../services/authService';

interface RoleDashboardPlaceholderProps {
  roleKey: StandardRoleKey;
}

export const RoleDashboardPlaceholder: React.FC<RoleDashboardPlaceholderProps> = ({ roleKey }) => {
  const { user, profile, logout } = useAuth();
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
              <span>Supabase Session Authenticated</span>
            </div>
          </div>
        </div>

        {/* User Profile Information Card */}
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
          </div>

          {/* Module Placeholder Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Module In Development</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The {roleConfig.label} dashboard workspace is ready for upcoming features. Authentication, role verification, and route security are active.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 block">
                Session ID: <span className="font-mono">{user?.id?.slice(0, 12)}...</span>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
