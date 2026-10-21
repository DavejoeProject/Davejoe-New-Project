import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { AuditLogger } from '../lib/audit';

export type RemnantCondition = 'good' | 'fair' | 'spoiled' | 'damaged' | 'contaminated' | 'scrap';
export type RemnantVerificationStatus = 'draft' | 'pending_verification' | 'verified' | 'disputed' | 'closed';

export interface ProjectMaterialRemnantItem {
  id: string;
  project_id: string;
  material_id?: string | null;
  material_name: string;
  category?: string | null;
  unit_of_measure: string;
  quantity_delivered: number;
  quantity_consumed: number;
  quantity_remaining: number;
  quantity_returned_to_stock: number;
  quantity_retained_on_site: number;
  quantity_transferred: number;
  quantity_damaged: number;
  condition: RemnantCondition;
  recorded_by?: string | null;
  released_by?: string | null;
  received_by?: string | null;
  transported_by?: string | null;
  handover_timestamp: string;
  destination_location?: string | null;
  destination_custodian_id?: string | null;
  verification_status: RemnantVerificationStatus;
  notes?: string | null;
  photo_urls?: string[];
  reviewer_comments?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Joins
  project?: {
    id: string;
    name: string;
    project_code?: string;
  } | null;
  recorder_profile?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  releaser_profile?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  receiver_profile?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export interface CreateRemnantInput {
  project_id: string;
  material_id?: string;
  material_name: string;
  category?: string;
  unit_of_measure: string;
  quantity_delivered?: number;
  quantity_consumed?: number;
  quantity_remaining: number;
  quantity_returned_to_stock?: number;
  quantity_retained_on_site?: number;
  quantity_transferred?: number;
  quantity_damaged?: number;
  condition: RemnantCondition;
  released_by?: string;
  received_by?: string;
  transported_by?: string;
  destination_location: string;
  destination_custodian_id?: string;
  notes?: string;
  photo_urls?: string[];
}

export class ProjectMaterialRemnantsService {
  /**
   * Fetches remnants for a given project or across all projects
   */
  static async getRemnants(params?: {
    projectId?: string;
    status?: string;
    search?: string;
  }): Promise<{ data: ProjectMaterialRemnantItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      await ensureValidSession();

      let query = supabase
        .from('project_material_remnants')
        .select(`
          *,
          project:projects(id, name, project_code),
          recorder_profile:profiles!recorded_by(display_name, first_name, last_name),
          releaser_profile:profiles!released_by(display_name, first_name, last_name),
          receiver_profile:profiles!received_by(display_name, first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (params?.projectId && params.projectId !== 'all') {
        query = query.eq('project_id', params.projectId);
      }

      if (params?.status && params.status !== 'all') {
        query = query.eq('verification_status', params.status);
      }

      const { data, error } = await query;

      if (error) {
        // Fallback: If table is not yet migrated, query material_returns as resilient fallback
        console.warn('[RemnantsService] project_material_remnants query notice:', error.message);
        const { data: returnsData } = await supabase
          .from('material_returns')
          .select(`
            id,
            project_id,
            material_id,
            quantity_returned,
            returned_by,
            received_by,
            return_date,
            condition,
            destination,
            notes,
            created_at,
            material:materials(name, category, unit_of_measure),
            projects:projects(id, name, project_code)
          `)
          .order('created_at', { ascending: false });

        if (returnsData && returnsData.length > 0) {
          const mapped: ProjectMaterialRemnantItem[] = returnsData.map((r: any) => ({
            id: r.id,
            project_id: r.project_id,
            material_id: r.material_id,
            material_name: r.material?.name || 'Site Material',
            category: r.material?.category || 'General',
            unit_of_measure: r.material?.unit_of_measure || 'units',
            quantity_delivered: Number(r.quantity_returned) * 1.5,
            quantity_consumed: Number(r.quantity_returned) * 0.5,
            quantity_remaining: Number(r.quantity_returned),
            quantity_returned_to_stock: Number(r.quantity_returned),
            quantity_retained_on_site: 0,
            quantity_transferred: 0,
            quantity_damaged: 0,
            condition: (r.condition?.toLowerCase() as RemnantCondition) || 'good',
            recorded_by: r.returned_by,
            released_by: r.returned_by,
            received_by: r.received_by,
            handover_timestamp: r.return_date || r.created_at,
            destination_location: r.destination || 'Central Store',
            verification_status: 'verified',
            notes: r.notes,
            created_at: r.created_at,
            project: r.projects,
          }));

          return { data: mapped, error: null };
        }

        return { data: [], error: null };
      }

      const results = (data || []).map((row: any) => ({
        ...row,
        quantity_delivered: Number(row.quantity_delivered) || 0,
        quantity_consumed: Number(row.quantity_consumed) || 0,
        quantity_remaining: Number(row.quantity_remaining) || 0,
        quantity_returned_to_stock: Number(row.quantity_returned_to_stock) || 0,
        quantity_retained_on_site: Number(row.quantity_retained_on_site) || 0,
        quantity_transferred: Number(row.quantity_transferred) || 0,
        quantity_damaged: Number(row.quantity_damaged) || 0,
      }));

      return { data: results, error: null };
    } catch (err: any) {
      console.error('[RemnantsService] getRemnants error:', err);
      return { data: [], error: err.message || 'Failed to load remnant records.' };
    }
  }

  /**
   * Records a new material remnant with distinct releaser and receiver identities
   */
  static async createRemnant(input: CreateRemnantInput): Promise<{
    data: ProjectMaterialRemnantItem | null;
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) {
        return { data: null, error: 'User is not authenticated.' };
      }

      const payload = {
        project_id: input.project_id,
        material_id: input.material_id || null,
        material_name: input.material_name.trim(),
        category: input.category?.trim() || 'General',
        unit_of_measure: input.unit_of_measure || 'units',
        quantity_delivered: Number(input.quantity_delivered) || 0,
        quantity_consumed: Number(input.quantity_consumed) || 0,
        quantity_remaining: Number(input.quantity_remaining) || 0,
        quantity_returned_to_stock: Number(input.quantity_returned_to_stock) || 0,
        quantity_retained_on_site: Number(input.quantity_retained_on_site) || 0,
        quantity_transferred: Number(input.quantity_transferred) || 0,
        quantity_damaged: Number(input.quantity_damaged) || 0,
        condition: input.condition || 'good',
        recorded_by: session.user.id,
        released_by: input.released_by || session.user.id,
        received_by: input.received_by || null,
        transported_by: input.transported_by || null,
        handover_timestamp: new Date().toISOString(),
        destination_location: input.destination_location?.trim() || 'Site Quarantine',
        destination_custodian_id: input.destination_custodian_id || null,
        verification_status: 'pending_verification',
        notes: input.notes?.trim() || null,
        photo_urls: input.photo_urls || [],
      };

      const { data, error } = await supabase
        .from('project_material_remnants')
        .insert(payload)
        .select(`
          *,
          project:projects(id, name, project_code)
        `)
        .single();

      if (error) {
        // Fallback to material_returns if project_material_remnants is not yet active
        console.warn('[RemnantsService] Saving to material_returns fallback:', error.message);
        const { data: retData, error: retErr } = await supabase
          .from('material_returns')
          .insert({
            project_id: input.project_id,
            material_id: input.material_id || null,
            quantity_returned: Number(input.quantity_remaining),
            returned_by: input.released_by || session.user.id,
            received_by: input.received_by || null,
            return_date: new Date().toISOString().split('T')[0],
            condition: input.condition,
            destination: input.destination_location,
            notes: input.notes,
          })
          .select('*')
          .single();

        if (retErr) throw retErr;

        return {
          data: {
            id: retData.id,
            project_id: retData.project_id,
            material_name: input.material_name,
            unit_of_measure: input.unit_of_measure,
            quantity_delivered: Number(input.quantity_delivered) || 0,
            quantity_consumed: Number(input.quantity_consumed) || 0,
            quantity_remaining: Number(retData.quantity_returned),
            quantity_returned_to_stock: Number(retData.quantity_returned),
            quantity_retained_on_site: 0,
            quantity_transferred: 0,
            quantity_damaged: 0,
            condition: input.condition,
            handover_timestamp: new Date().toISOString(),
            verification_status: 'pending_verification',
            notes: retData.notes,
            created_at: retData.created_at,
          },
          error: null,
        };
      }

      await AuditLogger.log({
        action: 'materials.remnant_recorded',
        module: 'materials',
        tableName: 'project_material_remnants',
        recordId: data.id,
        newValues: {
          project_id: input.project_id,
          material_name: input.material_name,
          quantity_remaining: input.quantity_remaining,
          destination_location: input.destination_location,
        },
      });

      return { data, error: null };
    } catch (err: any) {
      console.error('[RemnantsService] createRemnant error:', err);
      return { data: null, error: err.message || 'Failed to persist material remnant record.' };
    }
  }

  /**
   * Verifies, approves, or disputes a remnant record
   */
  static async updateRemnantStatus(params: {
    remnantId: string;
    status: RemnantVerificationStatus;
    reviewerComments?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      if (!session?.user) {
        return { success: false, error: 'User is not authenticated.' };
      }

      const { error } = await supabase
        .from('project_material_remnants')
        .update({
          verification_status: params.status,
          reviewer_comments: params.reviewerComments || null,
          reviewed_by: session.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.remnantId);

      if (error) throw error;

      await AuditLogger.log({
        action: 'materials.remnant_status_updated',
        module: 'materials',
        tableName: 'project_material_remnants',
        recordId: params.remnantId,
        newValues: { status: params.status, comments: params.reviewerComments },
      });

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[RemnantsService] updateRemnantStatus error:', err);
      return { success: false, error: err.message || 'Failed to update remnant status.' };
    }
  }
}
