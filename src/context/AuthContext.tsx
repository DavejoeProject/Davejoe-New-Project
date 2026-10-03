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
      setAssignedRoles(roles);

      // Check authoritative database role slug strictly by the 'slug' column
      const isManagement = assignedSlugs.some(
        (s) => s.toLowerCase().trim() === 'management'
      );

      const userPermissions = await AuthService.getUserPermissions(authUser.id, isManagement);
      setPermissions(userPermissions);

      // Active role key is derived strictly from public.user_roles -> public.roles (slug column)
      let validatedRoleKey: StandardRoleKey | null = null;
      if (isManagement) {
        validatedRoleKey = 'management';
      } else if (assignedSlugs.length > 0) {
        const primarySlug = normalizeRoleKey(assignedSlugs[0]);
        validatedRoleKey = primarySlug || 'artisan';
      } else if (roles.length > 0) {
        const primary = normalizeRoleKey(roles[0]);
        validatedRoleKey = primary || 'artisan';
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
      return currentRoleKey === targetKey;
    },
    [currentRoleKey]
  );

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (currentRoleKey === 'management' || permissions.includes('*')) return true;
      return permissions.includes(permission);
    },
    [currentRoleKey, permissions]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (currentRoleKey === 'management' || permissions.includes('*')) return true;
      return perms.some((p) => permissions.includes(p));
    },
    [currentRoleKey, permissions]
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (currentRoleKey === 'management' || permissions.includes('*')) return true;
      return perms.every((p) => permissions.includes(p));
    },
    [currentRoleKey, permissions]
  );

  const canAccessRoute = useCallback(
    (pathname: string): boolean => {
      if (!user) return false;
      // For now, only users whose database role is 'management' may access /management
      if (pathname.startsWith('/management')) {
        return currentRoleKey === 'management';
      }
      // All other dashboards are currently inactive
      return false;
    },
    [user, currentRoleKey]
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
