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
  currentRoleKey: StandardRoleKey | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (params: { email: string; password: string; selectedRole: string }) => Promise<{ redirectRoute: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (roleInput: string) => boolean;
  canAccessRoute: (pathname: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_ROLE_STORAGE_KEY = 'davejoe_active_role_key';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [currentRoleKey, setCurrentRoleKey] = useState<StandardRoleKey | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CURRENT_ROLE_STORAGE_KEY) as StandardRoleKey | null;
      return stored || null;
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Load user profile & roles whenever user changes
  const loadUserData = useCallback(async (authUser: User) => {
    try {
      const [userProfile, roles] = await Promise.all([
        AuthService.getProfile(authUser.id),
        AuthService.getUserRoles(authUser.id),
      ]);

      setProfile(userProfile);
      setAssignedRoles(roles);

      // Verify active role key still valid or fallback to first available
      setCurrentRoleKey((prevKey) => {
        if (prevKey && roles.some((r) => normalizeRoleKey(r) === prevKey)) {
          return prevKey;
        }
        if (roles.length > 0) {
          const firstKey = normalizeRoleKey(roles[0]);
          if (firstKey) {
            localStorage.setItem(CURRENT_ROLE_STORAGE_KEY, firstKey);
            return firstKey;
          }
        }
        return prevKey;
      });
    } catch (err) {
      console.warn('Error loading user data:', err);
    }
  }, []);

  // Initialize auth state and subscribe to changes
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Error reading session on load:', error);
        }

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            await loadUserData(initialSession.user);
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
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
        setCurrentRoleKey(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CURRENT_ROLE_STORAGE_KEY);
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
        setCurrentRoleKey(result.primaryRoleKey);

        if (typeof window !== 'undefined') {
          localStorage.setItem(CURRENT_ROLE_STORAGE_KEY, result.primaryRoleKey);
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
      setCurrentRoleKey(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(CURRENT_ROLE_STORAGE_KEY);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasRole = useCallback(
    (roleInput: string): boolean => {
      const targetKey = normalizeRoleKey(roleInput);
      if (!targetKey) return false;
      if (currentRoleKey === 'management') return true;
      return assignedRoles.some((r) => normalizeRoleKey(r) === targetKey);
    },
    [currentRoleKey, assignedRoles]
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
        // Not a strictly defined role route
        return true;
      }

      // Must match current active role or assigned roles
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
      currentRoleKey,
      isLoading,
      isInitialized,
      login,
      logout,
      refreshProfile,
      hasRole,
      canAccessRoute,
    }),
    [
      user,
      session,
      profile,
      assignedRoles,
      currentRoleKey,
      isLoading,
      isInitialized,
      login,
      logout,
      refreshProfile,
      hasRole,
      canAccessRoute,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
