import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  DashboardService,
  DashboardData,
  INITIAL_DASHBOARD_DATA,
  ProjectItem,
  AttentionItem,
} from '../../services/dashboardService';

import { Sidebar, NavigationModule } from './Sidebar';
import { Header } from './Header';
import { DashboardOverview } from './DashboardOverview';
import { ProjectsModule } from './ProjectsModule';
import { MaterialsModule } from './MaterialsModule';
import { WorkforceModule } from './WorkforceModule';
import { InspectionsModule } from './InspectionsModule';
import { ReportsModule } from './ReportsModule';
import { CalendarModule } from './CalendarModule';
import { DocumentsModule } from './DocumentsModule';
import { SuppliersModule } from './SuppliersModule';
import { SettingsModule } from './SettingsModule';
import { ProfileModule } from './ProfileModule';
import { SupportModule } from './SupportModule';
import { ProjectDetailModal } from './ProjectDetailModal';
import { GlobalSearchModal } from './GlobalSearchModal';
import { NotificationsDrawer, NotificationItem } from './NotificationsDrawer';

export const CeoDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [currentModule, setCurrentModule] = useState<NavigationModule>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [data, setData] = useState<DashboardData>(INITIAL_DASHBOARD_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Overlays
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-01',
      title: 'Structural Steel Requisition Pending',
      description: 'MR-024 for Riverside Apartments (₦18.7M) awaits CEO approval.',
      timestamp: '10 mins ago',
      unread: true,
      type: 'approval',
      module: 'materials',
    },
    {
      id: 'notif-02',
      title: 'Concrete Test Failure at Sunset Commercial',
      description: 'Shear wall 7-day cylinder strength registered 21.4 MPa vs 30 MPa design spec.',
      timestamp: '1 hour ago',
      unread: true,
      type: 'qc',
      module: 'inspections',
    },
    {
      id: 'notif-03',
      title: 'Metro Office Delayed by 4 Days',
      description: 'MEP pipe conduit rework scheduled to prevent slab depth compromise.',
      timestamp: '3 hours ago',
      unread: true,
      type: 'alert',
      module: 'projects',
    },
    {
      id: 'notif-04',
      title: 'Cement Delivery Verified',
      description: '400 bags delivered to Oakridge Villas site warehouse.',
      timestamp: 'Yesterday',
      unread: false,
      type: 'info',
      module: 'materials',
    },
  ]);

  // Load live data
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const result = await DashboardService.getDashboardData();
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleResolveAttentionItem = async (item: AttentionItem) => {
    await DashboardService.resolveAttentionItem(item.id, 'reviewed');
    setData((prev) => ({
      ...prev,
      attentionItems: prev.attentionItems.filter((i) => i.id !== item.id),
    }));
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const userName =
    profile?.display_name ||
    profile?.first_name ||
    user?.user_metadata?.full_name ||
    'Mayowa';

  const userRole = 'CEO';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFB] text-slate-900 font-sans select-auto">
      {/* 1. Left Vertical Collapsible Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={(mod) => setCurrentModule(mod)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          unreadNotificationsCount={notifications.filter((n) => n.unread).length}
          onSelectModule={(mod) => setCurrentModule(mod)}
          onLogout={handleLogout}
          userName={userName}
          userRole={userRole}
        />

        {/* Scrollable Main Workspace */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            /* Subtle Skeleton Loader (Matching Reference Layout) */
            <div className="space-y-6 animate-pulse max-w-7xl mx-auto">
              <div className="h-10 bg-slate-200/60 rounded-lg w-72" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 bg-white rounded-xl border border-slate-200/80 p-4" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 h-80 bg-white rounded-xl border border-slate-200/80" />
                <div className="lg:col-span-5 h-80 bg-white rounded-xl border border-slate-200/80" />
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {currentModule === 'dashboard' && (
                <DashboardOverview
                  data={data}
                  onSelectModule={(mod) => setCurrentModule(mod)}
                  onOpenProjectDetail={(proj) => setSelectedProject(proj)}
                  onResolveAttentionItem={handleResolveAttentionItem}
                  userName={userName}
                />
              )}

              {currentModule === 'projects' && (
                <ProjectsModule
                  onBackToDashboard={() => setCurrentModule('dashboard')}
                  onOpenProjectDetail={(proj) => setSelectedProject(proj)}
                  projects={data.projects}
                />
              )}

              {currentModule === 'materials' && (
                <MaterialsModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}

              {currentModule === 'workforce' && (
                <WorkforceModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}

              {currentModule === 'inspections' && (
                <InspectionsModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}

              {currentModule === 'reports' && (
                <ReportsModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}

              {currentModule === 'calendar' && (
                <CalendarModule
                  onBackToDashboard={() => setCurrentModule('dashboard')}
                  schedule={data.upcomingSchedule}
                />
              )}

              {currentModule === 'documents' && (
                <DocumentsModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}

              {currentModule === 'suppliers' && (
                <SuppliersModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}

              {currentModule === 'settings' && (
                <SettingsModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}

              {currentModule === 'profile' && (
                <ProfileModule
                  onBackToDashboard={() => setCurrentModule('dashboard')}
                  onLogout={handleLogout}
                />
              )}

              {currentModule === 'support' && (
                <SupportModule onBackToDashboard={() => setCurrentModule('dashboard')} />
              )}
            </div>
          )}
        </main>
      </div>

      {/* 3. Global Interactive Modals & Drawers */}
      <GlobalSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        projects={data.projects}
        onSelectProject={(proj) => setSelectedProject(proj)}
        onSelectModule={(mod) => setCurrentModule(mod)}
      />

      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onSelectNotification={(item) => setCurrentModule(item.module)}
      />

      <ProjectDetailModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
        onNavigateToMaterials={() => setCurrentModule('materials')}
        onNavigateToInspections={() => setCurrentModule('inspections')}
      />
    </div>
  );
};
