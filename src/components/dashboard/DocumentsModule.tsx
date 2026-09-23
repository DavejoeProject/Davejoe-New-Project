import React from 'react';
import { FileText, ArrowLeft, Download, Plus, Folder, Eye } from 'lucide-react';

interface DocumentsModuleProps {
  onBackToDashboard: () => void;
}

export const DocumentsModule: React.FC<DocumentsModuleProps> = ({ onBackToDashboard }) => {
  const documents = [
    { name: 'Riverside Apartments — Approved Architectural Plans (Rev 4)', project: 'Riverside Apartments', type: 'DWG / PDF', size: '18.4 MB', date: '14 Sep 2026' },
    { name: 'Sunset Commercial — Bill of Quantities (BoQ) & Priced Tender', project: 'Sunset Commercial', type: 'XLSX / PDF', size: '5.2 MB', date: '02 Sep 2026' },
    { name: 'Oakridge Villas — LASPPPA Building Permit Certification', project: 'Oakridge Villas', type: 'PDF Permit', size: '2.8 MB', date: '28 Aug 2026' },
    { name: 'Lakeside Residences — Structural Calculation Sheets & Core Tests', project: 'Lakeside Residences', type: 'PDF Report', size: '9.6 MB', date: '19 Aug 2026' },
    { name: 'Metro Office — MEP Mechanical & Electrical Schematics', project: 'Metro Office', type: 'PDF Drawing', size: '14.1 MB', date: '11 Aug 2026' },
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
            <FileText className="w-6 h-6 text-[#01875F]" />
            <span>Project Documents & Drawings Repository</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Secure cloud storage for architectural plans, statutory permits, BoQs, and contracts.
          </p>
        </div>

        <button className="px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-colors">
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100">
        {documents.map((doc) => (
          <div key={doc.name} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 leading-snug">{doc.name}</h4>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="font-semibold text-slate-700">{doc.project}</span>
                  <span>•</span>
                  <span>{doc.type}</span>
                  <span>•</span>
                  <span>{doc.size}</span>
                  <span>•</span>
                  <span>{doc.date}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer">
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
              <button className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer">
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
