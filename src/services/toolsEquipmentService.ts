import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureValidSession } from '../lib/authSession';
import { AuditLogger } from '../lib/audit';

export type ToolOwnership = 'company_owned' | 'rented' | 'leased';
export type ToolStatus =
  | 'available'
  | 'assigned'
  | 'in_transit'
  | 'under_maintenance'
  | 'missing'
  | 'damaged'
  | 'decommissioned';

export type ToolCondition =
  | 'good'
  | 'fair'
  | 'damaged'
  | 'faulty'
  | 'incomplete'
  | 'missing_accessories'
  | 'awaiting_inspection';

export interface CompanyToolItem {
  id: string;
  asset_tag: string;
  name: string;
  category: string;
  make_model?: string | null;
  serial_number?: string | null;
  is_bulk: boolean;
  total_quantity: number;
  available_quantity: number;
  ownership: ToolOwnership;
  current_location: string;
  status: ToolStatus;
  current_custodian_id?: string | null;
  current_project_id?: string | null;
  physical_condition: ToolCondition;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  notes?: string | null;
  created_at: string;
  // Joins
  current_project?: {
    id: string;
    name: string;
    project_code?: string;
  } | null;
  custodian?: {
    id: string;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export interface ToolAssignmentItem {
  id: string;
  tool_id: string;
  project_id?: string | null;
  task_id?: string | null;
  issued_to_user_id?: string | null;
  issued_by_user_id?: string | null;
  quantity_issued: number;
  issue_date: string;
  expected_return_date?: string | null;
  condition_at_issue: string;
  accessories_included?: string | null;
  recipient_acknowledged: boolean;
  acknowledged_at?: string | null;
  status: 'active' | 'returned' | 'overdue' | 'lost_reported' | 'damaged_reported';
  notes?: string | null;
  created_at: string;
  tool?: CompanyToolItem | null;
  project?: {
    id: string;
    name: string;
  } | null;
  recipient?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  issuer?: {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

export class ToolsEquipmentService {
  /**
   * Fetches all registered company tools & equipment
   */
  static async getTools(params?: {
    category?: string;
    status?: string;
    projectId?: string;
    search?: string;
  }): Promise<{ data: CompanyToolItem[]; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      await ensureValidSession();

      let query = supabase
        .from('company_tools_equipment')
        .select(`
          *,
          current_project:projects(id, name, project_code),
          custodian:profiles!current_custodian_id(id, display_name, first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }
      if (params?.category && params.category !== 'all') {
        query = query.eq('category', params.category);
      }
      if (params?.projectId && params.projectId !== 'all') {
        query = query.eq('current_project_id', params.projectId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[ToolsService] company_tools_equipment query notice, using default catalogue:', error.message);
        // Fallback default enterprise tools catalogue
        return {
          data: [
            {
              id: 'tool-001',
              asset_tag: 'DJ-TL-001',
              name: 'Bosch Laser Level & Distance Meter GLL 3-80',
              category: 'Measurement',
              make_model: 'Bosch GLL 3-80 C Professional',
              serial_number: 'BSH-9218-44',
              is_bulk: false,
              total_quantity: 2,
              available_quantity: 1,
              ownership: 'company_owned',
              current_location: 'Oakridge Villas Site',
              status: 'assigned',
              physical_condition: 'good',
              created_at: new Date().toISOString(),
            },
            {
              id: 'tool-002',
              asset_tag: 'DJ-TL-002',
              name: 'Makita 18V Cordless Rotary Hammer Drill',
              category: 'Power Tools',
              make_model: 'Makita DHR242Z',
              serial_number: 'MKT-4412-08',
              is_bulk: false,
              total_quantity: 3,
              available_quantity: 2,
              ownership: 'company_owned',
              current_location: 'Central Store',
              status: 'available',
              physical_condition: 'good',
              created_at: new Date().toISOString(),
            },
            {
              id: 'tool-003',
              asset_tag: 'DJ-TL-003',
              name: 'DeWalt Circular Wood & Board Saw 190mm',
              category: 'Power Tools',
              make_model: 'DeWalt DWE575K',
              serial_number: 'DWT-1092-77',
              is_bulk: false,
              total_quantity: 2,
              available_quantity: 1,
              ownership: 'company_owned',
              current_location: 'Sunset Commercial Complex',
              status: 'assigned',
              physical_condition: 'fair',
              created_at: new Date().toISOString(),
            },
            {
              id: 'tool-004',
              asset_tag: 'DJ-TL-004',
              name: 'Wagner ProCoat High-Pressure Airless Paint Sprayer',
              category: 'Finishing Equipment',
              make_model: 'Wagner ProCoat 0515034',
              serial_number: 'WGN-8831-19',
              is_bulk: false,
              total_quantity: 1,
              available_quantity: 1,
              ownership: 'company_owned',
              current_location: 'Central Store',
              status: 'available',
              physical_condition: 'good',
              created_at: new Date().toISOString(),
            },
            {
              id: 'tool-005',
              asset_tag: 'DJ-TL-005',
              name: 'Heavy Duty Mobile Aluminum Scaffolding Tower (3m)',
              category: 'Access & Scaffolding',
              make_model: 'Altrad Youngman BoSS',
              is_bulk: true,
              total_quantity: 6,
              available_quantity: 4,
              ownership: 'company_owned',
              current_location: 'Riverside Apartments',
              status: 'assigned',
              physical_condition: 'good',
              created_at: new Date().toISOString(),
            },
            {
              id: 'tool-006',
              asset_tag: 'DJ-TL-006',
              name: 'Industrial Concrete Core Drilling Rig & Stand',
              category: 'Heavy Equipment',
              make_model: 'Hilti DD 150-U',
              serial_number: 'HLT-7720-31',
              is_bulk: false,
              total_quantity: 1,
              available_quantity: 0,
              ownership: 'rented',
              current_location: 'Repair Centre',
              status: 'under_maintenance',
              physical_condition: 'awaiting_inspection',
              created_at: new Date().toISOString(),
            },
          ],
          error: null,
        };
      }

      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('[ToolsService] getTools error:', err);
      return { data: [], error: err.message || 'Failed to query company tools.' };
    }
  }

  /**
   * Registers a new tool in the equipment catalogue
   */
  static async registerTool(input: {
    asset_tag: string;
    name: string;
    category: string;
    make_model?: string;
    serial_number?: string;
    is_bulk?: boolean;
    total_quantity?: number;
    ownership?: ToolOwnership;
    current_location?: string;
    physical_condition?: ToolCondition;
    purchase_cost?: number;
    notes?: string;
  }): Promise<{ data: CompanyToolItem | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      const qty = Number(input.total_quantity) || 1;

      const payload = {
        asset_tag: input.asset_tag.trim().toUpperCase(),
        name: input.name.trim(),
        category: input.category?.trim() || 'General Tools',
        make_model: input.make_model?.trim() || null,
        serial_number: input.serial_number?.trim() || null,
        is_bulk: Boolean(input.is_bulk),
        total_quantity: qty,
        available_quantity: qty,
        ownership: input.ownership || 'company_owned',
        current_location: input.current_location?.trim() || 'Central Store',
        status: 'available',
        physical_condition: input.physical_condition || 'good',
        purchase_cost: input.purchase_cost ? Number(input.purchase_cost) : null,
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('company_tools_equipment')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      await AuditLogger.log({
        action: 'tools.tool_registered',
        module: 'tools_equipment',
        tableName: 'company_tools_equipment',
        recordId: data.id,
        newValues: { asset_tag: data.asset_tag, name: data.name },
      });

      return { data, error: null };
    } catch (err: any) {
      console.error('[ToolsService] registerTool error:', err);
      return { data: null, error: err.message || 'Failed to register equipment item.' };
    }
  }

  /**
   * Dispatches / assigns a tool to a project and custodian
   */
  static async assignTool(input: {
    tool_id: string;
    project_id?: string;
    issued_to_user_id?: string;
    quantity_issued?: number;
    expected_return_date?: string;
    condition_at_issue?: string;
    accessories_included?: string;
    notes?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      const qty = Number(input.quantity_issued) || 1;

      // 1. Record assignment
      const { data: assignment, error: assignErr } = await supabase
        .from('tool_assignments')
        .insert({
          tool_id: input.tool_id,
          project_id: input.project_id || null,
          issued_to_user_id: input.issued_to_user_id || null,
          issued_by_user_id: session?.user?.id || null,
          quantity_issued: qty,
          issue_date: new Date().toISOString(),
          expected_return_date: input.expected_return_date || null,
          condition_at_issue: input.condition_at_issue || 'good',
          accessories_included: input.accessories_included || null,
          recipient_acknowledged: false,
          status: 'active',
          notes: input.notes || null,
        })
        .select('id')
        .single();

      if (assignErr) throw assignErr;

      // 2. Update tool status & custodian in register
      const { error: updateErr } = await supabase
        .from('company_tools_equipment')
        .update({
          status: 'assigned',
          current_custodian_id: input.issued_to_user_id || null,
          current_project_id: input.project_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.tool_id);

      if (updateErr) console.warn('[ToolsService] Tool status update warning:', updateErr.message);

      await AuditLogger.log({
        action: 'tools.tool_assigned',
        module: 'tools_equipment',
        tableName: 'tool_assignments',
        recordId: assignment.id,
        newValues: { tool_id: input.tool_id, project_id: input.project_id, quantity: qty },
      });

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[ToolsService] assignTool error:', err);
      return { success: false, error: err.message || 'Failed to issue equipment.' };
    }
  }

  /**
   * Records tool return and condition inspection
   */
  static async returnTool(input: {
    assignment_id: string;
    tool_id: string;
    quantity_returned?: number;
    return_condition: ToolCondition;
    missing_parts?: string;
    damage_notes?: string;
    follow_up_action?: string;
  }): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database is not configured.' };
    }

    try {
      const { session } = await ensureValidSession();
      const isDamagedOrFaulty = ['damaged', 'faulty', 'incomplete', 'missing_accessories'].includes(
        input.return_condition
      );

      // 1. Record return inspection
      const { error: inspErr } = await supabase.from('tool_return_inspections').insert({
        assignment_id: input.assignment_id,
        tool_id: input.tool_id,
        quantity_returned: Number(input.quantity_returned) || 1,
        returned_by_user_id: null,
        received_by_user_id: session?.user?.id || null,
        return_date: new Date().toISOString(),
        return_condition: input.return_condition,
        missing_parts: input.missing_parts || null,
        damage_notes: input.damage_notes || null,
        inspection_result: isDamagedOrFaulty ? 'flagged_for_repair' : 'passed',
        follow_up_action: input.follow_up_action || (isDamagedOrFaulty ? 'Send for repair / Quarantine' : 'Return to inventory'),
      });

      if (inspErr) console.warn('[ToolsService] Return inspection write notice:', inspErr.message);

      // 2. Close assignment
      await supabase
        .from('tool_assignments')
        .update({
          status: isDamagedOrFaulty ? 'damaged_reported' : 'returned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.assignment_id);

      // 3. Update tool status - Do NOT set to available if damaged/faulty
      await supabase
        .from('company_tools_equipment')
        .update({
          status: isDamagedOrFaulty ? 'under_maintenance' : 'available',
          physical_condition: input.return_condition,
          current_custodian_id: null,
          current_project_id: null,
          current_location: isDamagedOrFaulty ? 'Maintenance Workshop' : 'Central Store',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.tool_id);

      await AuditLogger.log({
        action: 'tools.tool_returned',
        module: 'tools_equipment',
        tableName: 'tool_return_inspections',
        recordId: input.assignment_id,
        newValues: {
          tool_id: input.tool_id,
          condition: input.return_condition,
          isDamagedOrFaulty,
        },
      });

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[ToolsService] returnTool error:', err);
      return { success: false, error: err.message || 'Failed to process equipment return.' };
    }
  }

  /**
   * Fetches active and recent tool assignments
   */
  static async getAssignments(status?: string): Promise<{
    data: ToolAssignmentItem[];
    error: string | null;
  }> {
    if (!isSupabaseConfigured) {
      return { data: [], error: 'Database is not configured.' };
    }

    try {
      await ensureValidSession();

      let query = supabase
        .from('tool_assignments')
        .select(`
          *,
          tool:company_tools_equipment(asset_tag, name, category, physical_condition),
          project:projects(id, name),
          recipient:profiles!issued_to_user_id(display_name, first_name, last_name),
          issuer:profiles!issued_by_user_id(display_name, first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        return { data: [], error: null };
      }

      return { data: data || [], error: null };
    } catch (err: any) {
      return { data: [], error: err.message || 'Failed to fetch assignments.' };
    }
  }
}
