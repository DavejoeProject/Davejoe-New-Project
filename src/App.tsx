import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AccessDenied } from './components/AccessDenied';
import { CeoDashboard } from './components/dashboard/CeoDashboard';
import { useAuth } from './hooks/useAuth';

const RootRedirect: React.FC = () => {
  const { user, currentRoleKey, isInitialized, isLoading } = useAuth();

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf9]">
        <div className="w-10 h-10 border-3 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    if (currentRoleKey === 'management') {
      return <Navigate to="/management" replace />;
    }
    return <Navigate to="/access-denied" replace />;
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
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* Protected CEO / Management Command Centre: ONLY database role 'management' */}
          <Route
            path="/management"
            element={
              <ProtectedRoute allowedRoles={['management']}>
                <CeoDashboard />
              </ProtectedRoute>
            }
          />

          {/* Non-management dashboards are currently inactive */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={[]}>
                <AccessDenied />
              </ProtectedRoute>
            }
          />
          <Route
            path="/technical"
            element={
              <ProtectedRoute allowedRoles={[]}>
                <AccessDenied />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supervisor"
            element={
              <ProtectedRoute allowedRoles={[]}>
                <AccessDenied />
              </ProtectedRoute>
            }
          />
          <Route
            path="/procurement"
            element={
              <ProtectedRoute allowedRoles={[]}>
                <AccessDenied />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <ProtectedRoute allowedRoles={[]}>
                <AccessDenied />
              </ProtectedRoute>
            }
          />
          <Route
            path="/artisan"
            element={
              <ProtectedRoute allowedRoles={[]}>
                <AccessDenied />
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
