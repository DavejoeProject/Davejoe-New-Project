import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { validateEmail, validatePassword, sanitizeString } from '../lib/validation';
import { AuditLogger } from '../lib/audit';

export interface UserProfile {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  status?: string;
  job_title?: string;
  avatar_url?: string;
  created_at?: string;
}

export type StandardRoleKey =
  | 'management'
  | 'admin'
  | 'technical'
  | 'supervisor'
  | 'procurement'
  | 'accounts'
  | 'artisan';

export interface RoleConfig {
  key: StandardRoleKey;
  label: string;
  route: string;
  aliases: string[];
}

export const ROLE_CONFIGS: Record<StandardRoleKey, RoleConfig> = {
  management: {
    key: 'management',
    label: 'Management / CEO',
    route: '/management',
    aliases: ['management', 'ceo', 'management / ceo', 'executive', 'director', 'managing_director'],
  },
  admin: {
    key: 'admin',
    label: 'Admin / Client & Workforce Coordinator',
    route: '/admin',
    aliases: ['admin', 'administrator', 'coordinator', 'admin / client & workforce coordinator', 'workforce coordinator'],
  },
  technical: {
    key: 'technical',
    label: 'Technical Inspection & QC Officer',
    route: '/technical',
    aliases: ['technical', 'qc', 'qc officer', 'inspection', 'technical inspection & qc officer', 'quality_control'],
  },
  supervisor: {
    key: 'supervisor',
    label: 'Site Supervisor',
    route: '/supervisor',
    aliases: ['supervisor', 'site supervisor', 'site_supervisor', 'site_engineer'],
  },
  procurement: {
    key: 'procurement',
    label: 'Procurement & Logistics',
    route: '/procurement',
    aliases: ['procurement', 'logistics', 'procurement & logistics', 'procurement_logistics', 'supply_chain'],
  },
  accounts: {
    key: 'accounts',
    label: 'Accounts',
    route: '/accounts',
    aliases: ['accounts', 'accountant', 'finance', 'accounting'],
  },
  artisan: {
    key: 'artisan',
    label: 'Artisan / Workforce',
    route: '/artisan',
    aliases: ['artisan', 'workforce', 'artisan / workforce', 'worker', 'contractor'],
  },
};

/**
 * Normalizes any string representation of a role to its StandardRoleKey
 */
export function normalizeRoleKey(roleInput: string | null | undefined): StandardRoleKey | null {
  if (!roleInput) return null;
  const cleaned = roleInput.trim().toLowerCase().replace(/[-_]/g, ' ');

  for (const [key, config] of Object.entries(ROLE_CONFIGS) as [StandardRoleKey, RoleConfig][]) {
    if (cleaned === key || cleaned === config.label.toLowerCase()) {
      return key;
    }
    for (const alias of config.aliases) {
      if (cleaned === alias.toLowerCase()) {
        return key;
      }
    }
  }

  // Substring checks
  if (cleaned.includes('ceo') || cleaned.includes('management')) return 'management';
  if (cleaned.includes('admin') || cleaned.includes('coordinator')) return 'admin';
  if (cleaned.includes('qc') || cleaned.includes('inspection') || cleaned.includes('technical')) return 'technical';
  if (cleaned.includes('supervisor')) return 'supervisor';
  if (cleaned.includes('procurement') || cleaned.includes('logistics')) return 'procurement';
  if (cleaned.includes('account') || cleaned.includes('finance')) return 'accounts';
  if (cleaned.includes('artisan') || cleaned.includes('workforce')) return 'artisan';

  return null;
}

/**
 * Compares selected UI role against authoritative database-assigned roles
 */
export function verifyRoleMatch(selectedRole: string, assignedRoles: string[]): boolean {
  const selectedKey = normalizeRoleKey(selectedRole);
  if (!selectedKey) return false;

  return assignedRoles.some((assigned) => {
    const assignedKey = normalizeRoleKey(assigned);
    return assignedKey === selectedKey;
  });
}

/**
 * Get route for a given role
 */
export function getRouteForRole(roleInput: string): string {
  const key = normalizeRoleKey(roleInput);
  if (key && ROLE_CONFIGS[key]) {
    return ROLE_CONFIGS[key].route;
  }
  return '/login';
}

export class AuthService {
  /**
   * Fetches user profile from profiles table
   */
  static async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[AuthService] Could not fetch profile:', error.message);
        return null;
      }
      return data as UserProfile;
    } catch (err) {
      console.warn('[AuthService] Error querying profile:', err);
      return null;
    }
  }

  /**
   * Authoritative retrieval of assigned roles from database user_roles table.
   * SECURITY HARDENED:
   * - Ignores arbitrary profile fields (e.g. job_title) to prevent privilege escalation.
   * - Ignores client-controllable user_metadata.
   * - Only evaluates database user_roles table joined with roles table.
   */
  static async getUserRoles(userId: string): Promise<string[]> {
    const assignedRoles: string[] = [];

    try {
      // Primary authoritative query: user_roles joined with roles
      const { data: userRolesData, error: userRolesErr } = await supabase
        .from('user_roles')
        .select('role_id, role, roles(id, name, slug)')
        .eq('user_id', userId);

      if (!userRolesErr && userRolesData && userRolesData.length > 0) {
        for (const item of userRolesData) {
          if (item.roles) {
            const r = item.roles as unknown as Record<string, string>;
            if (r.slug) assignedRoles.push(r.slug);
            if (r.name) assignedRoles.push(r.name);
          } else if (item.role) {
            assignedRoles.push(String(item.role));
          }
        }
      }

      // If user_roles was empty or unjoined, check direct roles lookup by role_id
      if (assignedRoles.length === 0) {
        const { data: directRoles } = await supabase
          .from('user_roles')
          .select('role_id, role_name, role, slug')
          .eq('user_id', userId);

        if (directRoles && directRoles.length > 0) {
          for (const ur of directRoles) {
            if (ur.slug) assignedRoles.push(ur.slug);
            if (ur.role_name) assignedRoles.push(ur.role_name);
            if (ur.role) assignedRoles.push(ur.role);
            if (ur.role_id) {
              const { data: roleRow } = await supabase
                .from('roles')
                .select('name, slug')
                .eq('id', ur.role_id)
                .maybeSingle();
              if (roleRow) {
                if (roleRow.slug) assignedRoles.push(roleRow.slug);
                if (roleRow.name) assignedRoles.push(roleRow.name);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error reading user_roles:', err);
    }

    return Array.from(new Set(assignedRoles.filter(Boolean)));
  }

  /**
   * Retrieves granular permissions (module.action) assigned to the user
   * via user_roles -> role_permissions -> permissions.
   */
  static async getUserPermissions(userId: string, isManagement: boolean = false): Promise<string[]> {
    const permissions: Set<string> = new Set();

    if (isManagement) {
      // Management role has wildcard access across all modules
      permissions.add('*');
    }

    try {
      // Query user's roles first
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId);

      if (userRoles && userRoles.length > 0) {
        const roleIds = userRoles.map((ur) => ur.role_id).filter(Boolean);

        if (roleIds.length > 0) {
          const { data: rolePerms } = await supabase
            .from('role_permissions')
            .select('permission_id, permissions(name)')
            .in('role_id', roleIds);

          if (rolePerms) {
            for (const rp of rolePerms) {
              const p = rp.permissions as unknown as { name?: string };
              if (p?.name) {
                permissions.add(p.name);
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error loading user permissions:', err);
    }

    return Array.from(permissions);
  }

  /**
   * Complete hardened login sequence:
   * 1. Validate inputs (ReDoS and length limits)
   * 2. Authenticate against Supabase Auth
   * 3. Fetch profile & verify active status (suspend/inactive check)
   * 4. Authoritatively fetch assigned roles from user_roles
   * 5. Verify selected role against assigned roles (deny unauthorized selection)
   * 6. Fetch granular permissions
   * 7. Record security audit log
   */
  static async signIn(params: {
    email: string;
    password: string;
    selectedRole: string;
  }): Promise<{
    user: User;
    session: Session;
    profile: UserProfile | null;
    assignedRoles: string[];
    permissions: string[];
    primaryRoleKey: StandardRoleKey;
    redirectRoute: string;
  }> {
    const { email, password, selectedRole } = params;

    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment.'
      );
    }

    // Input validation
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      throw new Error(emailValidation.error || 'Please enter a valid email address.');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.error || 'Password does not meet security requirements.');
    }

    if (!selectedRole || !selectedRole.trim()) {
      throw new Error('Please select your assigned role from the list.');
    }

    const sanitizedEmail = sanitizeString(email).toLowerCase();

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      // Audit log failed sign-in attempt
      await AuditLogger.log({
        action: 'auth.login_failed',
        module: 'authentication',
        oldValues: { email: sanitizedEmail },
      });

      if (authError?.message?.toLowerCase().includes('network')) {
        throw new Error('Network error: Unable to connect to Supabase. Please check your internet connection.');
      }
      throw new Error('Invalid credentials. Please verify your email and password.');
    }

    const user = authData.user;
    const session = authData.session;

    // 2. Fetch profile from profiles table
    const profile = await this.getProfile(user.id);

    // 3. Verify account status
    if (profile?.status) {
      const statusLower = profile.status.toLowerCase().trim();
      if (['inactive', 'suspended', 'disabled', 'blocked', 'banned'].includes(statusLower)) {
        await supabase.auth.signOut();
        await AuditLogger.log({
          action: 'auth.inactive_login_blocked',
          module: 'authentication',
          recordId: user.id,
          oldValues: { email: sanitizedEmail, status: profile.status },
        });
        throw new Error('Your account is inactive. Please contact an administrator.');
      }
    }

    // 4. Fetch assigned roles from user_roles
    const assignedRoles = await this.getUserRoles(user.id);

    if (assignedRoles.length === 0) {
      await supabase.auth.signOut();
      await AuditLogger.log({
        action: 'auth.no_role_assigned',
        module: 'authentication',
        recordId: user.id,
        oldValues: { email: sanitizedEmail },
      });
      throw new Error('No assigned role found for this account. Please contact an administrator.');
    }

    // 5. Authorize selected role against database assigned roles
    const isAuthorized = verifyRoleMatch(selectedRole, assignedRoles);

    if (!isAuthorized) {
      await supabase.auth.signOut();
      await AuditLogger.log({
        action: 'auth.unauthorized_role_attempt',
        module: 'authorization',
        recordId: user.id,
        oldValues: {
          email: sanitizedEmail,
          selectedRole,
          assignedRoles,
        },
      });
      throw new Error('You are not authorized to access this role.');
    }

    const primaryRoleKey = normalizeRoleKey(selectedRole) || 'management';
    const isManagement = primaryRoleKey === 'management';

    // 6. Fetch granular permissions
    const permissions = await this.getUserPermissions(user.id, isManagement);

    // 7. Audit successful sign-in
    await AuditLogger.log({
      action: 'auth.login_success',
      module: 'authentication',
      recordId: user.id,
      newValues: {
        email: sanitizedEmail,
        selectedRole,
        primaryRoleKey,
      },
    });

    const redirectRoute = getRouteForRole(selectedRole);

    return {
      user,
      session,
      profile,
      assignedRoles,
      permissions,
      primaryRoleKey,
      redirectRoute,
    };
  }

  /**
   * Hardened sign out
   */
  static async signOut(): Promise<void> {
    try {
      await AuditLogger.log({
        action: 'auth.logout',
        module: 'authentication',
      });
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AuthService] Error during sign out:', err);
    }
  }

  /**
   * Retrieves current session
   */
  static async getSession(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[AuthService] Error reading session:', error.message);
        return null;
      }
      return data.session;
    } catch {
      return null;
    }
  }
}
