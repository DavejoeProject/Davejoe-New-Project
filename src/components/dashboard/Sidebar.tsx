import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  AlertTriangle,
  FolderKanban,
  TrendingUp,
  Flag,
  ClipboardCheck,
  Users,
  CalendarCheck,
  Activity,
  Clock,
  ShieldAlert,
  Package,
  FileText,
  ShoppingCart,
  Truck,
  Boxes,
  RotateCcw,
  Scale,
  CircleDollarSign,
  BarChart2,
  Receipt,
  FileBarChart,
  FileSpreadsheet,
  ScrollText,
  Briefcase,
  UserCog,
  ShieldCheck,
  Settings,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export type DashboardNavKey =
  // COMMAND CENTRE
  | 'overview'
  | 'approvals'
  | 'alerts'
  // PROJECTS
  | 'all-projects'
  | 'project-performance'
  | 'milestones'
  | 'inspections'
  // WORKFORCE
  | 'workforce'
  | 'workforce-performance'
  | 'attendance'
  | 'productivity'
  | 'overtime'
  | 'conduct'
  // MATERIALS
  | 'materials'
  | 'materials-directory'
  | 'material-requests'
  | 'procurement'
  | 'deliveries'
  | 'stock'
  | 'losses-returns'
  | 'reconciliation'
  // FINANCIAL CONTROL
  | 'project-costs'
  | 'budget-vs-actual'
  | 'procurement-costs'
  // REPORTS
  | 'project-reports'
  | 'workforce-reports'
  | 'material-reports'
  | 'management-reports'
  // ADMINISTRATION
  | 'users'
  | 'roles-permissions'
  | 'settings'
  // OTHER
  | 'profile';

export interface NavItemConfig {
  key: DashboardNavKey;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

export interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

export const SIDEBAR_SECTIONS: NavSectionConfig[] = [
  {
    title: 'COMMAND CENTRE',
    items: [
      { key: 'overview', label: 'Overview', icon: LayoutDashboard },
      { key: 'approvals', label: 'Approvals', icon: CheckSquare },
      { key: 'alerts', label: 'Alerts', icon: AlertTriangle },
    ],
  },
  {
    title: 'PROJECTS',
    items: [
      { key: 'all-projects', label: 'All Projects', icon: FolderKanban },
      { key: 'project-performance', label: 'Project Performance', icon: TrendingUp },
      { key: 'milestones', label: 'Milestones', icon: Flag },
      { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
    ],
  },
  {
    title: 'WORKFORCE',
    items: [
      { key: 'workforce', label: 'Workforce', icon: Users },
      { key: 'workforce-performance', label: 'Performance', icon: TrendingUp },
      { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
      { key: 'productivity', label: 'Productivity', icon: Activity },
      { key: 'overtime', label: 'Overtime', icon: Clock },
      { key: 'conduct', label: 'Conduct', icon: ShieldAlert },
    ],
  },
  {
    title: 'MATERIALS',
    items: [
      { key: 'materials', label: 'Materials', icon: Package },
      { key: 'material-requests', label: 'Material Requests', icon: FileText },
      { key: 'procurement', label: 'Procurement', icon: ShoppingCart },
      { key: 'deliveries', label: 'Deliveries', icon: Truck },
      { key: 'stock', label: 'Stock', icon: Boxes },
      { key: 'losses-returns', label: 'Losses & Returns', icon: RotateCcw },
      { key: 'reconciliation', label: 'Reconciliation', icon: Scale },
    ],
  },
  {
    title: 'FINANCIAL CONTROL',
    items: [
      { key: 'project-costs', label: 'Project Costs', icon: CircleDollarSign },
      { key: 'budget-vs-actual', label: 'Budget vs Actual', icon: BarChart2 },
      { key: 'procurement-costs', label: 'Procurement Costs', icon: Receipt },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { key: 'project-reports', label: 'Project Reports', icon: FileBarChart },
      { key: 'workforce-reports', label: 'Workforce Reports', icon: FileSpreadsheet },
      { key: 'material-reports', label: 'Material Reports', icon: ScrollText },
      { key: 'management-reports', label: 'Management Reports', icon: Briefcase },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { key: 'users', label: 'Users', icon: UserCog },
      { key: 'roles-permissions', label: 'Roles & Permissions', icon: ShieldCheck },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  currentModule: DashboardNavKey;
  onSelectModule: (module: DashboardNavKey) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  userName?: string;
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  onLogout,
  userName = 'Mayowa',
  userRole = 'Management / CEO',
}) => {
  return (
    <aside
      className={`bg-white border-r border-slate-200/90 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 select-none z-30 h-full ${
        collapsed ? 'w-[74px]' : 'w-[268px]'
      }`}
    >
      {/* Top Header: Brand Emblem & Collapse Toggle */}
      <div
        className={`h-16 border-b border-slate-100 flex items-center px-4 shrink-0 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        <div
          onClick={() => onSelectModule('overview')}
          className="flex items-center gap-2.5 cursor-pointer group"
          title="Davejoe Management Tool"
        >
          {/* Brand Emblem */}
          <div className="w-8 h-8 rounded-lg bg-[#01875F] flex items-center justify-center text-white font-extrabold text-sm shadow-xs transition-transform group-hover:scale-105 shrink-0">
            D
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 tracking-tight text-[16px] leading-tight truncate">
                Davejoe
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 truncate">
                Management Tool
              </span>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2]" />
          </button>
        )}
      </div>

      {/* Collapsed Expand Toggle */}
      {collapsed && (
        <div className="py-2 flex justify-center border-b border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4 stroke-[2]" />
          </button>
        </div>
      )}

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 custom-scrollbar">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <div className="px-3 py-1 text-[10.5px] font-bold tracking-wider text-slate-400 uppercase">
                {section.title}
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  currentModule === item.key ||
                  (item.key === 'materials' && currentModule === 'materials-directory');

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectModule(item.key)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group text-left ${
                      isActive
                        ? 'bg-[#01875F] text-white shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    } ${collapsed ? 'justify-center px-0 py-2.5' : ''}`}
                  >
                    <Icon
                      className={`w-[17px] h-[17px] shrink-0 ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-500 group-hover:text-slate-800'
                      }`}
                      strokeWidth={isActive ? 2.2 : 1.9}
                    />
                    {!collapsed && (
                      <span className="truncate text-[13px]">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section: Authenticated Identity, Profile & Logout */}
      <div className="p-3 border-t border-slate-100 shrink-0 space-y-1.5 bg-slate-50/60">
        {/* User Identity Display */}
        {!collapsed ? (
          <div className="px-2.5 py-2 rounded-lg bg-white border border-slate-200/80 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#01875F] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                M
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-bold text-slate-900 truncate leading-tight">
                  {userName}
                </span>
                <span className="text-[11px] font-semibold text-[#01875F] truncate leading-tight mt-0.5">
                  {userRole}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex justify-center mb-2"
            title={`${userName} • ${userRole}`}
          >
            <div className="w-8 h-8 rounded-full bg-[#01875F] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              M
            </div>
          </div>
        )}

        {/* PWA Install Button (automatically hidden if already running as installed app) */}
        <div className={`mb-1.5 ${collapsed ? 'flex justify-center' : ''}`}>
          <PWAInstallButton
            variant="minimal"
            size="sm"
            className={`w-full text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/70 ${
              collapsed ? 'justify-center px-0' : 'justify-start'
            }`}
          />
        </div>

        {/* Profile Button */}
        <button
          type="button"
          onClick={() => onSelectModule('profile')}
          title={collapsed ? 'Profile' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group text-left ${
            currentModule === 'profile'
              ? 'bg-slate-200 text-slate-900 font-semibold'
              : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
          } ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <User className="w-4 h-4 text-slate-500 group-hover:text-slate-800 shrink-0" strokeWidth={1.9} />
          {!collapsed && <span className="text-[13px]">Profile</span>}
        </button>

        {/* Logout Button */}
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer group text-left ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-700 shrink-0" strokeWidth={1.9} />
          {!collapsed && <span className="text-[13px]">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
