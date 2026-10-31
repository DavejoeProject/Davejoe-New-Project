import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { AuditLogger } from '../lib/audit';
import { normalizeMaterialCategory } from './materialsService';

export type RemnantCondition = 'good' | 'fair' | 'spoiled' | 'damaged' | 'contaminated' | 'scrap';
export type RemnantVerificationStatus = 'draft' | 'pending_verification' | 'verified' | 'disputed' | 'closed';

export interface RemnantPackedMetadata {
  material_name?: string;
  category?: string;
  unit_of_measure?: string;
  quantity_delivered?: number;
  quantity_consumed?: number;
  quantity_remaining?: number;
  quantity_returned_to_stock?: number;
  quantity_retained_on_site?: number;
  quantity_transferred?: number;
  quantity_damaged?: number;
  verification_status?: RemnantVerificationStatus;
  reviewer_comments?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  destination_location?: string | null;
}

const REMNANT_META_START = '<!-- DAVEJOE_REMNANT_META:';
const REMNANT_META_END = ':DAVEJOE_REMNANT_META -->';

export function packRemnantNotes(
  userNotes: string | null | undefined,
  meta: RemnantPackedMetadata
): string {
  const cleanNotes = (userNotes || '')
    .replace(new RegExp(`${REMNANT_META_START}[\\s\\S]*?${REMNANT_META_END}`, 'g'), '')
    .trim();
  const metaJson = JSON.stringify(meta);
  return cleanNotes
    ? `${cleanNotes}\n\n${REMNANT_META_START}${metaJson}${REMNANT_META_END}`
    : `${REMNANT_META_START}${metaJson}${REMNANT_META_END}`;
}

export function unpackRemnantNotes(rawNotes: string | null | undefined): {
  cleanNotes: string;
  meta: RemnantPackedMetadata;
} {
  if (!rawNotes) {
    return { cleanNotes: '', meta: {} };
  }
  const match = rawNotes.match(
    new RegExp(`${REMNANT_META_START}([\\s\\S]*?)${REMNANT_META_END}`)
  );
  if (!match) {
    return { cleanNotes: rawNotes, meta: {} };
  }
  let meta: RemnantPackedMetadata = {};
  try {
    meta = JSON.parse(match[1]);
  } catch (e) {
    console.warn('[RemnantsService] Failed to parse embedded remnant metadata', e);
  }
  const cleanNotes = rawNotes.replace(match[0], '').trim();
  return { cleanNotes, meta };
}

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
        // Fallback: If project_material_remnants is not yet active, query material_returns
        let returnsQuery = supabase
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
            project:projects(id, name, project_code),
            releaser_profile:profiles!returned_by(display_name, first_name, last_name),
            receiver_profile:profiles!received_by(display_name, first_name, last_name)
          `)
          .order('created_at', { ascending: false });

        if (params?.projectId && params.projectId !== 'all') {
          returnsQuery = returnsQuery.eq('project_id', params.projectId);
        }

        const { data: returnsData, error: retErr } = await returnsQuery;

        if (retErr) {
          console.error('[RemnantsService] Error querying material_returns:', retErr);
          return { data: [], error: retErr.message };
        }

        if (returnsData && returnsData.length > 0) {
          const mapped: ProjectMaterialRemnantItem[] = returnsData.map((r: any) => {
            const { cleanNotes, meta } = unpackRemnantNotes(r.notes);

            const qReturned = Number(r.quantity_returned) || 0;
            const qDelivered = meta.quantity_delivered ?? qReturned;
            const qConsumed = meta.quantity_consumed ?? 0;
            const qRemaining = meta.quantity_remaining ?? qReturned;
            const qReturnedStock = meta.quantity_returned_to_stock ?? qReturned;
            const qRetained = meta.quantity_retained_on_site ?? 0;
            const qTransferred = meta.quantity_transferred ?? 0;
            const qDamaged = meta.quantity_damaged ?? 0;

            return {
              id: r.id,
              project_id: r.project_id,
              material_id: r.material_id,
              material_name: meta.material_name || r.material?.name || 'Site Material',
              category: meta.category || r.material?.category || 'General',
              unit_of_measure: meta.unit_of_measure || r.material?.unit_of_measure || 'units',
              quantity_delivered: qDelivered,
              quantity_consumed: qConsumed,
              quantity_remaining: qRemaining,
              quantity_returned_to_stock: qReturnedStock,
              quantity_retained_on_site: qRetained,
              quantity_transferred: qTransferred,
              quantity_damaged: qDamaged,
              condition: (r.condition?.toLowerCase() as RemnantCondition) || 'good',
              recorded_by: r.returned_by,
              released_by: r.returned_by,
              received_by: r.received_by,
              handover_timestamp: r.return_date || r.created_at,
              destination_location: meta.destination_location || r.destination || 'Central Store',
              verification_status: meta.verification_status || 'verified',
              notes: cleanNotes || null,
              reviewer_comments: meta.reviewer_comments || null,
              reviewed_by: meta.reviewed_by || null,
              reviewed_at: meta.reviewed_at || null,
              created_at: r.created_at,
              project: r.project,
              releaser_profile: r.releaser_profile,
              receiver_profile: r.receiver_profile,
            };
          });

          let filtered = mapped;
          if (params?.status && params.status !== 'all') {
            filtered = filtered.filter((item) => item.verification_status === params.status);
          }
          if (params?.search && params.search.trim()) {
            const s = params.search.trim().toLowerCase();
            filtered = filtered.filter(
              (item) =>
                item.material_name.toLowerCase().includes(s) ||
                (item.destination_location || '').toLowerCase().includes(s) ||
                (item.notes || '').toLowerCase().includes(s)
            );
          }

          return { data: filtered, error: null };
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

      // 1. Resolve or auto-link a valid material_id
      let resolvedMaterialId = input.material_id;

      if (!resolvedMaterialId) {
        // A. Match material in public.materials by name
        const { data: matchedMaterial } = await supabase
          .from('materials')
          .select('id, name')
          .ilike('name', input.material_name.trim())
          .limit(1)
          .maybeSingle();

        if (matchedMaterial?.id) {
          resolvedMaterialId = matchedMaterial.id;
        } else {
          // B. Attempt to register a catalog item for this remnant material
          const codeSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
          const cleanCode = `MAT-REM-${codeSuffix}`;
          const normalizedCategory = normalizeMaterialCategory(input.category);

          const { data: newMat } = await supabase
            .from('materials')
            .insert({
              material_code: cleanCode,
              name: input.material_name.trim(),
              category: normalizedCategory,
              unit_of_measure: input.unit_of_measure?.trim() || 'units',
              current_stock: 0,
              reorder_level: 0,
              standard_unit_cost: 0,
              status: 'active',
              notes: 'Auto-registered from Site Remnants and Returns',
              created_by: session.user.id,
            })
            .select('id')
            .maybeSingle();

          if (newMat?.id) {
            resolvedMaterialId = newMat.id;
          } else {
            // C. Fallback: query any existing material record
            const { data: anyMat } = await supabase
              .from('materials')
              .select('id')
              .limit(1)
              .maybeSingle();
            if (anyMat?.id) {
              resolvedMaterialId = anyMat.id;
            }
          }
        }
      }

      // 2. Prepare payload for project_material_remnants
      const payload = {
        project_id: input.project_id,
        material_id: resolvedMaterialId || null,
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
        // Fallback to material_returns if project_material_remnants table is not yet migrated
        console.warn('[RemnantsService] project_material_remnants fallback to material_returns:', error.message);

        // Ensure we have a valid material_id because material_returns has a NOT NULL constraint on material_id
        if (!resolvedMaterialId) {
          return {
            data: null,
            error:
              'A catalog material is required for return logging. Please select or register a material in the catalog first.',
          };
        }

        const meta: RemnantPackedMetadata = {
          material_name: input.material_name.trim(),
          category: input.category || 'General',
          unit_of_measure: input.unit_of_measure,
          quantity_delivered: Number(input.quantity_delivered) || 0,
          quantity_consumed: Number(input.quantity_consumed) || 0,
          quantity_remaining: Number(input.quantity_remaining) || 0,
          quantity_returned_to_stock: Number(input.quantity_returned_to_stock) || 0,
          quantity_retained_on_site: Number(input.quantity_retained_on_site) || 0,
          quantity_transferred: Number(input.quantity_transferred) || 0,
          quantity_damaged: Number(input.quantity_damaged) || 0,
          destination_location: input.destination_location?.trim() || 'Central Store',
          verification_status: 'pending_verification',
        };

        const packedNotes = packRemnantNotes(input.notes, meta);

        const { data: retData, error: retErr } = await supabase
          .from('material_returns')
          .insert({
            project_id: input.project_id,
            material_id: resolvedMaterialId,
            quantity_returned:
              Number(input.quantity_returned_to_stock) || Number(input.quantity_remaining) || 0,
            returned_by: input.released_by || session.user.id,
            received_by: input.received_by || null,
            return_date: new Date().toISOString().split('T')[0],
            condition: input.condition || 'good',
            destination: input.destination_location?.trim() || 'Central Store',
            notes: packedNotes,
          })
          .select(`
            *,
            project:projects(id, name, project_code),
            material:materials(name, category, unit_of_measure)
          `)
          .single();

        if (retErr) throw retErr;

        return {
          data: {
            id: retData.id,
            project_id: retData.project_id,
            material_id: retData.material_id,
            material_name: input.material_name.trim(),
            category: input.category || 'General',
            unit_of_measure: input.unit_of_measure,
            quantity_delivered: Number(input.quantity_delivered) || 0,
            quantity_consumed: Number(input.quantity_consumed) || 0,
            quantity_remaining: Number(input.quantity_remaining) || 0,
            quantity_returned_to_stock: Number(retData.quantity_returned) || 0,
            quantity_retained_on_site: Number(input.quantity_retained_on_site) || 0,
            quantity_transferred: Number(input.quantity_transferred) || 0,
            quantity_damaged: Number(input.quantity_damaged) || 0,
            condition: (retData.condition?.toLowerCase() as RemnantCondition) || 'good',
            handover_timestamp: retData.return_date || new Date().toISOString(),
            destination_location: retData.destination,
            verification_status: 'pending_verification',
            notes: input.notes?.trim() || null,
            created_at: retData.created_at,
            project: retData.project,
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

      // Check material_returns first if project_material_remnants does not exist
      const { data: currentReturn } = await supabase
        .from('material_returns')
        .select('id, notes')
        .eq('id', params.remnantId)
        .maybeSingle();

      if (currentReturn) {
        const { cleanNotes, meta } = unpackRemnantNotes(currentReturn.notes);
        meta.verification_status = params.status;
        meta.reviewer_comments = params.reviewerComments || null;
        meta.reviewed_by = session.user.id;
        meta.reviewed_at = new Date().toISOString();

        const updatedNotes = packRemnantNotes(cleanNotes, meta);

        const { error: updErr } = await supabase
          .from('material_returns')
          .update({ notes: updatedNotes })
          .eq('id', params.remnantId);

        if (updErr) throw updErr;

        await AuditLogger.log({
          action: 'materials.remnant_status_updated',
          module: 'materials',
          tableName: 'material_returns',
          recordId: params.remnantId,
          newValues: { status: params.status, comments: params.reviewerComments },
        });

        return { success: true, error: null };
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
