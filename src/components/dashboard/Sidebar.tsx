import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Package,
  Users,
  ShieldCheck,
  BarChart3,
  Calendar,
  FileText,
  Truck,
  Settings,
  User,
  HelpCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type NavigationModule =
  | 'dashboard'
  | 'projects'
  | 'materials'
  | 'workforce'
  | 'inspections'
  | 'reports'
  | 'calendar'
  | 'documents'
  | 'suppliers'
  | 'settings'
  | 'profile'
  | 'support';

interface SidebarProps {
  currentModule: NavigationModule;
  onSelectModule: (module: NavigationModule) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  onLogout,
}) => {
  const primaryNavItems: Array<{
    id: NavigationModule;
    label: string;
    icon: React.ElementType;
    hasChevron?: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban, hasChevron: true },
    { id: 'materials', label: 'Materials & Procurement', icon: Package, hasChevron: true },
    { id: 'workforce', label: 'Workforce', icon: Users, hasChevron: true },
    { id: 'inspections', label: 'Inspections & Quality', icon: ShieldCheck, hasChevron: true },
    { id: 'reports', label: 'Reports', icon: BarChart3, hasChevron: true },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`bg-white border-r border-slate-200/80 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 select-none z-30 ${
        collapsed ? 'w-[74px]' : 'w-[260px]'
      }`}
    >
      {/* Top Section: Brand & Collapse Toggle */}
      <div>
        <div
          className={`h-16 border-b border-slate-100 flex items-center px-4 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {/* Logo & Brand Name */}
          <div
            onClick={() => onSelectModule('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer group"
            title="Davejoe Management Tool"
          >
            {/* Davejoe Emblem: Rounded green container with DJ geometry */}
            <div className="w-8 h-8 rounded-lg bg-[#01875F] flex items-center justify-center text-white font-bold text-sm shadow-xs transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-white"
              >
                <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" />
                <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
              </svg>
            </div>

            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 tracking-tight text-[17px] leading-tight">
                  Davejoe
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                  Management Tool
                </span>
              </div>
            )}
          </div>

          {/* Collapse/Expand Toggle Button */}
          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2]" />
            </button>
          )}
        </div>

        {/* Collapsed Expand Button */}
        {collapsed && (
          <div className="py-2 flex justify-center border-b border-slate-100">
            <button
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4 stroke-[2]" />
            </button>
          </div>
        )}

        {/* Primary Navigation List */}
        <nav className="p-3 space-y-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group ${
                  isActive
                    ? 'bg-[#01875F] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                } ${collapsed ? 'justify-center px-0' : 'justify-between'}`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-500 group-hover:text-slate-800'
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.9}
                  />
                  {!collapsed && (
                    <span className="truncate text-[13.5px]">{item.label}</span>
                  )}
                </div>

                {!collapsed && item.hasChevron && !isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Profile, Help, Logout */}
      <div className="p-3 border-t border-slate-100 space-y-1">
        {/* Profile */}
        <button
          onClick={() => onSelectModule('profile')}
          title={collapsed ? 'Profile' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer group ${
            currentModule === 'profile'
              ? 'bg-slate-100 text-slate-900 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          } ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <User className="w-[18px] h-[18px] text-slate-500 group-hover:text-slate-800 shrink-0" strokeWidth={1.9} />
          {!collapsed && <span className="text-[13.5px]">Profile</span>}
        </button>

        {/* Help & Support */}
        <button
          onClick={() => onSelectModule('support')}
          title={collapsed ? 'Help & Support' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer group ${
            currentModule === 'support'
              ? 'bg-slate-100 text-slate-900 font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          } ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <HelpCircle className="w-[18px] h-[18px] text-slate-500 group-hover:text-slate-800 shrink-0" strokeWidth={1.9} />
          {!collapsed && <span className="text-[13.5px]">Help & Support</span>}
        </button>

        {/* Logout (Red action) */}
        <button
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer group ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          <LogOut className="w-[18px] h-[18px] text-red-500 group-hover:text-red-700 shrink-0" strokeWidth={1.9} />
          {!collapsed && <span className="text-[13.5px] font-semibold">Logout</span>}
        </button>
      </div>
    </aside>
  );
};
