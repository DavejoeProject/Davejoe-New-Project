import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';

export interface RehabPaintProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  color: string | null;
  pack_size: string;
  current_stock: number;
  reorder_level: number;
  unit_cost_price: number;
  unit_selling_price: number;
  created_at: string;
  updated_at: string;
}

export interface RehabProductionRun {
  id: string;
  batch_number: string;
  product_id: string | null;
  quantity_produced: number;
  raw_materials_consumed: any[];
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  supervisor_id: string | null;
  start_date: string;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
  product?: RehabPaintProduct | null;
}

export interface RehabStockMovement {
  id: string;
  product_id: string;
  movement_type: 'production_in' | 'internal_transfer_davejoe' | 'third_party_sale' | 'stock_adjustment' | 'damaged_loss';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_id: string | null;
  destination_project_id: string | null;
  customer_name: string | null;
  unit_price: number;
  total_price: number;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  product?: RehabPaintProduct | null;
  project?: { name: string } | null;
}

export class RehabGlobalService {
  /**
   * Fetch all Rehab Global paint products
   */
  static async getProducts(): Promise<RehabPaintProduct[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('rehab_paint_products')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[RehabGlobalService] Error fetching products:', err);
      return [];
    }
  }

  /**
   * Fetch paint batch production runs
   */
  static async getProductionRuns(): Promise<RehabProductionRun[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('rehab_production_runs')
        .select(`
          *,
          product:rehab_paint_products(id, name, sku, pack_size)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[RehabGlobalService] Error fetching production runs:', err);
      return [];
    }
  }

  /**
   * Fetch inventory movements: transfers to Davejoe & 3rd party sales
   */
  static async getStockMovements(): Promise<RehabStockMovement[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('rehab_stock_movements')
        .select(`
          *,
          product:rehab_paint_products(id, name, sku, pack_size),
          project:projects(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('[RehabGlobalService] Error fetching stock movements:', err);
      return [];
    }
  }

  /**
   * Record paint production run and increment finished paint inventory
   */
  static async recordProductionRun(params: {
    productId: string;
    batchNumber: string;
    quantityProduced: number;
    rawMaterials?: any[];
    notes?: string;
  }): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Get product current stock
      const { data: product, error: pErr } = await supabase
        .from('rehab_paint_products')
        .select('*')
        .eq('id', params.productId)
        .single();

      if (pErr) throw pErr;

      const prevStock = Number(product.current_stock || 0);
      const newStock = prevStock + Number(params.quantityProduced);

      // 2. Insert production run
      const { error: runErr } = await supabase
        .from('rehab_production_runs')
        .insert({
          batch_number: params.batchNumber,
          product_id: params.productId,
          quantity_produced: params.quantityProduced,
          raw_materials_consumed: params.rawMaterials || [],
          status: 'completed',
          notes: params.notes || null,
        });

      if (runErr) throw runErr;

      // 3. Insert stock movement (production_in)
      const { error: movErr } = await supabase
        .from('rehab_stock_movements')
        .insert({
          product_id: params.productId,
          movement_type: 'production_in',
          quantity: params.quantityProduced,
          previous_stock: prevStock,
          new_stock: newStock,
          reference_id: params.batchNumber,
          notes: params.notes || 'Batch production output',
        });

      if (movErr) throw movErr;

      // 4. Update product current stock
      await supabase
        .from('rehab_paint_products')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.productId);

      await AuditLogger.log({
        action: 'rehab.production_recorded',
        module: 'rehab_global',
        tableName: 'rehab_production_runs',
        recordId: params.batchNumber,
        newValues: {
          product_id: params.productId,
          quantity: params.quantityProduced,
          new_stock: newStock,
        },
      });
    } catch (err) {
      console.error('[RehabGlobalService] Error recording production:', err);
      throw err;
    }
  }

  /**
   * Record stock movement: internal transfer to Davejoe project or third party sale
   */
  static async recordStockMovement(params: {
    productId: string;
    movementType: 'internal_transfer_davejoe' | 'third_party_sale' | 'stock_adjustment' | 'damaged_loss';
    quantity: number;
    destinationProjectId?: string;
    customerName?: string;
    unitPrice?: number;
    notes?: string;
  }): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const { data: product, error: pErr } = await supabase
        .from('rehab_paint_products')
        .select('*')
        .eq('id', params.productId)
        .single();

      if (pErr) throw pErr;

      const prevStock = Number(product.current_stock || 0);
      const isDeduction = ['internal_transfer_davejoe', 'third_party_sale', 'damaged_loss'].includes(params.movementType);
      const qtyChange = isDeduction ? -Math.abs(params.quantity) : Math.abs(params.quantity);
      const newStock = Math.max(0, prevStock + qtyChange);

      const unitPrice = params.unitPrice != null ? params.unitPrice : Number(product.unit_selling_price || 0);
      const totalPrice = unitPrice * Math.abs(params.quantity);

      const { error: movErr } = await supabase
        .from('rehab_stock_movements')
        .insert({
          product_id: params.productId,
          movement_type: params.movementType,
          quantity: qtyChange,
          previous_stock: prevStock,
          new_stock: newStock,
          destination_project_id: params.destinationProjectId || null,
          customer_name: params.customerName || null,
          unit_price: unitPrice,
          total_price: totalPrice,
          notes: params.notes || null,
        });

      if (movErr) throw movErr;

      // Update current stock
      await supabase
        .from('rehab_paint_products')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.productId);

      await AuditLogger.log({
        action: `rehab.${params.movementType}`,
        module: 'rehab_global',
        tableName: 'rehab_stock_movements',
        recordId: params.productId,
        newValues: {
          movement_type: params.movementType,
          quantity: qtyChange,
          previous_stock: prevStock,
          new_stock: newStock,
          total_price: totalPrice,
        },
      });
    } catch (err) {
      console.error('[RehabGlobalService] Error recording stock movement:', err);
      throw err;
    }
  }
}
