import React from 'react';
import { User, ArrowLeft, Briefcase, Mail, ShieldCheck, LogOut, KeyRound } from 'lucide-react';
import { ASSETS } from '../../assets/projectImages';
import { useAuth } from '../../hooks/useAuth';

interface ProfileModuleProps {
  onBackToDashboard: () => void;
  onLogout: () => void;
}

export const ProfileModule: React.FC<ProfileModuleProps> = ({ onBackToDashboard, onLogout }) => {
  const { user, profile, permissions } = useAuth();

  const displayName = profile?.display_name || 'Mayowa';
  const fullName = [profile?.first_name || 'Mayowa', profile?.last_name || 'Adewuyi'].join(' ');
  const email = user?.email || 'mayowa@davejoeinteriors.com';
  const jobTitle = profile?.job_title || 'Chief Executive Officer (CEO)';

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      <div>
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <User className="w-6 h-6 text-[#01875F]" />
          <span>Executive Profile</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Personal identification, assigned security role, and authorized executive permissions.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-slate-100">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border-2 border-[#01875F]/30 shrink-0">
            <img src={ASSETS.mayowaAvatar} alt={displayName} className="w-full h-full object-cover" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">{displayName}</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{jobTitle}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
                Management / CEO
              </span>
              <span className="text-xs text-slate-400 font-mono">UID: {user?.id?.slice(0, 10)}...</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-xs sm:text-sm">
          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400 block mb-1 text-xs">Full Legal Name</span>
            <span className="font-semibold text-slate-900">{fullName}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400 block mb-1 text-xs">Corporate Email</span>
            <span className="font-semibold text-slate-900">{email}</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400 block mb-1 text-xs">Assigned Responsibility</span>
            <span className="font-semibold text-slate-900">Executive Management & Overall Operations</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg">
            <span className="text-slate-400 block mb-1 text-xs">Account Status</span>
            <span className="font-semibold text-emerald-600">Active & Verified</span>
          </div>
        </div>

        {/* Permissions */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#01875F]" />
            <span>Database RLS & Granular Permissions</span>
          </h4>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs text-emerald-800">
            <strong className="block mb-0.5">Global Executive Wildcard (*)</strong>
            Management role carries full administrative, financial, procurement, and QC oversight across all database tables.
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Davejoe</span>
          </button>
        </div>
      </div>
    </div>
  );
};
