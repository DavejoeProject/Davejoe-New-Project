import React from 'react';
import { Calendar as CalendarIcon, ArrowLeft, Clock, MapPin, ChevronRight, Plus } from 'lucide-react';
import { ScheduleItem } from '../../services/dashboardService';

interface CalendarModuleProps {
  onBackToDashboard: () => void;
  schedule: ScheduleItem[];
}

export const CalendarModule: React.FC<CalendarModuleProps> = ({ onBackToDashboard, schedule }) => {
  const events = [
    ...schedule,
    { id: 'sch-05', day: '28', month: 'JUN', title: 'Client Walkthrough & Interim Handover', location: 'Riverside Apartments', time: '02:00 PM', status: 'Scheduled' as const },
    { id: 'sch-06', day: '29', month: 'JUN', title: 'Structural Engineer Sign-off (Pour 4)', location: 'Oakridge Villas', time: '11:30 AM', status: 'Scheduled' as const },
    { id: 'sch-07', day: '30', month: 'JUN', title: 'Monthly Executive Site Audit', location: 'Metro Office', time: '09:00 AM', status: 'Scheduled' as const },
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
            <CalendarIcon className="w-6 h-6 text-[#01875F]" />
            <span>Operational Schedule & Site Milestones</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Inspection schedules, planned concrete pours, material deliveries, and client walkthroughs.
          </p>
        </div>

        <button className="px-3.5 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 cursor-pointer transition-colors">
          <Plus className="w-4 h-4" />
          <span>Schedule Site Event</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100">
        {events.map((ev) => (
          <div key={ev.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E6F4EA] text-[#01875F] flex flex-col items-center justify-center font-bold shrink-0">
                <span className="text-base leading-none">{ev.day}</span>
                <span className="text-[10px] tracking-wider uppercase mt-0.5">{ev.month}</span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">{ev.title}</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>{ev.location}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{ev.time}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
