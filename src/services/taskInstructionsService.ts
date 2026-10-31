import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { AuditLogger } from '../lib/audit';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
export type TaskAcknowledgementStatus = 'unacknowledged' | 'acknowledged' | 'clarification_requested';
export type TaskVerificationStatus = 'pending_review' | 'verified' | 'rejected' | 'returned_for_correction';

/**
 * Normalizes user-supplied or legacy priority values to the strict PostgreSQL project_task_priority enum:
 * 'low' | 'medium' | 'high' | 'urgent'
 */
export function normalizeTaskPriority(val?: string | null): TaskPriority {
  if (!val) return 'medium';
  const lower = val.toLowerCase().trim();
  if (lower === 'urgent' || lower === 'critical') return 'urgent';
  if (lower === 'high') return 'high';
  if (lower === 'low') return 'low';
  return 'medium';
}

export interface TaskInstructionMetadata {
  deliverable?: string | null;
  required_materials?: string | null;
  required_tools?: string | null;
  required_ppe?: string | null;
  technical_specifications?: string | null;
  quality_standards?: string | null;
  safety_instructions?: string | null;
  completion_evidence_required?: string | null;
  acknowledgement_status?: TaskAcknowledgementStatus;
  acknowledged_at?: string | null;
  clarification_notes?: string | null;
  verification_status?: TaskVerificationStatus;
  reviewer_id?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  issued_by?: string | null;
  start_date?: string | null;
  parent_task_id?: string | null;
}

const META_DELIMITER_START = '<!-- DAVEJOE_INSTRUCTION_META:';
const META_DELIMITER_END = ':DAVEJOE_INSTRUCTION_META -->';

/**
 * Encodes task instruction metadata into the description column
 * to guarantee resilience across varied database schema states
 */
export function packTaskDescription(
  userDescription: string | null | undefined,
  meta: TaskInstructionMetadata
): string {
  const cleanDesc = (userDescription || '')
    .replace(new RegExp(`${META_DELIMITER_START}[\\s\\S]*?${META_DELIMITER_END}`, 'g'), '')
    .trim();
  const metaJson = JSON.stringify(meta);
  return cleanDesc
    ? `${cleanDesc}\n\n${META_DELIMITER_START}${metaJson}${META_DELIMITER_END}`
    : `${META_DELIMITER_START}${metaJson}${META_DELIMITER_END}`;
}

/**
 * Decodes task instruction metadata from raw description
 */
export function unpackTaskDescription(rawDescription: string | null | undefined): {
  cleanDescription: string;
  meta: TaskInstructionMetadata;
} {
  if (!rawDescription) {
    return { cleanDescription: '', meta: {} };
  }
  const match = rawDescription.match(
    new RegExp(`${META_DELIMITER_START}([\\s\\S]*?)${META_DELIMITER_END}`)
  );
  if (!match) {
    return { cleanDescription: rawDescription, meta: {} };
  }
  let meta: TaskInstructionMetadata = {};
  try {
    meta = JSON.parse(match[1]);
  } catch (e) {
    console.warn('[TaskInstructionsService] Failed to parse embedded instruction metadata', e);
  }
  const cleanDescription = rawDescription.replace(match[0], '').trim();
  return { cleanDescription, meta };
}

export interface TaskInstructionItem {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  issued_by?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  start_date?: string | null;
  due_date?: string | null;
  deliverable?: string | null;
  required_materials?: string | null;
  required_tools?: string | null;
  required_ppe?: string | null;
  technical_specifications?: string | null;
  quality_standards?: string | null;
  safety_instructions?: string | null;
  completion_evidence_required?: string | null;
  acknowledgement_status: TaskAcknowledgementStatus;
  acknowledged_at?: string | null;
  clarification_notes?: string | null;
  verification_status: TaskVerificationStatus;
  reviewer_id?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  parent_task_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Joins
  project?: {
    id: string;
    name: string;
    project_code?: string;
  } | null;
  assignee?: {
    id: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  issuer?: {
    id: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  reviewer?: {
    id: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export interface CreateTaskInstructionInput {
  project_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  priority?: TaskPriority;
  start_date?: string;
  due_date?: string;
  deliverable?: string;
  required_materials?: string;
  required_tools?: string;
  required_ppe?: string;
  technical_specifications?: string;
  quality_standards?: string;
  safety_instructions?: string;
  completion_evidence_required?: string;
  parent_task_id?: string;
}

function mapRowToTaskInstruction(row: any): TaskInstructionItem {
  const { cleanDescription, meta } = unpackTaskDescription(row.description);

  return {
    id: row.id,
    project_id: row.project_id,
    title: row.title || row.task_name || 'Untitled Task',
    description: cleanDescription || row.description || null,
    assigned_to: row.assigned_to,
    issued_by: row.issued_by || meta.issued_by || row.created_by || null,
    priority: normalizeTaskPriority(row.priority),
    status: (row.status as TaskStatus) || 'todo',
    start_date: row.start_date || meta.start_date || null,
    due_date: row.due_date || null,
    deliverable: row.deliverable || meta.deliverable || null,
    required_materials: row.required_materials || meta.required_materials || null,
    required_tools: row.required_tools || meta.required_tools || null,
    required_ppe: row.required_ppe || meta.required_ppe || null,
    technical_specifications: row.technical_specifications || meta.technical_specifications || null,
    quality_standards: row.quality_standards || meta.quality_standards || null,
    safety_instructions: row.safety_instructions || meta.safety_instructions || null,
    completion_evidence_required:
      row.completion_evidence_required || meta.completion_evidence_required || null,
    acknowledgement_status: (row.acknowledgement_status ||
      meta.acknowledgement_status ||
      'unacknowledged') as TaskAcknowledgementStatus,
    acknowledged_at: row.acknowledged_at || meta.acknowledged_at || null,
    clarification_notes: row.clarification_notes || meta.clarification_notes || null,
    verification_status: (row.verification_status ||
      meta.verification_status ||
      'pending_review') as TaskVerificationStatus,
    reviewer_id: row.reviewer_id || meta.reviewer_id || null,
    review_notes: row.review_notes || meta.review_notes || null,
    reviewed_at: row.reviewed_at || meta.reviewed_at || null,
    parent_task_id: row.parent_task_id || meta.parent_task_id || null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || null,
    project: row.project || null,
    assignee: row.assignee || null,
    issuer: row.issuer || row.creator || null,
    reviewer: row.reviewer || null,
  };
}

export class TaskInstructionsService {
  /**
   * Fetches tasks with instructions and accountability history
   * Queries verified live Supabase project_tasks table with no mock/fake fallbacks
   */
  static async getTasks(params?: {
    projectId?: string;
    assignedTo?: string;
    status?: string;
    search?: string;
  }): Promise<{ data: TaskInstructionItem[]; error: string | null }> {
    if (!isSupabaseConfigured) return { data: [], error: 'Database is not configured.' };

    try {
      await ensureValidSession();

      let query = supabase
        .from('project_tasks')
        .select(`
          *,
          project:projects(id, name, project_code),
          assignee:profiles!assigned_to(id, display_name, first_name, last_name),
          creator:profiles!created_by(id, display_name, first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (params?.projectId && params.projectId !== 'all') {
        query = query.eq('project_id', params.projectId);
      }
      if (params?.assignedTo) {
        query = query.eq('assigned_to', params.assignedTo);
      }
      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[TaskInstructionsService] Query project_tasks error:', error.message);
        return { data: [], error: error.message };
      }

      let items = (data || []).map(mapRowToTaskInstruction);

      if (params?.search && params.search.trim()) {
        const term = params.search.trim().toLowerCase();
        items = items.filter(
          (t) =>
            t.title.toLowerCase().includes(term) ||
            (t.description && t.description.toLowerCase().includes(term)) ||
            (t.deliverable && t.deliverable.toLowerCase().includes(term))
        );
      }

      return { data: items, error: null };
    } catch (err: any) {
      console.error('[TaskInstructionsService] getTasks error:', err);
      return { data: [], error: err.message || 'Failed to query task instructions.' };
    }
  }

  /**
   * Creates a new task instruction adhering strictly to the live database schema
   * while preserving all comprehensive technical & safety specifications
   */
  static async createTask(input: CreateTaskInstructionInput): Promise<{
    data: TaskInstructionItem | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) return { data: null, error: 'Database is not configured.' };

    try {
      const { session } = await ensureValidSession();

      if (!input.title?.trim()) {
        return { data: null, error: 'Task title is required.' };
      }
      if (!input.project_id) {
        return { data: null, error: 'A valid project must be selected.' };
      }

      const meta: TaskInstructionMetadata = {
        deliverable: input.deliverable?.trim() || null,
        required_materials: input.required_materials?.trim() || null,
        required_tools: input.required_tools?.trim() || null,
        required_ppe: input.required_ppe?.trim() || null,
        technical_specifications: input.technical_specifications?.trim() || null,
        quality_standards: input.quality_standards?.trim() || null,
        safety_instructions: input.safety_instructions?.trim() || null,
        completion_evidence_required: input.completion_evidence_required?.trim() || null,
        acknowledgement_status: 'unacknowledged',
        verification_status: 'pending_review',
        issued_by: session?.user?.id || null,
        start_date: input.start_date || null,
        parent_task_id: input.parent_task_id || null,
      };

      const packedDescription = packTaskDescription(input.description, meta);

      // Build payload strictly adhering to verified columns of project_tasks
      const payload: Record<string, any> = {
        project_id: input.project_id,
        title: input.title.trim(),
        description: packedDescription,
        priority: normalizeTaskPriority(input.priority),
        status: 'todo',
        due_date: input.due_date || null,
        created_by: session?.user?.id || null,
      };

      if (input.assigned_to) {
        payload.assigned_to = input.assigned_to;
      }

      const { data, error } = await supabase
        .from('project_tasks')
        .insert(payload)
        .select(`
          *,
          project:projects(id, name, project_code),
          assignee:profiles!assigned_to(id, display_name, first_name, last_name),
          creator:profiles!created_by(id, display_name, first_name, last_name)
        `)
        .single();

      if (error) {
        console.error('[TaskInstructionsService] createTask database error:', error);
        throw error;
      }

      await AuditLogger.log({
        action: 'tasks.instruction_issued',
        module: 'project_tasks',
        tableName: 'project_tasks',
        recordId: data.id,
        newValues: {
          title: data.title,
          project_id: data.project_id,
          assigned_to: data.assigned_to,
        },
      });

      return { data: mapRowToTaskInstruction(data), error: null };
    } catch (err: any) {
      console.error('[TaskInstructionsService] createTask error:', err);
      return { data: null, error: err.message || 'Failed to create task instructions.' };
    }
  }

  /**
   * Acknowledges task receipt or requests clarification
   */
  static async acknowledgeTask(params: {
    taskId: string;
    status: 'acknowledged' | 'clarification_requested';
    clarificationNotes?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      await ensureValidSession();

      // Read current task description to update instruction metadata safely
      const { data: currentTask, error: fetchErr } = await supabase
        .from('project_tasks')
        .select('id, description')
        .eq('id', params.taskId)
        .single();

      if (fetchErr) throw fetchErr;

      const { cleanDescription, meta } = unpackTaskDescription(currentTask.description);
      meta.acknowledgement_status = params.status;
      meta.acknowledged_at = new Date().toISOString();
      if (params.clarificationNotes) {
        meta.clarification_notes = params.clarificationNotes;
      }

      const updatedDescription = packTaskDescription(cleanDescription, meta);

      const { error: updateErr } = await supabase
        .from('project_tasks')
        .update({
          description: updatedDescription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.taskId);

      if (updateErr) throw updateErr;

      await AuditLogger.log({
        action: 'tasks.task_acknowledged',
        module: 'project_tasks',
        tableName: 'project_tasks',
        recordId: params.taskId,
        newValues: {
          acknowledgement_status: params.status,
          clarification_notes: params.clarificationNotes,
        },
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update task acknowledgement.' };
    }
  }

  /**
   * Reviewer verifies, rejects, or returns task for correction
   */
  static async reviewTask(params: {
    taskId: string;
    verificationStatus: TaskVerificationStatus;
    reviewNotes?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Database is not configured.' };

    try {
      const { session } = await ensureValidSession();
      const isVerified = params.verificationStatus === 'verified';

      // Read current task description to update verification metadata safely
      const { data: currentTask, error: fetchErr } = await supabase
        .from('project_tasks')
        .select('id, description')
        .eq('id', params.taskId)
        .single();

      if (fetchErr) throw fetchErr;

      const { cleanDescription, meta } = unpackTaskDescription(currentTask.description);
      meta.verification_status = params.verificationStatus;
      meta.reviewer_id = session?.user?.id || null;
      meta.reviewed_at = new Date().toISOString();
      if (params.reviewNotes) {
        meta.review_notes = params.reviewNotes;
      }

      const updatedDescription = packTaskDescription(cleanDescription, meta);

      const updates: Record<string, any> = {
        description: updatedDescription,
        status: isVerified
          ? 'completed'
          : params.verificationStatus === 'returned_for_correction'
          ? 'in_progress'
          : 'blocked',
        updated_at: new Date().toISOString(),
      };

      if (isVerified) {
        updates.completed_at = new Date().toISOString();
      }

      const { error: updateErr } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('id', params.taskId);

      if (updateErr) throw updateErr;

      await AuditLogger.log({
        action: 'tasks.task_reviewed',
        module: 'project_tasks',
        tableName: 'project_tasks',
        recordId: params.taskId,
        newValues: {
          verification_status: params.verificationStatus,
          review_notes: params.reviewNotes,
        },
      });

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to record task review.' };
    }
  }
}
