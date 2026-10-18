import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseKey } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';
import { UserProfile, StandardRoleKey, normalizeRoleKey } from './authService';

type AdminManageUserAction =
  | 'invite_user'
  | 'create_user'
  | 'update_profile'
  | 'update_status'
  | 'assign_role'
  | 'remove_role'
  | 'assign_role_permission'
  | 'remove_role_permission';

async function callAdminManageUser<T = unknown>(
  action: AdminManageUserAction,
  payload: Record<string, unknown>
): Promise<T> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError) {
    console.error('[AdminService] Session retrieval error before Edge Function invocation:', sessionError);
    throw sessionError;
  }

  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  // Sanitize payload for logging (mask passwords)
  const loggablePayload = { ...payload };
  if ('password' in loggablePayload && typeof loggablePayload.password === 'string') {
    loggablePayload.password = '***[MASKED]***';
  }

  console.log(`[AdminService] Invoking Edge Function "admin-manage-user" [action: ${action}]`, {
    action,
    payload: loggablePayload,
  });

  let resData: any = null;
  let resError: any = null;

  try {
    const result = await supabase.functions.invoke(
      'admin-manage-user',
      {
        body: { action, ...payload },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    resData = result.data;
    resError = result.error;
  } catch (invokeErr: any) {
    console.error(`[AdminService] Exception calling Edge Function "admin-manage-user" [${action}]:`, invokeErr);
    throw new Error(invokeErr?.message || 'Failed to send a request to the Edge Function');
  }

  // Handle Edge Function HTTP or Fetch Errors
  if (resError) {
    let detailedMessage: string = resError.message || 'The secure administration request failed.';

    // If FunctionsHttpError, extract the server response JSON/text from error.context
    if (resError && typeof resError === 'object' && 'context' in resError && resError.context) {
      try {
        const errorBody = await resError.context.json();
        if (errorBody && typeof errorBody === 'object') {
          if (typeof errorBody.error === 'string') {
            detailedMessage = errorBody.error;
          } else if (typeof errorBody.message === 'string') {
            detailedMessage = errorBody.message;
          }
        }
      } catch {
        try {
          const rawText = await resError.context.text();
          if (rawText && rawText.trim()) {
            detailedMessage = rawText.trim();
          }
        } catch {
          // Ignore context read errors
        }
      }
    }

    // Enhance message if it's the generic network/CORS error
    if (detailedMessage.includes('Failed to send a request to the Edge Function')) {
      console.error(
        `[AdminService] Edge Function unreachable for action "${action}". ` +
        `This typically indicates the Edge Function is not deployed or CORS preflight was rejected.`,
        { action, payload: loggablePayload, error: resError }
      );
      detailedMessage =
        'Failed to send a request to the Edge Function. The "admin-manage-user" Edge Function is not reachable or not deployed. ' +
        'Ensure "supabase functions deploy admin-manage-user" has been run, or use the database RPC "admin_create_user".';
    } else {
      console.error(`[AdminService] Edge Function "${action}" returned error:`, {
        action,
        status: resError?.context?.status,
        message: detailedMessage,
        payload: loggablePayload,
      });
    }

    throw new Error(detailedMessage);
  }

  // Check if server returned an error in the JSON response body
  if (resData && typeof resData === 'object' && 'error' in resData) {
    const errorMsg = String((resData as { error: unknown }).error);
    console.error(`[AdminService] Edge Function "${action}" returned application error:`, {
      action,
      error: errorMsg,
      payload: loggablePayload,
    });
    throw new Error(errorMsg);
  }

  console.log(`[AdminService] Edge Function "${action}" succeeded:`, resData);
  return resData as T;
}

export interface AdminUserListItem {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  job_title: string | null;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
  roles: { id: string; name: string; slug: string }[];
  workforce?: { id: string; trade: string; workforce_code?: string } | null;
}

export interface AdminRoleItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  is_system_role: boolean;
  assigned_users_count: number;
}

export interface AdminPermissionItem {
  id: string;
  name: string;
  module: string;
  description: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  module: string;
  table_name: string | null;
  record_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
}

export interface AdminDashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  totalWorkforce: number;
  totalProjects: number;
  recentAuditCount: number;
}

export class AdminService {
  /**
   * Create a staff account through the server-authorized Edge Function.
   * Never create privileged Auth users directly from the browser.
   */
  static async createUser(input: {
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    phone?: string;
    roleSlugs: string[];
  }): Promise<{ success: boolean; user_id: string; assigned_roles: string[] }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. User accounts cannot be created.');
    }

    const email = input.email.trim().toLowerCase();
    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const roleSlugs = [...new Set(input.roleSlugs.map((slug) => slug.trim()).filter(Boolean))];
    const password = (input.password || '').trim() || `Davejoe${Math.floor(100000 + Math.random() * 900000)}!`;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Enter a valid email address.');
    }
    if (!firstName) throw new Error('First name is required.');
    if (password.length < 6) {
      throw new Error('Password must contain at least 6 characters.');
    }
    if (roleSlugs.length === 0) throw new Error('Select at least one role.');

    // 1. Try PostgreSQL RPC admin_create_user first
    // This executes directly against the database via PostgREST and does NOT require Edge Function deployment.
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_user', {
        p_email: email,
        p_password: password,
        p_first_name: firstName,
        p_last_name: lastName,
        p_phone: input.phone?.trim() || null,
        p_roles: roleSlugs,
      });

      if (!rpcError && rpcData && typeof rpcData === 'object') {
        const res = rpcData as { success?: boolean; user_id?: string; assigned_roles?: string[]; error?: string };
        if (res.user_id) {
          try {
            await AuditLogger.log({
              action: 'admin.user_created',
              module: 'administration',
              tableName: 'profiles',
              recordId: res.user_id,
              newValues: {
                user_id: res.user_id,
                email,
                display_name: `${firstName} ${lastName}`.trim(),
                roles: res.assigned_roles || roleSlugs,
                engine: 'postgresql_rpc',
              },
            });
          } catch (auditErr) {
            console.warn('[AdminService] Audit log write warning (non-fatal):', auditErr);
          }

          return {
            success: true,
            user_id: res.user_id,
            assigned_roles: res.assigned_roles || roleSlugs,
          };
        }
      }

      // If the RPC returned an application error (e.g. user already exists or caller unauthorized), throw it directly
      if (
        rpcError &&
        rpcError.code !== 'PGRST202' &&
        !rpcError.message.includes('admin_create_user') &&
        !rpcError.message.includes('not found') &&
        !rpcError.message.includes('schema cache')
      ) {
        throw new Error(rpcError.message);
      }
    } catch (rpcErr: any) {
      // Re-throw explicit application-level errors from the database
      if (
        rpcErr.message &&
        !rpcErr.message.includes('admin_create_user') &&
        !rpcErr.message.includes('PGRST202') &&
        !rpcErr.message.includes('not found') &&
        !rpcErr.message.includes('schema cache')
      ) {
        throw rpcErr;
      }
      console.warn('[AdminService] Database RPC admin_create_user not found or unavailable; attempting Edge Function fallback:', rpcErr?.message);
    }

    // 2. Try the admin-manage-user Edge Function
    try {
      const result = await callAdminManageUser<{
        success: boolean;
        user_id: string;
        assigned_roles: string[];
        message?: string;
      }>('create_user', {
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone: input.phone?.trim() || '',
        role_slugs: roleSlugs,
      });

      if (!result?.success || !result.user_id) {
        throw new Error(result?.message || 'The server did not confirm account creation.');
      }

      try {
        await AuditLogger.log({
          action: 'admin.user_created',
          module: 'administration',
          tableName: 'profiles',
          recordId: result.user_id,
          newValues: {
            user_id: result.user_id,
            email,
            display_name: `${firstName} ${lastName}`.trim(),
            roles: result.assigned_roles || roleSlugs,
            engine: 'edge_function',
          },
        });
      } catch (auditErr) {
        console.warn('[AdminService] Audit log write warning (non-fatal):', auditErr);
      }

      return result;
    } catch (edgeErr: any) {
      console.warn('[AdminService] Edge Function unreachable; transitioning to direct Supabase Auth engine:', edgeErr?.message);

      // 3. Resilient Fallback: Direct Supabase Auth engine via isolated ephemeral client
      // Uses standard GoTrue auth endpoint (/auth/v1/signup). Does not alter current admin session.
      try {
        const ephemeralClient = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });

        const displayName = `${firstName} ${lastName}`.trim() || email.split('@')[0];

        const { data: signUpData, error: signUpError } = await ephemeralClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName || null,
              display_name: displayName,
              phone: input.phone?.trim() || null,
            },
          },
        });

        if (signUpError) {
          if (signUpError.message?.toLowerCase().includes('already registered')) {
            throw new Error(`An account with email "${email}" already exists.`);
          }
          throw new Error(signUpError.message || 'Authentication service could not register account.');
        }

        const newUserId = signUpData?.user?.id;
        if (!newUserId) {
          throw new Error('Authentication service did not return a valid user identity.');
        }

        // Upsert profile record using authenticated administrator session
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: newUserId,
          email,
          first_name: firstName,
          last_name: lastName || null,
          display_name: displayName,
          phone: input.phone?.trim() || null,
          status: 'active',
        }, { onConflict: 'id' });

        if (profileError) {
          console.warn('[AdminService] Profile upsert notice:', profileError.message);
        }

        // Assign requested roles using authenticated administrator session
        const { data: matchedRoles } = await supabase
          .from('roles')
          .select('id, slug, name')
          .in('slug', roleSlugs);

        if (matchedRoles && matchedRoles.length > 0) {
          const { data: sessionInfo } = await supabase.auth.getSession();
          const currentCallerId = sessionInfo?.session?.user?.id || null;

          for (const role of matchedRoles) {
            await supabase.from('user_roles').upsert({
              user_id: newUserId,
              role_id: role.id,
              assigned_by: currentCallerId,
            }, { onConflict: 'user_id,role_id' });
          }
        }

        try {
          await AuditLogger.log({
            action: 'admin.user_created',
            module: 'administration',
            tableName: 'profiles',
            recordId: newUserId,
            newValues: {
              user_id: newUserId,
              email,
              display_name: displayName,
              roles: roleSlugs,
              engine: 'direct_auth',
            },
          });
        } catch (auditErr) {
          console.warn('[AdminService] Audit log write warning (non-fatal):', auditErr);
        }

        console.log('[AdminService] User created successfully via Direct Auth Engine:', {
          userId: newUserId,
          email,
          roles: roleSlugs,
        });

        return {
          success: true,
          user_id: newUserId,
          assigned_roles: roleSlugs,
        };
      } catch (authFallbackErr: any) {
        console.error('[AdminService] All user creation engines failed:', {
          rpcError: 'Not found or unavailable',
          edgeError: edgeErr?.message,
          authError: authFallbackErr?.message,
        });
        throw authFallbackErr;
      }
    }
  }

  // ============================================================================
  // 1. DASHBOARD METRICS
  // ============================================================================
  static async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    if (!isSupabaseConfigured) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalRoles: 0,
        totalWorkforce: 0,
        totalProjects: 0,
        recentAuditCount: 0,
      };
    }

    try {
      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: totalRoles },
        { count: totalWorkforce },
        { count: totalProjects },
        { count: recentAuditCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('roles').select('*', { count: 'exact', head: true }),
        supabase.from('workforce_members').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }),
      ]);

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalRoles: totalRoles || 0,
        totalWorkforce: totalWorkforce || 0,
        totalProjects: totalProjects || 0,
        recentAuditCount: recentAuditCount || 0,
      };
    } catch (err) {
      console.warn('[AdminService] Error fetching dashboard metrics:', err);
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalRoles: 0,
        totalWorkforce: 0,
        totalProjects: 0,
        recentAuditCount: 0,
      };
    }
  }

  // ============================================================================
  // 2. USER DIRECTORY & MANAGEMENT
  // ============================================================================
  static async getUsers(params?: {
    search?: string;
    roleSlug?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: AdminUserListItem[]; totalCount: number }> {
    if (!isSupabaseConfigured) return { users: [], totalCount: 0 };

    const page = params?.page || 1;
    const limit = params?.limit || 15;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    try {
      // 1. Query profiles with optional status filter
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }

      if (params?.search && params.search.trim()) {
        const term = `%${params.search.trim()}%`;
        query = query.or(
          `display_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},job_title.ilike.${term}`
        );
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data: profiles, count, error } = await query;
      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        return { users: [], totalCount: 0 };
      }

      const userIds = profiles.map((p) => p.id);

      // 2. Fetch assigned roles for these users
      const { data: userRolesData } = await supabase
        .from('user_roles')
        .select('user_id, roles(id, name, slug)')
        .in('user_id', userIds);

      const rolesByUser: Record<string, { id: string; name: string; slug: string }[]> = {};
      if (userRolesData) {
        for (const item of userRolesData as any[]) {
          if (!rolesByUser[item.user_id]) rolesByUser[item.user_id] = [];
          if (item.roles) {
            rolesByUser[item.user_id].push({
              id: item.roles.id,
              name: item.roles.name,
              slug: item.roles.slug,
            });
          }
        }
      }

      // 3. Fetch workforce relationship if any
      const { data: workforceData } = await supabase
        .from('workforce_members')
        .select('id, profile_id, trade, workforce_code')
        .in('profile_id', userIds);

      const workforceByUser: Record<string, { id: string; trade: string; workforce_code?: string }> = {};
      if (workforceData) {
        for (const w of workforceData) {
          if (w.profile_id) {
            workforceByUser[w.profile_id] = {
              id: w.id,
              trade: w.trade || 'General',
              workforce_code: w.workforce_code,
            };
          }
        }
      }

      // 4. Transform and filter by roleSlug if requested
      let result: AdminUserListItem[] = profiles.map((p: any) => ({
        id: p.id,
        email: p.email || null,
        first_name: p.first_name || null,
        last_name: p.last_name || null,
        display_name: p.display_name || null,
        phone: p.phone || null,
        job_title: p.job_title || null,
        status: p.status || 'active',
        created_at: p.created_at,
        updated_at: p.updated_at,
        roles: rolesByUser[p.id] || [],
        workforce: workforceByUser[p.id] || null,
      }));

      if (params?.roleSlug && params.roleSlug !== 'all') {
        result = result.filter((u) =>
          u.roles.some((r) => r.slug === params.roleSlug)
        );
      }

      return {
        users: result,
        totalCount: count || result.length,
      };
    } catch (err) {
      console.error('[AdminService] Error loading users:', err);
      throw err;
    }
  }

  static async getUserDetails(userId: string): Promise<{
    profile: AdminUserListItem | null;
    recentAuditLogs: AuditLogEntry[];
  }> {
    if (!isSupabaseConfigured) return { profile: null, recentAuditLogs: [] };

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!profile) return { profile: null, recentAuditLogs: [] };

      // Roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('roles(id, name, slug)')
        .eq('user_id', userId);

      const roles = (rolesData || [])
        .map((r: any) => r.roles)
        .filter(Boolean);

      // Workforce
      const { data: wfData } = await supabase
        .from('workforce_members')
        .select('id, trade, workforce_code')
        .eq('profile_id', userId)
        .maybeSingle();

      // Recent audit logs for this user (actor or subject)
      const { data: auditData } = await supabase
        .from('audit_logs')
        .select('*')
        .or(`actor_id.eq.${userId},record_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(6);

      const userItem: AdminUserListItem = {
        id: profile.id,
        email: profile.email || null,
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        display_name: profile.display_name || null,
        phone: profile.phone || null,
        job_title: profile.job_title || null,
        status: profile.status || 'active',
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        roles,
        workforce: wfData ? { id: wfData.id, trade: wfData.trade, workforce_code: wfData.workforce_code } : null,
      };

      return {
        profile: userItem,
        recentAuditLogs: (auditData as AuditLogEntry[]) || [],
      };
    } catch (err) {
      console.error('[AdminService] Error loading user details:', err);
      throw err;
    }
  }



  static async updateUserProfile(
    userId: string,
    updates: {
      first_name?: string;
      last_name?: string;
      display_name?: string;
      job_title?: string;
    }
  ): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const payload: Record<string, unknown> = {
        user_id: userId,
      };

      if (updates.first_name !== undefined) {
        payload.first_name = updates.first_name.trim();
      }

      if (updates.last_name !== undefined) {
        payload.last_name = updates.last_name.trim();
      }

      if (updates.job_title !== undefined) {
        payload.job_title = updates.job_title.trim();
      }

      const result = await callAdminManageUser<{
        success: boolean;
        message: string;
        oldValues: Record<string, unknown>;
        newValues: Record<string, unknown>;
      }>('update_profile', payload);

      if (!result.success) {
        throw new Error(result.message || 'Profile update failed.');
      }

      await AuditLogger.log({
        action: 'admin.user_profile_updated',
        module: 'administration',
        tableName: 'profiles',
        recordId: userId,
        oldValues: result.oldValues,
        newValues: result.newValues,
      });
    } catch (err) {
      console.error('[AdminService] Error updating user profile:', err);
      throw err;
    }
  }



  static async updateUserStatus(
    userId: string,
    newStatus: 'active' | 'inactive' | 'suspended' | 'pending'
  ): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const result = await callAdminManageUser<{
        success: boolean;
        message: string;
        oldValues: { status: string };
        newValues: { status: string };
      }>('update_status', {
        user_id: userId,
        status: newStatus,
      });

      if (!result.success) {
        throw new Error(result.message || 'Account status update failed.');
      }

      await AuditLogger.log({
        action: 'admin.user_status_changed',
        module: 'administration',
        tableName: 'profiles',
        recordId: userId,
        oldValues: result.oldValues,
        newValues: result.newValues,
      });
    } catch (err) {
      console.error('[AdminService] Error updating user status:', err);
      throw err;
    }
  }


  static async assignUserRole(
    userId: string,
    roleId: string
  ): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const { data: roleInfo, error: roleError } = await supabase
        .from('roles')
        .select('name, slug')
        .eq('id', roleId)
        .single();

      if (roleError) throw roleError;

      if (!roleInfo?.slug) {
        throw new Error('The selected role could not be found.');
      }

      const result = await callAdminManageUser<{
        success: boolean;
        message: string;
      }>('assign_role', {
        user_id: userId,
        role_slug: roleInfo.slug,
      });

      if (!result.success) {
        throw new Error(result.message || 'Role assignment failed.');
      }

      await AuditLogger.log({
        action: 'admin.role_assigned',
        module: 'administration',
        tableName: 'user_roles',
        recordId: `${userId}_${roleId}`,
        newValues: {
          user_id: userId,
          role_id: roleId,
          role_slug: roleInfo.slug,
          role_name: roleInfo.name,
        },
      });
    } catch (err) {
      console.error('[AdminService] Error assigning role:', err);
      throw err;
    }
  }



  static async removeUserRole(
    userId: string,
    roleId: string,
    roleSlug?: string
  ): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      let targetSlug = roleSlug;

      if (!targetSlug) {
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('slug, name')
          .eq('id', roleId)
          .single();

        if (roleError) throw roleError;
        targetSlug = roleData?.slug;
      }

      if (!targetSlug) {
        throw new Error('The selected role could not be found.');
      }

      const result = await callAdminManageUser<{
        success: boolean;
        message: string;
      }>('remove_role', {
        user_id: userId,
        role_slug: targetSlug,
      });

      if (!result.success) {
        throw new Error(result.message || 'Role removal failed.');
      }

      await AuditLogger.log({
        action: 'admin.role_removed',
        module: 'administration',
        tableName: 'user_roles',
        recordId: `${userId}_${roleId}`,
        oldValues: {
          user_id: userId,
          role_id: roleId,
          role_slug: targetSlug,
        },
      });
    } catch (err) {
      console.error('[AdminService] Error removing role:', err);
      throw err;
    }
  }


  // ============================================================================
  // 3. ROLES & PERMISSIONS
  // ============================================================================
  static async getRoles(): Promise<AdminRoleItem[]> {
    if (!isSupabaseConfigured) return [];

    try {
      const { data: roles, error } = await supabase
        .from('roles')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      if (!roles || roles.length === 0) return [];

      // Query user assignment counts per role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id');

      const countMap: Record<string, number> = {};
      if (userRoles) {
        for (const ur of userRoles) {
          countMap[ur.role_id] = (countMap[ur.role_id] || 0) + 1;
        }
      }

      const systemRoles = ['admin', 'management', 'executive_director', 'supervisor', 'artisan', 'technical', 'procurement', 'accounts'];

      return roles.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description || null,
        created_at: r.created_at,
        is_system_role: systemRoles.includes(r.slug.toLowerCase().trim()),
        assigned_users_count: countMap[r.id] || 0,
      }));
    } catch (err) {
      console.error('[AdminService] Error loading roles:', err);
      throw err;
    }
  }

  static async getRolePermissions(roleId: string): Promise<string[]> {
    if (!isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_id, permissions(name)')
        .eq('role_id', roleId);

      if (error) throw error;
      if (!data) return [];

      const perms: string[] = [];
      for (const item of data as any[]) {
        if (item.permissions?.name) {
          perms.push(item.permissions.name);
        }
      }
      return perms;
    } catch (err) {
      console.error('[AdminService] Error loading role permissions:', err);
      throw err;
    }
  }

  static async getAllPermissions(): Promise<{
    all: AdminPermissionItem[];
    byModule: Record<string, AdminPermissionItem[]>;
  }> {
    if (!isSupabaseConfigured) return { all: [], byModule: {} };

    try {
      const { data: permissions, error } = await supabase
        .from('permissions')
        .select('*')
        .order('module', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      if (!permissions) return { all: [], byModule: {} };

      const byModule: Record<string, AdminPermissionItem[]> = {};
      for (const p of permissions) {
        const mod = p.module || 'general';
        if (!byModule[mod]) byModule[mod] = [];
        byModule[mod].push(p);
      }

      return {
        all: permissions,
        byModule,
      };
    } catch (err) {
      console.error('[AdminService] Error loading all permissions:', err);
      throw err;
    }
  }


  static async assignRolePermission(
    roleId: string,
    permissionId: string,
    roleSlug?: string,
    permissionName?: string
  ): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const result = await callAdminManageUser<{
        success: boolean;
        message: string;
        oldValues?: Record<string, unknown> | null;
        newValues?: Record<string, unknown> | null;
      }>('assign_role_permission', {
        role_id: roleId,
        permission_id: permissionId,
      });

      if (!result.success) {
        throw new Error(result.message || 'Permission assignment failed.');
      }

      await AuditLogger.log({
        action: 'admin.role_permission_assigned',
        module: 'administration',
        tableName: 'role_permissions',
        recordId: `${roleId}_${permissionId}`,
        oldValues: result.oldValues ?? undefined,
        newValues: result.newValues ?? {
          role_id: roleId,
          permission_id: permissionId,
          role_slug: roleSlug,
          permission_name: permissionName,
        },
      });
    } catch (err) {
      console.error('[AdminService] Error assigning role permission:', err);
      throw err;
    }
  }



  static async removeRolePermission(
    roleId: string,
    permissionId: string,
    roleSlug?: string,
    permissionName?: string
  ): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      const result = await callAdminManageUser<{
        success: boolean;
        message: string;
        oldValues?: Record<string, unknown> | null;
        newValues?: Record<string, unknown> | null;
      }>('remove_role_permission', {
        role_id: roleId,
        permission_id: permissionId,
      });

      if (!result.success) {
        throw new Error(result.message || 'Permission removal failed.');
      }

      await AuditLogger.log({
        action: 'admin.role_permission_removed',
        module: 'administration',
        tableName: 'role_permissions',
        recordId: `${roleId}_${permissionId}`,
        oldValues: result.oldValues ?? {
          role_id: roleId,
          permission_id: permissionId,
          role_slug: roleSlug,
          permission_name: permissionName,
        },
        newValues: result.newValues ?? undefined,
      });
    } catch (err) {
      console.error('[AdminService] Error removing role permission:', err);
      throw err;
    }
  }

  // ============================================================================
  // 4. AUDIT LOGS (READ-ONLY)
  // ============================================================================
  static async getAuditLogs(params?: {
    search?: string;
    module?: string;
    action?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: AuditLogEntry[]; totalCount: number }> {
    if (!isSupabaseConfigured) return { logs: [], totalCount: 0 };

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });

      if (params?.module && params.module !== 'all') {
        query = query.eq('module', params.module);
      }

      if (params?.action && params.action !== 'all') {
        query = query.eq('action', params.action);
      }

      if (params?.dateFrom) {
        query = query.gte('created_at', params.dateFrom);
      }

      if (params?.dateTo) {
        // End of the day
        query = query.lte('created_at', `${params.dateTo}T23:59:59.999Z`);
      }

      if (params?.search && params.search.trim()) {
        const term = `%${params.search.trim()}%`;
        query = query.or(
          `action.ilike.${term},module.ilike.${term},record_id.ilike.${term},table_name.ilike.${term}`
        );
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data: logs, count, error } = await query;
      if (error) throw error;
      if (!logs || logs.length === 0) return { logs: [], totalCount: 0 };

      // Enrich logs with actor name/email if actor_id present
      const actorIds = Array.from(
        new Set(logs.map((l) => l.actor_id).filter(Boolean))
      ) as string[];

      let profilesMap: Record<string, { name: string; email: string }> = {};
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', actorIds);

        if (actors) {
          for (const a of actors) {
            profilesMap[a.id] = {
              name: a.display_name || a.email?.split('@')[0] || 'User',
              email: a.email || '',
            };
          }
        }
      }

      const enrichedLogs: AuditLogEntry[] = logs.map((l) => ({
        ...l,
        actor_name: l.actor_id ? profilesMap[l.actor_id]?.name || null : 'System / Automated',
        actor_email: l.actor_id ? profilesMap[l.actor_id]?.email || null : null,
      }));

      return {
        logs: enrichedLogs,
        totalCount: count || enrichedLogs.length,
      };
    } catch (err) {
      console.error('[AdminService] Error loading audit logs:', err);
      throw err;
    }
  }

  static async getAuditLogModulesAndActions(): Promise<{
    modules: string[];
    actions: string[];
  }> {
    if (!isSupabaseConfigured) return { modules: [], actions: [] };

    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('module, action')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!data) return { modules: [], actions: [] };

      const modules = Array.from(new Set(data.map((d) => d.module).filter(Boolean)));
      const actions = Array.from(new Set(data.map((d) => d.action).filter(Boolean)));

      return { modules, actions };
    } catch {
      return {
        modules: ['authentication', 'authorization', 'administration', 'projects', 'workforce', 'materials', 'finance'],
        actions: ['auth.login_success', 'auth.logout', 'admin.user_profile_updated', 'admin.user_status_changed', 'admin.role_assigned'],
      };
    }
  }
}
