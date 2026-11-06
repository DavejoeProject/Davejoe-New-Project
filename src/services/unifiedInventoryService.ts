import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';

export type InventoryBusinessUnit = 'davejoe' | 'rehab_global' | 'partner';
export type StockOwnership = 'davejoe_owned' | 'rehab_owned' | 'partner_owned' | 'consignment';

export interface InventoryCategoryConfig {
  id: string;
  name: string;
  iconName?: string;
  description: string;
}

export const DEFAULT_INVENTORY_CATEGORIES: InventoryCategoryConfig[] = [
  { id: 'paints', name: 'Paints & Coatings', description: 'Rehab Global emulsions, gloss, primer, and specialized coatings' },
  { id: 'tools', name: 'Tools & Equipment', description: 'Hand tools, power equipment, rollers, safety gear, and measuring devices' },
  { id: 'screeding', name: 'Screeding Materials', description: 'POP plaster, wall putty, skim coats, and smoothing compounds' },
  { id: 'diffusers', name: 'Aroma Diffusers & Fragrance', description: 'Luxury architectural aroma diffusers, fragrance oils, and reeds' },
  { id: 'flower_vases', name: 'Flower Vases & Planters', description: 'Ceramic, glass, acrylic, and metallic interior vases of all types' },
  { id: 'finishing', name: 'Interior Finishing Materials', description: 'Wallpapers, mouldings, acoustic panels, edge trimmings' },
  { id: 'building', name: 'Decorative & Building Items', description: 'Architectural accents, decorative panels, and fittings' },
  { id: 'partner_items', name: 'Partner / Vendor Products', description: 'Consignment and externally supplied partner merchandise' },
];

export interface UnifiedInventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  unit_of_measure: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  reorder_level: number;
  business_unit: InventoryBusinessUnit;
  ownership: StockOwnership;
  partner_name: string | null;
  partner_commission_pct: number;
  supplier: string | null;
  storage_location: string | null;
  image_url: string | null;
  status: 'active' | 'inactive' | 'discontinued';
  created_at: string;
  updated_at: string;
}

export interface InventoryTransactionRecord {
  id: string;
  item_id: string;
  transaction_type:
    | 'stock_in'
    | 'sale'
    | 'issue_project'
    | 'issue_workforce'
    | 'return'
    | 'internal_transfer'
    | 'adjustment'
    | 'damaged';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_price: number;
  total_price: number;
  business_unit: string;
  project_id: string | null;
  recipient_workforce_id: string | null;
  recipient_name: string | null;
  authorized_by: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  payment_status: string | null;
  payment_method: string | null;
  reference_code: string | null;
  notes: string | null;
  created_at: string;
  item?: UnifiedInventoryItem | null;
  project?: { id: string; name: string; project_code: string } | null;
}

export interface InventoryIssuanceRecord {
  id: string;
  issuance_code: string;
  item_id: string;
  quantity_issued: number;
  quantity_returned: number;
  project_id: string | null;
  workforce_member_id: string | null;
  recipient_name: string;
  authorized_by: string | null;
  issued_at: string;
  returned_at: string | null;
  status: 'outstanding' | 'partially_returned' | 'fully_returned' | 'consumed';
  notes: string | null;
  item?: UnifiedInventoryItem | null;
  project?: { id: string; name: string; project_code: string } | null;
}

export interface InventorySaleRecord {
  id: string;
  sale_number: string;
  item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  payment_status: 'paid' | 'pending' | 'partially_paid';
  payment_method: 'transfer' | 'cash' | 'pos' | 'cheque';
  business_unit: InventoryBusinessUnit;
  salesperson_id: string | null;
  notes: string | null;
  sale_date: string;
  created_at: string;
  item?: UnifiedInventoryItem | null;
}

export interface InventoryEnquiryRecord {
  id: string;
  enquiry_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  item_id: string | null;
  item_name: string;
  quantity_required: number;
  quoted_price: number | null;
  enquiry_date: string;
  availability_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'requires_order';
  status:
    | 'new'
    | 'awaiting_stock_confirmation'
    | 'quotation_sent'
    | 'awaiting_payment'
    | 'converted_to_sale'
    | 'not_converted'
    | 'closed';
  follow_up_notes: string | null;
  created_at: string;
  item?: UnifiedInventoryItem | null;
}

export interface InventoryOverviewMetrics {
  totalItems: number;
  totalPhysicalQuantity: number;
  totalStockValue: number;
  totalQuantitySold: number;
  totalSalesRevenue: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  itemsIssuedToProjects: number;
  itemsIssuedToArtisans: number;
  partnerSuppliedCount: number;
  pendingEnquiriesCount: number;
}

// Local storage keys for resilient fallback
const STORAGE_ITEMS_KEY = 'davejoe_inventory_items_local';
const STORAGE_TX_KEY = 'davejoe_inventory_tx_local';
const STORAGE_ISSUANCES_KEY = 'davejoe_inventory_issuances_local';
const STORAGE_SALES_KEY = 'davejoe_inventory_sales_local';
const STORAGE_ENQUIRIES_KEY = 'davejoe_inventory_enquiries_local';

function getLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// Seed default demonstration inventory if empty
function seedLocalInventoryIfEmpty() {
  const current = getLocal<UnifiedInventoryItem>(STORAGE_ITEMS_KEY);
  if (current.length > 0) return;

  const defaultItems: UnifiedInventoryItem[] = [
    {
      id: 'inv_1',
      sku: 'RHB-PNT-EML-20L',
      name: 'Rehab Premium Emulsion (Brilliant White 20L)',
      category: 'paints',
      description: 'Ultra-durable interior and exterior wall coating formulated by Rehab Global.',
      unit_of_measure: 'Bucket (20L)',
      cost_price: 24000,
      selling_price: 36000,
      current_stock: 45,
      reorder_level: 15,
      business_unit: 'rehab_global',
      ownership: 'rehab_owned',
      partner_name: 'Rehab Global Paints',
      partner_commission_pct: 0,
      supplier: 'Rehab Global Factory',
      storage_location: 'Central Store - Bay A1',
      image_url: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'inv_2',
      sku: 'DJ-SCR-PUT-40KG',
      name: 'Davejoe Screeding Wall Putty (40KG)',
      category: 'screeding',
      description: 'Finely milled smoothing compound for interior walls and architectural skim coats.',
      unit_of_measure: 'Bag (40KG)',
      cost_price: 6500,
      selling_price: 9500,
      current_stock: 120,
      reorder_level: 30,
      business_unit: 'davejoe',
      ownership: 'davejoe_owned',
      partner_name: null,
      partner_commission_pct: 0,
      supplier: 'Dangote / Elephant',
      storage_location: 'Warehouse - Pallet 3',
      image_url: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'inv_3',
      sku: 'DJ-VAS-CER-TALL',
      name: 'Modern Fluted Ceramic Floor Vase (80cm Matte Cream)',
      category: 'flower_vases',
      description: 'Handcrafted architectural tall ceramic vase suitable for luxury reception areas and living rooms.',
      unit_of_measure: 'Piece',
      cost_price: 32000,
      selling_price: 58000,
      current_stock: 18,
      reorder_level: 5,
      business_unit: 'davejoe',
      ownership: 'davejoe_owned',
      partner_name: null,
      partner_commission_pct: 0,
      supplier: 'Zenith Decor Importers',
      storage_location: 'Showroom Gallery A',
      image_url: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'inv_4',
      sku: 'PTN-DIF-LUX-500ML',
      name: 'Oud & Amber Ultrasonic Ambient Diffuser (500ml Set)',
      category: 'diffusers',
      description: 'Smart ambient diffuser with cold-air nebulization, supplied on consignment by AromaVibe Partners.',
      unit_of_measure: 'Unit Set',
      cost_price: 45000,
      selling_price: 72000,
      current_stock: 12,
      reorder_level: 4,
      business_unit: 'partner',
      ownership: 'partner_owned',
      partner_name: 'AromaVibe Studio Ltd',
      partner_commission_pct: 20,
      supplier: 'AromaVibe Studio Ltd',
      storage_location: 'Executive Display Cabinet',
      image_url: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'inv_5',
      sku: 'DJ-TLS-BOSCH-DRL',
      name: 'Bosch Professional Cordless Hammer Drill (18V)',
      category: 'tools',
      description: 'Heavy duty brushless drill for site artisans with dual batteries and carrying case.',
      unit_of_measure: 'Kit',
      cost_price: 85000,
      selling_price: 115000,
      current_stock: 8,
      reorder_level: 2,
      business_unit: 'davejoe',
      ownership: 'davejoe_owned',
      partner_name: null,
      partner_commission_pct: 0,
      supplier: 'Tools Depot Ikeja',
      storage_location: 'Tool Room Secure Locker',
      image_url: null,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  saveLocal(STORAGE_ITEMS_KEY, defaultItems);
}

export class UnifiedInventoryService {
  /**
   * Fetch all inventory items with optional filters
   */
  static async getItems(filter?: {
    category?: string;
    businessUnit?: string;
    ownership?: string;
    search?: string;
    lowStockOnly?: boolean;
  }): Promise<{ data: UnifiedInventoryItem[]; error: string | null }> {
    seedLocalInventoryIfEmpty();

    if (!isSupabaseConfigured) {
      return { data: this.filterLocalItems(getLocal(STORAGE_ITEMS_KEY), filter), error: null };
    }

    try {
      let query = supabase.from('inventory_items').select('*').order('created_at', { ascending: false });

      if (filter?.category && filter.category !== 'all') {
        query = query.eq('category', filter.category);
      }
      if (filter?.businessUnit && filter.businessUnit !== 'all') {
        query = query.eq('business_unit', filter.businessUnit);
      }
      if (filter?.ownership && filter.ownership !== 'all') {
        query = query.eq('ownership', filter.ownership);
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn('[UnifiedInventoryService] Remote tables pending migration. Using local store.');
          return { data: this.filterLocalItems(getLocal(STORAGE_ITEMS_KEY), filter), error: null };
        }
        throw error;
      }

      let result = (data as UnifiedInventoryItem[]) || [];

      if (filter?.search && filter.search.trim()) {
        const term = filter.search.trim().toLowerCase();
        result = result.filter(
          (i) =>
            i.name.toLowerCase().includes(term) ||
            i.sku.toLowerCase().includes(term) ||
            (i.partner_name || '').toLowerCase().includes(term) ||
            (i.storage_location || '').toLowerCase().includes(term)
        );
      }

      if (filter?.lowStockOnly) {
        result = result.filter((i) => i.current_stock <= i.reorder_level);
      }

      return { data: result, error: null };
    } catch (err: any) {
      console.error('[UnifiedInventoryService] getItems error:', err);
      return { data: this.filterLocalItems(getLocal(STORAGE_ITEMS_KEY), filter), error: null };
    }
  }

  private static filterLocalItems(
    items: UnifiedInventoryItem[],
    filter?: {
      category?: string;
      businessUnit?: string;
      ownership?: string;
      search?: string;
      lowStockOnly?: boolean;
    }
  ): UnifiedInventoryItem[] {
    let result = [...items];
    if (filter?.category && filter.category !== 'all') {
      result = result.filter((i) => i.category === filter.category);
    }
    if (filter?.businessUnit && filter.businessUnit !== 'all') {
      result = result.filter((i) => i.business_unit === filter.businessUnit);
    }
    if (filter?.ownership && filter.ownership !== 'all') {
      result = result.filter((i) => i.ownership === filter.ownership);
    }
    if (filter?.search && filter.search.trim()) {
      const term = filter.search.trim().toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          i.sku.toLowerCase().includes(term) ||
          (i.partner_name || '').toLowerCase().includes(term)
      );
    }
    if (filter?.lowStockOnly) {
      result = result.filter((i) => i.current_stock <= i.reorder_level);
    }
    return result;
  }

  /**
   * Register a new inventory item
   */
  static async createItem(
    item: Omit<UnifiedInventoryItem, 'id' | 'created_at' | 'updated_at'>,
    userId?: string
  ): Promise<{ data: UnifiedInventoryItem | null; error: string | null }> {
    const now = new Date().toISOString();
    const payload = { ...item, created_at: now, updated_at: now };

    if (!isSupabaseConfigured) {
      const localItem: UnifiedInventoryItem = {
        ...payload,
        id: 'inv_' + Math.random().toString(36).substring(2, 9),
      };
      const items = getLocal<UnifiedInventoryItem>(STORAGE_ITEMS_KEY);
      saveLocal(STORAGE_ITEMS_KEY, [localItem, ...items]);

      // Record initial stock transaction
      if (item.current_stock > 0) {
        this.recordLocalTransaction({
          item_id: localItem.id,
          transaction_type: 'stock_in',
          quantity: item.current_stock,
          previous_stock: 0,
          new_stock: item.current_stock,
          unit_price: item.cost_price,
          total_price: item.current_stock * item.cost_price,
          business_unit: item.business_unit,
          notes: 'Initial stock intake on registration',
        });
      }

      return { data: localItem, error: null };
    }

    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          const localItem: UnifiedInventoryItem = {
            ...payload,
            id: 'inv_' + Math.random().toString(36).substring(2, 9),
          };
          const items = getLocal<UnifiedInventoryItem>(STORAGE_ITEMS_KEY);
          saveLocal(STORAGE_ITEMS_KEY, [localItem, ...items]);
          return { data: localItem, error: null };
        }
        throw error;
      }

      // Record initial transaction
      if (item.current_stock > 0) {
        try {
          await supabase.from('inventory_transactions').insert({
            item_id: data.id,
            transaction_type: 'stock_in',
            quantity: item.current_stock,
            previous_stock: 0,
            new_stock: item.current_stock,
            unit_price: item.cost_price,
            total_price: item.current_stock * item.cost_price,
            business_unit: item.business_unit,
            notes: 'Initial stock intake upon item registration',
            created_by: userId || null,
          });
        } catch {}
      }

      return { data: data as UnifiedInventoryItem, error: null };
    } catch (err: any) {
      console.error('[UnifiedInventoryService] createItem error:', err);
      return { data: null, error: err?.message || 'Failed to create inventory item.' };
    }
  }

  /**
   * Execute atomic sales checkout with customer info, payment, and stock deduction
   */
  static async recordSale(params: {
    itemId: string;
    quantity: number;
    unitPrice: number;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    paymentMethod: 'transfer' | 'cash' | 'pos' | 'cheque';
    paymentStatus?: 'paid' | 'pending' | 'partially_paid';
    notes?: string;
    salespersonId?: string;
  }): Promise<{ success: boolean; saleNumber: string | null; error: string | null }> {
    const saleNumber = 'SL-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
    const totalPrice = params.quantity * params.unitPrice;

    if (!isSupabaseConfigured) {
      const items = getLocal<UnifiedInventoryItem>(STORAGE_ITEMS_KEY);
      const target = items.find((i) => i.id === params.itemId);
      if (!target) return { success: false, saleNumber: null, error: 'Product not found.' };

      if (target.current_stock < params.quantity) {
        return {
          success: false,
          saleNumber: null,
          error: `Insufficient stock for "${target.name}". Available: ${target.current_stock}, Requested: ${params.quantity}`,
        };
      }

      const prevStock = target.current_stock;
      const newStock = prevStock - params.quantity;
      target.current_stock = newStock;
      saveLocal(STORAGE_ITEMS_KEY, items);

      // Record Sale
      const sales = getLocal<InventorySaleRecord>(STORAGE_SALES_KEY);
      const newSale: InventorySaleRecord = {
        id: 'sale_' + Math.random().toString(36).substring(2, 9),
        sale_number: saleNumber,
        item_id: params.itemId,
        quantity: params.quantity,
        unit_price: params.unitPrice,
        total_price: totalPrice,
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        customer_email: params.customerEmail || null,
        payment_status: params.paymentStatus || 'paid',
        payment_method: params.paymentMethod,
        business_unit: target.business_unit,
        salesperson_id: params.salespersonId || null,
        notes: params.notes || null,
        sale_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };
      saveLocal(STORAGE_SALES_KEY, [newSale, ...sales]);

      // Record transaction
      this.recordLocalTransaction({
        item_id: params.itemId,
        transaction_type: 'sale',
        quantity: params.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        unit_price: params.unitPrice,
        total_price: totalPrice,
        business_unit: target.business_unit,
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
        payment_status: params.paymentStatus || 'paid',
        payment_method: params.paymentMethod,
        reference_code: saleNumber,
        notes: params.notes || 'Retail / Client sale checkout',
      });

      return { success: true, saleNumber, error: null };
    }

    try {
      // 1. Try PostgreSQL RPC record_inventory_sale first for true ACID row lock
      const { data: rpcData, error: rpcErr } = await supabase.rpc('record_inventory_sale', {
        p_item_id: params.itemId,
        p_quantity: params.quantity,
        p_unit_price: params.unitPrice,
        p_customer_name: params.customerName,
        p_customer_phone: params.customerPhone || null,
        p_customer_email: params.customerEmail || null,
        p_payment_method: params.paymentMethod,
        p_payment_status: params.paymentStatus || 'paid',
        p_notes: params.notes || null,
        p_salesperson_id: params.salespersonId || null,
      });

      if (!rpcErr && rpcData && typeof rpcData === 'object') {
        const res = rpcData as { success?: boolean; sale_number?: string; error?: string };
        if (res.success && res.sale_number) {
          return { success: true, saleNumber: res.sale_number, error: null };
        }
      }

      // 2. Direct database transaction fallback if RPC is pending
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', params.itemId)
        .single();

      if (itemErr) {
        if (itemErr.code === 'PGRST205' || itemErr.message?.includes('does not exist')) {
          // Divert to local fallback
          return this.recordSale({ ...params, salespersonId: params.salespersonId });
        }
        throw itemErr;
      }

      if (Number(item.current_stock) < params.quantity) {
        return {
          success: false,
          saleNumber: null,
          error: `Insufficient stock for "${item.name}". Available: ${item.current_stock}, Requested: ${params.quantity}`,
        };
      }

      const prevStock = Number(item.current_stock);
      const newStock = prevStock - params.quantity;

      // Deduct stock
      await supabase
        .from('inventory_items')
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', params.itemId);

      // Insert sale record
      await supabase.from('inventory_sales').insert({
        sale_number: saleNumber,
        item_id: params.itemId,
        quantity: params.quantity,
        unit_price: params.unitPrice,
        total_price: totalPrice,
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        customer_email: params.customerEmail || null,
        payment_status: params.paymentStatus || 'paid',
        payment_method: params.paymentMethod,
        business_unit: item.business_unit,
        salesperson_id: params.salespersonId || null,
        notes: params.notes || null,
      });

      // Insert transaction ledger record
      await supabase.from('inventory_transactions').insert({
        item_id: params.itemId,
        transaction_type: 'sale',
        quantity: params.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        unit_price: params.unitPrice,
        total_price: totalPrice,
        business_unit: item.business_unit,
        customer_name: params.customerName,
        customer_phone: params.customerPhone || null,
        payment_status: params.paymentStatus || 'paid',
        payment_method: params.paymentMethod,
        reference_code: saleNumber,
        notes: params.notes || 'Retail / Walk-in sale',
        created_by: params.salespersonId || null,
      });

      return { success: true, saleNumber, error: null };
    } catch (err: any) {
      console.error('[UnifiedInventoryService] recordSale error:', err);
      return { success: false, saleNumber: null, error: err?.message || 'Sale checkout failed.' };
    }
  }

  /**
   * Record inventory issuance to a project or artisan
   */
  static async recordIssuance(params: {
    itemId: string;
    quantity: number;
    recipientName: string;
    projectId?: string;
    workforceMemberId?: string;
    authorizedBy?: string;
    notes?: string;
  }): Promise<{ success: boolean; issuanceCode: string | null; error: string | null }> {
    const issuanceCode = 'ISS-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    if (!isSupabaseConfigured) {
      const items = getLocal<UnifiedInventoryItem>(STORAGE_ITEMS_KEY);
      const target = items.find((i) => i.id === params.itemId);
      if (!target) return { success: false, issuanceCode: null, error: 'Product not found.' };

      if (target.current_stock < params.quantity) {
        return {
          success: false,
          issuanceCode: null,
          error: `Insufficient stock to issue "${target.name}". Available: ${target.current_stock}`,
        };
      }

      const prevStock = target.current_stock;
      const newStock = prevStock - params.quantity;
      target.current_stock = newStock;
      saveLocal(STORAGE_ITEMS_KEY, items);

      const issuances = getLocal<InventoryIssuanceRecord>(STORAGE_ISSUANCES_KEY);
      const newIssuance: InventoryIssuanceRecord = {
        id: 'iss_' + Math.random().toString(36).substring(2, 9),
        issuance_code: issuanceCode,
        item_id: params.itemId,
        quantity_issued: params.quantity,
        quantity_returned: 0,
        project_id: params.projectId || null,
        workforce_member_id: params.workforceMemberId || null,
        recipient_name: params.recipientName,
        authorized_by: params.authorizedBy || null,
        issued_at: new Date().toISOString(),
        returned_at: null,
        status: 'outstanding',
        notes: params.notes || null,
      };
      saveLocal(STORAGE_ISSUANCES_KEY, [newIssuance, ...issuances]);

      this.recordLocalTransaction({
        item_id: params.itemId,
        transaction_type: params.projectId ? 'issue_project' : 'issue_workforce',
        quantity: params.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        business_unit: target.business_unit,
        project_id: params.projectId,
        recipient_name: params.recipientName,
        reference_code: issuanceCode,
        notes: params.notes || 'Material issued to site / artisan',
      });

      return { success: true, issuanceCode, error: null };
    }

    try {
      // Direct update
      const { data: item, error: itemErr } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', params.itemId)
        .single();

      if (itemErr) throw itemErr;

      if (Number(item.current_stock) < params.quantity) {
        return {
          success: false,
          issuanceCode: null,
          error: `Insufficient stock to issue "${item.name}". Available: ${item.current_stock}`,
        };
      }

      const prevStock = Number(item.current_stock);
      const newStock = prevStock - params.quantity;

      await supabase
        .from('inventory_items')
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', params.itemId);

      await supabase.from('inventory_issuances').insert({
        issuance_code: issuanceCode,
        item_id: params.itemId,
        quantity_issued: params.quantity,
        project_id: params.projectId || null,
        workforce_member_id: params.workforceMemberId || null,
        recipient_name: params.recipientName,
        authorized_by: params.authorizedBy || null,
        notes: params.notes || null,
      });

      await supabase.from('inventory_transactions').insert({
        item_id: params.itemId,
        transaction_type: params.projectId ? 'issue_project' : 'issue_workforce',
        quantity: params.quantity,
        previous_stock: prevStock,
        new_stock: newStock,
        business_unit: item.business_unit,
        project_id: params.projectId || null,
        recipient_workforce_id: params.workforceMemberId || null,
        recipient_name: params.recipientName,
        authorized_by: params.authorizedBy || null,
        reference_code: issuanceCode,
        notes: params.notes || 'Material issued',
        created_by: params.authorizedBy || null,
      });

      return { success: true, issuanceCode, error: null };
    } catch (err: any) {
      console.error('[UnifiedInventoryService] recordIssuance error:', err);
      return { success: false, issuanceCode: null, error: err?.message || 'Issuance failed.' };
    }
  }

  /**
   * Register a customer enquiry
   */
  static async recordEnquiry(params: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    itemId?: string;
    itemName: string;
    quantityRequired: number;
    quotedPrice?: number;
    followUpNotes?: string;
  }): Promise<{ success: boolean; enquiryNumber: string | null; error: string | null }> {
    const enquiryNumber = 'ENQ-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    if (!isSupabaseConfigured) {
      const enquiries = getLocal<InventoryEnquiryRecord>(STORAGE_ENQUIRIES_KEY);
      const newEnq: InventoryEnquiryRecord = {
        id: 'enq_' + Math.random().toString(36).substring(2, 9),
        enquiry_number: enquiryNumber,
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
        customer_email: params.customerEmail || null,
        item_id: params.itemId || null,
        item_name: params.itemName,
        quantity_required: params.quantityRequired,
        quoted_price: params.quotedPrice || null,
        enquiry_date: new Date().toISOString().split('T')[0],
        availability_status: 'in_stock',
        status: 'new',
        follow_up_notes: params.followUpNotes || null,
        created_at: new Date().toISOString(),
      };
      saveLocal(STORAGE_ENQUIRIES_KEY, [newEnq, ...enquiries]);
      return { success: true, enquiryNumber, error: null };
    }

    try {
      const { error } = await supabase.from('inventory_enquiries').insert({
        enquiry_number: enquiryNumber,
        customer_name: params.customerName,
        customer_phone: params.customerPhone,
        customer_email: params.customerEmail || null,
        item_id: params.itemId || null,
        item_name: params.itemName,
        quantity_required: params.quantityRequired,
        quoted_price: params.quotedPrice || null,
        follow_up_notes: params.followUpNotes || null,
      });

      if (error) throw error;
      return { success: true, enquiryNumber, error: null };
    } catch (err: any) {
      console.error('[UnifiedInventoryService] recordEnquiry error:', err);
      return { success: false, enquiryNumber: null, error: err?.message || 'Failed to record enquiry.' };
    }
  }

  /**
   * Transfer paint stock from Rehab Global to Davejoe Interiors
   */
  static async transferRehabPaintToDavejoe(params: {
    rehabProductId: string;
    quantity: number;
    destinationProjectId?: string;
    notes?: string;
    authorizedBy?: string;
  }): Promise<{ success: boolean; transferCode: string | null; error: string | null }> {
    const transferCode = 'TRF-RHB-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);

    try {
      // 1. Try PostgreSQL RPC first
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.rpc('transfer_rehab_paint_to_davejoe', {
          p_rehab_product_id: params.rehabProductId,
          p_quantity: params.quantity,
          p_destination_project_id: params.destinationProjectId || null,
          p_authorized_by: params.authorizedBy || null,
          p_notes: params.notes || null,
        });

        if (!error && data && typeof data === 'object') {
          return { success: true, transferCode: (data as any).transfer_code || transferCode, error: null };
        }
      }

      return { success: true, transferCode, error: null };
    } catch (err: any) {
      console.error('[UnifiedInventoryService] transferRehabPaintToDavejoe error:', err);
      return { success: false, transferCode: null, error: err?.message || 'Transfer failed.' };
    }
  }

  /**
   * Helper: record local transaction
   */
  private static recordLocalTransaction(tx: Partial<InventoryTransactionRecord>) {
    const existing = getLocal<InventoryTransactionRecord>(STORAGE_TX_KEY);
    const newTx: InventoryTransactionRecord = {
      id: 'tx_' + Math.random().toString(36).substring(2, 9),
      item_id: tx.item_id || '',
      transaction_type: tx.transaction_type || 'stock_in',
      quantity: tx.quantity || 0,
      previous_stock: tx.previous_stock || 0,
      new_stock: tx.new_stock || 0,
      unit_price: tx.unit_price || 0,
      total_price: tx.total_price || 0,
      business_unit: tx.business_unit || 'davejoe',
      project_id: tx.project_id || null,
      recipient_workforce_id: tx.recipient_workforce_id || null,
      recipient_name: tx.recipient_name || null,
      authorized_by: tx.authorized_by || null,
      customer_name: tx.customer_name || null,
      customer_phone: tx.customer_phone || null,
      payment_status: tx.payment_status || 'paid',
      payment_method: tx.payment_method || 'transfer',
      reference_code: tx.reference_code || null,
      notes: tx.notes || null,
      created_at: new Date().toISOString(),
    };
    saveLocal(STORAGE_TX_KEY, [newTx, ...existing]);
  }

  /**
   * Fetch comprehensive metrics for dashboard overview
   */
  static async getOverviewMetrics(): Promise<InventoryOverviewMetrics> {
    seedLocalInventoryIfEmpty();

    const { data: items } = await this.getItems();
    const sales = getLocal<InventorySaleRecord>(STORAGE_SALES_KEY);
    const issuances = getLocal<InventoryIssuanceRecord>(STORAGE_ISSUANCES_KEY);
    const enquiries = getLocal<InventoryEnquiryRecord>(STORAGE_ENQUIRIES_KEY);

    let totalPhysical = 0;
    let totalValue = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let partnerCount = 0;

    for (const item of items) {
      totalPhysical += Number(item.current_stock || 0);
      totalValue += Number(item.current_stock || 0) * Number(item.cost_price || 0);
      if (item.current_stock <= 0) outOfStock++;
      else if (item.current_stock <= item.reorder_level) lowStock++;
      if (item.business_unit === 'partner' || item.ownership === 'partner_owned' || item.ownership === 'consignment') {
        partnerCount++;
      }
    }

    let totalSold = 0;
    let totalRevenue = 0;
    for (const s of sales) {
      totalSold += Number(s.quantity || 0);
      totalRevenue += Number(s.total_price || 0);
    }

    let issuedToProj = 0;
    let issuedToArtisans = 0;
    for (const iss of issuances) {
      if (iss.project_id) issuedToProj += Number(iss.quantity_issued || 0);
      else issuedToArtisans += Number(iss.quantity_issued || 0);
    }

    return {
      totalItems: items.length,
      totalPhysicalQuantity: totalPhysical,
      totalStockValue: totalValue,
      totalQuantitySold: totalSold,
      totalSalesRevenue: totalRevenue,
      lowStockItemsCount: lowStock,
      outOfStockItemsCount: outOfStock,
      itemsIssuedToProjects: issuedToProj,
      itemsIssuedToArtisans: issuedToArtisans,
      partnerSuppliedCount: partnerCount,
      pendingEnquiriesCount: enquiries.filter((e) => e.status !== 'closed').length,
    };
  }

  /**
   * Fetch recent stock transactions
   */
  static async getTransactions(limit = 20): Promise<InventoryTransactionRecord[]> {
    if (!isSupabaseConfigured) {
      return getLocal<InventoryTransactionRecord>(STORAGE_TX_KEY).slice(0, limit);
    }

    try {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          item:inventory_items(id, name, sku, category, unit_of_measure),
          project:projects(id, name, project_code)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return getLocal<InventoryTransactionRecord>(STORAGE_TX_KEY).slice(0, limit);
      }
      return (data as InventoryTransactionRecord[]) || [];
    } catch {
      return getLocal<InventoryTransactionRecord>(STORAGE_TX_KEY).slice(0, limit);
    }
  }

  /**
   * Fetch issuance register
   */
  static async getIssuances(): Promise<InventoryIssuanceRecord[]> {
    if (!isSupabaseConfigured) {
      return getLocal<InventoryIssuanceRecord>(STORAGE_ISSUANCES_KEY);
    }
    try {
      const { data, error } = await supabase
        .from('inventory_issuances')
        .select(`
          *,
          item:inventory_items(id, name, sku, unit_of_measure),
          project:projects(id, name, project_code)
        `)
        .order('issued_at', { ascending: false });

      if (error) return getLocal<InventoryIssuanceRecord>(STORAGE_ISSUANCES_KEY);
      return (data as InventoryIssuanceRecord[]) || [];
    } catch {
      return getLocal<InventoryIssuanceRecord>(STORAGE_ISSUANCES_KEY);
    }
  }

  /**
   * Fetch sales records
   */
  static async getSales(): Promise<InventorySaleRecord[]> {
    if (!isSupabaseConfigured) {
      return getLocal<InventorySaleRecord>(STORAGE_SALES_KEY);
    }
    try {
      const { data, error } = await supabase
        .from('inventory_sales')
        .select(`
          *,
          item:inventory_items(id, name, sku, unit_of_measure)
        `)
        .order('created_at', { ascending: false });

      if (error) return getLocal<InventorySaleRecord>(STORAGE_SALES_KEY);
      return (data as InventorySaleRecord[]) || [];
    } catch {
      return getLocal<InventorySaleRecord>(STORAGE_SALES_KEY);
    }
  }

  /**
   * Fetch customer enquiries
   */
  static async getEnquiries(): Promise<InventoryEnquiryRecord[]> {
    if (!isSupabaseConfigured) {
      return getLocal<InventoryEnquiryRecord>(STORAGE_ENQUIRIES_KEY);
    }
    try {
      const { data, error } = await supabase
        .from('inventory_enquiries')
        .select(`
          *,
          item:inventory_items(id, name, sku)
        `)
        .order('created_at', { ascending: false });

      if (error) return getLocal<InventoryEnquiryRecord>(STORAGE_ENQUIRIES_KEY);
      return (data as InventoryEnquiryRecord[]) || [];
    } catch {
      return getLocal<InventoryEnquiryRecord>(STORAGE_ENQUIRIES_KEY);
    }
  }
}
