import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  CalendarCheck,
  Activity,
  Clock,
  ShieldAlert,
} from 'lucide-react';

export type WorkforceTabKey =
  | 'directory'
  | 'performance'
  | 'attendance'
  | 'productivity'
  | 'overtime'
  | 'conduct';

interface WorkforceNavTabsProps {
  activeTab: WorkforceTabKey;
}

export const WorkforceNavTabs: React.FC<WorkforceNavTabsProps> = ({ activeTab }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isManagement = location.pathname.startsWith('/management');
  const isExecutive = location.pathname.startsWith('/executive');
  const isAdmin = location.pathname.startsWith('/admin');

  const baseDirectoryPath = isManagement
    ? '/management/workforce'
    : isExecutive
    ? '/executive/workforce'
    : '/admin/workforce';

  const baseAttendancePath = isManagement
    ? '/management/workforce/attendance'
    : isExecutive
    ? '/executive/attendance'
    : '/admin/attendance';

  const tabs: Array<{
    key: WorkforceTabKey;
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }> = [
    {
      key: 'directory',
      label: 'Staff Directory',
      path: baseDirectoryPath,
      icon: Users,
    },
    {
      key: 'performance',
      label: 'Performance Overview',
      path: isManagement ? '/management/workforce/performance' : baseDirectoryPath,
      icon: TrendingUp,
    },
    {
      key: 'attendance',
      label: 'Attendance',
      path: baseAttendancePath,
      icon: CalendarCheck,
    },
    {
      key: 'productivity',
      label: 'Productivity',
      path: isManagement ? '/management/workforce/productivity' : baseDirectoryPath,
      icon: Activity,
    },
    {
      key: 'overtime',
      label: 'Overtime',
      path: isManagement ? '/management/workforce/overtime' : baseDirectoryPath,
      icon: Clock,
    },
    {
      key: 'conduct',
      label: 'Conduct & Safety',
      path: isManagement ? '/management/workforce/conduct' : baseDirectoryPath,
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-1.5 flex items-center gap-1 overflow-x-auto custom-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              if (location.pathname !== tab.path) {
                navigate(tab.path);
              }
            }}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              isActive
                ? 'bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <Icon
              className={`w-3.5 h-3.5 shrink-0 ${
                isActive ? 'text-[#01875F]' : 'text-slate-400 group-hover:text-slate-600'
              }`}
              strokeWidth={isActive ? 2.2 : 1.8}
            />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default WorkforceNavTabs;
