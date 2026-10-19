import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthService, UserProfile, getRouteForRole, normalizeRoleKey } from '../services/authService';
import { AccessDenied } from './AccessDenied';
import { UserX, LogOut } from 'lucide-react';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Strict Administrator Route Guard for /admin
 *
 * Verifies before rendering:
 * 1. Valid Supabase session exists.
 * 2. Authenticated user exists via getUser().
 * 3. Authoritative database role slug matches 'admin'.
 * 4. User account is active (not suspended/inactive).
 */
export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    isAuthorizedAdmin: boolean;
    userProfile: UserProfile | null;
    isSuspended: boolean;
    alternativeRole: string | null;
  }>({
    isLoading: true,
    isAuthenticated: false,
    isAuthorizedAdmin: false,
    userProfile: null,
    isSuspended: false,
    alternativeRole: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function verifyAdminAuthorization() {
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
              isAuthorizedAdmin: false,
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
              isAuthorizedAdmin: false,
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

        // Check if user is active: any status other than 'active' (suspended, inactive, pending) is blocked
        const isSuspended = Boolean(
          !profile?.status ||
          profile.status.toLowerCase().trim() !== 'active'
        );

        // Verify authoritative database role slug matches 'admin'
        const hasAdminSlug = assignedSlugs.some(
          (slug) => slug.toLowerCase().trim() === 'admin'
        );

        const hasAdminName = assignedNames.some((name) => {
          const n = name.toLowerCase();
          return n.includes('admin') || n.includes('administrator') || n.includes('coordinator');
        });

        const isAuthorized = !isSuspended && (hasAdminSlug || hasAdminName);

        // Check if user has an alternative valid role (e.g. executive_director, management, supervisor, artisan)
        let alternativeRole: string | null = null;
        if (!isAuthorized) {
          if (assignedSlugs.includes('executive_director') || assignedNames.some((n) => normalizeRoleKey(n) === 'executive_director')) {
            alternativeRole = 'executive_director';
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
            isAuthorizedAdmin: isAuthorized,
            userProfile: profile,
            isSuspended,
            alternativeRole,
          });
        }
      } catch (err) {
        console.error('[AdminRouteGuard] Authorization check failed:', err);
        if (isMounted) {
          setAuthState({
            isLoading: false,
            isAuthenticated: false,
            isAuthorizedAdmin: false,
            userProfile: null,
            isSuspended: false,
            alternativeRole: null,
          });
        }
      }
    }

    verifyAdminAuthorization();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && isMounted) {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          isAuthorizedAdmin: false,
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
          Loading your workspace...
        </p>
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (authState.isSuspended) {
    const status = authState.userProfile?.status?.toLowerCase() || 'pending';
    const isSuspended = status === 'suspended';
    const isPending = status === 'pending';

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isSuspended ? 'bg-red-50 text-red-600' : isPending ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
          }`}>
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            {isSuspended
              ? 'Account Suspended'
              : isPending
              ? 'Account Pending Activation'
              : 'Account Inactive'}
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {isSuspended
              ? 'Your account has been temporarily suspended by Davejoe Management. You cannot access workspaces or execute operations.'
              : isPending
              ? 'Your account is awaiting administrator verification and activation.'
              : 'Your account is marked as inactive. Please contact Management or Executive Director to restore access.'}
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

  if (!authState.isAuthorizedAdmin) {
    // If user has another authorized role, safely forward them to their dashboard
    if (authState.alternativeRole) {
      return <Navigate to={getRouteForRole(authState.alternativeRole)} replace />;
    }
    return <AccessDenied />;
  }

  return <>{children}</>;
};
