import React, { useState, useEffect, useCallback } from 'react';
import {
  AdminService,
  AuditLogEntry,
} from '../../services/adminService';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  Clock,
  User,
  Shield,
  Database,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  Info,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Available filter choices
  const [modulesList, setModulesList] = useState<string[]>([]);
  const [actionsList, setActionsList] = useState<string[]>([]);

  // Active filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Selected Log for Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Fetch available modules and actions on mount
  useEffect(() => {
    async function loadMeta() {
      try {
        const { modules, actions } = await AdminService.getAuditLogModulesAndActions();
        setModulesList(modules);
        setActionsList(actions);
      } catch (err) {
        console.warn('Could not load audit log meta:', err);
      }
    }
    loadMeta();
  }, []);

  // 2. Fetch logs with active filters and pagination
  const fetchLogs = useCallback(async () => {
    setError(null);
    try {
      const { logs: fetched, totalCount: count } = await AdminService.getAuditLogs({
        search: searchQuery.trim(),
        module: selectedModule,
        action: selectedAction,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page: currentPage,
        limit: pageSize,
      });

      setLogs(fetched);
      setTotalCount(count);
    } catch (err: any) {
      console.error('[AuditLogsView] Error fetching logs:', err);
      setError(err?.message || 'Failed to query audit logs from database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, selectedModule, selectedAction, dateFrom, dateTo, currentPage]);

  useEffect(() => {
    setIsLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
  };

  const handleCopyJSON = (data: any, key: string) => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">System Audit Logs</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Read-only chronological trail of system operations, authentication attempts, and data modifications.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#01875F]' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search action, module, table, record ID..."
              className="w-full pl-9 pr-3 h-9 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-[#01875F] focus:ring-1 focus:ring-[#01875F] transition-all"
            />
          </div>

          {/* Module Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] transition-all cursor-pointer"
            >
              <option value="all">All Modules</option>
              {modulesList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="md:col-span-2">
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 px-3 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] transition-all cursor-pointer"
            >
              <option value="all">All Actions</option>
              {actionsList.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              title="Date from"
              className="w-full h-9 px-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] transition-all"
            />
          </div>

          {/* Date To */}
          <div className="md:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              title="Date to"
              className="w-full h-9 px-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:bg-white focus:border-[#01875F] transition-all"
            />
          </div>
        </div>

        {/* Filter Summary */}
        {(searchQuery || selectedModule !== 'all' || selectedAction !== 'all' || dateFrom || dateTo) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                Search: "{searchQuery}"
              </span>
            )}
            {selectedModule !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                Module: {selectedModule}
              </span>
            )}
            {selectedAction !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                Action: {selectedAction}
              </span>
            )}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                Date: {dateFrom || 'start'} to {dateTo || 'now'}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedModule('all');
                setSelectedAction('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-[#01875F] hover:underline text-[11px] font-semibold ml-auto cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            className="text-red-700 font-semibold underline hover:text-red-800 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-500">Querying public.audit_logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No audit logs found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              {searchQuery || selectedModule !== 'all' || selectedAction !== 'all' || dateFrom || dateTo
                ? 'No records match your active query filters.'
                : 'No audit records have been generated yet in public.audit_logs.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Target Record</th>
                    <th className="py-3 px-4 text-right">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const hasPayload = Boolean(log.old_values || log.new_values);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 group-hover:text-[#01875F] transition-colors block">
                            {log.action}
                          </span>
                        </td>

                        {/* Module */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                            {log.module}
                          </span>
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4">
                          <div className="min-w-0">
                            <span className="font-medium text-slate-800 block truncate">
                              {log.actor_name || 'System / Automated'}
                            </span>
                            {log.actor_email && (
                              <span className="text-[10px] text-slate-400 block truncate">
                                {log.actor_email}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Target Table & Record */}
                        <td className="py-3 px-4">
                          {log.table_name ? (
                            <div className="font-mono text-[11px] text-slate-600">
                              <span>{log.table_name}</span>
                              {log.record_id && (
                                <span className="text-slate-400 ml-1">
                                  #{log.record_id.slice(0, 8)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Inspection Button */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLog(log);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#01875F] hover:text-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                Showing{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(totalCount, (currentPage - 1) * pageSize + 1)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(totalCount, currentPage * pageSize)}
                </span>{' '}
                of <span className="font-semibold text-slate-800">{totalCount}</span> log entries
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="px-2 py-1 text-xs font-semibold text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* INSPECTION MODAL */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 id="audit-modal-title" className="text-sm font-bold text-slate-900 truncate">
                    {selectedLog.action}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Core Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Timestamp</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Module</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedLog.module}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Actor</span>
                  <span className="font-semibold text-slate-800">
                    {selectedLog.actor_name || 'System'}
                  </span>
                  {selectedLog.actor_email && (
                    <span className="text-slate-400 text-[10px] block">
                      {selectedLog.actor_email}
                    </span>
                  )}
                  {selectedLog.actor_id && (
                    <span className="font-mono text-[10px] text-slate-400 block select-all">
                      UUID: {selectedLog.actor_id}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px] font-medium">Target Table / Record</span>
                  <span className="font-mono text-slate-800">
                    {selectedLog.table_name || 'N/A'}
                  </span>
                  {selectedLog.record_id && (
                    <span className="font-mono text-[10px] text-slate-500 block select-all">
                      Record: {selectedLog.record_id}
                    </span>
                  )}
                </div>

                {selectedLog.ip_address && (
                  <div>
                    <span className="text-slate-400 block text-[11px] font-medium">IP Address</span>
                    <span className="font-mono text-slate-700">{selectedLog.ip_address}</span>
                  </div>
                )}

                {selectedLog.user_agent && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 block text-[11px] font-medium">User Agent</span>
                    <span className="text-[11px] text-slate-600 break-all">{selectedLog.user_agent}</span>
                  </div>
                )}
              </div>

              {/* Payload Comparison: Old Values vs New Values */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Audit Payload & Modifications
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyJSON(
                        { old_values: selectedLog.old_values, new_values: selectedLog.new_values },
                        'all_payload'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#01875F] hover:underline cursor-pointer"
                  >
                    {copiedKey === 'all_payload' ? (
                      <>
                        <Check className="w-3 h-3 text-[#01875F]" />
                        <span>Copied JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Full Payload</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Old Values */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Previous State (Old Values)
                    </span>
                    <div className="bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56">
                      {selectedLog.old_values ? (
                        <pre>{JSON.stringify(selectedLog.old_values, null, 2)}</pre>
                      ) : (
                        <span className="text-slate-500 italic">None (New Record / Insert)</span>
                      )}
                    </div>
                  </div>

                  {/* New Values */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      Applied Changes (New Values)
                    </span>
                    <div className="bg-slate-900 text-emerald-400 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-56">
                      {selectedLog.new_values ? (
                        <pre>{JSON.stringify(selectedLog.new_values, null, 2)}</pre>
                      ) : (
                        <span className="text-slate-500 italic">None (Deletion / State Reset)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Immutability Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Audit logs in Davejoe are immutable security records. They cannot be edited or modified.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
