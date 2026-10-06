import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Database,
  Shield,
  Smartphone,
  Cpu,
  Layers,
  HardDrive,
  Activity,
  Lock,
  ExternalLink,
  Info,
} from 'lucide-react';

interface DiagnosticResult {
  table: string;
  status: 'healthy' | 'warning' | 'error' | 'pending';
  latencyMs: number;
  message: string;
}

export const SystemSettingsView: React.FC = () => {
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([
    { table: 'profiles', status: 'pending', latencyMs: 0, message: 'Not tested' },
    { table: 'roles', status: 'pending', latencyMs: 0, message: 'Not tested' },
    { table: 'user_roles', status: 'pending', latencyMs: 0, message: 'Not tested' },
    { table: 'role_permissions', status: 'pending', latencyMs: 0, message: 'Not tested' },
    { table: 'audit_logs', status: 'pending', latencyMs: 0, message: 'Not tested' },
    { table: 'workforce_members', status: 'pending', latencyMs: 0, message: 'Not tested' },
    { table: 'projects', status: 'pending', latencyMs: 0, message: 'Not tested' },
  ]);

  const runDatabaseDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    const tables = [
      'profiles',
      'roles',
      'user_roles',
      'role_permissions',
      'audit_logs',
      'workforce_members',
      'projects',
    ];

    const results: DiagnosticResult[] = [];

    for (const table of tables) {
      const startTime = performance.now();
      try {
        const { error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        const latencyMs = Math.round(performance.now() - startTime);

        if (error) {
          results.push({
            table,
            status: error.code === '42501' ? 'warning' : 'error',
            latencyMs,
            message: error.code === '42501' ? 'Protected by RLS policies' : error.message,
          });
        } else {
          results.push({
            table,
            status: 'healthy',
            latencyMs,
            message: `Responsive (${count ?? 0} records)`,
          });
        }
      } catch (err: any) {
        const latencyMs = Math.round(performance.now() - startTime);
        results.push({
          table,
          status: 'error',
          latencyMs,
          message: err?.message || 'Connection failed',
        });
      }
    }

    setDiagnostics(results);
    setIsRunningDiagnostics(false);
  };

  useEffect(() => {
    runDatabaseDiagnostics();
  }, []);

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">System Configuration & Health</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Architecture parameters, Supabase database connectivity diagnostics, and runtime security controls.
          </p>
        </div>

        <button
          type="button"
          onClick={runDatabaseDiagnostics}
          disabled={isRunningDiagnostics}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin text-[#01875F]' : ''}`} />
          <span>Run Live Health Checks</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: System Identity & Health Diagnostic (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* System Identity Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#01875F]" />
              <span>Application Identity & Runtime</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Application Name</span>
                <span className="font-bold text-slate-900">Davejoe Management Tool</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Primary Brand Theme</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-3 h-3 rounded-full bg-[#01875F] inline-block shadow-2xs" />
                  <span className="font-bold text-[#01875F]">#01875F (Emerald Green)</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Backend Provider</span>
                <span className="font-bold text-slate-900">
                  {isSupabaseConfigured ? 'Supabase PostgreSQL' : 'Mock / Local'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block text-[11px]">Deployment Target</span>
                <span className="font-bold text-slate-900">Vercel Production</span>
              </div>
            </div>
          </div>

          {/* Live Database Connectivity Diagnostic */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Database className="w-4 h-4 text-[#01875F]" />
                <span>Supabase Database Diagnostics</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                {diagnostics.filter((d) => d.status === 'healthy').length} / {diagnostics.length} healthy
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {diagnostics.map((diag) => (
                <div key={diag.table} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    {diag.status === 'healthy' && (
                      <CheckCircle2 className="w-4 h-4 text-[#01875F] shrink-0" />
                    )}
                    {diag.status === 'warning' && (
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    {diag.status === 'error' && (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    {diag.status === 'pending' && (
                      <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin shrink-0" />
                    )}
                    <div>
                      <span className="font-mono font-semibold text-slate-900">
                        public.{diag.table}
                      </span>
                      <span className="text-[11px] text-slate-400 block">{diag.message}</span>
                    </div>
                  </div>

                  <span className="font-mono text-[11px] text-slate-500">
                    {diag.latencyMs > 0 ? `${diag.latencyMs} ms` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Security Architecture & PWA Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Authoritative Security Architecture */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#01875F]" />
              <span>Access Control & Role Resolution</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed">
              Davejoe enforces access through the authoritative relational database model:
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono text-[11px] text-slate-700 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Lock className="w-3 h-3 text-[#01875F]" />
                <span>auth.users</span>
              </div>
              <div className="text-slate-400 pl-4">&darr; foreign key (user_id)</div>
              <div className="font-bold text-slate-900 pl-4">public.user_roles</div>
              <div className="text-slate-400 pl-8">&darr; foreign key (role_id)</div>
              <div className="font-bold text-[#01875F] pl-8">public.roles.slug</div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-slate-700 space-y-1">
              <span className="font-bold text-[#01875F] block">Admin Authorization Key:</span>
              <p className="text-[11px] text-slate-600">
                Role slug <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-[#01875F]">admin</code> routes to <code className="bg-white px-1 py-0.5 rounded font-mono">/admin</code>.
              </p>
              <p className="text-[11px] text-slate-600">
                Role slug <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-emerald-700">management</code> routes to <code className="bg-white px-1 py-0.5 rounded font-mono">/management</code>.
              </p>
            </div>
          </div>

          {/* Progressive Web App (PWA) Status */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#01875F]" />
              <span>Progressive Web App (PWA)</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Display Mode</span>
                  <span className="text-[11px] text-slate-400">
                    {isStandalone ? 'Installed Standalone App' : 'Web Browser Window'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    isStandalone
                      ? 'bg-emerald-100 text-[#01875F]'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isStandalone ? 'Standalone' : 'Browser'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Service Worker & Caching</span>
                  <span className="text-[11px] text-slate-400">vite-plugin-pwa Workbox</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-[#01875F]">
                  Active
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">PWA Manifest</span>
                  <span className="text-[11px] text-slate-400">/manifest.webmanifest</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-[#01875F]">
                  Configured
                </span>
              </div>
            </div>
          </div>

          {/* Audit Retention Policy */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <HardDrive className="w-4 h-4 text-[#01875F]" />
              <span>Audit Logging Policy</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Audit logs are stored permanently in <code className="font-mono text-slate-700">public.audit_logs</code>. In compliance with security auditing protocols, records cannot be modified or purged through the client interface.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
