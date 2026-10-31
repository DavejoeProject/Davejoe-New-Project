import React from 'react';
import {
  Calculator,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  FileCheck2,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Send,
  HelpCircle,
  FileText,
  Building2,
  Calendar,
} from 'lucide-react';
import { ProjectProjection } from '../../services/projectProjectionsService';
import { formatNaira } from '../../services/dashboardService';

interface PlanningOverviewViewProps {
  projections: ProjectProjection[];
  onOpenCreateModal: () => void;
  onSelectProjection: (p: ProjectProjection) => void;
  onNavigateSection: (section: string) => void;
}

export const PlanningOverviewView: React.FC<PlanningOverviewViewProps> = ({
  projections,
  onOpenCreateModal,
  onSelectProjection,
  onNavigateSection,
}) => {
  // KPI Calculations
  const total = projections.length;
  const drafts = projections.filter((p) => p.status === 'draft').length;
  const awaitingContributions = projections.filter(
    (p) => p.sub_status === 'awaiting_contributions'
  ).length;
  const underReview = projections.filter(
    (p) => p.status === 'under_review' && p.sub_status !== 'awaiting_contributions'
  ).length;
  const awaitingApproval = projections.filter(
    (p) => p.sub_status === 'awaiting_management_approval'
  ).length;
  const approved = projections.filter((p) => p.status === 'approved').length;
  const clientReview = projections.filter(
    (p) => p.status === 'client_review' || p.sub_status === 'quotation_sent'
  ).length;
  const readyForConversion = projections.filter(
    (p) => p.sub_status === 'ready_for_conversion'
  ).length;
  const converted = projections.filter((p) => p.status === 'converted').length;

  // Financial aggregates
  const totalContractValue = projections.reduce(
    (sum, p) => sum + (p.proposed_selling_price || p.estimated_grand_total || 0),
    0
  );
  const totalEstimatedCost = projections.reduce(
    (sum, p) => sum + (p.estimated_grand_total || 0),
    0
  );
  const totalGrossProfit = Math.max(0, totalContractValue - totalEstimatedCost);
  const overallMargin =
    totalContractValue > 0
      ? Math.round((totalGrossProfit / totalContractValue) * 1000) / 10
      : 0;

  // Attention Required items
  const attentionItems = projections.filter(
    (p) =>
      p.sub_status === 'awaiting_contributions' ||
      p.sub_status === 'awaiting_management_approval' ||
      p.sub_status === 'changes_requested' ||
      p.sub_status === 'ready_for_conversion'
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Primary Action */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-[#015e42] rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-300 text-xs font-semibold mb-3 tracking-wide">
            <Calculator className="w-3.5 h-3.5" />
            Davejoe Pre-Project Commercial Gateway
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Project Planning & Projections Engine
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
            Evaluate proposed jobs, record technical measurements, prepare comprehensive Bills of Quantities,
            consolidate multi-role contributions, and obtain commercial sign-off before official project activation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#01875F] hover:bg-[#01704f] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create New Projection
          </button>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Projected Contract Value</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatNaira(totalContractValue)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all planned pipeline proposals</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated Project Cost</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatNaira(totalEstimatedCost)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Direct costs + contingency reserve</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Projected Gross Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#01875F] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700">
            {formatNaira(totalGrossProfit)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Calculated contract spread</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Projected Gross Margin</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-purple-700">
            {overallMargin}%
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`inline-block w-2 h-2 rounded-full ${overallMargin >= 25 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="text-[11px] text-slate-500">
              {overallMargin >= 25 ? 'Healthy Davejoe target (≥25%)' : 'Below company standard target'}
            </span>
          </div>
        </div>
      </div>

      {/* Planning Pipeline Stages */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FolderKanban className="w-4 h-4 text-[#01875F]" />
          Projection Lifecycle Pipeline
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div
            onClick={() => onNavigateSection('all-projections')}
            className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/70 transition-colors cursor-pointer text-center"
          >
            <span className="text-2xl font-bold text-slate-800 block">{drafts}</span>
            <span className="text-xs font-semibold text-slate-500 mt-0.5 block">1. Drafts</span>
          </div>

          <div
            onClick={() => onNavigateSection('pending-reviews')}
            className="p-3.5 bg-blue-50/60 hover:bg-blue-100/60 rounded-xl border border-blue-200/70 transition-colors cursor-pointer text-center"
          >
            <span className="text-2xl font-bold text-blue-700 block">{awaitingContributions}</span>
            <span className="text-xs font-semibold text-blue-600 mt-0.5 block">2. Contributions</span>
          </div>

          <div
            onClick={() => onNavigateSection('pending-reviews')}
            className="p-3.5 bg-amber-50/60 hover:bg-amber-100/60 rounded-xl border border-amber-200/70 transition-colors cursor-pointer text-center"
          >
            <span className="text-2xl font-bold text-amber-700 block">{underReview}</span>
            <span className="text-xs font-semibold text-amber-600 mt-0.5 block">3. Under Review</span>
          </div>

          <div
            onClick={() => onNavigateSection('awaiting-approval')}
            className="p-3.5 bg-purple-50/60 hover:bg-purple-100/60 rounded-xl border border-purple-200/70 transition-colors cursor-pointer text-center"
          >
            <span className="text-2xl font-bold text-purple-700 block">{awaitingApproval}</span>
            <span className="text-xs font-semibold text-purple-600 mt-0.5 block">4. Awaiting Approval</span>
          </div>

          <div
            onClick={() => onNavigateSection('approved-projections')}
            className="p-3.5 bg-emerald-50/60 hover:bg-emerald-100/60 rounded-xl border border-emerald-200/70 transition-colors cursor-pointer text-center"
          >
            <span className="text-2xl font-bold text-emerald-700 block">{approved}</span>
            <span className="text-xs font-semibold text-emerald-600 mt-0.5 block">5. Approved</span>
          </div>

          <div
            onClick={() => onNavigateSection('approved-projections')}
            className="p-3.5 bg-cyan-50/60 hover:bg-cyan-100/60 rounded-xl border border-cyan-200/70 transition-colors cursor-pointer text-center"
          >
            <span className="text-2xl font-bold text-cyan-700 block">{clientReview}</span>
            <span className="text-xs font-semibold text-cyan-600 mt-0.5 block">6. Client Quote</span>
          </div>

          <div
            onClick={() => onNavigateSection('converted-projects')}
            className="p-3.5 bg-emerald-100/60 hover:bg-emerald-200/60 rounded-xl border border-emerald-300 transition-colors cursor-pointer text-center"
          >
            <span className="text-2xl font-bold text-[#01875F] block">{converted}</span>
            <span className="text-xs font-bold text-[#01875F] mt-0.5 block">7. Converted</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Attention Required Section */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Attention Required
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {attentionItems.length} Pending
            </span>
          </div>

          {attentionItems.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              All projections are on track. No pending blockers or overdue reviews.
            </div>
          ) : (
            <div className="space-y-3">
              {attentionItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectProjection(item)}
                  className="p-3 bg-slate-50 hover:bg-slate-100/90 rounded-xl border border-slate-200/80 transition-all cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.proposed_project_name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-slate-200 text-slate-600">
                        {item.projection_number}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      Client: {item.client_name}
                    </div>
                    <div className="text-[11px] text-amber-700 font-medium mt-1">
                      {item.sub_status === 'awaiting_contributions' && '• Departmental contribution pending'}
                      {item.sub_status === 'awaiting_management_approval' && '• Awaiting final management decision'}
                      {item.sub_status === 'changes_requested' && '• Revisions requested by reviewer'}
                      {item.sub_status === 'ready_for_conversion' && '• Client accepted: Ready to convert to project'}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 transition-transform group-hover:translate-x-0.5 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Planning Activities */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#01875F]" />
              Recent Planning Pipeline
            </h3>
            <button
              type="button"
              onClick={() => onNavigateSection('all-projections')}
              className="text-xs font-semibold text-[#01875F] hover:text-[#01704f] transition-colors"
            >
              View All ({projections.length})
            </button>
          </div>

          {projections.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              No project projections recorded yet. Click &quot;Create New Projection&quot; to begin.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projections.slice(0, 6).map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onSelectProjection(proj)}
                  className="py-3 hover:bg-slate-50/80 px-2 rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {proj.proposed_project_name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                        {proj.projection_number}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          proj.status === 'approved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : proj.status === 'converted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : proj.status === 'under_review'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {proj.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="truncate">Client: <strong className="text-slate-700">{proj.client_name}</strong></span>
                      {proj.site_location && <span>• {proj.site_location}</span>}
                      <span>• {new Date(proj.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-900">
                      {formatNaira(proj.proposed_selling_price || proj.estimated_grand_total)}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold">
                      {proj.projected_gross_margin_pct}% margin
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
