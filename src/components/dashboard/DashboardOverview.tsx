import React, { useState } from 'react';
import {
  Building2,
  Users,
  Package,
  ClipboardCheck,
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar,
  ChevronDown,
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Truck,
  ShieldAlert,
  DollarSign,
  Briefcase,
} from 'lucide-react';
import { DashboardData, ProjectItem, AttentionItem } from '../../services/dashboardService';
import { NavigationModule } from './Sidebar';

interface DashboardOverviewProps {
  data: DashboardData;
  onSelectModule: (module: NavigationModule) => void;
  onOpenProjectDetail: (project: ProjectItem) => void;
  onResolveAttentionItem: (item: AttentionItem) => void;
  userName?: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  data,
  onSelectModule,
  onOpenProjectDetail,
  onResolveAttentionItem,
  userName = 'Mayowa',
}) => {
  const [selectedDateRange, setSelectedDateRange] = useState('Tuesday, 24 June 2025');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Time-aware greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 sm:space-y-7 pb-12">
      {/* 1. TOP GREETING & DATE FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              WELCOME BACK
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
              CEO
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {getGreeting()}, {userName}.
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here's a quick overview of your operations.
          </p>
        </div>

        {/* Date Selector Dropdown (Matching Reference Image) */}
        <div className="relative self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setDateDropdownOpen((prev) => !prev)}
            className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-lg text-xs sm:text-sm font-medium text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{selectedDateRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dateDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40 animate-in fade-in duration-100">
              {['Today', 'Tuesday, 24 June 2025', 'This Week', 'This Month', 'Q2 2025'].map(
                (range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      setSelectedDateRange(range);
                      setDateDropdownOpen(false);
                    }}
                    className={`w-full px-3.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                      selectedDateRange === range
                        ? 'bg-[#01875F]/10 text-[#01875F] font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {range}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. TOP KPI CARDS (4 Cards matching Reference Image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI Card 1: Active Projects */}
        <div
          onClick={() => onSelectModule('projects')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-lg bg-[#E6F4EA] flex items-center justify-center text-[#01875F]">
              <Building2 className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F]">
              <TrendingUp className="w-3 h-3" />
              {data.kpis.activeProjectsTrend}
            </span>
          </div>

          <div className="mt-4">
            <span className="text-xs font-medium text-slate-500 block">Active Projects</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight">
              {data.kpis.activeProjects}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              of {data.kpis.totalProjects} total projects
            </span>
          </div>
        </div>

        {/* KPI Card 2: Total Workforce */}
        <div
          onClick={() => onSelectModule('workforce')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-lg bg-[#E6F7F2] flex items-center justify-center text-[#0D9488]">
              <Users className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F]">
              <TrendingUp className="w-3 h-3" />
              {data.kpis.workforceTrend}
            </span>
          </div>

          <div className="mt-4">
            <span className="text-xs font-medium text-slate-500 block">Total Workforce</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight">
              {data.kpis.totalWorkforce}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              {data.kpis.onSiteToday} on site today
            </span>
          </div>
        </div>

        {/* KPI Card 3: Materials Value */}
        <div
          onClick={() => onSelectModule('materials')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
              <Package className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F]">
              <TrendingUp className="w-3 h-3" />
              {data.kpis.materialsTrend}
            </span>
          </div>

          <div className="mt-4">
            <span className="text-xs font-medium text-slate-500 block">Materials Value</span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5 tracking-tight truncate">
              {data.kpis.materialsValue}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              Current stock value
            </span>
          </div>
        </div>

        {/* KPI Card 4: Open Inspections */}
        <div
          onClick={() => onSelectModule('inspections')}
          className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED]">
              <ClipboardCheck className="w-5 h-5" strokeWidth={2} />
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#DC2626]">
              <TrendingDown className="w-3 h-3" />
              {data.kpis.inspectionsTrend}
            </span>
          </div>

          <div className="mt-4">
            <span className="text-xs font-medium text-slate-500 block">Open Inspections</span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-0.5 tracking-tight">
              {data.kpis.openInspections}
            </div>
            <span className="text-xs text-slate-400 mt-1 block">
              of {data.kpis.inspectionsThisMonth} this month
            </span>
          </div>
        </div>
      </div>

      {/* 3. MANAGEMENT ATTENTION SECTION (CEO Priority Actions) */}
      {data.attentionItems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h2 className="text-sm font-bold text-slate-900">Needs Your Attention</h2>
              <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                {data.attentionItems.length} items require CEO review
              </span>
            </div>
            <button
              onClick={() => onSelectModule('reports')}
              className="text-xs font-medium text-[#01875F] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Management log →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.attentionItems.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-colors ${
                  item.severity === 'critical'
                    ? 'bg-red-50/50 border-red-200/70'
                    : 'bg-amber-50/50 border-amber-200/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        item.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.severity === 'critical' ? 'Intervention' : 'Attention'}
                    </span>
                    <span className="text-[10px] text-slate-400">{item.timestamp}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 leading-snug">{item.title}</h4>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      onResolveAttentionItem(item);
                      if (item.module) onSelectModule(item.module);
                    }}
                    className="text-xs font-semibold text-[#01875F] hover:text-[#016f4e] inline-flex items-center gap-1 cursor-pointer"
                  >
                    {item.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. MAIN MIDDLE ROW: Project Progress (Left) + Material Usage vs Budget (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): Project Progress */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Project Progress</h2>
            <button
              type="button"
              onClick={() => onSelectModule('projects')}
              className="text-xs font-semibold text-[#01875F] hover:text-[#016f4e] inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Project List Rows (Matching Reference Image) */}
          <div className="space-y-4">
            {data.projects.map((proj) => {
              // Status badge styling
              let statusClasses = 'bg-[#E6F4EA] text-[#01875F]';
              if (proj.status === 'At Risk') {
                statusClasses = 'bg-[#FEF7E0] text-[#B06000]';
              } else if (proj.status === 'Delayed') {
                statusClasses = 'bg-[#FCE8E6] text-[#C5221F]';
              }

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpenProjectDetail(proj)}
                  className="flex items-center gap-3.5 p-2 rounded-lg hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  {/* Thumbnail Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/70 shrink-0">
                    <img
                      src={proj.image}
                      alt={proj.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>

                  {/* Name and Location */}
                  <div className="flex-1 min-w-[120px] max-w-[190px]">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate group-hover:text-[#01875F] transition-colors">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-1 text-slate-400 text-xs mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{proj.location}</span>
                    </div>
                  </div>

                  {/* Progress Bar & Percentage */}
                  <div className="flex-1 max-w-[170px] hidden sm:flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#01875F] rounded-full transition-all duration-500"
                        style={{ width: `${proj.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-600 w-8 text-right">
                      {proj.progress}%
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusClasses}`}
                    >
                      {proj.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (5 Cols): Material Usage vs Budget */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Material Usage vs Budget
              </h2>
              <button
                type="button"
                onClick={() => onSelectModule('materials')}
                className="text-xs font-semibold text-[#01875F] hover:text-[#016f4e] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600 mb-6">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#01875F]" />
                <span>Actual Usage</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#CBD5E1]" />
                <span>Budgeted</span>
              </div>
            </div>

            {/* Bar Chart Visualization (Matching Reference Image) */}
            <div className="relative pt-2 pb-4">
              {/* Y-axis Labels & Gridlines */}
              <div className="space-y-6 text-[11px] font-medium text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right font-mono">₦200M</span>
                  <div className="flex-1 border-b border-slate-100" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right font-mono">₦150M</span>
                  <div className="flex-1 border-b border-slate-100" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right font-mono">₦100M</span>
                  <div className="flex-1 border-b border-slate-100" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right font-mono">₦50M</span>
                  <div className="flex-1 border-b border-slate-100" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right font-mono">₦0</span>
                  <div className="flex-1 border-b border-slate-200" />
                </div>
              </div>

              {/* Monthly Paired Bars */}
              <div className="absolute inset-x-0 bottom-7 pl-12 pr-2 flex items-end justify-between h-44">
                {data.materialUsage.map((item, idx) => {
                  const maxAmount = 200;
                  const actualHeight = Math.min(100, (item.actual / maxAmount) * 100);
                  const budgetHeight = Math.min(100, (item.budgeted / maxAmount) * 100);
                  const isHovered = hoveredBarIndex === idx;

                  return (
                    <div
                      key={item.month}
                      className="flex flex-col items-center group relative cursor-pointer"
                      onMouseEnter={() => setHoveredBarIndex(idx)}
                      onMouseLeave={() => setHoveredBarIndex(null)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute -top-12 z-20 bg-slate-900 text-white text-[10px] rounded-md px-2 py-1 shadow-lg pointer-events-none whitespace-nowrap">
                          <div>Actual: ₦{item.actual}M</div>
                          <div>Budget: ₦{item.budgeted}M</div>
                        </div>
                      )}

                      {/* Paired Bars */}
                      <div className="flex items-end gap-1 sm:gap-1.5 h-36">
                        {/* Green bar: Actual */}
                        <div
                          className="w-3 sm:w-4 bg-[#01875F] rounded-t transition-all group-hover:brightness-110"
                          style={{ height: `${actualHeight}%` }}
                        />
                        {/* Light grey bar: Budget */}
                        <div
                          className="w-3 sm:w-4 bg-[#CBD5E1] rounded-t transition-all group-hover:bg-[#94A3B8]"
                          style={{ height: `${budgetHeight}%` }}
                        />
                      </div>

                      {/* Month label */}
                      <span className="text-[11px] font-medium text-slate-500 mt-2">
                        {item.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick summary below chart */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>YTD Material Variance: <span className="text-[#01875F] font-semibold">-14.2%</span> (Under budget)</span>
            <span className="text-slate-400">Currency: NGN (₦)</span>
          </div>
        </div>
      </div>

      {/* 5. BOTTOM ROW: Recent Activities (Left) + Upcoming Schedule (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (6 Cols): Recent Activities */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Activities</h2>
            <button
              type="button"
              onClick={() => onSelectModule('reports')}
              className="text-xs font-semibold text-[#01875F] hover:text-[#016f4e] inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {data.recentActivities.map((act) => {
              // Icon & color by activity type
              let iconNode = <Package className="w-4 h-4 text-purple-600" />;
              let bgClass = 'bg-purple-50';

              if (act.type === 'inspection') {
                iconNode = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                bgClass = 'bg-emerald-50';
              } else if (act.type === 'approval') {
                iconNode = <FileText className="w-4 h-4 text-blue-600" />;
                bgClass = 'bg-blue-50';
              } else if (act.type === 'attendance') {
                iconNode = <Users className="w-4 h-4 text-teal-600" />;
                bgClass = 'bg-teal-50';
              } else if (act.type === 'po') {
                iconNode = <Truck className="w-4 h-4 text-amber-600" />;
                bgClass = 'bg-amber-50';
              }

              return (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full ${bgClass} flex items-center justify-center shrink-0`}
                    >
                      {iconNode}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-snug">
                        {act.title}
                      </h4>
                      <p className="text-xs text-slate-500 leading-none mt-0.5">{act.subtitle}</p>
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-2">
                    {act.timestamp}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (6 Cols): Upcoming Schedule */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Upcoming Schedule</h2>
            <button
              type="button"
              onClick={() => onSelectModule('calendar')}
              className="text-xs font-semibold text-[#01875F] hover:text-[#016f4e] inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {data.upcomingSchedule.map((sch) => (
              <div
                key={sch.id}
                onClick={() => onSelectModule('calendar')}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  {/* Date Badge: green square with bold day + small month */}
                  <div className="w-10 h-10 rounded-lg bg-[#E6F4EA] flex flex-col items-center justify-center text-[#01875F] shrink-0 font-bold">
                    <span className="text-sm leading-none">{sch.day}</span>
                    <span className="text-[9px] uppercase tracking-wider leading-none mt-0.5">
                      {sch.month}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#01875F] transition-colors leading-snug">
                      {sch.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-none mt-0.5">{sch.location}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-slate-500 text-xs font-medium">
                  <span>{sch.time}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. EXECUTIVE FINANCIAL & COST SNAPSHOT (Compact Card) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Project Cost Snapshot</h3>
              <p className="text-xs text-slate-500">Executive financial overview across all active projects</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectModule('reports')}
            className="text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
          >
            Financial Ledger →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block mb-0.5">Project Revenue</span>
            <span className="text-sm sm:text-base font-bold text-slate-900 font-mono">
              {data.financialSnapshot.revenue}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block mb-0.5">Project Costs</span>
            <span className="text-sm sm:text-base font-bold text-slate-900 font-mono">
              {data.financialSnapshot.costs}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block mb-0.5">Outstanding Receivables</span>
            <span className="text-sm sm:text-base font-bold text-amber-600 font-mono">
              {data.financialSnapshot.receivables}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block mb-0.5">Current Project Margin</span>
            <span className="text-sm sm:text-base font-bold text-emerald-600 font-mono">
              {data.financialSnapshot.margin}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
