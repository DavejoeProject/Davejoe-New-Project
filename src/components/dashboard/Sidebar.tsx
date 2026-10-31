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
  ChevronDown,
  X,
  Wrench,
  ClipboardList,
  Calculator,
} from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { BRAND_ASSETS } from '../../config/branding';

export type DashboardNavKey =
  // COMMAND CENTRE
  | 'overview'
  | 'approvals'
  | 'alerts'
  // PROJECT PLANNING & PROJECTIONS
  | 'planning'
  // PROJECTS
  | 'all-projects'
  | 'project-performance'
  | 'milestones'
  | 'inspections'
  | 'tasks'
  // WORKFORCE
  | 'workforce'
  | 'workforce-performance'
  | 'attendance'
  | 'productivity'
  | 'overtime'
  | 'conduct'
  // MATERIALS & TOOLS
  | 'materials'
  | 'materials-directory'
  | 'material-requests'
  | 'procurement'
  | 'deliveries'
  | 'stock'
  | 'losses-returns'
  | 'reconciliation'
  | 'remnants'
  | 'tools'
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
    title: 'PROJECT PLANNING',
    items: [
      { key: 'planning', label: 'Planning & Projections', icon: Calculator },
    ],
  },
  {
    title: 'PROJECTS',
    items: [
      { key: 'all-projects', label: 'All Projects', icon: FolderKanban },
      { key: 'project-performance', label: 'Project Performance', icon: TrendingUp },
      { key: 'milestones', label: 'Milestones', icon: Flag },
      { key: 'inspections', label: 'Inspections', icon: ClipboardCheck },
      { key: 'tasks', label: 'Task Specifications', icon: ClipboardList },
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
    title: 'MATERIALS & ASSETS',
    items: [
      { key: 'materials', label: 'Materials Overview', icon: Package },
      { key: 'material-requests', label: 'Material Requests', icon: FileText },
      { key: 'procurement', label: 'Procurement', icon: ShoppingCart },
      { key: 'deliveries', label: 'Deliveries', icon: Truck },
      { key: 'stock', label: 'Stock', icon: Boxes },
      { key: 'losses-returns', label: 'Losses & Returns', icon: RotateCcw },
      { key: 'reconciliation', label: 'Reconciliation', icon: Scale },
      { key: 'remnants', label: 'Site Remnants', icon: RotateCcw },
      { key: 'tools', label: 'Tools & Equipment', icon: Wrench },
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
    title: 'GOVERNANCE & ROLES',
    items: [
      { key: 'users', label: 'Users & Personnel', icon: UserCog },
      { key: 'roles-permissions', label: 'Roles & Permissions', icon: ShieldCheck },
      { key: 'settings', label: 'System Settings', icon: Settings },
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
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  onLogout,
  userName = 'Mayowa',
  userRole = 'Management / CEO',
  onCloseMobile,
}) => {
  // Collapsible section state
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('davejoe_sidebar_sections_state');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignored
    }
    return {};
  });

  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => {
      const updated = { ...prev, [title]: !prev[title] };
      try {
        localStorage.setItem('davejoe_sidebar_sections_state', JSON.stringify(updated));
      } catch {
        // Ignored
      }
      return updated;
    });
  };

  // Ensure active module's section is never collapsed
  React.useEffect(() => {
    const parentSection = SIDEBAR_SECTIONS.find((s) =>
      s.items.some(
        (i) =>
          i.key === currentModule ||
          (i.key === 'materials' && currentModule === 'materials-directory')
      )
    );
    if (parentSection && collapsedSections[parentSection.title]) {
      setCollapsedSections((prev) => ({ ...prev, [parentSection.title]: false }));
    }
  }, [currentModule]);

  const handleItemClick = (key: DashboardNavKey) => {
    onSelectModule(key);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

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
          onClick={() => handleItemClick('overview')}
          className="flex items-center cursor-pointer group min-w-0"
          title="Davejoe Interiors — Digital Operating System"
        >
          {collapsed ? (
            <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 shrink-0 bg-white border border-slate-100 p-1">
              <img
                src={BRAND_ASSETS.emblem192}
                alt="Davejoe Emblem"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="flex items-center py-1">
              <img
                src={BRAND_ASSETS.logoTransparent}
                alt="Davejoe Interiors"
                className="h-8 max-w-[170px] w-auto object-contain transition-transform group-hover:scale-[1.02]"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden w-10 h-10 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5 stroke-[2.2]" />
            </button>
          )}

          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 items-center justify-center transition-colors cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2]" />
            </button>
          )}
        </div>
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
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
        {SIDEBAR_SECTIONS.map((section) => {
          const isSectionCollapsed = Boolean(collapsedSections[section.title]);
          const containsActive = section.items.some(
            (i) =>
              currentModule === i.key ||
              (i.key === 'materials' && currentModule === 'materials-directory')
          );

          return (
            <div key={section.title} className="space-y-1">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[10.5px] font-bold tracking-wider uppercase text-slate-400 hover:text-slate-700 hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  title={`${isSectionCollapsed ? 'Expand' : 'Collapse'} ${section.title}`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{section.title}</span>
                    <span className="text-[9.5px] font-medium text-slate-400/80">
                      ({section.items.length})
                    </span>
                  </div>
                  <div className="flex items-center text-slate-400 group-hover:text-slate-600 transition-transform">
                    {isSectionCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </button>
              ) : (
                <div className="my-2 border-t border-slate-100" />
              )}

              {/* Items - visible if section is expanded OR sidebar is in icon-only collapsed mode */}
              {(!isSectionCollapsed || collapsed) && (
                <div className="space-y-0.5 animate-in fade-in duration-150">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      currentModule === item.key ||
                      (item.key === 'materials' && currentModule === 'materials-directory');

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleItemClick(item.key)}
                        title={collapsed ? item.label : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group text-left min-h-[42px] sm:min-h-[38px] ${
                          isActive
                            ? 'bg-[#01875F] text-white shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        } ${collapsed ? 'justify-center px-0 py-2.5' : ''}`}
                      >
                        <Icon
                          className={`w-[18px] h-[18px] sm:w-[17px] sm:h-[17px] shrink-0 ${
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
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Section: Authenticated Identity, Profile & Logout with safe-area */}
      <div className="p-3 pb-safe border-t border-slate-100 shrink-0 space-y-1.5 bg-slate-50/60">
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
            className={`w-full text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/70 min-h-[40px] sm:min-h-[36px] ${
              collapsed ? 'justify-center px-0' : 'justify-start'
            }`}
          />
        </div>

        {/* Profile Button */}
        <button
          type="button"
          onClick={() => onSelectModule('profile')}
          title={collapsed ? 'Profile' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer group text-left min-h-[42px] sm:min-h-[38px] ${
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
          className={`w-full flex items-center gap-3 px-3 py-2.5 sm:py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer group text-left min-h-[42px] sm:min-h-[38px] ${
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
