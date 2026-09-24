import { useContext } from 'react';
import { AuthContext, AuthContextType } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export interface AuthDiagnosticTrace {
  userId: string | null;
  profiles: {
    attempted: string;
    rowCount: number;
    data: any;
    error: any;
    status: 'FOUND' | 'EMPTY_SET' | 'RLS_BLOCKED' | 'ERROR';
  };
  userRoles: {
    attempted: string;
    rowCount: number;
    data: any[];
    error: any;
    status: 'FOUND' | 'EMPTY_SET' | 'RLS_BLOCKED' | 'ERROR';
  };
  joinQuery: {
    attempted: string;
    rowCount: number;
    data: any[];
    error: any;
    status: 'FOUND' | 'EMPTY_SET' | 'RLS_BLOCKED' | 'RELATION_NOT_FOUND' | 'ERROR';
  };
  roles: {
    attempted: string;
    rowCount: number;
    data: any[];
    error: any;
    status: 'FOUND' | 'EMPTY_SET' | 'RLS_BLOCKED' | 'ERROR';
  };
  hasManagementSlug: boolean;
  resolvedSlugs: string[];
  resolvedNames: string[];
  diagnosis: string;
}

/**
 * Diagnostic log function to explicitly trace the data fetch from:
 * 1. public.profiles
 * 2. public.user_roles
 * 3. PostgREST JOIN between public.user_roles and public.roles
 * 4. public.roles
 *
 * Outputs the full diagnostic trace and JOIN query results directly to the browser console.
 */
export async function traceAuthDatabaseFetch(explicitUserId?: string): Promise<AuthDiagnosticTrace> {
  let targetUserId: string | null = explicitUserId || null;

  if (!targetUserId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    targetUserId = user?.id || null;
  }

  const result: AuthDiagnosticTrace = {
    userId: targetUserId,
    profiles: {
      attempted: `supabase.from('profiles').select('*').eq('id', '${targetUserId}')`,
      rowCount: 0,
      data: null,
      error: null,
      status: 'EMPTY_SET',
    },
    userRoles: {
      attempted: `supabase.from('user_roles').select('*').eq('user_id', '${targetUserId}')`,
      rowCount: 0,
      data: [],
      error: null,
      status: 'EMPTY_SET',
    },
    joinQuery: {
      attempted: `supabase.from('user_roles').select('user_id, role_id, roles(id, name, slug)').eq('user_id', '${targetUserId}')`,
      rowCount: 0,
      data: [],
      error: null,
      status: 'EMPTY_SET',
    },
    roles: {
      attempted: `supabase.from('roles').select('id, name, slug')`,
      rowCount: 0,
      data: [],
      error: null,
      status: 'EMPTY_SET',
    },
    hasManagementSlug: false,
    resolvedSlugs: [],
    resolvedNames: [],
    diagnosis: '',
  };

  console.group(
    '%c[Davejoe Auth Diagnostics] 🔍 Tracing Supabase Database Role Authorization',
    'color: #01875F; font-weight: bold; font-size: 13px; padding: 2px 4px;'
  );

  console.log('%cAuthenticated User ID:%c ' + (targetUserId || 'NONE'), 'font-weight: bold;', 'color: #0284c7;');

  if (!targetUserId) {
    result.diagnosis = 'No authenticated user ID found. Please log in first.';
    console.warn('[Davejoe Auth Diagnostics] ⚠️ No authenticated user session found.');
    console.groupEnd();
    return result;
  }

  // -------------------------------------------------------------------------
  // 1. Trace public.profiles
  // -------------------------------------------------------------------------
  console.groupCollapsed('%c1. public.profiles Lookup', 'color: #334155; font-weight: 600;');
  try {
    const { data: profData, error: profError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    result.profiles.data = profData;
    result.profiles.error = profError;

    if (profError) {
      if (profError.code === '42501' || profError.message?.toLowerCase().includes('row-level security')) {
        result.profiles.status = 'RLS_BLOCKED';
        console.error('❌ public.profiles: RLS POLICY BLOCKED READ', profError);
      } else {
        result.profiles.status = 'ERROR';
        console.error('❌ public.profiles: Database error', profError);
      }
    } else if (!profData) {
      result.profiles.status = 'EMPTY_SET';
      result.profiles.rowCount = 0;
      console.warn('⚠️ public.profiles: Returned EMPTY SET (0 rows for user_id = ' + targetUserId + ')');
    } else {
      result.profiles.status = 'FOUND';
      result.profiles.rowCount = 1;
      console.log('✓ public.profiles row found:', profData);
      if (profData.role_slug) result.resolvedSlugs.push(String(profData.role_slug).toLowerCase());
      if (profData.role_name) result.resolvedNames.push(String(profData.role_name));
    }
  } catch (err) {
    result.profiles.error = err;
    result.profiles.status = 'ERROR';
    console.error('❌ public.profiles exception:', err);
  }
  console.groupEnd();

  // -------------------------------------------------------------------------
  // 2. Trace public.user_roles
  // -------------------------------------------------------------------------
  console.groupCollapsed('%c2. public.user_roles Lookup', 'color: #334155; font-weight: 600;');
  const collectedRoleIds: string[] = [];
  try {
    const { data: urData, error: urError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', targetUserId);

    result.userRoles.data = urData || [];
    result.userRoles.error = urError;

    if (urError) {
      if (urError.code === '42501' || urError.message?.toLowerCase().includes('row-level security')) {
        result.userRoles.status = 'RLS_BLOCKED';
        console.error('❌ public.user_roles: RLS POLICY BLOCKED READ (Code 42501)', urError);
      } else {
        result.userRoles.status = 'ERROR';
        console.error('❌ public.user_roles: Database error', urError);
      }
    } else if (!urData || urData.length === 0) {
      result.userRoles.status = 'EMPTY_SET';
      result.userRoles.rowCount = 0;
      console.warn('⚠️ public.user_roles: Returned EMPTY SET (0 rows for user_id = ' + targetUserId + ')');
    } else {
      result.userRoles.status = 'FOUND';
      result.userRoles.rowCount = urData.length;
      console.log(`✓ public.user_roles: Found ${urData.length} assigned row(s):`, urData);

      for (const row of urData as Record<string, any>[]) {
        if (row.role_id) collectedRoleIds.push(String(row.role_id));
        if (row.role_slug) result.resolvedSlugs.push(String(row.role_slug).toLowerCase());
        if (row.slug) result.resolvedSlugs.push(String(row.slug).toLowerCase());
        if (row.role_name) result.resolvedNames.push(String(row.role_name));
      }
    }
  } catch (err) {
    result.userRoles.error = err;
    result.userRoles.status = 'ERROR';
    console.error('❌ public.user_roles exception:', err);
  }
  console.groupEnd();

  // -------------------------------------------------------------------------
  // 3. Trace PostgREST JOIN Query: user_roles -> roles
  // -------------------------------------------------------------------------
  console.group('%c3. PostgREST JOIN: user_roles ⟕ roles', 'color: #01875F; font-weight: bold;');
  try {
    const { data: joinData, error: joinError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role_id,
        roles (
          id,
          name,
          slug
        )
      `)
      .eq('user_id', targetUserId);

    result.joinQuery.data = joinData || [];
    result.joinQuery.error = joinError;

    if (joinError) {
      if (joinError.code === '42501' || joinError.message?.toLowerCase().includes('row-level security')) {
        result.joinQuery.status = 'RLS_BLOCKED';
        console.error('❌ JOIN Query RLS BLOCKED:', joinError.message);
      } else if (joinError.code === 'PGRST200') {
        result.joinQuery.status = 'RELATION_NOT_FOUND';
        console.warn('⚠️ PostgREST foreign key relationship user_roles->roles not exposed. Falling back to multi-step query.');
      } else {
        result.joinQuery.status = 'ERROR';
        console.error('❌ JOIN Query error:', joinError);
      }
    } else if (!joinData || joinData.length === 0) {
      result.joinQuery.status = 'EMPTY_SET';
      result.joinQuery.rowCount = 0;
      console.warn('⚠️ JOIN Query returned EMPTY SET (0 rows matched for user_id = ' + targetUserId + ')');
    } else {
      result.joinQuery.status = 'FOUND';
      result.joinQuery.rowCount = joinData.length;
      console.log('✓ JOIN query executed successfully. Row count:', joinData.length);
      console.table(
        joinData.map((item: any) => ({
          user_id: item.user_id,
          role_id: item.role_id,
          role_name: item.roles?.name || '(null)',
          role_slug: item.roles?.slug || '(null)',
        }))
      );

      for (const item of joinData as any[]) {
        if (item.roles) {
          const r = item.roles;
          if (r.slug) result.resolvedSlugs.push(String(r.slug).toLowerCase().trim());
          if (r.name) result.resolvedNames.push(String(r.name));
        }
      }
    }
  } catch (err) {
    result.joinQuery.error = err;
    result.joinQuery.status = 'ERROR';
    console.error('❌ JOIN Query exception:', err);
  }
  console.groupEnd();

  // -------------------------------------------------------------------------
  // 4. Trace public.roles Direct Table Lookup
  // -------------------------------------------------------------------------
  console.groupCollapsed('%c4. public.roles Table Lookup', 'color: #334155; font-weight: 600;');
  try {
    let rolesQuery = supabase.from('roles').select('id, name, slug');
    if (collectedRoleIds.length > 0) {
      rolesQuery = rolesQuery.in('id', collectedRoleIds);
    }

    const { data: rolesData, error: rolesError } = await rolesQuery;
    result.roles.data = rolesData || [];
    result.roles.error = rolesError;

    if (rolesError) {
      if (rolesError.code === '42501' || rolesError.message?.toLowerCase().includes('row-level security')) {
        result.roles.status = 'RLS_BLOCKED';
        console.error('❌ public.roles: RLS POLICY BLOCKED READ (Code 42501)', rolesError);
      } else {
        result.roles.status = 'ERROR';
        console.error('❌ public.roles: Database error', rolesError);
      }
    } else if (!rolesData || rolesData.length === 0) {
      result.roles.status = 'EMPTY_SET';
      result.roles.rowCount = 0;
      console.warn('⚠️ public.roles: Returned EMPTY SET (0 rows for role_ids)');
    } else {
      result.roles.status = 'FOUND';
      result.roles.rowCount = rolesData.length;
      console.log(`✓ public.roles: Found ${rolesData.length} role definition(s):`, rolesData);

      for (const r of rolesData as any[]) {
        const slug = r.slug || r.role_slug;
        const name = r.name || r.role_name;
        if (slug) result.resolvedSlugs.push(String(slug).toLowerCase().trim());
        if (name) result.resolvedNames.push(String(name));
      }
    }
  } catch (err) {
    result.roles.error = err;
    result.roles.status = 'ERROR';
    console.error('❌ public.roles exception:', err);
  }
  console.groupEnd();

  // -------------------------------------------------------------------------
  // 5. Final Synthesis & Slug Verification
  // -------------------------------------------------------------------------
  const uniqueSlugs = Array.from(new Set(result.resolvedSlugs.map((s) => s.toLowerCase().trim())));
  const uniqueNames = Array.from(new Set(result.resolvedNames));
  result.resolvedSlugs = uniqueSlugs;
  result.resolvedNames = uniqueNames;

  result.hasManagementSlug = uniqueSlugs.includes('management');

  if (result.hasManagementSlug) {
    result.diagnosis = `CONFIRMED: Role slug 'management' is correctly retrieved for user ID ${targetUserId}. Authorizes CEO/Management dashboard.`;
    console.log(
      '%c✓ DIAGNOSTIC VERDICT: SUCCESS%c\nRole slug %c"management"%c was successfully resolved from the database!\nAssigned Slugs: ' +
        JSON.stringify(uniqueSlugs) +
        '\nAssigned Names: ' +
        JSON.stringify(uniqueNames),
      'background: #E6F4EA; color: #01875F; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
      'color: inherit;',
      'color: #01875F; font-weight: bold;',
      'color: inherit;'
    );
  } else if (uniqueSlugs.length > 0) {
    result.diagnosis = `User has non-management database role(s): [${uniqueSlugs.join(', ')}]. Access to /management should be denied.`;
    console.log(
      '%cℹ️ DIAGNOSTIC VERDICT: NON-MANAGEMENT ROLE%c\nResolved Slugs: ' + JSON.stringify(uniqueSlugs),
      'background: #EFF6FF; color: #1D4ED8; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
      'color: inherit;'
    );
  } else {
    // Check if RLS blocked any query
    const rlsBlocked = [result.profiles, result.userRoles, result.joinQuery, result.roles].some(
      (q) => q.status === 'RLS_BLOCKED'
    );
    if (rlsBlocked) {
      result.diagnosis = `FAILED: Database RLS policy prevented reading role tables for user ID ${targetUserId}.`;
      console.error(
        '%c❌ DIAGNOSTIC VERDICT: RLS POLICY ERROR%c\nOne or more tables blocked SELECT for this authenticated user.',
        'background: #FEE2E2; color: #DC2626; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
        'color: inherit;'
      );
    } else {
      result.diagnosis = `FAILED: No role records found in public.user_roles or public.roles for user ID ${targetUserId}.`;
      console.error(
        '%c❌ DIAGNOSTIC VERDICT: EMPTY ROLE SET%c\nNo user_roles records found for user ID ' + targetUserId,
        'background: #FEF3C7; color: #D97706; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
        'color: inherit;'
      );
    }
  }

  console.groupEnd();
  return result;
}

/**
 * useAuth Hook providing AuthContext + Diagnostic Tracer
 */
export const useAuth = (): AuthContextType & {
  runAuthDiagnostics: (userId?: string) => Promise<AuthDiagnosticTrace>;
} => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return {
    ...context,
    runAuthDiagnostics: traceAuthDatabaseFetch,
  };
};

export default useAuth;
