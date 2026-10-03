import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ManagementRouteGuard } from './components/ManagementRouteGuard';
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
              <ManagementRouteGuard>
                <CeoDashboard initialModule="overview" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/projects"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="all-projects" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/projects/:projectId"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="all-projects" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/workforce"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="workforce" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/workforce/performance"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="workforce-performance" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/workforce/attendance"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="attendance" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/workforce/productivity"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="productivity" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/workforce/overtime"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="overtime" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/workforce/conduct"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="conduct" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/workforce/:workforceId"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="workforce" />
              </ManagementRouteGuard>
            }
          />

          {/* Materials Module Foundation Routes */}
          <Route
            path="/management/materials"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="materials" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/directory"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="materials-directory" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/requests"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="material-requests" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/requests/:requestId"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="material-requests" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/procurement"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="procurement" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/procurement/:purchaseOrderId"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="procurement" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/deliveries"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="deliveries" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/stock"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="stock" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/losses-returns"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="losses-returns" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/materials/reconciliation"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="reconciliation" />
              </ManagementRouteGuard>
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
