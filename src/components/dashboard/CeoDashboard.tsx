import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  DashboardService,
  DashboardData,
  EMPTY_DASHBOARD_DATA,
  ProjectItem,
  AttentionItem,
} from '../../services/dashboardService';

import { Sidebar, DashboardNavKey } from './Sidebar';
import { Header } from './Header';
import { DashboardOverview } from './DashboardOverview';
import { ModuleShell } from './ModuleShell';
import { ProjectsModule } from './ProjectsModule';
import { ProjectControlCentre } from './ProjectControlCentre';
import { GlobalSearchModal } from './GlobalSearchModal';
import { NotificationsDrawer, NotificationItem } from './NotificationsDrawer';

interface CeoDashboardProps {
  initialModule?: DashboardNavKey;
}

export const CeoDashboard: React.FC<CeoDashboardProps> = ({ initialModule = 'overview' }) => {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();

  const getModuleFromPath = (): DashboardNavKey => {
    if (location.pathname === '/management/projects' || location.pathname.startsWith('/management/projects/')) {
      return 'all-projects';
    }
    return initialModule;
  };

  const [currentModule, setCurrentModule] = useState<DashboardNavKey>(getModuleFromPath);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync route on location change
  useEffect(() => {
    if (location.pathname === '/management/projects' || location.pathname.startsWith('/management/projects/')) {
      setCurrentModule('all-projects');
    } else if (location.pathname === '/management' || location.pathname === '/management/') {
      setCurrentModule('overview');
    }
  }, [location.pathname]);

  const handleSelectModule = (mod: DashboardNavKey) => {
    setCurrentModule(mod);
    if (mod === 'all-projects') {
      if (location.pathname !== '/management/projects') {
        navigate('/management/projects');
      }
    } else if (mod === 'overview') {
      if (location.pathname !== '/management') {
        navigate('/management');
      }
    }
  };

  // Overlays
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  // Real notifications (clean empty array - no fabricated demo items)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Load real database data only
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
        console.warn('[CeoDashboard] Error loading live database values:', err);
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
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const userName =
    profile?.display_name ||
    profile?.first_name ||
    user?.user_metadata?.full_name ||
    'Mayowa';

  const userRole = 'Management / CEO';
  const userEmail = user?.email || profile?.email || 'olaoluwapoadewuyi@gmail.com';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFB] text-slate-900 font-sans select-auto">
      {/* 1. Desktop Left Vertical Collapsible Sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar
          currentModule={currentModule}
          onSelectModule={handleSelectModule}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onLogout={handleLogout}
          userName={userName}
          userRole={userRole}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white z-50 animate-in slide-in-from-left duration-200">
            <Sidebar
              currentModule={currentModule}
              onSelectModule={(mod) => {
                handleSelectModule(mod);
                setMobileSidebarOpen(false);
              }}
              collapsed={false}
              onToggleCollapse={() => setMobileSidebarOpen(false)}
              onLogout={handleLogout}
              userName={userName}
              userRole={userRole}
            />
          </div>
        </div>
      )}

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <Header
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          unreadNotificationsCount={notifications.filter((n) => n.unread).length}
          onSelectModule={handleSelectModule}
          onLogout={handleLogout}
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
          userName={userName}
          userRole={userRole}
        />

        {/* Scrollable Main Workspace */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            /* Subtle clean skeleton loader during initial database fetch */
            <div className="space-y-6 animate-pulse max-w-7xl mx-auto">
              <div className="h-20 bg-white rounded-xl border border-slate-200/80 p-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
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
              {projectId ? (
                <ProjectControlCentre
                  projectId={projectId}
                  onBackToProjects={() => navigate('/management/projects')}
                />
              ) : currentModule === 'overview' ? (
                <DashboardOverview
                  onSelectModule={handleSelectModule}
                  userName={userName}
                  userRole={userRole}
                />
              ) : currentModule === 'all-projects' ? (
                <ProjectsModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : (
                <ModuleShell
                  moduleKey={currentModule}
                  onBackToOverview={() => handleSelectModule('overview')}
                  dashboardData={data}
                  userEmail={userEmail}
                  userName={userName}
                  userRole={userRole}
                />
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
        onSelectProject={(proj: ProjectItem) => {
          setSelectedProject(proj);
          navigate(`/management/projects/${proj.id}`);
        }}
        onSelectModule={handleSelectModule}
      />

      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onSelectNotification={(item) => {
          if (item.module) handleSelectModule(item.module);
        }}
      />
    </div>
  );
};

export default CeoDashboard;
