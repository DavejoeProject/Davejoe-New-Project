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

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  assignedRoles: string[];
  permissions: string[];
  currentRoleKey: StandardRoleKey | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (params: { email: string; password: string; selectedRole: string }) => Promise<{ redirectRoute: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (roleInput: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canAccessRoute: (pathname: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// UI preference key only — NEVER treated as an authorization boundary
const UI_SELECTED_ROLE_KEY = 'davejoe_ui_role_preference';

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
      const [userProfile, roles] = await Promise.all([
        AuthService.getProfile(authUser.id),
        AuthService.getUserRoles(authUser.id),
      ]);

      setProfile(userProfile);
      setAssignedRoles(roles);

      const isManagement = roles.some((r) => normalizeRoleKey(r) === 'management');
      const userPermissions = await AuthService.getUserPermissions(authUser.id, isManagement);
      setPermissions(userPermissions);

      // Verify active role key: MUST match an actually assigned database role
      let validatedRoleKey: StandardRoleKey | null = null;

      // Check if user stored a UI preference that is STILL legitimately assigned to them
      if (typeof window !== 'undefined') {
        const storedPreference = localStorage.getItem(UI_SELECTED_ROLE_KEY) as StandardRoleKey | null;
        if (storedPreference && roles.some((r) => normalizeRoleKey(r) === storedPreference)) {
          validatedRoleKey = storedPreference;
        }
      }

      // If no valid preference, default to their primary assigned database role
      if (!validatedRoleKey && roles.length > 0) {
        const primary = normalizeRoleKey(roles[0]);
        if (primary) {
          validatedRoleKey = primary;
        }
      }

      setCurrentRoleKey(validatedRoleKey);
      if (typeof window !== 'undefined' && validatedRoleKey) {
        localStorage.setItem(UI_SELECTED_ROLE_KEY, validatedRoleKey);
      }
    } catch (err) {
      console.warn('[AuthContext] Error loading user authorization data:', err);
    }
  }, []);

  // Initialize auth state and subscribe to changes
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[AuthContext] Error reading session on load:', error.message);
        }

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            await loadUserData(initialSession.user);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' && newSession?.user) {
        await loadUserData(newSession.user);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setAssignedRoles([]);
        setPermissions([]);
        setCurrentRoleKey(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(UI_SELECTED_ROLE_KEY);
        }
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
    async (params: { email: string; password: string; selectedRole: string }) => {
      setIsLoading(true);
      try {
        const result = await AuthService.signIn(params);
        setUser(result.user);
        setSession(result.session);
        setProfile(result.profile);
        setAssignedRoles(result.assignedRoles);
        setPermissions(result.permissions);
        setCurrentRoleKey(result.primaryRoleKey);

        if (typeof window !== 'undefined') {
          localStorage.setItem(UI_SELECTED_ROLE_KEY, result.primaryRoleKey);
        }

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
      if (typeof window !== 'undefined') {
        localStorage.removeItem(UI_SELECTED_ROLE_KEY);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasRole = useCallback(
    (roleInput: string): boolean => {
      const targetKey = normalizeRoleKey(roleInput);
      if (!targetKey) return false;
      // Management role grants global module oversight
      if (currentRoleKey === 'management') return true;
      return assignedRoles.some((r) => normalizeRoleKey(r) === targetKey);
    },
    [currentRoleKey, assignedRoles]
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
      // Management has access to all modules
      if (currentRoleKey === 'management') return true;

      // Find which role this route belongs to
      const matchedConfig = Object.values(ROLE_CONFIGS).find((cfg) => {
        return pathname.startsWith(cfg.route);
      });

      if (!matchedConfig) {
        return true;
      }

      // Must match verified current active role or assigned roles
      if (currentRoleKey === matchedConfig.key) return true;
      return assignedRoles.some((r) => normalizeRoleKey(r) === matchedConfig.key);
    },
    [user, currentRoleKey, assignedRoles]
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
