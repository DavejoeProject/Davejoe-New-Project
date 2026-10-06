import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ManagementRouteGuard } from './components/ManagementRouteGuard';
import { SupervisorRouteGuard } from './components/SupervisorRouteGuard';
import { ArtisanRouteGuard } from './components/ArtisanRouteGuard';
import { AdminRouteGuard } from './components/AdminRouteGuard';
import { AccessDenied } from './components/AccessDenied';
import { CeoDashboard } from './components/dashboard/CeoDashboard';
import { SupervisorDashboard } from './components/supervisor/SupervisorDashboard';
import { ArtisanDashboard } from './components/artisan/ArtisanDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AttendanceRegister } from './components/attendance/AttendanceRegister';
import { useAuth } from './hooks/useAuth';
import { PWAInstallPrompt } from './components/pwa/PWAInstallPrompt';
import { PWAUpdateToast } from './components/pwa/PWAUpdateToast';
import { PWAOfflineIndicator } from './components/pwa/PWAOfflineIndicator';

const RootRedirect: React.FC = () => {
  const { user, currentRoleKey, isInitialized, isLoading } = useAuth();

  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8faf9] gap-3">
        <div className="w-10 h-10 border-3 border-[#01875F]/20 border-t-[#01875F] rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-500 tracking-wide">
          Loading your workspace...
        </p>
      </div>
    );
  }

  if (user) {
    if (currentRoleKey === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (currentRoleKey === 'management') {
      return <Navigate to="/management" replace />;
    }
    if (currentRoleKey === 'supervisor') {
      return <Navigate to="/supervisor" replace />;
    }
    if (currentRoleKey === 'artisan') {
      return <Navigate to="/artisan" replace />;
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

          {/* Protected Administration Command Centre: database role 'admin' */}
          <Route
            path="/admin"
            element={
              <AdminRouteGuard>
                <AdminDashboard />
              </AdminRouteGuard>
            }
          />
          <Route
            path="/admin/*"
            element={
              <AdminRouteGuard>
                <AdminDashboard />
              </AdminRouteGuard>
            }
          />

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
            path="/management/materials/deliveries/:deliveryId"
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

          {/* Financial Control Routes */}
          <Route
            path="/management/financial-control"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="project-costs" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/financial-control/projects"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="project-costs" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/financial-control/budget"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="budget-vs-actual" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/financial-control/procurement"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="procurement-costs" />
              </ManagementRouteGuard>
            }
          />

          {/* Management Reports Routes */}
          <Route
            path="/management/reports"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="management-reports" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/reports/management"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="management-reports" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/reports/projects"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="project-reports" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/reports/workforce"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="workforce-reports" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/reports/materials"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="material-reports" />
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
          {/* Phase 9.1: Site Supervisor Operational Workspace */}
          <Route
            path="/supervisor"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/project/:projectId"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />

          {/* Phase 9.2: Dedicated Attendance Register (Supervisor & Management) */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute allowedRoles={['management', 'supervisor']}>
                <AttendanceRegister />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/today"
            element={
              <ProtectedRoute allowedRoles={['management', 'supervisor']}>
                <AttendanceRegister initialTab="today" />
              </ProtectedRoute>
            }
          />

          {/* Phase 9.3: Artisan / Workforce Operational Portal */}
          <Route
            path="/artisan"
            element={
              <ArtisanRouteGuard>
                <ArtisanDashboard />
              </ArtisanRouteGuard>
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

          {/* Unknown routes redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>

        {/* Progressive Web App Support: Install Prompt, Service Worker Update Toast, Offline Status */}
        <PWAInstallPrompt />
        <PWAUpdateToast />
        <PWAOfflineIndicator />
      </BrowserRouter>
    </AuthProvider>
  );
}
