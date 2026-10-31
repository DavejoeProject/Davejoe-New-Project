import React, { useState } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  FileSpreadsheet,
} from 'lucide-react';
import { ProjectProjection } from '../../services/projectProjectionsService';
import { formatNaira } from '../../services/dashboardService';

interface ProjectionsTableViewProps {
  projections: ProjectProjection[];
  title: string;
  subtitle: string;
  onOpenCreateModal: () => void;
  onSelectProjection: (p: ProjectProjection) => void;
}

export const ProjectionsTableView: React.FC<ProjectionsTableViewProps> = ({
  projections,
  title,
  subtitle,
  onOpenCreateModal,
  onSelectProjection,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'margin'>('date');

  const filtered = projections
    .filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.proposed_project_name.toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        p.projection_number.toLowerCase().includes(q) ||
        (p.site_location || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'value') {
        return (b.proposed_selling_price || b.estimated_grand_total) - (a.proposed_selling_price || a.estimated_grand_total);
      }
      if (sortBy === 'margin') {
        return (b.projected_gross_margin_pct || 0) - (a.projected_gross_margin_pct || 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#01875F] text-white hover:bg-[#01704f] rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Projection
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by project, client, or PRJ-PROJ code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#01875F] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
          >
            <option value="all">All Lifecycle Statuses</option>
            <option value="draft">Draft</option>
            <option value="under_review">Under Review</option>
            <option value="client_review">Client Review</option>
            <option value="approved">Approved</option>
            <option value="converted">Converted</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
          >
            <option value="date">Sort by Recent</option>
            <option value="value">Sort by Contract Value</option>
            <option value="margin">Sort by Margin %</option>
          </select>
        </div>
      </div>

      {/* Table / Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            No projections matching the selected criteria.
          </div>
        ) : (
          <>
            {/* Mobile Card View (md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onSelectProjection(proj)}
                  className="p-4 hover:bg-slate-50/70 transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200/80">
                          {proj.projection_number}
                        </span>
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                            proj.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : proj.status === 'converted'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : proj.status === 'under_review'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : proj.status === 'client_review'
                              ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {proj.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-1 leading-snug">
                        {proj.proposed_project_name}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {proj.site_location || 'Location TBD'}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200/80 shrink-0">
                      {proj.projected_gross_margin_pct}% Mgn
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/60 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Client</span>
                      <span className="font-medium text-slate-800 truncate block">{proj.client_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Contract Value</span>
                      <span className="font-mono font-bold text-[#01875F] truncate block">
                        {formatNaira(proj.proposed_selling_price || proj.estimated_grand_total)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Estimated Cost</span>
                      <span className="font-mono text-slate-600 truncate block">
                        {formatNaira(proj.estimated_grand_total)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Sub-Status</span>
                      <span className="text-slate-700 capitalize truncate block text-[11px]">
                        {proj.sub_status?.replace(/_/g, ' ') || 'Draft'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProjection(proj);
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-[#01875F] bg-[#01875F]/10 hover:bg-[#01875F]/20 rounded-lg transition-colors min-h-[38px] cursor-pointer"
                  >
                    <span>Open Projection Record</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop Table (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Projection Code</th>
                    <th className="py-3 px-4">Proposed Project Name</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-3 text-right">Est. Cost</th>
                    <th className="py-3 px-3 text-right">Contract Value</th>
                    <th className="py-3 px-3 text-right">Gross Margin</th>
                    <th className="py-3 px-4 text-center">Lifecycle Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((proj) => (
                    <tr
                      key={proj.id}
                      onClick={() => onSelectProjection(proj)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {proj.projection_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-[#01875F] transition-colors">
                          {proj.proposed_project_name}
                        </div>
                        <div className="text-[11px] text-slate-500">{proj.site_location || 'Location TBD'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{proj.client_name}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {formatNaira(proj.estimated_grand_total)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatNaira(proj.proposed_selling_price || proj.estimated_grand_total)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                        {proj.projected_gross_margin_pct}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                            proj.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : proj.status === 'converted'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : proj.status === 'under_review'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : proj.status === 'client_review'
                              ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {proj.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProjection(proj);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#01875F] bg-[#01875F]/10 hover:bg-[#01875F]/20 rounded-md transition-colors"
                        >
                          Open Record
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
