import React from 'react';
import { Settings, ArrowLeft, ShieldCheck, Database, Key, Bell, CheckCircle2, Lock } from 'lucide-react';

interface SettingsModuleProps {
  onBackToDashboard: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({ onBackToDashboard }) => {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[#01875F]" />
            <span>System Configuration & Security Architecture</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Enterprise parameters, PostgreSQL Row Level Security status, and organizational branding.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security & RLS Policy State */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Security Architecture Status</h3>
              <p className="text-xs text-slate-500">PostgreSQL RLS & Defense-in-Depth</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600 font-medium">PostgreSQL Row Level Security (RLS)</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active & Enforced
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600 font-medium">Immutable Audit Trail Table</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Active (Trigger Protected)
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600 font-medium">PKCE Flow & Token Storage</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Hardened
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
              <span className="text-slate-600 font-medium">Search Path Isolation</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                pg_temp, public
              </span>
            </div>
          </div>
        </div>

        {/* Organization Information */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Organization Settings</h3>
              <p className="text-xs text-slate-500">Corporate entity details</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-500 font-medium block mb-1">Company Name</label>
              <input
                type="text"
                disabled
                value="Davejoe Interiors Ltd"
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="text-slate-500 font-medium block mb-1">Operating Currency</label>
              <input
                type="text"
                disabled
                value="Nigerian Naira (NGN - ₦)"
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="text-slate-500 font-medium block mb-1">Primary Operational Territory</label>
              <input
                type="text"
                disabled
                value="Lagos State, Nigeria (Lekki, Ajah, VI, Ikoyi, Yaba)"
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
