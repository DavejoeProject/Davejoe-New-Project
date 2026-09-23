import React, { useState } from 'react';
import { Users, ArrowLeft, Search, UserCheck, Clock, UserX, Briefcase, MapPin } from 'lucide-react';

interface WorkforceModuleProps {
  onBackToDashboard: () => void;
}

export const WorkforceModule: React.FC<WorkforceModuleProps> = ({ onBackToDashboard }) => {
  const [selectedSite, setSelectedSite] = useState<string>('All');

  const sites = [
    { name: 'Riverside Apartments (Lekki)', deployed: 42, present: 38, late: 3, absent: 1, supervisor: 'Engr. Babatunde Lawal' },
    { name: 'Oakridge Villas (Ajah)', deployed: 32, present: 29, late: 2, absent: 1, supervisor: 'Engr. Chidi Okafor' },
    { name: 'Sunset Commercial (VI)', deployed: 35, present: 28, late: 4, absent: 3, supervisor: 'Arch. Fatima Aliyu' },
    { name: 'Lakeside Residences (Ikoyi)', deployed: 21, present: 17, late: 3, absent: 1, supervisor: 'Engr. Segun Adeleke' },
    { name: 'Metro Office (Yaba)', deployed: 12, present: 8, late: 0, absent: 0, supervisor: 'Engr. Emeka Nwosu' },
  ];

  const trades = [
    { trade: 'Masons & Bricklayers', count: 34, lead: 'Musa Ibrahim', status: 'Optimal' },
    { trade: 'Carpenters & Joiners', count: 28, lead: 'Adeyemi Johnson', status: 'Optimal' },
    { trade: 'Steel Fixers & Welders', count: 20, lead: 'Tariq Hassan', status: 'High Demand' },
    { trade: 'Electricians (MEP)', count: 18, lead: 'Sunday Obi', status: 'Optimal' },
    { trade: 'Painters & Finishers', count: 16, lead: 'Kunle Adeleke', status: 'Low Demand' },
    { trade: 'Plumbers & Drainage', count: 14, lead: 'Gideon Chukwu', status: 'Optimal' },
    { trade: 'Tile & Granite Fitters', count: 12, lead: 'Efe Omoruyi', status: 'Optimal' },
  ];

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
            <Users className="w-6 h-6 text-[#01875F]" />
            <span>Workforce & Artisan Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time daily muster rolls, artisan compensation, and site deployment rosters.
          </p>
        </div>
      </div>

      {/* Snapshot KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-medium block">Total Workforce</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">142</span>
          <span className="text-[10px] text-slate-500">Active roster</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-medium block">Present Today</span>
          <span className="text-xl font-bold text-emerald-600 mt-1 block">120</span>
          <span className="text-[10px] text-emerald-700 font-medium">84.5% muster rate</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-medium block">Late Arrivals</span>
          <span className="text-xl font-bold text-amber-600 mt-1 block">12</span>
          <span className="text-[10px] text-slate-500">Grace period active</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-medium block">Unexcused Absent</span>
          <span className="text-xl font-bold text-red-600 mt-1 block">6</span>
          <span className="text-[10px] text-slate-500">Site penalties applied</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-medium block">Permanent Staff</span>
          <span className="text-xl font-bold text-slate-800 mt-1 block">84</span>
          <span className="text-[10px] text-slate-500">Salaried personnel</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[11px] text-slate-400 font-medium block">Artisan / Contract</span>
          <span className="text-xl font-bold text-slate-800 mt-1 block">58</span>
          <span className="text-[10px] text-slate-500">Daily/Project rate</span>
        </div>
      </div>

      {/* Grid: Site Distribution & Trade Capacities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Site Deployment */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#01875F]" />
            <span>Site Workforce Deployment Today</span>
          </h3>

          <div className="space-y-3">
            {sites.map((site) => (
              <div key={site.name} className="p-3 bg-slate-50/70 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">{site.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Site Head: {site.supervisor}</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Deployed</span>
                    <span className="font-bold text-slate-900">{site.deployed}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Present</span>
                    <span className="font-bold text-emerald-600">{site.present}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Late/Absent</span>
                    <span className="font-bold text-amber-600">{site.late + site.absent}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trade Allocation */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#01875F]" />
            <span>Artisan Trade Allocation</span>
          </h3>

          <div className="divide-y divide-slate-100 text-xs">
            {trades.map((t) => (
              <div key={t.trade} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">{t.trade}</span>
                  <span className="text-[11px] text-slate-400">Trade Lead: {t.lead}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900 block">{t.count} artisans</span>
                  <span className={`text-[10px] font-medium ${t.status === 'High Demand' ? 'text-amber-600' : 'text-slate-400'}`}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
