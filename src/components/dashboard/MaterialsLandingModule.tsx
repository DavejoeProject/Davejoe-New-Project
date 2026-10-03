import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  FileText,
  ShoppingCart,
  Truck,
  Boxes,
  RotateCcw,
  Scale,
  ArrowRight,
  TrendingDown,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  getMaterialSummary,
  MaterialSummary,
} from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { DashboardNavKey } from './Sidebar';

interface MaterialsLandingModuleProps {
  onBackToDashboard?: () => void;
  onSelectSection?: (sectionKey: DashboardNavKey) => void;
}

export const MaterialsLandingModule: React.FC<MaterialsLandingModuleProps> = ({
  onBackToDashboard,
  onSelectSection,
}) => {
  const navigate = useNavigate();

  const [summary, setSummary] = useState<MaterialSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSummary = useCallback(async (isManual: boolean = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    const res = await getMaterialSummary();

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setSummary(res.data);
    }

    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleNavigateSection = (route: string, sectionKey: DashboardNavKey) => {
    if (onSelectSection) {
      onSelectSection(sectionKey);
    }
    navigate(route);
  };

  // 7 Core functional domains of Materials Management
  const materialActionCards: Array<{
    key: DashboardNavKey;
    title: string;
    shortLabel: string;
    purpose: string;
    route: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    badge: string;
    statLabel: string;
    statValue: number;
  }> = [
    {
      key: 'materials-directory',
      title: 'Materials Directory',
      shortLabel: 'Materials',
      purpose: "View and manage the organization's master material catalog, standard unit rates, and inventory thresholds.",
      route: '/management/materials/directory',
      icon: Package,
      badge: 'Master Catalog',
      statLabel: 'Registered Materials',
      statValue: summary ? summary.totalMaterials : 0,
    },
    {
      key: 'material-requests',
      title: 'Material Requests',
      shortLabel: 'Requests',
      purpose: 'Review and manage site material requisitions, site supervisor requests, and approval queues.',
      route: '/management/materials/requests',
      icon: FileText,
      badge: 'Site Requisitions',
      statLabel: 'Pending Requests',
      statValue: summary ? summary.pendingRequests : 0,
    },
    {
      key: 'procurement',
      title: 'Procurement',
      shortLabel: 'Procurement',
      purpose: 'Manage vendor purchasing, purchase orders, commercial commitments, and supplier relations.',
      route: '/management/materials/procurement',
      icon: ShoppingCart,
      badge: 'Purchase Orders',
      statLabel: 'Active Orders',
      statValue: summary ? summary.pendingProcurements : 0,
    },
    {
      key: 'deliveries',
      title: 'Deliveries',
      shortLabel: 'Deliveries',
      purpose: 'Track incoming site material shipments, delivery waybills, and on-site physical receipts.',
      route: '/management/materials/deliveries',
      icon: Truck,
      badge: 'Site Logistics',
      statLabel: 'Waybill Logs',
      statValue: 0,
    },
    {
      key: 'stock',
      title: 'Stock',
      shortLabel: 'Stock & Movements',
      purpose: 'Monitor physical stock balances, warehouse storage locations, and site issue movements.',
      route: '/management/materials/stock',
      icon: Boxes,
      badge: 'Inventory Ledger',
      statLabel: 'Low Stock Alerts',
      statValue: summary ? summary.lowStockItems : 0,
    },
    {
      key: 'losses-returns',
      title: 'Losses & Returns',
      shortLabel: 'Losses & Returns',
      purpose: 'Track construction site wastage, damaged goods, transit losses, and returns to suppliers.',
      route: '/management/materials/losses-returns',
      icon: RotateCcw,
      badge: 'Discrepancy Control',
      statLabel: 'Incident Logs',
      statValue: 0,
    },
    {
      key: 'reconciliation',
      title: 'Reconciliation',
      shortLabel: 'Reconciliation',
      purpose: 'Perform audits comparing theoretical usage, purchase orders, physical stock, and billing variances.',
      route: '/management/materials/reconciliation',
      icon: Scale,
      badge: 'Audit & Control',
      statLabel: 'Audits',
      statValue: 0,
    },
  ];

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* 1. Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                MANAGEMENT / MATERIALS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Package className="w-7 h-7 text-[#01875F]" />
              <span>Materials</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Manage materials, inventory movement, procurement and material control across the organization.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchSummary(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh materials summary from database"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="overview" />

      {/* 3. Core Materials Overview Metrics (KPI Cards) */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs" />
          ))}
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-8 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load this section.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchSummary()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Materials */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
              TOTAL MATERIALS
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
              {summary ? summary.totalMaterials : 0}
            </span>
            <span className="text-[11px] text-slate-500">Catalogued items</span>
          </div>

          {/* Low Stock Items */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
              LOW STOCK
            </span>
            <span
              className={`text-2xl font-bold mt-1 block font-mono ${
                (summary?.lowStockItems ?? 0) > 0 ? 'text-amber-600' : 'text-slate-900'
              }`}
            >
              {summary ? summary.lowStockItems : 0}
            </span>
            <span className="text-[11px] text-slate-500">At or below reorder level</span>
          </div>

          {/* Pending Material Requests */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
              PENDING REQUESTS
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
              {summary ? summary.pendingRequests : 0}
            </span>
            <span className="text-[11px] text-slate-500">Site requisitions</span>
          </div>

          {/* Pending Procurements */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
            <span className="text-[10.5px] text-slate-400 font-bold uppercase tracking-wider block">
              PENDING PROCUREMENT
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
              {summary ? summary.pendingProcurements : 0}
            </span>
            <span className="text-[11px] text-slate-500">Open purchase orders</span>
          </div>
        </div>
      )}

      {/* Database Empty State Informational Banner */}
      {!isLoading && !errorMessage && summary?.isEmpty && (
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Package className="w-4 h-4 text-[#01875F] shrink-0" />
            <span>
              <strong className="font-semibold text-slate-800">Database Ready:</strong> Zero records currently logged across materials, requests, and purchase orders.
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono self-start sm:self-auto">
            Zero-Demo-Data Policy Active
          </span>
        </div>
      )}

      {/* 4. Action Cards Grid Layout (Materials, Requests, Procurement, etc.) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Material Management Modules
          </h2>
          <span className="text-xs text-slate-400">7 Core Domains</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materialActionCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.key}
                onClick={() => handleNavigateSection(card.route, card.key)}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-[#01875F]/40 hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E6F4EA] text-[#01875F] flex items-center justify-center shrink-0 border border-[#01875F]/20 group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" strokeWidth={1.9} />
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/80">
                      {card.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-[#01875F] transition-colors flex items-center gap-1.5">
                    <span>{card.title}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-3">
                    {card.purpose}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-slate-400">{card.statLabel}:</span>
                    <span className="font-bold text-slate-800">{card.statValue}</span>
                  </div>

                  <div className="inline-flex items-center gap-1 text-[#01875F] font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MaterialsLandingModule;
