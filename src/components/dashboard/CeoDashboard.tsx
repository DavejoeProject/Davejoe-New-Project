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
import { WorkforceModule } from './WorkforceModule';
import { WorkforceControlCentre } from './WorkforceControlCentre';
import { WorkforcePerformanceModule } from './WorkforcePerformanceModule';
import { AttendanceModule } from './AttendanceModule';
import { ProductivityModule } from './ProductivityModule';
import { OvertimeModule } from './OvertimeModule';
import { ConductModule } from './ConductModule';
import { MaterialsLandingModule } from './MaterialsLandingModule';
import { MaterialsDirectoryModule } from './MaterialsDirectoryModule';
import { MaterialRequestsModule } from './MaterialRequestsModule';
import { MaterialRequestControlCentre } from './MaterialRequestControlCentre';
import { ProcurementModule } from './ProcurementModule';
import { PurchaseOrderControlCentre } from './PurchaseOrderControlCentre';
import { MaterialsSubmoduleFoundation } from './MaterialsSubmoduleFoundation';
import {
  FileText,
  ShoppingCart,
  Truck,
  Boxes,
  RotateCcw,
  Scale,
} from 'lucide-react';
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
  const { projectId, workforceId, requestId, purchaseOrderId } = useParams<{
    projectId?: string;
    workforceId?: string;
    requestId?: string;
    purchaseOrderId?: string;
  }>();

  const isIndividualWorker = Boolean(
    workforceId &&
      !['performance', 'attendance', 'productivity', 'overtime', 'conduct'].includes(workforceId)
  );

  const getModuleFromPath = (): DashboardNavKey => {
    if (location.pathname === '/management/projects' || location.pathname.startsWith('/management/projects/')) {
      return 'all-projects';
    }
    // Workforce routes
    if (location.pathname === '/management/workforce/performance') {
      return 'workforce-performance';
    }
    if (location.pathname === '/management/workforce/attendance') {
      return 'attendance';
    }
    if (location.pathname === '/management/workforce/productivity') {
      return 'productivity';
    }
    if (location.pathname === '/management/workforce/overtime') {
      return 'overtime';
    }
    if (location.pathname === '/management/workforce/conduct') {
      return 'conduct';
    }
    if (location.pathname === '/management/workforce' || location.pathname.startsWith('/management/workforce/')) {
      return 'workforce';
    }
    // Materials routes
    if (location.pathname === '/management/materials/directory') {
      return 'materials-directory';
    }
    if (location.pathname === '/management/materials/requests' || location.pathname.startsWith('/management/materials/requests/')) {
      return 'material-requests';
    }
    if (location.pathname === '/management/materials/procurement' || location.pathname.startsWith('/management/materials/procurement/')) {
      return 'procurement';
    }
    if (location.pathname === '/management/materials/deliveries') {
      return 'deliveries';
    }
    if (location.pathname === '/management/materials/stock') {
      return 'stock';
    }
    if (location.pathname === '/management/materials/losses-returns') {
      return 'losses-returns';
    }
    if (location.pathname === '/management/materials/reconciliation') {
      return 'reconciliation';
    }
    if (location.pathname === '/management/materials' || location.pathname.startsWith('/management/materials/')) {
      return 'materials';
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
    } else if (location.pathname === '/management/workforce/performance') {
      setCurrentModule('workforce-performance');
    } else if (location.pathname === '/management/workforce/attendance') {
      setCurrentModule('attendance');
    } else if (location.pathname === '/management/workforce/productivity') {
      setCurrentModule('productivity');
    } else if (location.pathname === '/management/workforce/overtime') {
      setCurrentModule('overtime');
    } else if (location.pathname === '/management/workforce/conduct') {
      setCurrentModule('conduct');
    } else if (location.pathname === '/management/workforce' || location.pathname.startsWith('/management/workforce/')) {
      setCurrentModule('workforce');
    } else if (location.pathname === '/management/materials/directory') {
      setCurrentModule('materials-directory');
    } else if (location.pathname === '/management/materials/requests' || location.pathname.startsWith('/management/materials/requests/')) {
      setCurrentModule('material-requests');
    } else if (location.pathname === '/management/materials/procurement' || location.pathname.startsWith('/management/materials/procurement/')) {
      setCurrentModule('procurement');
    } else if (location.pathname === '/management/materials/deliveries') {
      setCurrentModule('deliveries');
    } else if (location.pathname === '/management/materials/stock') {
      setCurrentModule('stock');
    } else if (location.pathname === '/management/materials/losses-returns') {
      setCurrentModule('losses-returns');
    } else if (location.pathname === '/management/materials/reconciliation') {
      setCurrentModule('reconciliation');
    } else if (location.pathname === '/management/materials' || location.pathname.startsWith('/management/materials/')) {
      setCurrentModule('materials');
    } else if (location.pathname === '/management' || location.pathname === '/management/') {
      setCurrentModule(initialModule || 'overview');
    }
  }, [location.pathname, initialModule]);

  // Synchronize when initialModule prop changes
  useEffect(() => {
    if (initialModule && initialModule !== 'overview') {
      setCurrentModule(initialModule);
    }
  }, [initialModule]);

  const handleSelectModule = (mod: DashboardNavKey) => {
    setCurrentModule(mod);
    if (mod === 'all-projects') {
      if (location.pathname !== '/management/projects') {
        navigate('/management/projects');
      }
    } else if (mod === 'workforce') {
      if (location.pathname !== '/management/workforce') {
        navigate('/management/workforce');
      }
    } else if (mod === 'workforce-performance') {
      if (location.pathname !== '/management/workforce/performance') {
        navigate('/management/workforce/performance');
      }
    } else if (mod === 'attendance') {
      if (location.pathname !== '/management/workforce/attendance') {
        navigate('/management/workforce/attendance');
      }
    } else if (mod === 'productivity') {
      if (location.pathname !== '/management/workforce/productivity') {
        navigate('/management/workforce/productivity');
      }
    } else if (mod === 'overtime') {
      if (location.pathname !== '/management/workforce/overtime') {
        navigate('/management/workforce/overtime');
      }
    } else if (mod === 'conduct') {
      if (location.pathname !== '/management/workforce/conduct') {
        navigate('/management/workforce/conduct');
      }
    } else if (mod === 'materials') {
      if (location.pathname !== '/management/materials') {
        navigate('/management/materials');
      }
    } else if (mod === 'materials-directory') {
      if (location.pathname !== '/management/materials/directory') {
        navigate('/management/materials/directory');
      }
    } else if (mod === 'material-requests') {
      if (location.pathname !== '/management/materials/requests') {
        navigate('/management/materials/requests');
      }
    } else if (mod === 'procurement') {
      if (location.pathname !== '/management/materials/procurement') {
        navigate('/management/materials/procurement');
      }
    } else if (mod === 'deliveries') {
      if (location.pathname !== '/management/materials/deliveries') {
        navigate('/management/materials/deliveries');
      }
    } else if (mod === 'stock') {
      if (location.pathname !== '/management/materials/stock') {
        navigate('/management/materials/stock');
      }
    } else if (mod === 'losses-returns') {
      if (location.pathname !== '/management/materials/losses-returns') {
        navigate('/management/materials/losses-returns');
      }
    } else if (mod === 'reconciliation') {
      if (location.pathname !== '/management/materials/reconciliation') {
        navigate('/management/materials/reconciliation');
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
              ) : isIndividualWorker && workforceId ? (
                <WorkforceControlCentre
                  workforceId={workforceId}
                  onBackToWorkforce={() => navigate('/management/workforce')}
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
              ) : currentModule === 'workforce' ? (
                <WorkforceModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : currentModule === 'workforce-performance' ? (
                <WorkforcePerformanceModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : currentModule === 'attendance' ? (
                <AttendanceModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : currentModule === 'productivity' ? (
                <ProductivityModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : currentModule === 'overtime' ? (
                <OvertimeModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : currentModule === 'conduct' ? (
                <ConductModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : currentModule === 'materials' ? (
                <MaterialsLandingModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                  onSelectSection={handleSelectModule}
                />
              ) : currentModule === 'materials-directory' ? (
                <MaterialsDirectoryModule
                  onBackToDashboard={() => handleSelectModule('overview')}
                />
              ) : currentModule === 'material-requests' ? (
                requestId ? (
                  <MaterialRequestControlCentre
                    requestId={requestId}
                    onBack={() => {
                      navigate('/management/materials/requests');
                      handleSelectModule('material-requests');
                    }}
                  />
                ) : (
                  <MaterialRequestsModule
                    onBackToDashboard={() => handleSelectModule('overview')}
                  />
                )
              ) : currentModule === 'procurement' ? (
                purchaseOrderId ? (
                  <PurchaseOrderControlCentre
                    purchaseOrderId={purchaseOrderId}
                    onBack={() => {
                      navigate('/management/materials/procurement');
                      handleSelectModule('procurement');
                    }}
                  />
                ) : (
                  <ProcurementModule
                    onBackToDashboard={() => handleSelectModule('overview')}
                  />
                )
              ) : currentModule === 'deliveries' ? (
                <MaterialsSubmoduleFoundation
                  title="Deliveries"
                  subtitle="Track incoming site material shipments, delivery waybills, and physical receipts."
                  tabKey="deliveries"
                  icon={Truck}
                  targetTable="material_deliveries"
                  tableLabel="delivery dispatches"
                  description="Supplier waybill verification, gate pass inspection, and on-site delivery receipt logs will be introduced in subsequent phases."
                  onBackToOverview={() => handleSelectModule('materials')}
                />
              ) : currentModule === 'stock' ? (
                <MaterialsSubmoduleFoundation
                  title="Stock"
                  subtitle="Monitor physical stock balances, warehouse storage locations, and site issue movements."
                  tabKey="stock"
                  icon={Boxes}
                  targetTable="material_stock_movements"
                  tableLabel="stock movement entries"
                  description="Warehouse storage bin management, stock ledger adjustments, and real-time site issue tickets will be introduced in subsequent phases."
                  onBackToOverview={() => handleSelectModule('materials')}
                />
              ) : currentModule === 'losses-returns' ? (
                <MaterialsSubmoduleFoundation
                  title="Losses & Returns"
                  subtitle="Track construction site wastage, damaged goods, transit losses, and returns to suppliers."
                  tabKey="losses-returns"
                  icon={RotateCcw}
                  targetTable="material_losses"
                  tableLabel="loss incident records"
                  description="Damaged material quarantine, supplier credit return authorizations, and wastage threshold tracking will be introduced in subsequent phases."
                  onBackToOverview={() => handleSelectModule('materials')}
                />
              ) : currentModule === 'reconciliation' ? (
                <MaterialsSubmoduleFoundation
                  title="Reconciliation"
                  subtitle="Compare material movement, usage, physical stock, and billing variances."
                  tabKey="reconciliation"
                  icon={Scale}
                  targetTable="material_reconciliations"
                  tableLabel="audit reconciliation runs"
                  description="Periodic physical stocktaking, theoretical vs actual consumption audits, and discrepancy resolution will be introduced in subsequent phases."
                  onBackToOverview={() => handleSelectModule('materials')}
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
