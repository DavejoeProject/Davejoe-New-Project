import React from 'react';
import { ArrowLeft, Clock, ShieldCheck, UserCog } from 'lucide-react';
import { DashboardNavKey, SIDEBAR_SECTIONS } from './Sidebar';
import { DashboardData } from '../../services/dashboardService';

interface ModuleShellProps {
  moduleKey: DashboardNavKey;
  onBackToOverview: () => void;
  dashboardData: DashboardData;
  userEmail?: string;
  userName?: string;
  userRole?: string;
}

export const ModuleShell: React.FC<ModuleShellProps> = ({
  moduleKey,
  onBackToOverview,
  dashboardData,
  userEmail = 'olaoluwapoadewuyi@gmail.com',
  userName = 'Mayowa',
  userRole = 'Management / CEO',
}) => {
  // Find current item and section config
  let sectionTitle = 'OPERATIONS';
  let itemLabel = 'Module';
  let ItemIcon: React.ComponentType<{ className?: string; strokeWidth?: number }> = Clock;

  for (const sec of SIDEBAR_SECTIONS) {
    const found = sec.items.find((i) => i.key === moduleKey);
    if (found) {
      sectionTitle = sec.title;
      itemLabel = found.label;
      ItemIcon = found.icon;
      break;
    }
  }

  if (moduleKey === 'profile') {
    sectionTitle = 'ACCOUNT';
    itemLabel = 'Executive Profile';
  }

  // Specific handling for Users administration (showing the 1 real user: Mayowa)
  if (moduleKey === 'users') {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
          <div>
            <button
              type="button"
              onClick={onBackToOverview}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </button>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                {sectionTitle}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <UserCog className="w-6 h-6 text-[#01875F]" />
              <span>Users Management</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Active enterprise user accounts and authenticated identities in Davejoe.
            </p>
          </div>
        </div>

        {/* Real User Account List */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Registered Accounts (1 Active)
            </h2>
          </div>

          <div className="pt-4 divide-y divide-slate-100">
            <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#01875F] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs">
                  M
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{userName}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{userEmail}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-center">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
                  {userRole}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handling for Profile
  if (moduleKey === 'profile') {
    return (
      <div className="space-y-6 pb-12">
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Overview</span>
          </button>
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            EXECUTIVE IDENTITY
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Profile</h1>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-6 max-w-xl">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-[#01875F] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
              M
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{userName}</h2>
              <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
                {userRole}
              </span>
            </div>
          </div>

          <div className="pt-5 space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Email Address:</span>
              <span className="font-mono font-semibold text-slate-800">{userEmail}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Assigned Role:</span>
              <span className="font-semibold text-slate-800">{userRole}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Authorization Scope:</span>
              <span className="font-semibold text-[#01875F]">Executive Authority (Wildcard *)</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-500 font-medium">Account Status:</span>
              <span className="font-semibold text-emerald-700">Active</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Clean empty state / module shell for other modules
  let emptyTitle = `${itemLabel} Module`;
  let emptyDescription = 'This module will be connected to real database tables in subsequent phases.';

  if (moduleKey === 'all-projects' && dashboardData.projects.length === 0) {
    emptyTitle = 'No projects yet';
    emptyDescription = 'No construction or interior fit-out projects are currently registered in the database.';
  } else if (moduleKey === 'approvals' && dashboardData.attentionItems.length === 0) {
    emptyTitle = 'No pending approvals';
    emptyDescription = 'There are currently no requisitions or procurement requests awaiting CEO sign-off.';
  } else if (moduleKey === 'alerts' && dashboardData.kpis.activeAlerts === 0) {
    emptyTitle = 'No alerts';
    emptyDescription = 'All quality inspections, structural milestones, and delivery checkpoints are clear.';
  } else if (moduleKey === 'workforce' && dashboardData.kpis.totalWorkforce === 0) {
    emptyTitle = 'No workforce records';
    emptyDescription = 'Workforce roster logs and artisan field assignments will appear here once submitted.';
  } else if (moduleKey === 'materials') {
    emptyTitle = 'No material alerts';
    emptyDescription = 'Materials inventory and requisitions are currently balanced with no pending alerts.';
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header with breadcrumb */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={onBackToOverview}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            {sectionTitle}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <ItemIcon className="w-6 h-6 text-[#01875F]" />
          <span>{itemLabel}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Davejoe Construction &amp; Project Management System &bull; {sectionTitle}
        </p>
      </div>

      {/* Main Empty State / Enterprise Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 sm:p-12 text-center max-w-2xl mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-4 border border-[#01875F]/20">
          <ItemIcon className="w-7 h-7" strokeWidth={1.8} />
        </div>

        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{emptyTitle}</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          {emptyDescription}
        </p>

        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBackToOverview}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Overview</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModuleShell;
