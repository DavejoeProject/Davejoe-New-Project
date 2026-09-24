import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { StandardRoleKey } from '../services/authService';
import { AccessDenied } from './AccessDenied';
import { UserX, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: StandardRoleKey[];
  requiredRole?: StandardRoleKey;
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredRole,
  requiredPermission,
}) => {
  const { user, profile, currentRoleKey, hasPermission, isLoading, isInitialized, logout } = useAuth();
  const location = useLocation();

  // Show clean loading spinner during session restoration
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8faf9]">
        <div className="w-10 h-10 border-3 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-slate-500 tracking-wide">
          Verifying Davejoe authorization...
        </p>
      </div>
    );
  }

  // Not logged in -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Inactive or suspended account guard
  if (profile?.status && ['inactive', 'suspended', 'disabled', 'blocked'].includes(profile.status.toLowerCase())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Account Inactive</h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Your account is currently {profile.status}. Please contact an administrator or HR to reactivate your workspace access.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Check granular permission restriction if specified
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDenied />;
  }

  // Check role restrictions: Only authorized database role allowed
  const effectiveAllowed = allowedRoles || (requiredRole ? [requiredRole] : undefined);

  if (effectiveAllowed && effectiveAllowed.length > 0) {
    const isAllowed = Boolean(currentRoleKey && effectiveAllowed.includes(currentRoleKey));

    if (!isAllowed) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
};

