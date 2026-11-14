import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';
import { maskBankAccountNumber } from './workforceDirectoryService';

export type VendorPartnerType = 'vendor' | 'partner' | 'both';
export type VendorPartnerStatus = 'active' | 'inactive' | 'suspended';

export const CAC_STORAGE_BUCKET = 'vendor-documents';
const MAX_CAC_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_CAC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export const VENDOR_PUBLIC_COLUMNS =
  'id, full_name, business_name, email_address, phone_number, record_type, cac_certificate_path, status, notes, created_by, updated_by, created_at, updated_at';

export interface VendorProtectedDetails {
  vendor_id: string;
  next_of_kin: string | null;
  next_of_kin_phone: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
}

export interface VendorPartnerRecord {
  id: string;
  full_name: string;
  business_name: string | null;
  email_address: string | null;
  phone_number: string;
  next_of_kin?: string | null;
  next_of_kin_phone?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_number?: string | null;
  record_type: VendorPartnerType | string;
  cac_certificate_path: string | null;
  status: VendorPartnerStatus | string;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorsPartnersMetrics {
  totalCount: number;
  activeCount: number;
  totalVendorsCount: number;
  totalPartnersCount: number;
  vendorOnlyCount: number;
  partnerOnlyCount: number;
  bothCount: number;
  cacUploadedCount: number;
}

export interface VendorPartnerInput {
  full_name: string;
  business_name?: string;
  email_address?: string;
  phone_number: string;
  next_of_kin?: string;
  next_of_kin_phone?: string;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  record_type: VendorPartnerType;
  status?: VendorPartnerStatus;
  notes?: string;
}

function isMissingRpcError(error: any): boolean {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    (msg.includes('function') && msg.includes('does not exist'))
  );
}

export class VendorsPartnersService {
  static async listVendorsPartners(filters?: {
    search?: string;
    recordType?: string;
    status?: string;
  }): Promise<{
    data: VendorPartnerRecord[];
    metrics: VendorsPartnersMetrics;
    error: string | null;
  }> {
    const emptyMetrics: VendorsPartnersMetrics = {
      totalCount: 0,
      activeCount: 0,
      totalVendorsCount: 0,
      totalPartnersCount: 0,
      vendorOnlyCount: 0,
      partnerOnlyCount: 0,
      bothCount: 0,
      cacUploadedCount: 0,
    };

    if (!isSupabaseConfigured) {
      return { data: [], metrics: emptyMetrics, error: 'Supabase is not configured.' };
    }

    try {
      const { data, error } = await supabase
        .from('vendors_partners')
        .select(VENDOR_PUBLIC_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], metrics: emptyMetrics, error: error.message };
      }

      const allRecords = ((data || []) as any[]).map((r) => ({
        ...r,
        record_type: (r.record_type || 'vendor').toLowerCase(),
        status: (r.status || 'active').toLowerCase(),
      })) as VendorPartnerRecord[];

      const vendorOnlyCount = allRecords.filter((r) => r.record_type === 'vendor').length;
      const partnerOnlyCount = allRecords.filter((r) => r.record_type === 'partner').length;
      const bothCount = allRecords.filter((r) => r.record_type === 'both').length;

      const metrics: VendorsPartnersMetrics = {
        totalCount: allRecords.length,
        activeCount: allRecords.filter((r) => r.status === 'active').length,
        totalVendorsCount: vendorOnlyCount + bothCount,
        totalPartnersCount: partnerOnlyCount + bothCount,
        vendorOnlyCount,
        partnerOnlyCount,
        bothCount,
        cacUploadedCount: allRecords.filter((r) => Boolean(r.cac_certificate_path)).length,
      };

      let filtered = allRecords;

      if (filters?.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.full_name.toLowerCase().includes(term) ||
            (r.business_name || '').toLowerCase().includes(term) ||
            (r.phone_number || '').toLowerCase().includes(term) ||
            (r.email_address || '').toLowerCase().includes(term)
        );
      }

      if (filters?.recordType && filters.recordType !== 'all') {
        const typeTarget = filters.recordType.toLowerCase();
        filtered = filtered.filter((r) => r.record_type === typeTarget);
      }

      if (filters?.status && filters.status !== 'all') {
        const statusTarget = filters.status.toLowerCase();
        filtered = filtered.filter((r) => r.status === statusTarget);
      }

      return { data: filtered, metrics, error: null };
    } catch (err: any) {
      return {
        data: [],
        metrics: emptyMetrics,
        error: err?.message || 'Failed to load vendors & partners directory.',
      };
    }
  }

  static async getVendorProtectedDetails(id: string): Promise<{
    data: VendorProtectedDetails | null;
    error: string | null;
    restricted?: boolean;
  }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Supabase is not configured.' };
    }

    try {
      const { data, error } = await supabase.rpc('get_vendor_protected_details', {
        p_vendor_id: id,
      });

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          return {
            data: {
              vendor_id: id,
              next_of_kin: null,
              next_of_kin_phone: null,
              bank_name: null,
              account_name: null,
              account_number: null,
            },
            error: null,
          };
        }
        return {
          data: {
            vendor_id: row.vendor_id || id,
            next_of_kin: row.next_of_kin ?? null,
            next_of_kin_phone: row.next_of_kin_phone ?? null,
            bank_name: row.bank_name ?? null,
            account_name: row.account_name ?? null,
            account_number: row.account_number ?? null,
          },
          error: null,
        };
      }

      if (isMissingRpcError(error)) {
        const fallbackRes = await supabase
          .from('vendors_partners')
          .select('id, next_of_kin, next_of_kin_phone, bank_name, account_name, account_number')
          .eq('id', id)
          .maybeSingle();

        if (fallbackRes.error) {
          const isPermErr =
            fallbackRes.error.code === '42501' ||
            fallbackRes.error.message.toLowerCase().includes('permission');
          return { data: null, error: fallbackRes.error.message, restricted: isPermErr };
        }

        const fb = fallbackRes.data as any;
        return {
          data: fb
            ? {
                vendor_id: fb.id || id,
                next_of_kin: fb.next_of_kin ?? null,
                next_of_kin_phone: fb.next_of_kin_phone ?? null,
                bank_name: fb.bank_name ?? null,
                account_name: fb.account_name ?? null,
                account_number: fb.account_number ?? null,
              }
            : null,
          error: null,
        };
      }

      const isRestricted =
        error.code === '42501' || error.message.toLowerCase().includes('permission');
      return { data: null, error: error.message, restricted: isRestricted };
    } catch (err: any) {
      return {
        data: null,
        error: err?.message || 'Unable to load protected vendor banking details.',
      };
    }
  }

  static async uploadCacCertificate(
    file: File,
    ownerSlug: string
  ): Promise<{ path: string | null; error: string | null }> {
    if (!file) return { path: null, error: null };

    if (file.size <= 0 || file.size > MAX_CAC_FILE_SIZE) {
      return { path: null, error: 'CAC Certificate file must be 5 MB or smaller.' };
    }

    if (!ALLOWED_CAC_TYPES.includes(file.type)) {
      return {
        path: null,
        error: 'Only PDF, JPG, or PNG files are permitted for CAC Certificates.',
      };
    }

    const safeFileName = file.name
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      .slice(-80);
    const safeFolder =
      ownerSlug
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 32) || 'entity';

    const storagePath = `${safeFolder}/${Date.now()}-${safeFileName}`;

    try {
      const { error: uploadErr } = await supabase.storage
        .from(CAC_STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) {
        return {
          path: null,
          error: `CAC upload failed (${uploadErr.message}). Ensure private storage bucket "${CAC_STORAGE_BUCKET}" and RLS policies are provisioned.`,
        };
      }

      await AuditLogger.log({
        action: 'UPLOAD_VENDOR_CAC_CERTIFICATE',
        module: 'vendors_partners',
        tableName: 'vendors_partners',
        newValues: {
          bucket: CAC_STORAGE_BUCKET,
          cac_certificate_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
        },
      });

      // Return ONLY the relative private storage path, never a public URL
      return { path: storagePath, error: null };
    } catch (err: any) {
      return {
        path: null,
        error: err?.message || 'Failed to upload CAC Certificate to private storage.',
      };
    }
  }

  static async getSignedCacUrl(
    storagePath: string
  ): Promise<{ signedUrl: string | null; error: string | null }> {
    if (!storagePath) {
      return { signedUrl: null, error: 'No CAC Certificate path recorded.' };
    }

    // Reject public URLs or inline data URIs to uphold private storage policy
    if (
      storagePath.startsWith('http://') ||
      storagePath.startsWith('https://') ||
      storagePath.startsWith('data:')
    ) {
      return {
        signedUrl: null,
        error: 'Stored certificate path is not a valid private storage reference.',
      };
    }

    try {
      const { data, error } = await supabase.storage
        .from(CAC_STORAGE_BUCKET)
        .createSignedUrl(storagePath, 300); // 5-minute expiring signed URL

      if (error || !data?.signedUrl) {
        return {
          signedUrl: null,
          error: error?.message || 'Unable to generate secure download link for CAC Certificate.',
        };
      }

      await AuditLogger.log({
        action: 'VIEW_VENDOR_CAC_CERTIFICATE',
        module: 'vendors_partners',
        tableName: 'vendors_partners',
        newValues: {
          bucket: CAC_STORAGE_BUCKET,
          cac_certificate_path: storagePath,
        },
      });

      return { signedUrl: data.signedUrl, error: null };
    } catch (err: any) {
      return {
        signedUrl: null,
        error: err?.message || 'Unable to access private CAC Certificate.',
      };
    }
  }

  static async createVendorPartner(
    input: VendorPartnerInput,
    cacFile: File | null
  ): Promise<{ data: VendorPartnerRecord | null; error: string | null }> {
    const fullName = input.full_name?.trim();
    const phone = input.phone_number?.trim();
    const email = input.email_address?.trim();

    if (!fullName) {
      return { data: null, error: 'Full Name is required.' };
    }
    if (!phone) {
      return { data: null, error: 'Phone Number is required.' };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { data: null, error: 'Please provide a valid Email Address.' };
    }
    if (input.account_number?.trim() && !/^\d{6,20}$/.test(input.account_number.trim())) {
      return { data: null, error: 'Account Number must contain 6 to 20 digits.' };
    }

    try {
      let cacPath: string | null = null;
      if (cacFile) {
        const uploadRes = await this.uploadCacCertificate(
          cacFile,
          input.business_name?.trim() || fullName
        );
        if (uploadRes.error) {
          return { data: null, error: uploadRes.error };
        }
        cacPath = uploadRes.path;
      }

      // created_by / updated_by are populated server-side by trg_identity_vendors_partners
      const payload = {
        full_name: fullName,
        business_name: input.business_name?.trim() || null,
        email_address: email || null,
        phone_number: phone,
        next_of_kin: input.next_of_kin?.trim() || null,
        next_of_kin_phone: input.next_of_kin_phone?.trim() || null,
        bank_name: input.bank_name?.trim() || null,
        account_name: input.account_name?.trim() || null,
        account_number: input.account_number?.trim() || null,
        record_type: input.record_type || 'vendor',
        cac_certificate_path: cacPath,
        status: input.status || 'active',
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await supabase
        .from('vendors_partners')
        .insert(payload)
        .select(VENDOR_PUBLIC_COLUMNS)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      await AuditLogger.log({
        action: 'CREATE_VENDOR_PARTNER',
        module: 'vendors_partners',
        tableName: 'vendors_partners',
        recordId: data.id,
        newValues: {
          full_name: payload.full_name,
          business_name: payload.business_name,
          record_type: payload.record_type,
          bank_name: payload.bank_name,
          account_number: maskBankAccountNumber(payload.account_number),
          has_cac: Boolean(cacPath),
          status: payload.status,
        },
      });

      return { data: data as VendorPartnerRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to register vendor/partner.' };
    }
  }

  static async updateVendorPartner(
    id: string,
    input: VendorPartnerInput,
    cacFile: File | null,
    previous?: VendorPartnerRecord | null,
    preserveProtectedDetails = false
  ): Promise<{ data: VendorPartnerRecord | null; error: string | null }> {
    const fullName = input.full_name?.trim();
    const phone = input.phone_number?.trim();
    const email = input.email_address?.trim();

    if (!fullName) {
      return { data: null, error: 'Full Name is required.' };
    }
    if (!phone) {
      return { data: null, error: 'Phone Number is required.' };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { data: null, error: 'Please provide a valid Email Address.' };
    }
    if (
      !preserveProtectedDetails &&
      input.account_number?.trim() &&
      !/^\d{6,20}$/.test(input.account_number.trim())
    ) {
      return { data: null, error: 'Account Number must contain 6 to 20 digits.' };
    }

    try {
      let cacPath = previous?.cac_certificate_path || null;
      if (cacFile) {
        const uploadRes = await this.uploadCacCertificate(
          cacFile,
          input.business_name?.trim() || fullName
        );
        if (uploadRes.error) {
          return { data: null, error: uploadRes.error };
        }
        cacPath = uploadRes.path;
      }

      // updated_by is set server-side via trigger auth.uid()
      const payload: Record<string, any> = {
        full_name: fullName,
        business_name: input.business_name?.trim() || null,
        email_address: email || null,
        phone_number: phone,
        record_type: input.record_type || previous?.record_type || 'vendor',
        cac_certificate_path: cacPath,
        status: input.status || previous?.status || 'active',
        notes: input.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (!preserveProtectedDetails) {
        payload.next_of_kin = input.next_of_kin?.trim() || null;
        payload.next_of_kin_phone = input.next_of_kin_phone?.trim() || null;
        payload.bank_name = input.bank_name?.trim() || null;
        payload.account_name = input.account_name?.trim() || null;
        payload.account_number = input.account_number?.trim() || null;
      }

      const { data, error } = await supabase
        .from('vendors_partners')
        .update(payload)
        .eq('id', id)
        .select(VENDOR_PUBLIC_COLUMNS)
        .single();

      if (error) {
        return { data: null, error: error.message };
      }

      await AuditLogger.log({
        action: 'UPDATE_VENDOR_PARTNER',
        module: 'vendors_partners',
        tableName: 'vendors_partners',
        recordId: id,
        oldValues: previous
          ? {
              full_name: previous.full_name,
              business_name: previous.business_name,
              record_type: previous.record_type,
              ...(preserveProtectedDetails
                ? {}
                : {
                    bank_name: previous.bank_name,
                    account_number: maskBankAccountNumber(previous.account_number),
                  }),
              status: previous.status,
            }
          : undefined,
        newValues: {
          full_name: payload.full_name,
          business_name: payload.business_name,
          record_type: payload.record_type,
          ...(preserveProtectedDetails
            ? {}
            : {
                bank_name: payload.bank_name,
                account_number: maskBankAccountNumber(payload.account_number),
              }),
          has_cac: Boolean(cacPath),
          status: payload.status,
        },
      });

      return { data: data as VendorPartnerRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err?.message || 'Failed to update vendor/partner record.' };
    }
  }

  static async updateStatus(
    id: string,
    status: VendorPartnerStatus,
    previousStatus?: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('vendors_partners')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) return { error: error.message };

      await AuditLogger.log({
        action: 'UPDATE_VENDOR_PARTNER_STATUS',
        module: 'vendors_partners',
        tableName: 'vendors_partners',
        recordId: id,
        oldValues: previousStatus ? { status: previousStatus } : undefined,
        newValues: { status },
      });

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Failed to update status.' };
    }
  }
}
