import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ManagementRouteGuard } from './components/ManagementRouteGuard';
import { SupervisorRouteGuard } from './components/SupervisorRouteGuard';
import { ArtisanRouteGuard } from './components/ArtisanRouteGuard';
import { AdminRouteGuard } from './components/AdminRouteGuard';
import { ExecutiveRouteGuard } from './components/ExecutiveRouteGuard';
import { AccessDenied } from './components/AccessDenied';
import { CeoDashboard } from './components/dashboard/CeoDashboard';
import { SupervisorDashboard } from './components/supervisor/SupervisorDashboard';
import { ArtisanDashboard } from './components/artisan/ArtisanDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { ExecutiveDashboard } from './components/executive/ExecutiveDashboard';
import { SocialMediaDashboard } from './components/social-media/SocialMediaDashboard';
import { TechnicalDashboard } from './components/technical/TechnicalDashboard';
import { ProcurementDashboard } from './components/procurement/ProcurementDashboard';
import { AccountsDashboard } from './components/accounts/AccountsDashboard';
import { AttendanceRegister } from './components/attendance/AttendanceRegister';
import { useAuth } from './hooks/useAuth';
import { PWAInstallPrompt } from './components/pwa/PWAInstallPrompt';
import { PWAUpdateToast } from './components/pwa/PWAUpdateToast';
import { PWAOfflineIndicator } from './components/pwa/PWAOfflineIndicator';
import { UserX, LogOut } from 'lucide-react';

const RootRedirect: React.FC = () => {
  const { user, profile, currentRoleKey, isInitialized, isLoading, logout } = useAuth();

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
    // Guard against pending, suspended, or inactive status on root redirect
    if (!profile?.status || profile.status.toLowerCase().trim() !== 'active') {
      const status = profile?.status?.toLowerCase() || 'pending';
      const isSuspended = status === 'suspended';
      const isPending = status === 'pending';
      const isInactive = status === 'inactive';

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
    if (currentRoleKey === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (currentRoleKey === 'management') {
      return <Navigate to="/management" replace />;
    }
    if (currentRoleKey === 'executive_director') {
      return <Navigate to="/executive" replace />;
    }
    
    if (currentRoleKey === 'supervisor') {
      return <Navigate to="/supervisor" replace />;
    }
    if (currentRoleKey === 'artisan') {
      return <Navigate to="/artisan" replace />;
    }
    if (currentRoleKey === 'technical') {
      return <Navigate to="/technical" replace />;
    }
    if (currentRoleKey === 'procurement') {
      return <Navigate to="/procurement" replace />;
    }
    if (currentRoleKey === 'accounts') {
      return <Navigate to="/accounts" replace />;
    }
    if (currentRoleKey === 'social_media_manager') {
      return <Navigate to="/social-media" replace />;
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

          {/* Protected Executive Director Command Centre: database role 'executive_director' */}
          <Route
            path="/executive"
            element={
              <ExecutiveRouteGuard>
                <ExecutiveDashboard />
              </ExecutiveRouteGuard>
            }
          />
          <Route
            path="/executive/*"
            element={
              <ExecutiveRouteGuard>
                <ExecutiveDashboard />
              </ExecutiveRouteGuard>
            }
          />

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
            path="/management/users"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="users" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/roles-permissions"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="roles-permissions" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/planning"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="planning" />
              </ManagementRouteGuard>
            }
          />
          <Route
            path="/management/planning/:projectionId"
            element={
              <ManagementRouteGuard>
                <CeoDashboard initialModule="planning" />
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

          {/* Phase 9.2: Technical Inspection & Quality Control Workspace */}
          <Route
            path="/technical"
            element={
              <ProtectedRoute allowedRoles={['technical', 'management', 'executive_director']}>
                <TechnicalDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/technical/*"
            element={
              <ProtectedRoute allowedRoles={['technical', 'management', 'executive_director']}>
                <TechnicalDashboard />
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
            path="/supervisor/projects"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/projects/:projectId"
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
          <Route
            path="/supervisor/attendance"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/productivity"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/materials"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/inspections"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/reports"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/issues"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />
          <Route
            path="/supervisor/*"
            element={
              <SupervisorRouteGuard>
                <SupervisorDashboard />
              </SupervisorRouteGuard>
            }
          />

          {/* Phase 9.2: Dedicated Attendance Register (Supervisor, Management & Executive Director) */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute allowedRoles={['management', 'executive_director', 'supervisor']}>
                <AttendanceRegister />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance/today"
            element={
              <ProtectedRoute allowedRoles={['management', 'executive_director', 'supervisor']}>
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
  path="/social-media"
  element={
    <ProtectedRoute allowedRoles={['social_media_manager', 'management', 'executive_director']}>
      <SocialMediaDashboard />
    </ProtectedRoute>
  }
/>
<Route
  path="/social-media/*"
  element={
    <ProtectedRoute allowedRoles={['social_media_manager', 'management', 'executive_director']}>
      <SocialMediaDashboard />
    </ProtectedRoute>
  }
/>
          {/* Procurement & Logistics Management */}
          <Route
            path="/procurement"
            element={
              <ProtectedRoute allowedRoles={['procurement', 'management', 'executive_director']}>
                <ProcurementDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/procurement/*"
            element={
              <ProtectedRoute allowedRoles={['procurement', 'management', 'executive_director']}>
                <ProcurementDashboard />
              </ProtectedRoute>
            }
          />

          {/* Financial & Accounts Management */}
          <Route
            path="/accounts"
            element={
              <ProtectedRoute allowedRoles={['accounts', 'management', 'executive_director']}>
                <AccountsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounts/*"
            element={
              <ProtectedRoute allowedRoles={['accounts', 'management', 'executive_director']}>
                <AccountsDashboard />
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
