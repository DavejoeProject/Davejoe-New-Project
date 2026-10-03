import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FileText,
  ShoppingCart,
  Truck,
  Boxes,
  RotateCcw,
  Scale,
} from 'lucide-react';

export type MaterialsTabKey =
  | 'overview'
  | 'directory'
  | 'requests'
  | 'procurement'
  | 'deliveries'
  | 'stock'
  | 'losses-returns'
  | 'reconciliation';

interface MaterialsNavTabsProps {
  activeTab: MaterialsTabKey;
}

export const MaterialsNavTabs: React.FC<MaterialsNavTabsProps> = ({ activeTab }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs: Array<{
    key: MaterialsTabKey;
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }> = [
    {
      key: 'overview',
      label: 'Materials',
      path: '/management/materials',
      icon: LayoutDashboard,
    },
    {
      key: 'directory',
      label: 'Directory',
      path: '/management/materials/directory',
      icon: Package,
    },
    {
      key: 'requests',
      label: 'Requests',
      path: '/management/materials/requests',
      icon: FileText,
    },
    {
      key: 'procurement',
      label: 'Procurement',
      path: '/management/materials/procurement',
      icon: ShoppingCart,
    },
    {
      key: 'deliveries',
      label: 'Deliveries',
      path: '/management/materials/deliveries',
      icon: Truck,
    },
    {
      key: 'stock',
      label: 'Stock',
      path: '/management/materials/stock',
      icon: Boxes,
    },
    {
      key: 'losses-returns',
      label: 'Losses & Returns',
      path: '/management/materials/losses-returns',
      icon: RotateCcw,
    },
    {
      key: 'reconciliation',
      label: 'Reconciliation',
      path: '/management/materials/reconciliation',
      icon: Scale,
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

export default MaterialsNavTabs;
