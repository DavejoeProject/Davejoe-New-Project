import React from 'react';
import { useAuth } from '../hooks/useAuth';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  fallback?: React.ReactNode;
}

/**
 * Frontend UX permission guard.
 * Conditionally renders UI elements based on user permissions.
 * NOTE: Frontend permission checks are UX only; PostgreSQL RLS and security definers enforce true security.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  anyPermissions,
  allPermissions,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    return <>{fallback}</>;
  }

  if (allPermissions && !hasAllPermissions(allPermissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
