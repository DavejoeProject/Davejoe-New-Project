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

export interface UserRoleRecord {
  roleId: string;
  roleName: string;
  roleSlug: string;
}

export interface RoleDiagnosticReport {
  userId: string;
  userRolesQuery: {
    attempted: string;
    rowCount: number;
    error: any;
    columnsFound: string[];
    sampleData?: any;
  };
  rolesQuery: {
    attempted: string;
    rowCount: number;
    error: any;
    sampleData?: any;
  };
  profilesQuery: {
    attempted: string;
    found: boolean;
    error: any;
    roleFieldsDetected: Record<string, any>;
  };
  classification:
    | 'SUCCESS'
    | 'A_NO_ROWS'
    | 'B_RLS_ERROR'
    | 'C_INCORRECT_RELATIONSHIP'
    | 'D_USER_ID_MISSING'
    | 'E_WRONG_FIELD'
    | 'F_UNEXPECTED_NAME';
  explanation: string;
}

export class AuthService {
  /**
   * Diagnostic logger for authentication and role resolution
   */
  static logDiagnostics(report: RoleDiagnosticReport) {
    const isError = report.classification !== 'SUCCESS';
    const headerStyle = isError
      ? 'background: #EF4444; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;'
      : 'background: #01875F; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;';

    console.groupCollapsed(
      `%c[Davejoe Auth Diagnostics] %c${report.classification}: ${report.explanation}`,
      headerStyle,
      'color: #1e293b; font-weight: 600;'
    );
    console.log('User ID:', report.userId);
    console.log('Step 1 - public.user_roles query:', report.userRolesQuery);
    console.log('Step 2 - public.roles query:', report.rolesQuery);
    console.log('Step 3 - public.profiles query:', report.profilesQuery);
    console.log('Classification:', report.classification);
    console.log('Diagnostic Details:', report.explanation);
    console.groupEnd();
  }

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
        console.warn('[Davejoe Auth Diagnostics] Could not fetch profile for user', userId, error);
        return null;
      }
      return data as UserProfile;
    } catch (err) {
      console.warn('[Davejoe Auth Diagnostics] Error querying profile:', err);
      return null;
    }
  }

  /**
   * Fetches available roles directly from Supabase public.roles table,
   * falling back to standard configured roles if RLS restricts unauthenticated read.
   */
  static async getAvailableRoles(): Promise<{ id: string; name: string; slug: string }[]> {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, slug')
        .order('name');

      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          id: String(r.id),
          name: String(r.name || r.slug),
          slug: String(r.slug || r.name).toLowerCase(),
        }));
      }
    } catch (err) {
      console.warn('[AuthService] Could not fetch public.roles from Supabase, using defaults:', err);
    }

    // Default canonical Supabase roles fallback
    return [
      { id: '1', name: 'Management / CEO', slug: 'management' },
      { id: '2', name: 'Admin / Client & Workforce Coordinator', slug: 'admin' },
      { id: '3', name: 'Technical Inspection & QC Officer', slug: 'technical' },
      { id: '4', name: 'Site Supervisor', slug: 'supervisor' },
      { id: '5', name: 'Procurement & Logistics', slug: 'procurement' },
      { id: '6', name: 'Accounts', slug: 'accounts' },
      { id: '7', name: 'Artisan / Workforce', slug: 'artisan' },
    ];
  }

  /**
   * Authoritative retrieval of assigned roles following:
   * auth.users (user_id) -> user_roles -> roles (and profiles fallback)
   */
  static async getUserRolesDetailed(userId: string): Promise<{
    roles: UserRoleRecord[];
    assignedSlugs: string[];
    assignedNames: string[];
    diagnosticReport: RoleDiagnosticReport;
  }> {
    const report: RoleDiagnosticReport = {
      userId,
      userRolesQuery: {
        attempted: "supabase.from('user_roles').select('*').eq('user_id', userId)",
        rowCount: 0,
        error: null,
        columnsFound: [],
      },
      rolesQuery: {
        attempted: "supabase.from('roles').select('*').in('id', roleIds)",
        rowCount: 0,
        error: null,
      },
      profilesQuery: {
        attempted: "supabase.from('profiles').select('*').eq('id', userId)",
        found: false,
        error: null,
        roleFieldsDetected: {},
      },
      classification: 'A_NO_ROWS',
      explanation: 'No role records identified yet.',
    };

    if (!userId) {
      report.classification = 'D_USER_ID_MISSING';
      report.explanation = 'Authenticated user ID is missing or null.';
      this.logDiagnostics(report);
      return { roles: [], assignedSlugs: [], assignedNames: [], diagnosticReport: report };
    }

    const assignedSlugs = new Set<string>();
    const assignedNames = new Set<string>();
    const roleRecords: UserRoleRecord[] = [];
    const collectedRoleIds = new Set<string>();

    // -------------------------------------------------------------
    // Step 1: Query public.user_roles with select('*')
    // -------------------------------------------------------------
    try {
      const { data: urData, error: urErr } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      report.userRolesQuery.error = urErr;

      if (urErr) {
        if (
          urErr.code === '42501' ||
          urErr.message?.toLowerCase().includes('row-level security') ||
          urErr.message?.toLowerCase().includes('permission denied')
        ) {
          report.classification = 'B_RLS_ERROR';
          report.explanation = `RLS Policy blocked SELECT on public.user_roles for user ${userId}: [${urErr.code}] ${urErr.message}`;
        } else {
          report.explanation = `Error querying public.user_roles: [${urErr.code}] ${urErr.message}`;
        }
      } else if (urData) {
        report.userRolesQuery.rowCount = urData.length;
        if (urData.length > 0) {
          report.userRolesQuery.sampleData = urData[0];
          report.userRolesQuery.columnsFound = Object.keys(urData[0]);

          for (const row of urData as Record<string, any>[]) {
            if (row.role_id) collectedRoleIds.add(String(row.role_id));
            if (row.role_slug) assignedSlugs.add(String(row.role_slug));
            if (row.slug) assignedSlugs.add(String(row.slug));
            if (row.role_name) assignedNames.add(String(row.role_name));
            if (row.name) assignedNames.add(String(row.name));
            if (row.role && typeof row.role === 'string') {
              assignedSlugs.add(row.role);
            }
          }
        }
      }
    } catch (err) {
      report.userRolesQuery.error = err;
    }

    // Also attempt embedded PostgREST relation if possible
    try {
      const { data: joinData, error: joinErr } = await supabase
        .from('user_roles')
        .select('role_id, roles(id, name, slug)')
        .eq('user_id', userId);

      if (joinErr) {
        if (joinErr.code === 'PGRST200') {
          if (report.classification !== 'B_RLS_ERROR') {
            report.classification = 'C_INCORRECT_RELATIONSHIP';
            report.explanation = `PostgREST relationship not found: user_roles -> roles [${joinErr.code}]. Using direct query fallback.`;
          }
        }
      } else if (joinData && joinData.length > 0) {
        for (const item of joinData as any[]) {
          if (item.roles) {
            const r = item.roles;
            if (r.slug) assignedSlugs.add(r.slug);
            if (r.name) assignedNames.add(r.name);
            if (r.id) {
              roleRecords.push({
                roleId: r.id,
                roleName: r.name || r.slug,
                roleSlug: r.slug || r.name,
              });
            }
          }
        }
      }
    } catch {
      // Direct roles query handles resolution
    }

    // -------------------------------------------------------------
    // Step 2: Query public.roles directly for all collected role_ids
    // -------------------------------------------------------------
    if (collectedRoleIds.size > 0) {
      try {
        const { data: rolesData, error: rolesErr } = await supabase
          .from('roles')
          .select('*')
          .in('id', Array.from(collectedRoleIds));

        report.rolesQuery.error = rolesErr;

        if (rolesErr) {
          if (
            rolesErr.code === '42501' ||
            rolesErr.message?.toLowerCase().includes('row-level security') ||
            rolesErr.message?.toLowerCase().includes('permission denied')
          ) {
            report.classification = 'B_RLS_ERROR';
            report.explanation = `RLS Policy blocked SELECT on public.roles: [${rolesErr.code}] ${rolesErr.message}`;
          }
        } else if (rolesData) {
          report.rolesQuery.rowCount = rolesData.length;
          if (rolesData.length > 0) {
            report.rolesQuery.sampleData = rolesData[0];
            for (const r of rolesData as Record<string, any>[]) {
              const slug = r.slug || r.role_slug || r.key;
              const name = r.name || r.role_name || r.title || slug;
              if (slug) assignedSlugs.add(String(slug));
              if (name) assignedNames.add(String(name));

              roleRecords.push({
                roleId: String(r.id),
                roleName: String(name),
                roleSlug: String(slug),
              });
            }
          }
        }
      } catch (err) {
        report.rolesQuery.error = err;
      }
    }

    // -------------------------------------------------------------
    // Step 3: Inspect public.profiles for role indicators
    // -------------------------------------------------------------
    try {
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      report.profilesQuery.error = profErr;
      if (profData) {
        report.profilesQuery.found = true;
        const p = profData as Record<string, any>;
        const detected: Record<string, any> = {};

        if (p.role_slug) {
          detected.role_slug = p.role_slug;
          assignedSlugs.add(String(p.role_slug));
        }
        if (p.role_name) {
          detected.role_name = p.role_name;
          assignedNames.add(String(p.role_name));
        }
        if (p.role) {
          detected.role = p.role;
          assignedSlugs.add(String(p.role));
        }
        if (p.assigned_role) {
          detected.assigned_role = p.assigned_role;
          assignedSlugs.add(String(p.assigned_role));
        }
        if (p.job_title) {
          detected.job_title = p.job_title;
        }

        report.profilesQuery.roleFieldsDetected = detected;
      }
    } catch (err) {
      report.profilesQuery.error = err;
    }

    // -------------------------------------------------------------
    // Step 4: Final Classification
    // -------------------------------------------------------------
    if (assignedSlugs.size > 0 || assignedNames.size > 0) {
      report.classification = 'SUCCESS';
      report.explanation = `Resolved ${assignedSlugs.size} role slugs: [${Array.from(assignedSlugs).join(', ')}] and ${assignedNames.size} names: [${Array.from(assignedNames).join(', ')}]`;
    } else if (report.classification !== 'B_RLS_ERROR' && report.classification !== 'D_USER_ID_MISSING') {
      if (report.userRolesQuery.rowCount === 0) {
        report.classification = 'A_NO_ROWS';
        report.explanation = `Query to public.user_roles returned 0 rows for user_id = ${userId}.`;
      } else if (report.rolesQuery.rowCount === 0 && collectedRoleIds.size > 0) {
        report.classification = 'A_NO_ROWS';
        report.explanation = `Query to public.roles returned 0 rows for role_ids: [${Array.from(collectedRoleIds).join(', ')}].`;
      } else {
        report.classification = 'E_WRONG_FIELD';
        report.explanation = 'User role rows were retrieved, but neither slug nor name fields were found in the columns.';
      }
    }

    this.logDiagnostics(report);

    return {
      roles: roleRecords,
      assignedSlugs: Array.from(assignedSlugs),
      assignedNames: Array.from(assignedNames),
      diagnosticReport: report,
    };
  }

  /**
   * Authoritative retrieval of assigned roles from database user_roles table.
   */
  static async getUserRoles(userId: string): Promise<string[]> {
    const { assignedSlugs, assignedNames } = await this.getUserRolesDetailed(userId);
    return Array.from(new Set([...assignedSlugs, ...assignedNames]));
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
   * 3. Authoritatively verify authenticated user with supabase.auth.getUser()
   * 4. Fetch profile & verify active status (suspend/inactive check)
   * 5. Authoritatively fetch assigned roles from public.user_roles -> public.roles
   * 6. Enforce that only roles.slug === 'management' is granted active dashboard access
   * 7. Fetch granular permissions & record security audit log
   */
  static async signIn(params: {
    email: string;
    password: string;
    selectedRole?: string;
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

    const sanitizedEmail = sanitizeString(email).trim().toLowerCase();

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

    // Authoritative verification via getUser() as per security requirements
    const {
      data: { user: verifiedUser },
    } = await supabase.auth.getUser();

    const user = verifiedUser || authData.user;
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

    // 4. Authoritatively resolve assigned roles from public.user_roles -> public.roles
    const { assignedSlugs, assignedNames, diagnosticReport } = await this.getUserRolesDetailed(user.id);
    const assignedRoles = Array.from(new Set([...assignedSlugs, ...assignedNames]));

    if (assignedRoles.length === 0) {
      await supabase.auth.signOut();
      await AuditLogger.log({
        action: 'auth.no_role_assigned',
        module: 'authentication',
        recordId: user.id,
        oldValues: { email: sanitizedEmail },
      });

      if (diagnosticReport.classification === 'B_RLS_ERROR') {
        throw new Error(
          `Database authorization error: RLS policy prevented reading assigned roles for user ${user.id}.`
        );
      }
      throw new Error('No assigned role found for this account. Please contact an administrator.');
    }

    // 5. Database role is the SOLE source of truth
    // Authenticated user's authoritative role slug strictly resolved from Supabase
    const authenticatedUserRoleSlug: string | null =
      assignedSlugs.find((s) => s.toLowerCase().trim() === 'management') ||
      (assignedSlugs[0] ? assignedSlugs[0].toLowerCase().trim() : null);

    // Selected role slug from the login form
    const selectedRoleSlug: StandardRoleKey | null = normalizeRoleKey(selectedRole);

    // Core Authorization Rule:
    // If a role was selected, selectedRoleSlug MUST match authenticatedUserRoleSlug.
    // Selecting another role (e.g. Artisan, Accounts, Admin, etc.) with Management credentials MUST be denied.
    if (selectedRole && selectedRole.trim()) {
      const isRoleMatch = Boolean(
        selectedRoleSlug &&
        authenticatedUserRoleSlug &&
        selectedRoleSlug === authenticatedUserRoleSlug
      );

      if (!isRoleMatch) {
        // Immediate sign out so NO session or credentials linger
        await supabase.auth.signOut();
        await AuditLogger.log({
          action: 'auth.role_mismatch_denied',
          module: 'authorization',
          recordId: user.id,
          oldValues: {
            email: sanitizedEmail,
            selectedRole,
            selectedRoleSlug,
            authenticatedUserRoleSlug,
            assignedRoles,
          },
        });

        const error = new Error('These login details are not assigned to the selected role.');
        (error as any).secondaryText = 'Please select the role assigned to this account.';
        (error as any).selectedRole = selectedRole;
        (error as any).isRoleMismatch = true;
        throw error;
      }
    }

    // Role Activation Rule:
    // For this development stage:
    // Management / CEO (slug: 'management') is ACTIVE.
    // All other roles (Admin, QC, Supervisor, Procurement, Accounts, Artisan) are NOT YET ACTIVE.
    if (selectedRoleSlug && selectedRoleSlug !== 'management') {
      await supabase.auth.signOut();
      const roleName = selectedRole || 'This role';
      const error = new Error(`${roleName} access is not yet available.`);
      (error as any).secondaryText = 'Accounts for this role and its dashboard have not been activated yet.';
      (error as any).isNotYetActive = true;
      throw error;
    }

    // Authenticated user's database role must also be 'management'
    const isManagement = authenticatedUserRoleSlug === 'management';
    if (!isManagement) {
      await supabase.auth.signOut();
      const error = new Error('These login details are not assigned to the selected role.');
      (error as any).secondaryText = 'Please select the role assigned to this account.';
      throw error;
    }

    // Only if selectedRoleSlug === 'management' AND authenticatedUserRoleSlug === 'management':
    const primaryRoleKey: StandardRoleKey = 'management';
    const redirectRoute = '/management';

    // 6. Fetch granular permissions
    const permissions = await this.getUserPermissions(user.id, isManagement);

    // 7. Audit successful sign-in
    await AuditLogger.log({
      action: 'auth.login_success',
      module: 'authentication',
      recordId: user.id,
      newValues: {
        email: sanitizedEmail,
        selectedRole: selectedRole || null,
        selectedRoleSlug,
        authenticatedUserRoleSlug,
        primaryRoleKey,
        assignedRoles,
        redirectRoute,
      },
    });

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
   * Resolves currently authenticated user and authoritative database role
   */
  static async resolveCurrentUserRole(): Promise<{
    user: User | null;
    profile: UserProfile | null;
    assignedRoles: string[];
    primaryRoleKey: StandardRoleKey | null;
    redirectRoute: string;
  }> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        user: null,
        profile: null,
        assignedRoles: [],
        primaryRoleKey: null,
        redirectRoute: '/login',
      };
    }

    const profile = await this.getProfile(user.id);
    const { assignedSlugs, assignedNames } = await this.getUserRolesDetailed(user.id);
    const assignedRoles = Array.from(new Set([...assignedSlugs, ...assignedNames]));

    const isManagement =
      assignedSlugs.some((s) => s.toLowerCase().trim() === 'management') ||
      assignedRoles.some((r) => normalizeRoleKey(r) === 'management');

    if (isManagement) {
      return {
        user,
        profile,
        assignedRoles,
        primaryRoleKey: 'management',
        redirectRoute: '/management',
      };
    }

    const firstRole =
      (assignedSlugs[0] ? normalizeRoleKey(assignedSlugs[0]) : null) ||
      (assignedRoles[0] ? normalizeRoleKey(assignedRoles[0]) : null);

    return {
      user,
      profile,
      assignedRoles,
      primaryRoleKey: firstRole,
      redirectRoute: '/access-denied',
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
