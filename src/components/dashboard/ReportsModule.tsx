import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  FileBarChart,
  Briefcase,
  Users,
  Package,
  CircleDollarSign,
  Printer,
  Download,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Truck,
  RotateCcw,
  Scale,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  ManagementReportsService,
  ReportDateRange,
  ExecutiveReportData,
  ProjectReportRow,
  WorkforceReportData,
  MaterialReportData,
  FinancialReportData,
} from '../../services/managementReportsService';
import { formatNaira, formatNigerianDate } from '../../services/materialsService';
import { PROJECT_STATUS_CONFIG, ProjectStatus } from '../../services/projectService';

export type ReportCategoryTab =
  | 'management'
  | 'projects'
  | 'workforce'
  | 'materials'
  | 'financial';

interface ReportsModuleProps {
  initialCategory?: ReportCategoryTab;
  onBackToDashboard?: () => void;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  initialCategory = 'management',
}) => {
  const navigate = useNavigate();

  // Active Report Tab
  const [activeTab, setActiveTab] = useState<ReportCategoryTab>(initialCategory);

  // Date Range Filter
  const [dateRange, setDateRange] = useState<ReportDateRange>('all');

  // Report Data States
  const [executiveData, setExecutiveData] = useState<ExecutiveReportData | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectReportRow[]>([]);
  const [workforceData, setWorkforceData] = useState<WorkforceReportData | null>(null);
  const [materialData, setMaterialData] = useState<MaterialReportData | null>(null);
  const [financialData, setFinancialData] = useState<FinancialReportData | null>(null);

  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialCategory);
  }, [initialCategory]);

  const fetchReport = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      try {
        if (activeTab === 'management') {
          const res = await ManagementReportsService.getExecutiveReportData(dateRange);
          if (res.error) setErrorMessage(res.error);
          else setExecutiveData(res.data);
        } else if (activeTab === 'projects') {
          const res = await ManagementReportsService.getProjectReportData();
          if (res.error) setErrorMessage(res.error);
          else setProjectsData(res.data);
        } else if (activeTab === 'workforce') {
          const res = await ManagementReportsService.getWorkforceReportData();
          if (res.error) setErrorMessage(res.error);
          else setWorkforceData(res.data);
        } else if (activeTab === 'materials') {
          const res = await ManagementReportsService.getMaterialReportData();
          if (res.error) setErrorMessage(res.error);
          else setMaterialData(res.data);
        } else if (activeTab === 'financial') {
          const res = await ManagementReportsService.getFinancialReportData();
          if (res.error) setErrorMessage(res.error);
          else setFinancialData(res.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to generate management report.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [activeTab, dateRange]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (activeTab === 'projects') {
      const headers = [
        'Project Code',
        'Project Name',
        'Status',
        'Start Date',
        'Contract Value (NGN)',
        'Assigned Workers',
        'Purchase Orders Count',
        'Procurement Committed (NGN)',
        'Material Usage Recorded (NGN)',
        'Deliveries Count',
      ];
      const rows = projectsData.map((p) => [
        p.code,
        p.name,
        p.status,
        p.startDate || 'Not recorded',
        p.contractValue != null ? p.contractValue : '',
        p.assignedWorkersCount,
        p.purchaseOrdersCount,
        p.purchaseOrdersTotal,
        p.materialUsageValue,
        p.deliveriesCount,
      ]);
      ManagementReportsService.exportToCsv('Davejoe_Projects_Report', headers, rows);
    } else if (activeTab === 'financial' && financialData) {
      const headers = [
        'Project Code',
        'Project Name',
        'Contract Value (NGN)',
        'Procurement Committed (NGN)',
        'Requirements Estimate (NGN)',
        'Usage Expenditure (NGN)',
      ];
      const rows = financialData.projectsBreakdown.map((p) => [
        p.code,
        p.name,
        p.contractValue != null ? p.contractValue : '',
        p.procurementCommitted,
        p.requirementsEstimate,
        p.usageExpenditure,
      ]);
      ManagementReportsService.exportToCsv('Davejoe_Financial_Report', headers, rows);
    } else if (activeTab === 'management' && executiveData) {
      const headers = ['Portfolio Metric', 'Value'];
      const rows = [
        ['Total Projects', executiveData.portfolio.totalProjects],
        ['Active Projects', executiveData.portfolio.activeProjects],
        ['Total Contract Value', formatNaira(executiveData.portfolio.totalContractValue)],
        ['Procurement Committed', formatNaira(executiveData.financials.procurementCommitted)],
        ['Material Requirements Target', formatNaira(executiveData.financials.requirementsEstimate)],
        ['Material Usage Recorded', formatNaira(executiveData.financials.materialUsageRecorded)],
        ['Total Workforce Roster', executiveData.workforce.totalWorkforce],
        ['Active Workforce', executiveData.workforce.activeWorkforce],
        ['Master Materials Count', executiveData.materials.totalMaterials],
        ['Low Stock Alerts', executiveData.materials.lowStockCount],
        ['Out of Stock Alerts', executiveData.materials.outOfStockCount],
      ];
      ManagementReportsService.exportToCsv('Davejoe_Executive_Report', headers, rows);
    } else if (activeTab === 'workforce' && workforceData) {
      const headers = ['Workforce Metric', 'Count'];
      const rows = [
        ['Total Roster', workforceData.totalRoster],
        ['Active Workers', workforceData.activeCount],
        ['Inactive Workers', workforceData.inactiveCount],
        ['Suspended Workers', workforceData.suspendedCount],
        ['Terminated Workers', workforceData.terminatedCount],
        ['Assigned Workers', workforceData.assignedCount],
        ['Productivity Logs', workforceData.productivityRecordsCount],
        ['Total Overtime Hours', workforceData.overtimeHoursCount],
        ['Conduct Notices', workforceData.conductNoticesCount],
      ];
      ManagementReportsService.exportToCsv('Davejoe_Workforce_Report', headers, rows);
    } else if (activeTab === 'materials' && materialData) {
      const headers = ['Materials Metric', 'Value'];
      const rows = [
        ['Total Materials', materialData.totalMaterials],
        ['Active Catalog Materials', materialData.activeCount],
        ['Low Stock Items', materialData.lowStockCount],
        ['Out of Stock Items', materialData.outOfStockCount],
        ['Requisitions Logged', materialData.requisitionsSummary.total],
        ['Purchase Orders Logged', materialData.procurementSummary.totalOrders],
        ['Procurement Committed (NGN)', formatNaira(materialData.procurementSummary.totalValue)],
        ['Deliveries Dispatched', materialData.deliveriesSummary.totalDeliveries],
        ['Total Audit Runs', materialData.reconciliationsSummary.totalAudits],
        ['Net Audit Variance', materialData.reconciliationsSummary.netVarianceQuantity],
      ];
      ManagementReportsService.exportToCsv('Davejoe_Materials_Report', headers, rows);
    }
  };

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header (Screen View) */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                MANAGEMENT REPORTS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <FileBarChart className="w-7 h-7 text-[#01875F]" />
              <span>Operational &amp; Executive Reporting</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Generate auditable executive reports derived exclusively from verified organizational records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center shrink-0">
            {/* Date range selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as ReportDateRange)}
                className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Year</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="Export report dataset to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              title="Print report"
            >
              <Printer className="w-3.5 h-3.5 text-[#01875F]" />
              <span>Print View</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReport(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh Report Data"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Formal Print-Only Document Header */}
      <div className="hidden print:block p-4 border-b-2 border-slate-900 mb-6 text-slate-900">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider">
              Davejoe Management Tool
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Enterprise Project, Workforce &amp; Operational Management System
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold uppercase tracking-wider block">Executive Report</span>
            <span className="font-mono text-[11px] text-slate-600">
              Period: {dateRange.toUpperCase().replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between text-[11px] font-mono text-slate-500">
          <span>Generated by: Mayowa (Management / CEO)</span>
          <span>Date: {formatNigerianDate(new Date().toISOString())}</span>
        </div>
      </div>

      {/* 3. Sub-Tabs Navigation (Screen View) */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-1.5 flex items-center gap-1 overflow-x-auto custom-scrollbar print:hidden">
        {[
          { key: 'management', label: 'Management Executive Summary', icon: Briefcase },
          { key: 'projects', label: 'Project Portfolio Report', icon: Building },
          { key: 'workforce', label: 'Workforce Operational Report', icon: Users },
          { key: 'materials', label: 'Materials Operations Report', icon: Package },
          { key: 'financial', label: 'Financial & Commitments Report', icon: CircleDollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as ReportCategoryTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#01875F] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Report Content / Loading / Error */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 animate-pulse space-y-4">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-slate-50 rounded-xl" />
            ))}
          </div>
          <div className="h-40 bg-slate-50 rounded-xl" />
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to generate report</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchReport()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: EXECUTIVE MANAGEMENT REPORT                                       */}
          {/* ========================================================================= */}
          {activeTab === 'management' && executiveData && (
            <div className="space-y-6">
              {/* Actionable Alerts Panel */}
              {executiveData.alerts.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                      Operational Action Required ({executiveData.alerts.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {executiveData.alerts.map((al, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-slate-900 block">{al.title}</span>
                          <span className="text-slate-500 text-[11px]">{al.description}</span>
                        </div>
                        <Link
                          to={al.route}
                          className="shrink-0 ml-3 p-1.5 text-[#01875F] hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold"
                          title="Open operational view"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Portfolio & Financials Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    TOTAL CONTRACT PORTFOLIO
                  </span>
                  <span className="text-xl font-bold text-[#01875F] mt-1 block font-mono">
                    {formatNaira(executiveData.portfolio.totalContractValue)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {executiveData.portfolio.totalProjects} total registered projects
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    ACTIVE SITES
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                    {executiveData.portfolio.activeProjects}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {executiveData.portfolio.completedProjects} completed • {executiveData.portfolio.onHoldProjects} on hold
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    PROCUREMENT COMMITTED
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                    {formatNaira(executiveData.financials.procurementCommitted)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {executiveData.materials.purchaseOrdersCount} purchase orders
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    WORKFORCE ROSTER
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                    {executiveData.workforce.activeWorkforce} Active
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {executiveData.workforce.assignedWorkforce} site assignments
                  </span>
                </div>
              </div>

              {/* Materials & Operational Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Materials &amp; Inventory Balance
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Registered Master Catalog:</span>
                      <span className="font-bold text-slate-900">{executiveData.materials.totalMaterials} materials</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Low Stock / Reorder Threshold:</span>
                      <span className="font-bold text-amber-600">{executiveData.materials.lowStockCount} items</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Out of Stock Items:</span>
                      <span className="font-bold text-rose-600">{executiveData.materials.outOfStockCount} items</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Site Requisitions Logged:</span>
                      <span className="font-bold text-slate-900">{executiveData.materials.requisitionsCount}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Audit Discrepancies Recorded:</span>
                      <span className="font-bold text-slate-900">{executiveData.materials.variancesCount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Workforce Compliance &amp; Operations
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Total Workforce Registered:</span>
                      <span className="font-bold text-slate-900">{executiveData.workforce.totalWorkforce} workers</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Active Status Roster:</span>
                      <span className="font-bold text-emerald-700">{executiveData.workforce.activeWorkforce} workers</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Attendance Logged Records:</span>
                      <span className="font-bold text-slate-900">{executiveData.workforce.attendanceLogsCount} logs</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Approved Overtime Hours:</span>
                      <span className="font-bold text-slate-900">{executiveData.workforce.overtimeHoursTotal} hrs</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Conduct &amp; Disciplinary Notices:</span>
                      <span className="font-bold text-slate-900">{executiveData.workforce.conductNoticesCount} notices</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PROJECTS REPORT                                                    */}
          {/* ========================================================================= */}
          {activeTab === 'projects' && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Project Portfolio Register
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comprehensive cross-module progress, commitment, and workforce deployment per site.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-800">
                  {projectsData.length} Projects
                </span>
              </div>

              {projectsData.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No project records found in database.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3.5 px-4">Project</th>
                        <th className="py-3.5 px-3">Status</th>
                        <th className="py-3.5 px-3 text-right">Contract Value</th>
                        <th className="py-3.5 px-3 text-right">Procurement Committed</th>
                        <th className="py-3.5 px-3 text-right">Material Usage</th>
                        <th className="py-3.5 px-3 text-center">Workforce</th>
                        <th className="py-3.5 px-3 text-center">Deliveries</th>
                        <th className="py-3.5 px-4 text-right print:hidden">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectsData.map((p) => {
                        const statusCfg =
                          PROJECT_STATUS_CONFIG[p.status as ProjectStatus] || {
                            label: p.status,
                            badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                          };

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 block">{p.name}</span>
                              <span className="font-mono text-[10.5px] text-slate-400">{p.code}</span>
                            </td>

                            <td className="py-3.5 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${statusCfg.badgeClass}`}
                              >
                                {statusCfg.label}
                              </span>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono font-bold text-[#01875F]">
                              {p.contractValue != null ? formatNaira(p.contractValue) : '—'}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatNaira(p.purchaseOrdersTotal)}
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                              {formatNaira(p.materialUsageValue)}
                            </td>

                            <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                              {p.assignedWorkersCount}
                            </td>

                            <td className="py-3.5 px-3 text-center font-mono text-slate-700">
                              {p.deliveriesCount}
                            </td>

                            <td className="py-3.5 px-4 text-right print:hidden">
                              <Link
                                to={`/management/projects/${p.id}`}
                                className="text-[#01875F] hover:underline inline-flex items-center gap-1 font-semibold"
                              >
                                <span>Inspect</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: WORKFORCE REPORT                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'workforce' && workforceData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    TOTAL ROSTER
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                    {workforceData.totalRoster}
                  </span>
                  <span className="text-[11px] text-slate-500">Registered personnel</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    ACTIVE STATUS
                  </span>
                  <span className="text-2xl font-bold text-emerald-600 mt-1 block font-mono">
                    {workforceData.activeCount}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {workforceData.assignedCount} currently assigned to sites
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    OVERTIME APPROVED
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                    {workforceData.overtimeHoursCount} hrs
                  </span>
                  <span className="text-[11px] text-slate-500">Approved overtime logged</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    CONDUCT NOTICES
                  </span>
                  <span className="text-2xl font-bold text-amber-600 mt-1 block font-mono">
                    {workforceData.conductNoticesCount}
                  </span>
                  <span className="text-[11px] text-slate-500">Disciplinary warnings logged</span>
                </div>
              </div>

              {/* Attendance Breakdown */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                  Muster Roll &amp; Attendance Logs
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Present</span>
                    <span className="text-xl font-bold font-mono text-emerald-900 mt-1 block">
                      {workforceData.attendanceSummary.presentCount}
                    </span>
                  </div>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <span className="text-[10px] uppercase font-bold text-rose-700 block">Absent</span>
                    <span className="text-xl font-bold font-mono text-rose-900 mt-1 block">
                      {workforceData.attendanceSummary.absentCount}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">Late</span>
                    <span className="text-xl font-bold font-mono text-amber-900 mt-1 block">
                      {workforceData.attendanceSummary.lateCount}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block">On Leave</span>
                    <span className="text-xl font-bold font-mono text-blue-900 mt-1 block">
                      {workforceData.attendanceSummary.leaveCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: MATERIALS REPORT                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'materials' && materialData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    TOTAL CATALOG ITEMS
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                    {materialData.totalMaterials}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {materialData.activeCount} active master items
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    LOW STOCK ALERTS
                  </span>
                  <span className="text-2xl font-bold text-amber-600 mt-1 block font-mono">
                    {materialData.lowStockCount}
                  </span>
                  <span className="text-[11px] text-slate-500">Below reorder threshold</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    OUT OF STOCK
                  </span>
                  <span className="text-2xl font-bold text-rose-600 mt-1 block font-mono">
                    {materialData.outOfStockCount}
                  </span>
                  <span className="text-[11px] text-slate-500">Zero physical inventory</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    RECONCILIATION VARIANCES
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
                    {materialData.reconciliationsSummary.varianceAudits}
                  </span>
                  <span className="text-[11px] text-slate-500">Audits with discrepancy</span>
                </div>
              </div>

              {/* Requisition & Procurement Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Requisition Pipeline
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Total Material Requests:</span>
                      <span className="font-bold text-slate-900">{materialData.requisitionsSummary.total}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Awaiting Manager Review:</span>
                      <span className="font-bold text-amber-600">{materialData.requisitionsSummary.pending}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Approved Requisitions:</span>
                      <span className="font-bold text-emerald-700">{materialData.requisitionsSummary.approved}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Fulfilled by Warehouse:</span>
                      <span className="font-bold text-slate-900">{materialData.requisitionsSummary.fulfilled}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 text-xs">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Procurement Commitments
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Total Purchase Orders:</span>
                      <span className="font-bold text-slate-900">{materialData.procurementSummary.totalOrders}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Total Commercial Commitment:</span>
                      <span className="font-bold font-mono text-[#01875F]">
                        {formatNaira(materialData.procurementSummary.totalValue)}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-500">Pending Approval:</span>
                      <span className="font-bold text-amber-600">{materialData.procurementSummary.pendingApproval}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: FINANCIAL REPORT                                                   */}
          {/* ========================================================================= */}
          {activeTab === 'financial' && financialData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    PORTFOLIO CONTRACT SUM
                  </span>
                  <span className="text-xl font-bold text-[#01875F] mt-1 block font-mono">
                    {formatNaira(financialData.totalContractValue)}
                  </span>
                  <span className="text-[11px] text-slate-500">Agreed client contracts</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    PROCUREMENT COMMITTED
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                    {formatNaira(financialData.totalProcurementCommitted)}
                  </span>
                  <span className="text-[11px] text-slate-500">Authorized purchase orders</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    BOQ REQUIREMENTS TARGET
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                    {formatNaira(financialData.totalRequirementsEstimate)}
                  </span>
                  <span className="text-[11px] text-slate-500">Project requirements baseline</span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    MATERIAL USAGE RECORDED
                  </span>
                  <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
                    {formatNaira(financialData.totalUsageExpenditure)}
                  </span>
                  <span className="text-[11px] text-slate-500">Consumption logged on site</span>
                </div>
              </div>

              {/* Projects Breakdown Table */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Project Financial Summary
                  </h3>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {financialData.projectsBreakdown.length} Projects
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                        <th className="py-3.5 px-4">Project</th>
                        <th className="py-3.5 px-3 text-right">Contract Value</th>
                        <th className="py-3.5 px-3 text-right">Procurement Committed</th>
                        <th className="py-3.5 px-3 text-right">Requirements BOQ</th>
                        <th className="py-3.5 px-3 text-right">Usage Recorded</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {financialData.projectsBreakdown.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{p.name}</span>
                            <span className="font-mono text-[10.5px] text-slate-400">{p.code}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-bold text-[#01875F]">
                            {p.contractValue != null ? formatNaira(p.contractValue) : 'Not recorded'}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatNaira(p.procurementCommitted)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                            {formatNaira(p.requirementsEstimate)}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                            {formatNaira(p.usageExpenditure)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsModule;
