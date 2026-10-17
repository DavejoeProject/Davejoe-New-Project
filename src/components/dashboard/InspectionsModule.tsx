import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, CheckCircle2, AlertTriangle, Clock, FileCheck, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface InspectionsModuleProps {
  onBackToDashboard: () => void;
}

export const InspectionsModule: React.FC<InspectionsModuleProps> = ({ onBackToDashboard }) => {
  const [filter, setFilter] = useState<'All' | 'Critical' | 'Pending' | 'Passed'>('All');
  const [inspections, setInspections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInspections = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_inspections')
        .select(`
          id,
          inspection_type,
          status,
          result,
          scheduled_date,
          created_at,
          inspection_findings,
          project:projects(name)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setInspections(data);
      }
    } catch (err) {
      console.warn('[InspectionsModule] Error fetching inspections:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, []);

  const totalOpen = inspections.filter((i) => i.status === 'pending' || i.status === 'in_progress').length;
  const totalPassed = inspections.filter((i) => i.result === 'passed' || i.status === 'completed').length;
  const totalPending = inspections.filter((i) => i.status === 'pending').length;
  const totalCritical = inspections.filter((i) => i.result === 'failed' || i.result === 'critical').length;

  const filtered = inspections.filter((ins) => {
    if (filter === 'Critical') return ins.result === 'failed' || ins.result === 'critical';
    if (filter === 'Pending') return ins.status === 'pending';
    if (filter === 'Passed') return ins.result === 'passed' || ins.status === 'completed';
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

        <button
          onClick={fetchInspections}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Open Inspections</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalOpen} open</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active on site</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Passed Certifications</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{totalPassed} passed</div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            {inspections.length > 0 ? `${Math.round((totalPassed / inspections.length) * 100)}% pass yield` : '—'}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Pending Witness</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">{totalPending} pending</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Awaiting signoff</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-xs text-slate-500 font-medium">Critical Findings</span>
          <div className="text-2xl font-bold text-red-600 mt-1">{totalCritical} critical</div>
          <span className="text-[11px] text-red-700 font-semibold mt-1 block">Requires action</span>
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
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Technical Inspections Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Quality control audits, concrete core tests, and statutory site inspections will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isCritical = item.result === 'failed' || item.result === 'critical';
            const isPending = item.status === 'pending';
            let badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            if (isCritical) badge = 'bg-red-50 text-red-700 border-red-200';
            if (isPending) badge = 'bg-amber-50 text-amber-700 border-amber-200';

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {item.id.slice(0, 8)}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      {item.project?.name || 'Project Inspection'}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge}`}>
                      {item.result || item.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{item.inspection_type}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                    {item.inspection_findings || 'Standard quality control inspection record.'}
                  </p>
                  <div className="text-[11px] text-slate-400 pt-1">
                    Scheduled date: {item.scheduled_date || new Date(item.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer">
                    View Record
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
