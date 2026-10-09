import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuditLogger } from '../lib/audit';
import { UserProfile, StandardRoleKey, normalizeRoleKey } from './authService';

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
      // Fetch previous values for audit trail
      const { data: previous } = await supabase
        .from('profiles')
        .select('first_name, last_name, display_name, job_title')
        .eq('id', userId)
        .single();

      const sanitizedUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.first_name !== undefined) sanitizedUpdates.first_name = updates.first_name.trim();
      if (updates.last_name !== undefined) sanitizedUpdates.last_name = updates.last_name.trim();
      if (updates.display_name !== undefined) sanitizedUpdates.display_name = updates.display_name.trim();
      if (updates.job_title !== undefined) sanitizedUpdates.job_title = updates.job_title.trim();

      const { error } = await supabase
        .from('profiles')
        .update(sanitizedUpdates)
        .eq('id', userId);

      if (error) throw error;

      await AuditLogger.log({
        action: 'admin.user_profile_updated',
        module: 'administration',
        tableName: 'profiles',
        recordId: userId,
        oldValues: previous || undefined,
        newValues: sanitizedUpdates,
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
      const { data: previous } = await supabase
        .from('profiles')
        .select('status, email, display_name')
        .eq('id', userId)
        .single();

      const { error } = await supabase
        .from('profiles')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      await AuditLogger.log({
        action: 'admin.user_status_changed',
        module: 'administration',
        tableName: 'profiles',
        recordId: userId,
        oldValues: { status: previous?.status },
        newValues: { status: newStatus },
      });
    } catch (err) {
      console.error('[AdminService] Error updating user status:', err);
      throw err;
    }
  }

  static async assignUserRole(userId: string, roleId: string): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Verify not already assigned
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role_id', roleId)
        .maybeSingle();

      if (existing) {
        return; // Already assigned idempotently
      }

      // 2. Fetch role name and slug for audit logging
      const { data: roleInfo } = await supabase
        .from('roles')
        .select('name, slug')
        .eq('id', roleId)
        .single();

      // 3. Insert assignment
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
        });

      if (error) throw error;

      await AuditLogger.log({
        action: 'admin.role_assigned',
        module: 'administration',
        tableName: 'user_roles',
        recordId: `${userId}_${roleId}`,
        newValues: {
          user_id: userId,
          role_id: roleId,
          role_slug: roleInfo?.slug,
          role_name: roleInfo?.name,
        },
      });
    } catch (err) {
      console.error('[AdminService] Error assigning role:', err);
      throw err;
    }
  }

  static async removeUserRole(userId: string, roleId: string, roleSlug?: string): Promise<void> {
    if (!isSupabaseConfigured) return;

    try {
      // 1. Determine role slug if not provided
      let targetSlug = roleSlug;
      if (!targetSlug) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('slug, name')
          .eq('id', roleId)
          .single();
        targetSlug = roleData?.slug;
      }

      // 2. CRITICAL PROTECTION: Check if user is the last active Admin in the system
      if (targetSlug === 'admin') {
        const { data: adminRole } = await supabase
          .from('roles')
          .select('id')
          .eq('slug', 'admin')
          .single();

        if (adminRole) {
          const { count: adminCount } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', adminRole.id);

          if ((adminCount || 0) <= 1) {
            throw new Error(
              'Cannot remove Admin role: This account is the last active Administrator in the system. At least one Administrator must remain assigned to preserve system control.'
            );
          }
        }
      }

      // 3. Delete assignment
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', roleId);

      if (error) throw error;

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
      const { error } = await supabase
        .from('role_permissions')
        .insert({
          role_id: roleId,
          permission_id: permissionId,
        });

      if (error && error.code !== '23505') {
        // 23505 is unique violation (already assigned), ignore
        throw error;
      }

      await AuditLogger.log({
        action: 'admin.role_permission_assigned',
        module: 'administration',
        tableName: 'role_permissions',
        recordId: `${roleId}_${permissionId}`,
        newValues: {
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
      // PROTECT ADMIN ESSENTIAL PERMISSIONS
      if (
        roleSlug === 'admin' &&
        permissionName &&
        ['roles.manage', 'users.manage', 'users.view', 'audit.view'].includes(permissionName)
      ) {
        throw new Error(
          `Cannot remove essential administrative permission "${permissionName}" from the Admin role.`
        );
      }

      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role_id', roleId)
        .eq('permission_id', permissionId);

      if (error) throw error;

      await AuditLogger.log({
        action: 'admin.role_permission_removed',
        module: 'administration',
        tableName: 'role_permissions',
        recordId: `${roleId}_${permissionId}`,
        oldValues: {
          role_id: roleId,
          permission_id: permissionId,
          role_slug: roleSlug,
          permission_name: permissionName,
        },
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
