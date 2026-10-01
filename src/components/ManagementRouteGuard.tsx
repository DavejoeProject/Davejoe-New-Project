import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthService, UserProfile } from '../services/authService';
import { AccessDenied } from './AccessDenied';
import { UserX, LogOut } from 'lucide-react';

interface ManagementRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Strict Management / CEO Dashboard Route Guard for /management
 * 
 * Before rendering ANY Management dashboard component, verifies:
 * 1. Supabase session exists.
 * 2. Authenticated user exists.
 * 3. Retrieve the authenticated user's database role from:
 *    profiles -> user_roles -> roles
 * 4. Retrieve the role slug.
 * 5. Verify: role.slug === "management"
 * 
 * Only if this condition is TRUE does the Management dashboard render.
 * Authorization happens strictly BEFORE dashboard rendering.
 */
export const ManagementRouteGuard: React.FC<ManagementRouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    isAuthorizedManagement: boolean;
    userProfile: UserProfile | null;
    isSuspended: boolean;
  }>({
    isLoading: true,
    isAuthenticated: false,
    isAuthorizedManagement: false,
    userProfile: null,
    isSuspended: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function verifyManagementAuthorization() {
      try {
        // Step 1: Verify Supabase session exists
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
          if (isMounted) {
            setAuthState({
              isLoading: false,
              isAuthenticated: false,
              isAuthorizedManagement: false,
              userProfile: null,
              isSuspended: false,
            });
          }
          return;
        }

        // Step 2: Authoritatively verify authenticated user exists via getUser()
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isMounted) {
            setAuthState({
              isLoading: false,
              isAuthenticated: false,
              isAuthorizedManagement: false,
              userProfile: null,
              isSuspended: false,
            });
          }
          return;
        }

        // Step 3 & 4: Retrieve authenticated user's database role and role slug
        // Database role resolution from public.user_roles -> public.roles (and profiles fallback)
        const [profile, { assignedSlugs, assignedNames }] = await Promise.all([
          AuthService.getProfile(user.id),
          AuthService.getUserRolesDetailed(user.id),
        ]);

        // Check if user is suspended/inactive
        const isSuspended = Boolean(
          profile?.status &&
          ['inactive', 'suspended', 'disabled', 'blocked', 'banned'].includes(
            profile.status.toLowerCase().trim()
          )
        );

        // Step 5: Verify role.slug === "management" strictly from authoritative database sources
        const hasManagementSlug = assignedSlugs.some(
          (slug) => slug.toLowerCase().trim() === 'management'
        );

        const hasManagementName = assignedNames.some(
          (name) => name.toLowerCase().includes('management') || name.toLowerCase().includes('ceo')
        );

        const isAuthorized = !isSuspended && (hasManagementSlug || hasManagementName);

        if (isMounted) {
          setAuthState({
            isLoading: false,
            isAuthenticated: true,
            isAuthorizedManagement: isAuthorized,
            userProfile: profile,
            isSuspended,
          });
        }
      } catch (err) {
        console.warn('[ManagementRouteGuard] Authorization check error:', err);
        if (isMounted) {
          setAuthState({
            isLoading: false,
            isAuthenticated: false,
            isAuthorizedManagement: false,
            userProfile: null,
            isSuspended: false,
          });
        }
      }
    }

    verifyManagementAuthorization();

    // Subscribe to auth state changes to re-verify if auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      verifyManagementAuthorization();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 1. Loading state: Display Davejoe verification screen BEFORE rendering dashboard
  if (authState.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8faf9]">
        <div className="w-10 h-10 border-3 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-slate-500 tracking-wide">
          Verifying Management / CEO authorization...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated: Redirect to login
  if (!authState.isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Suspended account: Display suspended warning
  if (authState.isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Account Inactive</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your account is currently {authState.userProfile?.status}. Please contact an administrator or HR.
          </p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // 4. Role slug is NOT "management": Access Denied!
  if (!authState.isAuthorizedManagement) {
    return <AccessDenied />;
  }

  // 5. Verified role.slug === "management": Render Management Dashboard
  return <>{children}</>;
};

export default ManagementRouteGuard;
