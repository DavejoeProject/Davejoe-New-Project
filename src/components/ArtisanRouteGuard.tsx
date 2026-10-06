import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthService, UserProfile } from '../services/authService';
import { AccessDenied } from './AccessDenied';
import { UserX, LogOut } from 'lucide-react';

interface ArtisanRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Strict Artisan / Workforce Route Guard for /artisan
 * 
 * Verifies before rendering:
 * 1. Valid Supabase session exists.
 * 2. Authenticated user exists via getUser().
 * 3. Authoritative database role slug matches 'artisan'.
 * 4. User account is active (not suspended/inactive).
 */
export const ArtisanRouteGuard: React.FC<ArtisanRouteGuardProps> = ({ children }) => {
  const location = useLocation();
  const [authState, setAuthState] = useState<{
    isLoading: boolean;
    isAuthenticated: boolean;
    isAuthorizedArtisan: boolean;
    userProfile: UserProfile | null;
    isSuspended: boolean;
  }>({
    isLoading: true,
    isAuthenticated: false,
    isAuthorizedArtisan: false,
    userProfile: null,
    isSuspended: false,
  });

  useEffect(() => {
    let isMounted = true;

    async function verifyArtisanAuthorization() {
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
              isAuthorizedArtisan: false,
              userProfile: null,
              isSuspended: false,
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
              isAuthorizedArtisan: false,
              userProfile: null,
              isSuspended: false,
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

        // Verify authoritative database role slug matches 'artisan'
        const hasArtisanSlug = assignedSlugs.some(
          (slug) => slug.toLowerCase().trim() === 'artisan'
        );

        const hasArtisanName = assignedNames.some((name) => {
          const n = name.toLowerCase();
          return n.includes('artisan') || n.includes('workforce');
        });

        const isAuthorized = !isSuspended && (hasArtisanSlug || hasArtisanName);

        if (isMounted) {
          setAuthState({
            isLoading: false,
            isAuthenticated: true,
            isAuthorizedArtisan: isAuthorized,
            userProfile: profile,
            isSuspended,
          });
        }
      } catch (err) {
        console.error('[ArtisanRouteGuard] Authorization check failed:', err);
        if (isMounted) {
          setAuthState({
            isLoading: false,
            isAuthenticated: false,
            isAuthorizedArtisan: false,
            userProfile: null,
            isSuspended: false,
          });
        }
      }
    }

    verifyArtisanAuthorization();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && isMounted) {
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          isAuthorizedArtisan: false,
          userProfile: null,
          isSuspended: false,
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
          Verifying Artisan authorization...
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
            Your worker profile is currently {authState.userProfile?.status || 'inactive'}. Please contact your Site Supervisor.
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

  if (!authState.isAuthorizedArtisan) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};
