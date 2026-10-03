import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  RotateCcw,
  AlertTriangle,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  Building,
  CheckCircle2,
  Boxes,
} from 'lucide-react';
import {
  MaterialLossesReturnsService,
  MaterialLossRecord,
  MaterialReturnRecord,
  LossesReturnsSummary,
} from '../../services/materialLossesReturnsService';
import {
  MaterialRequestsService,
  ProjectDropdownOption,
} from '../../services/materialRequestsService';
import { formatNigerianDate } from '../../services/materialsService';
import { MaterialsNavTabs } from './MaterialsNavTabs';
import { RecordLossModal } from './RecordLossModal';
import { RecordReturnModal } from './RecordReturnModal';

interface LossesReturnsModuleProps {
  onBackToDashboard?: () => void;
}

export const LossesReturnsModule: React.FC<LossesReturnsModuleProps> = () => {
  const navigate = useNavigate();

  // Active section tab: 'losses' vs 'returns'
  const [activeSection, setActiveSection] = useState<'losses' | 'returns'>('losses');

  // Data states
  const [losses, setLosses] = useState<MaterialLossRecord[]>([]);
  const [returns, setReturns] = useState<MaterialReturnRecord[]>([]);
  const [summary, setSummary] = useState<LossesReturnsSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDropdownOption[]>([]);

  // Flags
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Modals
  const [isLossModalOpen, setIsLossModalOpen] = useState<boolean>(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    MaterialRequestsService.getProjectsForDropdown().then((res) => {
      setProjects(res.data);
    });
  }, []);

  const fetchData = useCallback(
    async (isManual: boolean = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);
      setErrorMessage(null);

      try {
        const [sumRes, lossRes, retRes] = await Promise.all([
          MaterialLossesReturnsService.getLossesReturnsSummary(),
          MaterialLossesReturnsService.getMaterialLosses({
            search: debouncedSearch,
            projectId: projectFilter,
          }),
          MaterialLossesReturnsService.getMaterialReturns({
            search: debouncedSearch,
            projectId: projectFilter,
          }),
        ]);

        if (sumRes.error) {
          console.error('[LossesReturns] Summary error:', sumRes.error);
        } else {
          setSummary(sumRes.data);
        }

        if (lossRes.error) {
          setErrorMessage(lossRes.error);
        } else {
          setLosses(lossRes.data);
        }

        if (retRes.data) {
          setReturns(retRes.data);
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load losses and returns.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, projectFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApproveLoss = async (lossId: string) => {
    const res = await MaterialLossesReturnsService.approveMaterialLoss(lossId);
    if (!res.error) {
      fetchData(true);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setProjectFilter('all');
  };

  const hasActiveFilters = debouncedSearch.trim() !== '' || projectFilter !== 'all';

  return (
    <div className="space-y-6 pb-16 select-auto">
      {/* 1. Header */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                MATERIALS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <RotateCcw className="w-7 h-7 text-[#01875F]" />
              <span>Losses & Returns</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Track material waste, site damages, write-offs and store returns.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReturnModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-teal-700" />
              <span>Record Return</span>
            </button>

            <button
              type="button"
              onClick={() => setIsLossModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Record Loss</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab="losses-returns" />

      {/* 3. Executive Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL LOSS RECORDS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalLossRecords ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Incident write-offs</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL LOST UNITS
          </span>
          <span
            className={`text-2xl font-bold mt-1 block font-mono ${
              (summary?.totalLostQuantity ?? 0) > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {isLoading && !summary ? '...' : (summary?.totalLostQuantity ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500">Damaged / spoiled</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL RETURN RECORDS
          </span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalReturnRecords ?? 0)}
          </span>
          <span className="text-[11px] text-slate-500">Surplus batches returned</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            TOTAL RETURNED UNITS
          </span>
          <span className="text-2xl font-bold text-[#01875F] mt-1 block font-mono">
            {isLoading && !summary ? '...' : (summary?.totalReturnedQuantity ?? 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500">Re-entered into inventory</span>
        </div>
      </div>

      {/* 4. Sub-Section Switcher & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveSection('losses')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'losses'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Material Losses ({losses.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('returns')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeSection === 'returns'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Material Returns ({returns.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-lg justify-end">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by material, reason, project..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
              />
            </div>

            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#01875F]"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_code} • {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <span>Filters active</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-[#01875F] font-semibold hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* 5. Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-8 animate-pulse space-y-3">
          <div className="h-6 bg-slate-100 rounded w-1/4" />
          <div className="h-24 bg-slate-50 rounded" />
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200 p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load losses and returns.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activeSection === 'losses' ? (
        losses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No material losses recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Damaged, spoiled, or written-off materials will be audited here.
            </p>
            <button
              type="button"
              onClick={() => setIsLossModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Record Loss</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Loss Date</th>
                    <th className="py-3.5 px-3">Project</th>
                    <th className="py-3.5 px-3">Material</th>
                    <th className="py-3.5 px-3 text-right">Lost Qty</th>
                    <th className="py-3.5 px-3">Reason</th>
                    <th className="py-3.5 px-3">Evidence Ref</th>
                    <th className="py-3.5 px-3">Logged By</th>
                    <th className="py-3.5 px-4 text-center">Status / Approval</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {losses.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatNigerianDate(l.loss_date)}
                      </td>
                      <td className="py-3.5 px-3">
                        {l.projects ? (
                          <Link
                            to={`/management/projects/${l.project_id}`}
                            className="font-medium text-slate-800 hover:text-[#01875F] hover:underline"
                          >
                            {l.projects.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Site</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {l.material?.name || 'Material'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                        -{Number(l.quantity).toLocaleString()} {l.material?.unit_of_measure}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {l.reason}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-slate-500 text-[11px]">
                        {l.evidence_reference || '—'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        {l.recorder
                          ? `${l.recorder.first_name || ''} ${l.recorder.last_name || ''}`.trim() ||
                            l.recorder.display_name
                          : 'System'}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {l.approved_by ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[10.5px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approved</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApproveLoss(l.id)}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-[#01875F] border border-emerald-200 rounded text-[10.5px] font-semibold transition-colors cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Returns Section */
        returns.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center max-w-xl mx-auto shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3 border border-teal-200">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No material returns recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Surplus materials returned from project sites will appear here.
            </p>
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#01875F] text-white text-xs font-semibold rounded-lg shadow-2xs hover:bg-[#016f4e] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Record Return</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4">Return Date</th>
                    <th className="py-3.5 px-3">Source Project</th>
                    <th className="py-3.5 px-3">Material</th>
                    <th className="py-3.5 px-3 text-right">Returned Qty</th>
                    <th className="py-3.5 px-3">Condition</th>
                    <th className="py-3.5 px-3">Destination</th>
                    <th className="py-3.5 px-4">Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatNigerianDate(r.return_date)}
                      </td>
                      <td className="py-3.5 px-3">
                        {r.projects ? (
                          <Link
                            to={`/management/projects/${r.project_id}`}
                            className="font-medium text-slate-800 hover:text-[#01875F] hover:underline"
                          >
                            {r.projects.name}
                          </Link>
                        ) : (
                          <span className="text-slate-400">Site</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {r.material?.name || 'Material'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-teal-700 whitespace-nowrap">
                        +{Number(r.quantity_returned).toLocaleString()} {r.material?.unit_of_measure}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {r.condition || 'Good'}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {r.destination || 'Central Warehouse'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {r.returner
                          ? `${r.returner.first_name || ''} ${r.returner.last_name || ''}`.trim() ||
                            r.returner.display_name
                          : 'Store Officer'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modals */}
      <RecordLossModal
        isOpen={isLossModalOpen}
        onClose={() => setIsLossModalOpen(false)}
        onLossRecorded={() => fetchData(true)}
      />

      <RecordReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onReturnRecorded={() => fetchData(true)}
      />
    </div>
  );
};

export default LossesReturnsModule;
