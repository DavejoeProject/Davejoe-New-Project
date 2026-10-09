import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthService, UserProfile, getRouteForRole, normalizeRoleKey } from '../services/authService';
import { AccessDenied } from './AccessDenied';
import { UserX, LogOut } from 'lucide-react';

interface ExecutiveRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Strict Executive Director Route Guard for /executive
 *
 * Verifies before rendering:
 * 1. Valid Supabase session exists.
 * 2. Authenticated user exists via getUser().
 * 3. Authoritative database role slug matches 'executive_director'.
 * 4. User account is active (not suspended/inactive).
 */
export const ExecutiveRouteGuard: React.FC<ExecutiveRouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    isAuthorizedExecutive: boolean;
    userProfile: UserProfile | null;
    isSuspended: boolean;
    alternativeRole: string | null;
  }>({
    isLoading: true,
    isAuthenticated: false,
    isAuthorizedExecutive: false,
    userProfile: null,
    isSuspended: false,
    alternativeRole: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function verifyExecutiveAuthorization() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          if (isMounted) {
            setAuthState({
              isLoading: false,
              isAuthenticated: false,
              isAuthorizedExecutive: false,
              userProfile: null,
              isSuspended: false,
              alternativeRole: null,
            });
          }
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isMounted) {
            setAuthState({
              isLoading: false,
              isAuthenticated: false,
              isAuthorizedExecutive: false,
              userProfile: null,
              isSuspended: false,
              alternativeRole: null,
            });
          }
          return;
        }

        const [profile, { assignedSlugs, assignedNames }] = await Promise.all([
          AuthService.getProfile(user.id),
          AuthService.getUserRolesDetailed(user.id),
        ]);

        const isSuspended = Boolean(
          profile?.status &&
            ['inactive', 'suspended', 'disabled', 'blocked', 'banned'].includes(
              profile.status.toLowerCase().trim()
            )
        );

        // Verify authoritative database role slug matches 'executive_director'
        const hasExecutiveSlug = assignedSlugs.some(
          (slug) =>
            slug.toLowerCase().trim() === 'executive_director' ||
            normalizeRoleKey(slug) === 'executive_director'
        );

        const hasExecutiveName = assignedNames.some((name) => {
          return normalizeRoleKey(name) === 'executive_director';
        });

        const isAuthorized = !isSuspended && (hasExecutiveSlug || hasExecutiveName);

        // Check if user has an alternative valid role (e.g. admin, management, supervisor, artisan)
        let alternativeRole: string | null = null;
        if (!isAuthorized) {
          if (assignedSlugs.includes('admin') || assignedNames.some((n) => normalizeRoleKey(n) === 'admin')) {
            alternativeRole = 'admin';
          } else if (assignedSlugs.includes('management') || assignedNames.some((n) => normalizeRoleKey(n) === 'management')) {
            alternativeRole = 'management';
          } else if (assignedSlugs.includes('supervisor') || assignedNames.some((n) => normalizeRoleKey(n) === 'supervisor')) {
            alternativeRole = 'supervisor';
          } else if (assignedSlugs.includes('artisan') || assignedNames.some((n) => normalizeRoleKey(n) === 'artisan')) {
            alternativeRole = 'artisan';
          }
        }

        if (isMounted) {
          setAuthState({
            isLoading: false,
            isAuthenticated: true,
            isAuthorizedExecutive: isAuthorized,
            userProfile: profile,
            isSuspended,
            alternativeRole,
          });
        }
      } catch (err) {
        console.error('[ExecutiveRouteGuard] Authorization check failed:', err);
        if (isMounted) {
          setAuthState({
            isLoading: false,
            isAuthenticated: false,
            isAuthorizedExecutive: false,
            userProfile: null,
            isSuspended: false,
            alternativeRole: null,
          });
        }
      }
    }

    verifyExecutiveAuthorization();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && isMounted) {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          isAuthorizedExecutive: false,
          userProfile: null,
          isSuspended: false,
          alternativeRole: null,
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8faf9]">
        <div className="w-10 h-10 border-3 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500 tracking-wide">
          Verifying Executive Director authorization...
        </p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (authState.isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Account Inactive</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your executive account is currently {authState.userProfile?.status || 'inactive'}. Please contact system support.
          </p>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!authState.isAuthorizedExecutive) {
    // If user has another authorized role, safely forward them to their dashboard
    if (authState.alternativeRole) {
      return <Navigate to={getRouteForRole(authState.alternativeRole)} replace />;
    }
    return <AccessDenied />;
  }

  return <>{children}</>;
};

export default ExecutiveRouteGuard;
