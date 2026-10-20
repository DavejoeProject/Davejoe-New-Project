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
  const { user, profile, currentRoleKey, hasRole, hasPermission, isLoading, isInitialized, logout } = useAuth();
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

  // Inactive, suspended, or pending account guard
  if (!profile?.status || profile.status.toLowerCase() !== 'active') {
    const status = profile?.status?.toLowerCase() || 'pending';
    const isSuspended = status === 'suspended';
    const isInactive = status === 'inactive';
    const isPending = status === 'pending';

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isSuspended
              ? 'bg-red-50 text-red-600'
              : isPending
              ? 'bg-amber-50 text-amber-600'
              : 'bg-slate-100 text-slate-600'
          }`}>
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            {isSuspended
              ? 'Account Suspended'
              : isPending
              ? 'Account Pending Activation'
              : isInactive
              ? 'Account Inactive'
              : 'Account Unverified'}
          </h2>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {isSuspended
              ? 'Your account has been temporarily suspended by Davejoe Management. You cannot access workspaces or execute operations. Please contact Management or Executive Director.'
              : isPending
              ? 'Your account has been registered and is awaiting administrator verification and activation. Please contact Management or Executive Director.'
              : isInactive
              ? 'Your account has been deactivated. Please contact Management or Executive Director to restore your workspace access.'
              : 'Your account status is currently unverified. Please contact Management or HR to activate your access.'}
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

  // Check role restrictions: Authorized database role or leadership oversight
  const effectiveAllowed = allowedRoles || (requiredRole ? [requiredRole] : undefined);

  if (effectiveAllowed && effectiveAllowed.length > 0) {
    const isLeadership =
      hasRole('management') ||
      hasRole('executive_director') ||
      currentRoleKey === 'management' ||
      currentRoleKey === 'executive_director';

    const isAllowed = Boolean(
      (currentRoleKey && effectiveAllowed.includes(currentRoleKey)) ||
      effectiveAllowed.some((role) => hasRole(role)) ||
      isLeadership
    );

    if (!isAllowed) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
};

