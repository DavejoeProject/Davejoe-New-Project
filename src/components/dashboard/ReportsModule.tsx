import React from 'react';
import { BarChart3, ArrowLeft, Download, FileText, TrendingUp, DollarSign, Calendar } from 'lucide-react';

interface ReportsModuleProps {
  onBackToDashboard: () => void;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ onBackToDashboard }) => {
  const reports = [
    { title: 'Executive Operations Monthly Brief (September 2026)', date: 'Generated 23 Sep 2026', size: '2.4 MB', category: 'Executive', downloads: 12 },
    { title: 'Comprehensive Portfolio Cost & Margin Reconciliation', date: 'Generated 20 Sep 2026', size: '4.8 MB', category: 'Financial', downloads: 8 },
    { title: 'QC Snagging & Structural Certification Audit Report', date: 'Generated 18 Sep 2026', size: '6.1 MB', category: 'Quality', downloads: 14 },
    { title: 'Site Material Wastage & Loss Variance Analysis', date: 'Generated 15 Sep 2026', size: '1.9 MB', category: 'Procurement', downloads: 7 },
    { title: 'Workforce Productivity & Overtime Payroll Ledger', date: 'Generated 12 Sep 2026', size: '3.1 MB', category: 'Workforce', downloads: 19 },
  ];

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
            <BarChart3 className="w-6 h-6 text-[#01875F]" />
            <span>Executive Reports & Intelligence</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Automated operational summaries, margin audits, and compliance documentation.
          </p>
        </div>

        <button className="px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-colors">
          <Download className="w-4 h-4" />
          <span>Export All Data (CSV/PDF)</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100">
        {reports.map((rep) => (
          <div key={rep.title} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">{rep.title}</h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>{rep.date}</span>
                  <span>•</span>
                  <span>{rep.size}</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-600">{rep.category}</span>
                </div>
              </div>
            </div>

            <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
