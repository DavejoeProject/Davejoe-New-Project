import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { StandardRoleKey, ROLE_CONFIGS } from '../services/authService';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: StandardRoleKey[];
  requiredRole?: StandardRoleKey;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredRole,
}) => {
  const { user, profile, currentRoleKey, isLoading, isInitialized, logout } = useAuth();
  const location = useLocation();

  // Show clean loading spinner during session restoration
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8faf9]">
        <div className="w-10 h-10 border-3 border-[#18B892]/20 border-t-[#18B892] rounded-full animate-spin mb-3" />
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

  // Check role restrictions
  const effectiveAllowed = allowedRoles || (requiredRole ? [requiredRole] : undefined);

  if (effectiveAllowed && effectiveAllowed.length > 0) {
    const isManagement = currentRoleKey === 'management';
    const isAllowed = isManagement || (currentRoleKey && effectiveAllowed.includes(currentRoleKey));

    if (!isAllowed) {
      const authorizedRoute = currentRoleKey ? ROLE_CONFIGS[currentRoleKey]?.route || '/login' : '/login';
      const roleTitle = currentRoleKey ? ROLE_CONFIGS[currentRoleKey]?.label : 'Unknown Role';

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8faf9] px-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Your assigned role (<span className="font-semibold text-slate-800">{roleTitle}</span>) does not have permission to access this module.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={authorizedRoute}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#18B892] hover:bg-[#159e7d] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to My Dashboard
              </a>
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};
