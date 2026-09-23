import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleDashboardPlaceholder } from './components/RoleDashboardPlaceholder';
import { CeoDashboard } from './components/dashboard/CeoDashboard';
import { useAuth } from './hooks/useAuth';
import { getRouteForRole } from './services/authService';

const RootRedirect: React.FC = () => {
  const { user, currentRoleKey, isInitialized, isLoading } = useAuth();

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9]">
        <div className="w-10 h-10 border-3 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin" />
      </div>
    );
  }

  if (user && currentRoleKey) {
    return <Navigate to={getRouteForRole(currentRoleKey)} replace />;
  }

  return <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected CEO / Management Command Centre */}
          <Route
            path="/management"
            element={
              <ProtectedRoute allowedRoles={['management']}>
                <CeoDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <RoleDashboardPlaceholder roleKey="admin" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/technical"
            element={
              <ProtectedRoute allowedRoles={['technical']}>
                <RoleDashboardPlaceholder roleKey="technical" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute allowedRoles={['supervisor']}>
                <RoleDashboardPlaceholder roleKey="supervisor" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/procurement"
            element={
              <ProtectedRoute allowedRoles={['procurement']}>
                <RoleDashboardPlaceholder roleKey="procurement" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute allowedRoles={['accounts']}>
                <RoleDashboardPlaceholder roleKey="accounts" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/artisan"
            element={
              <ProtectedRoute allowedRoles={['artisan']}>
                <RoleDashboardPlaceholder roleKey="artisan" />
              </ProtectedRoute>
            }
          />

          {/* Unknown routes redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
