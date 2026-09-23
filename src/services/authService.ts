import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

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

export interface UserRoleRecord {
  id?: string;
  name?: string;
  slug?: string;
  code?: string;
  description?: string;
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
 * Check if the selected dropdown role matches any of the assigned roles
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
        console.warn('Could not fetch from profiles table:', error.message);
        return null;
      }
      return data as UserProfile;
    } catch (err) {
      console.warn('Error querying profile:', err);
      return null;
    }
  }

  /**
   * Fetches assigned roles from user_roles and roles tables
   */
  static async getUserRoles(userId: string): Promise<string[]> {
    const assignedRoles: string[] = [];

    try {
      // 1. Check user_roles table with join on roles table
      const { data: userRolesData, error: userRolesErr } = await supabase
        .from('user_roles')
        .select('role_id, role, roles(id, name, slug, code)')
        .eq('user_id', userId);

      if (!userRolesErr && userRolesData && userRolesData.length > 0) {
        for (const item of userRolesData) {
          if (item.roles) {
            // joined roles record
            const r = item.roles as unknown as Record<string, string>;
            if (r.name) assignedRoles.push(r.name);
            if (r.slug) assignedRoles.push(r.slug);
            if (r.code) assignedRoles.push(r.code);
          }
          if (item.role) {
            assignedRoles.push(String(item.role));
          }
          if (item.role_id) {
            assignedRoles.push(String(item.role_id));
          }
        }
      }

      // 2. If user_roles was empty or missing join, try querying roles table by user_id or direct lookup
      if (assignedRoles.length === 0) {
        const { data: directRoles } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId);

        if (directRoles && directRoles.length > 0) {
          for (const ur of directRoles) {
            if (ur.role_name) assignedRoles.push(ur.role_name);
            if (ur.role) assignedRoles.push(ur.role);
            if (ur.name) assignedRoles.push(ur.name);
            if (ur.slug) assignedRoles.push(ur.slug);
            if (ur.role_id) {
              // Fetch role name from roles table
              const { data: roleRow } = await supabase
                .from('roles')
                .select('name, slug, code')
                .eq('id', ur.role_id)
                .maybeSingle();
              if (roleRow) {
                if (roleRow.name) assignedRoles.push(roleRow.name);
                if (roleRow.slug) assignedRoles.push(roleRow.slug);
                if (roleRow.code) assignedRoles.push(roleRow.code);
              }
            }
          }
        }
      }

      // 3. Also check if profiles table has a role column directly
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, job_title')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        if (profileData.role) assignedRoles.push(String(profileData.role));
        if (profileData.job_title) assignedRoles.push(String(profileData.job_title));
      }
    } catch (err) {
      console.warn('Error reading user_roles/roles:', err);
    }

    return Array.from(new Set(assignedRoles.filter(Boolean)));
  }

  /**
   * Complete login sequence:
   * 1. Validate inputs
   * 2. Sign in with Supabase Auth
   * 3. Fetch profile & check active status
   * 4. Fetch assigned roles
   * 5. Verify selected role against assigned roles
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
    primaryRoleKey: StandardRoleKey;
    redirectRoute: string;
  }> {
    const { email, password, selectedRole } = params;

    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
      );
    }

    if (!email || !email.trim()) {
      throw new Error('Please enter your email address.');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }
    if (!selectedRole) {
      throw new Error('Please select your assigned role.');
    }

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !authData.user || !authData.session) {
      if (authError?.message?.toLowerCase().includes('network')) {
        throw new Error('Network error: Unable to connect to Supabase. Please check your internet connection.');
      }
      throw new Error('Invalid credentials');
    }

    const user = authData.user;
    const session = authData.session;

    // 2. Fetch profile from profiles table
    let profile: UserProfile | null = null;
    try {
      profile = await this.getProfile(user.id);
    } catch (err) {
      console.error('Error fetching profile during login:', err);
    }

    // Check account status if present
    if (profile?.status) {
      const statusLower = profile.status.toLowerCase().trim();
      if (['inactive', 'suspended', 'disabled', 'blocked', 'banned'].includes(statusLower)) {
        await supabase.auth.signOut();
        throw new Error('Inactive account: Your account is currently inactive. Please contact your administrator.');
      }
    }

    // 3. Fetch user's assigned roles from user_roles & roles
    const assignedRoles = await this.getUserRoles(user.id);

    // If no roles returned from tables, check app_metadata / user_metadata as fallback
    if (assignedRoles.length === 0) {
      const metaRole = (user.app_metadata?.role || user.user_metadata?.role) as string | undefined;
      if (metaRole) {
        assignedRoles.push(metaRole);
      }
    }

    if (assignedRoles.length === 0) {
      await supabase.auth.signOut();
      throw new Error('No assigned role: No role is assigned to your account. Please contact an administrator.');
    }

    // 4. Compare selected role with assigned roles
    const isAuthorized = verifyRoleMatch(selectedRole, assignedRoles);

    if (!isAuthorized) {
      await supabase.auth.signOut();
      throw new Error('You are not authorized to access this role.');
    }

    const primaryRoleKey = normalizeRoleKey(selectedRole) || 'management';
    const redirectRoute = getRouteForRole(selectedRole);

    return {
      user,
      session,
      profile,
      assignedRoles,
      primaryRoleKey,
      redirectRoute,
    };
  }

  /**
   * Signs out from Supabase Auth
   */
  static async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }

  /**
   * Retrieves current session
   */
  static async getSession(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Error reading session:', error.message);
        return null;
      }
      return data.session;
    } catch {
      return null;
    }
  }
}
