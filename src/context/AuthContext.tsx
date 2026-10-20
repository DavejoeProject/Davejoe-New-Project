import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  AuthService,
  UserProfile,
  StandardRoleKey,
  ROLE_CONFIGS,
  normalizeRoleKey,
  getRouteForRole,
} from '../services/authService';
import { traceAuthDatabaseFetch } from '../hooks/useAuth';
import { ensureValidSession, isJwtExpiredError } from '../lib/authSession';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  assignedRoles: string[];
  permissions: string[];
  currentRoleKey: StandardRoleKey | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (params: { email: string; password: string; selectedRole?: string }) => Promise<{ redirectRoute: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (roleInput: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canAccessRoute: (pathname: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [currentRoleKey, setCurrentRoleKey] = useState<StandardRoleKey | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Authoritatively load user profile, roles, and permissions from the database
  const loadUserData = useCallback(async (authUser: User) => {
    try {
      // Ensure we have a valid session token before querying database
      const { session: currentSession } = await ensureValidSession();
      if (!currentSession) {
        console.warn('[AuthContext] Cannot load user data without a valid session.');
        setProfile(null);
        setAssignedRoles([]);
        setPermissions([]);
        setCurrentRoleKey(null);
        return;
      }

      // Trigger explicit diagnostic trace on auth resolution
      traceAuthDatabaseFetch(authUser.id).catch((err) => {
        console.warn('[AuthContext] Diagnostic trace warning:', err);
      });

      const [userProfile, { assignedSlugs, assignedNames }] = await Promise.all([
        AuthService.getProfile(authUser.id),
        AuthService.getUserRolesDetailed(authUser.id),
      ]);

      const roles = Array.from(new Set([...assignedSlugs, ...assignedNames]));

      setProfile(userProfile);

      // Verify active account status: inactive, suspended, or pending users are immediately blocked
      const statusLower = userProfile?.status?.toLowerCase().trim();
      const isActive = statusLower === 'active';

      if (!isActive) {
        console.warn(
          `[AuthContext] User ${authUser.id} account status is "${userProfile?.status}". Workspace access revoked.`
        );
        setAssignedRoles([]);
        setPermissions([]);
        setCurrentRoleKey(null);
        return;
      }

      setAssignedRoles(roles);

      // Read any active role preference from session storage (e.g. from login role dropdown)
      const storedPreference = typeof window !== 'undefined'
        ? sessionStorage.getItem('davejoe_active_role_preference')
        : null;
      const normalizedPreference = normalizeRoleKey(storedPreference);

      // Check if user has the preferred role in their actual database roles
      const hasPreferredRole = Boolean(
        normalizedPreference && (
          assignedSlugs.some((s) => normalizeRoleKey(s) === normalizedPreference) ||
          roles.some((r) => normalizeRoleKey(r) === normalizedPreference)
        )
      );

      // Check authoritative database role slug strictly by the 'slug' column
      const hasExecutiveDirector =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'executive_director' || normalizeRoleKey(s) === 'executive_director') ||
        roles.some((r) => normalizeRoleKey(r) === 'executive_director');

      const isManagement =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'management') ||
        roles.some((r) => normalizeRoleKey(r) === 'management');

      const isAdmin =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'admin') ||
        roles.some((r) => normalizeRoleKey(r) === 'admin');

      const isTechnical =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'technical') ||
        roles.some((r) => normalizeRoleKey(r) === 'technical');

      const isSupervisor =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'supervisor') ||
        roles.some((r) => normalizeRoleKey(r) === 'supervisor');

      const isProcurement =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'procurement') ||
        roles.some((r) => normalizeRoleKey(r) === 'procurement');

      const isAccounts =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'accounts') ||
        roles.some((r) => normalizeRoleKey(r) === 'accounts');

      const isArtisan =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'artisan') ||
        roles.some((r) => normalizeRoleKey(r) === 'artisan');

      const isSocialMedia =
        assignedSlugs.some((s) => s.toLowerCase().trim() === 'social_media_manager') ||
        roles.some((r) => normalizeRoleKey(r) === 'social_media_manager');

      const userPermissions = await AuthService.getUserPermissions(
        authUser.id,
        isManagement || isAdmin || hasExecutiveDirector
      );
      setPermissions(userPermissions);

      // Active role key is derived strictly from public.user_roles -> public.roles (slug column)
      // If user holds multiple roles and selected one of them, respect that database-verified choice!
      let validatedRoleKey: StandardRoleKey | null = null;
      if (hasPreferredRole && normalizedPreference) {
        validatedRoleKey = normalizedPreference;
      } else if (isManagement) {
        validatedRoleKey = 'management';
      } else if (hasExecutiveDirector) {
        validatedRoleKey = 'executive_director';
      } else if (isAdmin) {
        validatedRoleKey = 'admin';
      } else if (isTechnical) {
        validatedRoleKey = 'technical';
      } else if (isSupervisor) {
        validatedRoleKey = 'supervisor';
      } else if (isProcurement) {
        validatedRoleKey = 'procurement';
      } else if (isAccounts) {
        validatedRoleKey = 'accounts';
      } else if (isArtisan) {
        validatedRoleKey = 'artisan';
      } else if (isSocialMedia) {
        validatedRoleKey = 'social_media_manager';
      } else if (assignedSlugs.length > 0) {
        validatedRoleKey = normalizeRoleKey(assignedSlugs[0]);
      } else if (roles.length > 0) {
        validatedRoleKey = normalizeRoleKey(roles[0]);
      }

      setCurrentRoleKey(validatedRoleKey);
    } catch (err) {
      console.warn('[AuthContext] Error loading user authorization data:', err);
    }
  }, []);

  // Initialize auth state and subscribe to changes
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { session: validSession, user: validUser, error: sessionErr } = await ensureValidSession();

        if (sessionErr) {
          console.warn('[AuthContext] Session verification warning:', sessionErr.message || sessionErr);
        }

        if (mounted) {
          setSession(validSession);
          setUser(validUser);

          if (validUser) {
            await loadUserData(validUser);
          } else {
            // Clean unauthenticated state
            setProfile(null);
            setAssignedRoles([]);
            setPermissions([]);
            setCurrentRoleKey(null);
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Auth initialization error:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    }

    initAuth();

    // Listen to Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession);
        setUser(newSession.user);
      } else if (event === 'SIGNED_IN' && newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await loadUserData(newSession.user);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setAssignedRoles([]);
        setPermissions([]);
        setCurrentRoleKey(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserData(user);
    }
  }, [user, loadUserData]);

  const login = useCallback(
    async (params: { email: string; password: string; selectedRole?: string }) => {
      setIsLoading(true);
      try {
        const result = await AuthService.signIn(params);
        setUser(result.user);
        setSession(result.session);
        setProfile(result.profile);
        setAssignedRoles(result.assignedRoles);
        setPermissions(result.permissions);
        setCurrentRoleKey(result.primaryRoleKey);

        return { redirectRoute: result.redirectRoute };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await AuthService.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setAssignedRoles([]);
      setPermissions([]);
      setCurrentRoleKey(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasRole = useCallback(
    (roleInput: string): boolean => {
      const targetKey = normalizeRoleKey(roleInput);
      if (!targetKey) return false;
      if (currentRoleKey === targetKey) return true;
      return assignedRoles.some((r) => normalizeRoleKey(r) === targetKey);
    },
    [currentRoleKey, assignedRoles]
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      // Leadership and system administrators share full application permissions.
      if (
        currentRoleKey === 'management' ||
        currentRoleKey === 'executive_director' ||
        currentRoleKey === 'admin' ||
        hasRole('management') ||
        hasRole('executive_director') ||
        hasRole('admin') ||
        permissions.includes('*')
      ) {
        return true;
      }

      return permissions.includes(permission);
    },
    [currentRoleKey, hasRole, permissions]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (
        currentRoleKey === 'management' ||
        currentRoleKey === 'executive_director' ||
        currentRoleKey === 'admin' ||
        hasRole('management') ||
        hasRole('executive_director') ||
        hasRole('admin') ||
        permissions.includes('*')
      )
        return true;
      return perms.some((p) => hasPermission(p));
    },
    [currentRoleKey, hasRole, permissions, hasPermission]
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (
        currentRoleKey === 'management' ||
        currentRoleKey === 'executive_director' ||
        currentRoleKey === 'admin' ||
        hasRole('management') ||
        hasRole('executive_director') ||
        hasRole('admin') ||
        permissions.includes('*')
      )
        return true;
      return perms.every((p) => hasPermission(p));
    },
    [currentRoleKey, hasRole, permissions, hasPermission]
  );

  const canAccessRoute = useCallback(
    (pathname: string): boolean => {
      if (!user) return false;
      if (!profile?.status || profile.status.toLowerCase().trim() !== 'active') {
        return false;
      }
      const isLeadership =
        currentRoleKey === 'management' ||
        currentRoleKey === 'executive_director' ||
        hasRole('management') ||
        hasRole('executive_director');

      // Leadership has operational oversight across all operational modules
      if (isLeadership) return true;

      if (pathname.startsWith('/admin')) {
        return currentRoleKey === 'admin' || hasRole('admin');
      }
      if (pathname.startsWith('/management')) {
        return hasRole('management');
      }
      if (pathname.startsWith('/executive')) {
        return hasRole('executive_director');
      }
      if (pathname.startsWith('/technical')) {
        return currentRoleKey === 'technical' || hasRole('technical');
      }
      if (pathname.startsWith('/supervisor')) {
        return currentRoleKey === 'supervisor' || hasRole('supervisor');
      }
      if (pathname.startsWith('/attendance')) {
        return currentRoleKey === 'supervisor' || hasRole('supervisor');
      }
      if (pathname.startsWith('/procurement')) {
        return currentRoleKey === 'procurement' || hasRole('procurement');
      }
      if (pathname.startsWith('/accounts')) {
        return currentRoleKey === 'accounts' || hasRole('accounts');
      }
      if (pathname.startsWith('/artisan')) {
        return currentRoleKey === 'artisan' || hasRole('artisan') || currentRoleKey === 'supervisor' || hasRole('supervisor');
      }
      if (pathname.startsWith('/social-media') || pathname.startsWith('/social')) {
        return currentRoleKey === 'social_media_manager' || hasRole('social_media_manager');
      }
      return false;
    },
    [user, profile, currentRoleKey, hasRole]
  );

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      assignedRoles,
      permissions,
      currentRoleKey,
      isLoading,
      isInitialized,
      login,
      logout,
      refreshProfile,
      hasRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessRoute,
    }),
    [
      user,
      session,
      profile,
      assignedRoles,
      permissions,
      currentRoleKey,
      isLoading,
      isInitialized,
      login,
      logout,
      refreshProfile,
      hasRole,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessRoute,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
