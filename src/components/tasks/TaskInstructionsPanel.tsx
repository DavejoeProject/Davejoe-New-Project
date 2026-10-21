import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Wrench,
  Package,
  HardHat,
  FileCheck2,
  HelpCircle,
  Plus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  TaskInstructionsService,
  TaskInstructionItem,
  CreateTaskInstructionInput,
  TaskPriority,
  TaskStatus,
} from '../../services/taskInstructionsService';

interface TaskInstructionsPanelProps {
  projectId?: string;
  className?: string;
}

export const TaskInstructionsPanel: React.FC<TaskInstructionsPanelProps> = ({
  projectId,
  className = '',
}) => {
  const { user, hasRole, currentRoleKey } = useAuth();
  const [tasks, setTasks] = useState<TaskInstructionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskInstructionItem | null>(null);

  // Form states
  const [clarificationNotes, setClarificationNotes] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // New task form
  const [createForm, setCreateForm] = useState<CreateTaskInstructionInput>({
    project_id: projectId || '',
    title: '',
    description: '',
    priority: 'normal',
    deliverable: '',
    required_materials: '',
    required_tools: '',
    required_ppe: '',
    technical_specifications: '',
    quality_standards: '',
    safety_instructions: '',
    completion_evidence_required: '',
  });

  const canCreateOrReview =
    hasRole('management') ||
    hasRole('executive_director') ||
    hasRole('admin') ||
    hasRole('technical') ||
    hasRole('supervisor') ||
    currentRoleKey === 'admin' ||
    currentRoleKey === 'supervisor' ||
    currentRoleKey === 'technical';

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await TaskInstructionsService.getTasks({
        projectId: projectId || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (err) setError(err);
      setTasks(data || []);
      if (data && data.length > 0 && !expandedTaskId) {
        setExpandedTaskId(data[0].id);
      }
    } catch (e: any) {
      setError(e.message || 'Error loading task instructions');
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAcknowledge = async (task: TaskInstructionItem) => {
    setActionLoading(true);
    try {
      const res = await TaskInstructionsService.acknowledgeTask({
        taskId: task.id,
        status: 'acknowledged',
      });
      if (!res.success) throw new Error(res.error || 'Failed to acknowledge');
      await loadTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to acknowledge task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!selectedTask || !clarificationNotes.trim()) return;
    setActionLoading(true);
    try {
      const res = await TaskInstructionsService.acknowledgeTask({
        taskId: selectedTask.id,
        status: 'clarification_requested',
        clarificationNotes: clarificationNotes.trim(),
      });
      if (!res.success) throw new Error(res.error || 'Failed to submit clarification request');
      setShowClarificationModal(false);
      setClarificationNotes('');
      await loadTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to request clarification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewSubmit = async (verdict: 'verified' | 'rejected' | 'returned_for_correction') => {
    if (!selectedTask) return;
    setActionLoading(true);
    try {
      const res = await TaskInstructionsService.reviewTask({
        taskId: selectedTask.id,
        verificationStatus: verdict,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      if (!res.success) throw new Error(res.error || 'Failed to record review');
      setShowReviewModal(false);
      setReviewNotes('');
      await loadTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to review task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      alert('Task title is required');
      return;
    }
    setActionLoading(true);
    try {
      const res = await TaskInstructionsService.createTask({
        ...createForm,
        project_id: createForm.project_id || projectId || 'general',
      });
      if (res.error) throw new Error(res.error);
      setShowCreateModal(false);
      setCreateForm({
        project_id: projectId || '',
        title: '',
        description: '',
        priority: 'normal',
        deliverable: '',
        required_materials: '',
        required_tools: '',
        required_ppe: '',
        technical_specifications: '',
        quality_standards: '',
        safety_instructions: '',
        completion_evidence_required: '',
      });
      await loadTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to create task instruction');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(term) ||
      (t.deliverable && t.deliverable.toLowerCase().includes(term)) ||
      (t.project?.name && t.project.name.toLowerCase().includes(term))
    );
  });

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800">Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800">High</span>;
      case 'normal':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">Normal</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">Low</span>;
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'completed':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-800">Completed</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">In Progress</span>;
      case 'blocked':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-rose-100 text-rose-800">Blocked</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700">Pending</span>;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-[#01875F]" />
              <h2 className="text-xl font-bold text-gray-900">Task Instructions & Handover</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Enforce unambiguous task specifications, safety standards, deliverables, and verifiable handover audits.
            </p>
          </div>
          {canCreateOrReview && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#01875F] hover:bg-[#01704e] text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Issue New Task Instruction
            </button>
          )}
        </div>

        {/* Filter / Search Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search deliverables, specs, or task title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white text-gray-700 focus:ring-2 focus:ring-[#01875F] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="todo">Pending (To Do)</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
            <Clock className="w-8 h-8 animate-spin mx-auto text-[#01875F] mb-2" />
            Loading task instructions and specifications...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            No task instructions found matching current filters.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;

            return (
              <div
                key={task.id}
                className="bg-white border border-gray-200 rounded-xl shadow-sm hover:border-gray-300 transition-all overflow-hidden"
              >
                {/* Header row */}
                <div
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900 text-base">{task.title}</span>
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}
                      {task.acknowledgement_status === 'acknowledged' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Acknowledged
                        </span>
                      ) : task.acknowledgement_status === 'clarification_requested' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <HelpCircle className="w-3 h-3" /> Clarification Requested
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3" /> Awaiting Receipt
                        </span>
                      )}
                    </div>
                    {task.project?.name && (
                      <p className="text-xs text-gray-500 font-medium">Project: {task.project.name}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-gray-500 hidden sm:block">
                      {task.due_date && <div>Due: {task.due_date}</div>}
                      <div>Status: <span className="font-medium text-gray-700 capitalize">{task.verification_status.replace(/_/g, ' ')}</span></div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-4 sm:p-6 border-t border-gray-100 space-y-6 text-sm">
                    {task.description && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                          Task Description & Scope
                        </h4>
                        <p className="text-gray-800 leading-relaxed">{task.description}</p>
                      </div>
                    )}

                    {/* Technical Specifications Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {task.deliverable && (
                        <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-900 font-semibold mb-1">
                            <FileCheck2 className="w-4 h-4 text-blue-600" />
                            Expected Deliverable & Acceptance Criteria
                          </div>
                          <p className="text-blue-950 text-xs sm:text-sm">{task.deliverable}</p>
                        </div>
                      )}

                      {task.technical_specifications && (
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1">
                            <ClipboardList className="w-4 h-4 text-slate-600" />
                            Technical Specifications & Tolerances
                          </div>
                          <p className="text-slate-800 text-xs sm:text-sm">{task.technical_specifications}</p>
                        </div>
                      )}

                      {task.required_materials && (
                        <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-lg">
                          <div className="flex items-center gap-2 text-amber-900 font-semibold mb-1">
                            <Package className="w-4 h-4 text-amber-600" />
                            Specified Materials & Consumables
                          </div>
                          <p className="text-amber-950 text-xs sm:text-sm">{task.required_materials}</p>
                        </div>
                      )}

                      {task.required_tools && (
                        <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-lg">
                          <div className="flex items-center gap-2 text-indigo-900 font-semibold mb-1">
                            <Wrench className="w-4 h-4 text-indigo-600" />
                            Required Tools & Calibrated Equipment
                          </div>
                          <p className="text-indigo-950 text-xs sm:text-sm">{task.required_tools}</p>
                        </div>
                      )}

                      {task.required_ppe && (
                        <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-lg">
                          <div className="flex items-center gap-2 text-emerald-900 font-semibold mb-1">
                            <HardHat className="w-4 h-4 text-emerald-600" />
                            Mandatory Safety PPE
                          </div>
                          <p className="text-emerald-950 text-xs sm:text-sm">{task.required_ppe}</p>
                        </div>
                      )}

                      {task.safety_instructions && (
                        <div className="p-3.5 bg-rose-50/60 border border-rose-100 rounded-lg">
                          <div className="flex items-center gap-2 text-rose-900 font-semibold mb-1">
                            <ShieldCheck className="w-4 h-4 text-rose-600" />
                            Hazard Mitigation & Safety Precautions
                          </div>
                          <p className="text-rose-950 text-xs sm:text-sm">{task.safety_instructions}</p>
                        </div>
                      )}
                    </div>

                    {task.completion_evidence_required && (
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                        <span className="font-semibold text-gray-700">Completion Evidence Required: </span>
                        <span className="text-gray-600">{task.completion_evidence_required}</span>
                      </div>
                    )}

                    {/* Clarification Notes if any */}
                    {task.clarification_notes && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                        <div className="font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5" />
                          Workforce Clarification Request:
                        </div>
                        <p className="text-amber-900">{task.clarification_notes}</p>
                      </div>
                    )}

                    {/* Verification Notes if any */}
                    {task.review_notes && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs">
                        <div className="font-semibold text-purple-800 mb-1 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          QC Review Audit Notes:
                        </div>
                        <p className="text-purple-900">{task.review_notes}</p>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {task.issuer && (
                          <span>Issued by: <strong className="text-gray-700">{task.issuer.display_name || task.issuer.first_name}</strong></span>
                        )}
                        {task.assignee && (
                          <span>• Assignee: <strong className="text-gray-700">{task.assignee.display_name || task.assignee.first_name}</strong></span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Acknowledge / Clarification actions */}
                        {task.acknowledgement_status !== 'acknowledged' && (
                          <>
                            <button
                              onClick={() => handleAcknowledge(task)}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Acknowledge Instructions
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowClarificationModal(true);
                              }}
                              disabled={actionLoading}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              Request Clarification
                            </button>
                          </>
                        )}

                        {/* Review actions for QC / Supervisors / Admin */}
                        {canCreateOrReview && (
                          <button
                            onClick={() => {
                              setSelectedTask(task);
                              setShowReviewModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#01875F]" />
                            Review & Verify Task
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Task Instruction */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#01875F]" />
                Issue Mandatory Task Instruction
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Bedroom Engineered Parquet Flooring"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Scope & Background Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed description of the task requirements..."
                  value={createForm.description || ''}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Priority
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Deliverable / Acceptance Criteria
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flush herringbone pattern with perimeter cork joints"
                    value={createForm.deliverable || ''}
                    onChange={(e) => setCreateForm({ ...createForm, deliverable: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Required Materials
                  </label>
                  <input
                    type="text"
                    placeholder="Specific items, grades, brands required"
                    value={createForm.required_materials || ''}
                    onChange={(e) => setCreateForm({ ...createForm, required_materials: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Required Tools & Equipment
                  </label>
                  <input
                    type="text"
                    placeholder="Required tools (e.g. drop saw, moisture meter)"
                    value={createForm.required_tools || ''}
                    onChange={(e) => setCreateForm({ ...createForm, required_tools: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Technical Specs & Tolerances
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Max 2mm deviation over 3m edge"
                    value={createForm.technical_specifications || ''}
                    onChange={(e) => setCreateForm({ ...createForm, technical_specifications: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    Safety Instructions & PPE
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FFP2 mask, eye shield, ventilated space"
                    value={createForm.safety_instructions || ''}
                    onChange={(e) => setCreateForm({ ...createForm, safety_instructions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Completion Evidence Required
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3 photos of joint alignment + QC signoff"
                  value={createForm.completion_evidence_required || ''}
                  onChange={(e) => setCreateForm({ ...createForm, completion_evidence_required: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#01875F] hover:bg-[#01704e] text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
                >
                  {actionLoading ? 'Issuing...' : 'Issue Task Instruction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Request Clarification */}
      {showClarificationModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-amber-600" />
              Request Clarification: {selectedTask.title}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              State clearly what instructions, drawings, materials, or safety specifications require clarification before work commences.
            </p>
            <textarea
              rows={4}
              required
              placeholder="e.g. Detail AD-204 does not specify the expansion gap along the stone skirt..."
              value={clarificationNotes}
              onChange={(e) => setClarificationNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowClarificationModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClarificationSubmit}
                disabled={actionLoading || !clarificationNotes.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {actionLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Review & Verify Task */}
      {showReviewModal && selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-[#01875F]" />
              Quality Inspection & Task Review
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Task: <strong className="text-gray-800">{selectedTask.title}</strong>
            </p>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
              Inspection / Verification Findings
            </label>
            <textarea
              rows={3}
              placeholder="State inspection findings, tolerance measurements, or reasons for return..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#01875F] focus:outline-none mb-4"
            />
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewSubmit('returned_for_correction')}
                disabled={actionLoading}
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Return for Correction
              </button>
              <button
                type="button"
                onClick={() => handleReviewSubmit('rejected')}
                disabled={actionLoading}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Reject Task
              </button>
              <button
                type="button"
                onClick={() => handleReviewSubmit('verified')}
                disabled={actionLoading}
                className="px-4 py-2 bg-[#01875F] hover:bg-[#01704e] text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Approve & Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TaskInstructionsPanel;
