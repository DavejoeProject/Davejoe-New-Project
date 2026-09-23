import { useAuth } from './useAuth';

export const usePermissions = () => {
  const {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    currentRoleKey,
  } = useAuth();

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isManagement: currentRoleKey === 'management',
  };
};
