import React, { useState } from 'react';
import { ShieldCheck, ArrowLeft, CheckCircle2, AlertTriangle, Clock, Camera, FileCheck, XCircle } from 'lucide-react';

interface InspectionsModuleProps {
  onBackToDashboard: () => void;
}

export const InspectionsModule: React.FC<InspectionsModuleProps> = ({ onBackToDashboard }) => {
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Pending' | 'Passed'>('All');

  const inspections = [
    {
      id: 'INS-019',
      project: 'Sunset Commercial (VI)',
      type: 'Concrete Compressive Core Testing',
      inspector: 'Engr. Taiwo Adeyemi (QC Lead)',
      date: '23 Sep 2026',
      status: 'Critical Finding',
      details: 'Level 4 shear wall core 7-day cylinder strength registered 21.4 MPa vs 30 MPa design spec. Structural engineer re-test mandated.',
      severity: 'critical',
    },
    {
      id: 'INS-020',
      project: 'Riverside Apartments (Lekki)',
      type: 'Foundation Raft Rebar Spacing & Cover',
      inspector: 'Engr. Babatunde Lawal',
      date: '24 Sep 2026',
      status: 'Passed',
      details: 'Clear cover blocks 50mm verified, rebar pitch verified against structural drawing ST-04. Pour permit certified.',
      severity: 'passed',
    },
    {
      id: 'INS-021',
      project: 'Oakridge Villas (Ajah)',
      type: 'Plumbing Pressure & Leakage Test',
      inspector: 'Engr. Chidi Okafor',
      date: '22 Sep 2026',
      status: 'Pending',
      details: 'PPR riser pipes held at 10 bar pressure test for 4 hours; final certificate awaiting joint witness by Client Rep.',
      severity: 'pending',
    },
    {
      id: 'INS-022',
      project: 'Metro Office (Yaba)',
      type: 'MEP Conduit Embedment Inspection',
      inspector: 'Engr. Emeka Nwosu',
      date: '21 Sep 2026',
      status: 'Critical Finding',
      details: 'Electrical conduit overlaps exceeding slab depth threshold. Re-routing required before screeding.',
      severity: 'critical',
    },
  ];

  const filtered = inspections.filter((ins) => {
    if (filter === 'Critical') return ins.severity === 'critical';
    if (filter === 'Pending') return ins.severity === 'pending';
    if (filter === 'Passed') return ins.severity === 'passed';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
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
            <ShieldCheck className="w-6 h-6 text-[#01875F]" />
            <span>Quality Control & Technical Inspections</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Structural audit logs, snagging tickets, test certifications, and building code compliance.
          </p>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Open Inspections</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">6 open</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active on site</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Passed Certifications</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">18 passed</div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">75% first-pass yield</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Pending Witness</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">4 pending</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting consultant signoff</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Critical Findings</span>
          <div className="text-2xl font-bold text-red-600 mt-1">2 critical</div>
          <span className="text-[11px] text-red-700 font-semibold mt-1 block">Requires CEO action</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {(['All', 'Critical', 'Pending', 'Passed'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              filter === tab
                ? 'bg-[#01875F] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Inspection Cards */}
      <div className="space-y-4">
        {filtered.map((item) => {
          let badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          if (item.severity === 'critical') badge = 'bg-red-50 text-red-700 border-red-200';
          if (item.severity === 'pending') badge = 'bg-amber-50 text-amber-700 border-amber-200';

          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {item.id}
                  </span>
                  <span className="text-xs font-bold text-slate-800">{item.project}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge}`}>
                    {item.status}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{item.type}</h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">{item.details}</p>
                <div className="text-[11px] text-slate-400 pt-1">
                  Inspected by: <strong className="text-slate-700">{item.inspector}</strong> • {item.date}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {item.severity === 'critical' ? (
                  <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer">
                    CEO Stop-Work Review
                  </button>
                ) : (
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer">
                    View Certificate
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
