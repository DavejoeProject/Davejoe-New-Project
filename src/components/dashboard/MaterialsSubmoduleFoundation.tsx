import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, RefreshCw, AlertCircle, LucideIcon } from 'lucide-react';
import { MaterialsNavTabs, MaterialsTabKey } from './MaterialsNavTabs';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface MaterialsSubmoduleFoundationProps {
  title: string;
  subtitle: string;
  tabKey: MaterialsTabKey;
  icon: LucideIcon;
  targetTable: string;
  tableLabel: string;
  description: string;
  onBackToOverview: () => void;
}

export const MaterialsSubmoduleFoundation: React.FC<MaterialsSubmoduleFoundationProps> = ({
  title,
  subtitle,
  tabKey,
  icon: Icon,
  targetTable,
  tableLabel,
  description,
  onBackToOverview,
}) => {
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRecordCount = useCallback(async (isManual: boolean = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    if (!isSupabaseConfigured) {
      setErrorMessage('Database connection is not configured.');
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const { count, error } = await supabase
        .from(targetTable)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error(`[MaterialsSubmoduleFoundation] Error checking ${targetTable}:`, error);
        setErrorMessage(error.message || `Unable to query ${targetTable}.`);
      } else {
        setRecordCount(count ?? 0);
      }
    } catch (err) {
      console.error(`[MaterialsSubmoduleFoundation] Unexpected error:`, err);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to connect to database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [targetTable]);

  useEffect(() => {
    fetchRecordCount();
  }, [fetchRecordCount]);

  return (
    <div className="space-y-6 pb-12 select-auto">
      {/* Top Header & Breadcrumbs */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-2xs">
        <button
          type="button"
          onClick={onBackToOverview}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Materials</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                MATERIALS MANAGEMENT / {title.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Icon className="w-7 h-7 text-[#01875F]" />
              <span>{title}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              onClick={() => fetchRecordCount(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
              title="Check live database records"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#01875F] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Checking...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <MaterialsNavTabs activeTab={tabKey} />

      {/* Main Foundation Surface */}
      {errorMessage ? (
        <div className="bg-white rounded-xl border border-red-200/90 shadow-2xs p-10 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Unable to load this section.</h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">{errorMessage}</p>
          <button
            type="button"
            onClick={() => fetchRecordCount()}
            className="px-4 py-2 bg-[#01875F] hover:bg-[#016f4e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-8 sm:p-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F4EA] text-[#01875F] flex items-center justify-center mx-auto mb-4 border border-[#01875F]/20 shadow-2xs">
            <Icon className="w-7 h-7" strokeWidth={1.8} />
          </div>

          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            {title} controls will appear here.
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {description}
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-lg font-mono">
              Database Table: <span className="font-bold text-slate-800">{targetTable}</span> ({isLoading ? 'checking...' : `${recordCount ?? 0} ${tableLabel}`})
            </div>
            <button
              type="button"
              onClick={onBackToOverview}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#01875F] hover:underline cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialsSubmoduleFoundation;
