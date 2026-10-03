import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Checks if a database or auth error was caused by an expired or invalid JWT
 */
export function isJwtExpiredError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || error.status || '');
  const msg = String(error.message || error.error_description || error.details || '').toLowerCase();

  return (
    code === 'PGRST303' ||
    code === '401' ||
    msg.includes('jwt expired') ||
    msg.includes('token is expired') ||
    msg.includes('invalid claim: exp') ||
    msg.includes('token expired')
  );
}

/**
 * Checks whether a given Supabase session has expired or is about to expire
 * within the given buffer threshold (defaults to 60 seconds).
 */
export function isSessionExpired(session: Session | null, bufferSeconds: number = 60): boolean {
  if (!session) return true;
  if (!session.expires_at) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return session.expires_at <= nowSeconds + bufferSeconds;
}

/**
 * Ensures a valid session is active before performing database calls.
 * If the current session is expired or within buffer, attempts an authoritative refresh.
 * If the refresh fails (e.g. refresh token expired or revoked), cleans up localStorage
 * and signs out cleanly to avoid infinite error loops.
 */
export async function ensureValidSession(): Promise<{
  session: Session | null;
  user: User | null;
  refreshed: boolean;
  error: any;
}> {
  try {
    const {
      data: { session: currentSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('[authSession] Error getting current session:', sessionError.message);
    }

    if (!currentSession) {
      return { session: null, user: null, refreshed: false, error: null };
    }

    // If session is expired or close to expiry, refresh immediately
    if (isSessionExpired(currentSession)) {
      console.log('[authSession] Session access token has expired or is nearing expiry. Refreshing session...');
      const {
        data: refreshData,
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError || !refreshData.session) {
        console.warn('[authSession] Failed to refresh expired session. Purging stale credentials:', refreshError?.message);
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore signout errors
        }
        return { session: null, user: null, refreshed: false, error: refreshError };
      }

      return {
        session: refreshData.session,
        user: refreshData.user,
        refreshed: true,
        error: null,
      };
    }

    // Verify session token validity via getUser()
    const {
      data: { user: verifiedUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      if (isJwtExpiredError(userError)) {
        console.warn('[authSession] getUser() detected expired JWT. Attempting refreshSession...');
        const {
          data: refreshData,
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session) {
          console.warn('[authSession] Refresh after getUser error failed. Purging stale credentials:', refreshError?.message);
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore
          }
          return { session: null, user: null, refreshed: false, error: refreshError };
        }

        return {
          session: refreshData.session,
          user: refreshData.user,
          refreshed: true,
          error: null,
        };
      }

      // If other user error, still return current session with caution
      console.warn('[authSession] getUser() error:', userError.message);
    }

    return {
      session: currentSession,
      user: verifiedUser || currentSession.user,
      refreshed: false,
      error: null,
    };
  } catch (err) {
    console.error('[authSession] Unexpected error ensuring valid session:', err);
    return { session: null, user: null, refreshed: false, error: err };
  }
}
