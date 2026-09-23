import React from 'react';
import { HelpCircle, ArrowLeft, Mail, Phone, ExternalLink, ShieldCheck } from 'lucide-react';

interface SupportModuleProps {
  onBackToDashboard: () => void;
}

export const SupportModule: React.FC<SupportModuleProps> = ({ onBackToDashboard }) => {
  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div>
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <HelpCircle className="w-6 h-6 text-[#01875F]" />
          <span>Davejoe Operations Support</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Executive technical support, emergency site dispatch, and documentation.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs space-y-5 text-xs sm:text-sm">
        <div className="p-4 bg-[#E6F4EA]/60 border border-[#01875F]/20 rounded-lg text-slate-800">
          <h3 className="font-bold text-slate-900 mb-1">Executive Priority Support Line</h3>
          <p className="text-slate-600 text-xs">
            Direct hotline to the Davejoe technical infrastructure team for site emergency halts or critical system queries.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-[#01875F]">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              +234 1 800 DAVEJOE (+234 1 800 3283)
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              support@davejoeinteriors.com
            </span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-slate-900 text-sm">Frequently Referenced Operational Protocols</h4>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
            <div className="p-3 bg-slate-50 flex items-center justify-between">
              <span className="font-medium text-slate-800">Concrete Pour Inspection Sign-off SOP</span>
              <span className="text-[#01875F] font-semibold text-xs cursor-pointer hover:underline">Read SOP →</span>
            </div>
            <div className="p-3 bg-slate-50 flex items-center justify-between">
              <span className="font-medium text-slate-800">Emergency Material Requisition Thresholds (₦10M+)</span>
              <span className="text-[#01875F] font-semibold text-xs cursor-pointer hover:underline">Read SOP →</span>
            </div>
            <div className="p-3 bg-slate-50 flex items-center justify-between">
              <span className="font-medium text-slate-800">Artisan Conduct & Safety Protocol Manual</span>
              <span className="text-[#01875F] font-semibold text-xs cursor-pointer hover:underline">Read SOP →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
