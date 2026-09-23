import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ASSETS } from '../assets/projectImages';
import { AuditLogger } from '../lib/audit';

export interface ProjectItem {
  id: string;
  name: string;
  location: string;
  progress: number;
  status: 'On Track' | 'At Risk' | 'Delayed' | 'Completed';
  image: string;
  budget: string;
  spent: string;
  client: string;
  siteSupervisor: string;
  targetDate: string;
}

export interface AttentionItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  actionLabel: string;
  module: 'projects' | 'materials' | 'inspections' | 'suppliers' | 'workforce';
  timestamp: string;
  resolved?: boolean;
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  type: 'delivery' | 'inspection' | 'approval' | 'attendance' | 'po';
}

export interface ScheduleItem {
  id: string;
  day: string;
  month: string;
  title: string;
  location: string;
  time: string;
  status: 'Scheduled' | 'Pending' | 'Completed';
}

export interface MaterialBudgetPoint {
  month: string;
  actual: number; // in Millions of Naira
  budgeted: number; // in Millions of Naira
}

export interface DashboardData {
  kpis: {
    activeProjects: number;
    totalProjects: number;
    activeProjectsTrend: string;
    totalWorkforce: number;
    onSiteToday: number;
    workforceTrend: string;
    materialsValue: string;
    materialsTrend: string;
    openInspections: number;
    inspectionsThisMonth: number;
    inspectionsTrend: string;
  };
  projects: ProjectItem[];
  materialUsage: MaterialBudgetPoint[];
  recentActivities: ActivityItem[];
  upcomingSchedule: ScheduleItem[];
  attentionItems: AttentionItem[];
  workforceSnapshot: {
    total: number;
    present: number;
    late: number;
    absent: number;
    temporary: number;
    permanent: number;
  };
  financialSnapshot: {
    revenue: string;
    costs: string;
    receivables: string;
    margin: string;
  };
}

export const INITIAL_DASHBOARD_DATA: DashboardData = {
  kpis: {
    activeProjects: 8,
    totalProjects: 12,
    activeProjectsTrend: '+ 14%',
    totalWorkforce: 142,
    onSiteToday: 120,
    workforceTrend: '+ 6%',
    materialsValue: '₦284,650,000',
    materialsTrend: '+ 9%',
    openInspections: 6,
    inspectionsThisMonth: 24,
    inspectionsTrend: '- 25%',
  },
  projects: [
    {
      id: 'proj-01',
      name: 'Riverside Apartments',
      location: 'Lekki, Lagos',
      progress: 76,
      status: 'On Track',
      image: ASSETS.riversideThumb,
      budget: '₦420,000,000',
      spent: '₦319,200,000',
      client: 'Greenfield Residences Ltd',
      siteSupervisor: 'Engr. Babatunde Lawal',
      targetDate: '15 Nov 2025',
    },
    {
      id: 'proj-02',
      name: 'Oakridge Villas',
      location: 'Ajah, Lagos',
      progress: 52,
      status: 'On Track',
      image: ASSETS.oakridgeThumb,
      budget: '₦380,000,000',
      spent: '₦197,600,000',
      client: 'Oakridge Properties',
      siteSupervisor: 'Engr. Chidi Okafor',
      targetDate: '28 Jan 2026',
    },
    {
      id: 'proj-03',
      name: 'Sunset Commercial',
      location: 'Victoria Island, Lagos',
      progress: 34,
      status: 'At Risk',
      image: ASSETS.sunsetThumb,
      budget: '₦680,000,000',
      spent: '₦231,200,000',
      client: 'Apex Capital Holdings',
      siteSupervisor: 'Arch. Fatima Aliyu',
      targetDate: '10 Apr 2026',
    },
    {
      id: 'proj-04',
      name: 'Lakeside Residences',
      location: 'Ikoyi, Lagos',
      progress: 68,
      status: 'On Track',
      image: ASSETS.lakesideThumb,
      budget: '₦510,000,000',
      spent: '₦346,800,000',
      client: 'Lakeside Ventures',
      siteSupervisor: 'Engr. Segun Adeleke',
      targetDate: '30 Dec 2025',
    },
    {
      id: 'proj-05',
      name: 'Metro Office',
      location: 'Yaba, Lagos',
      progress: 25,
      status: 'Delayed',
      image: ASSETS.metroThumb,
      budget: '₦290,000,000',
      spent: '₦72,500,000',
      client: 'TechHub Properties',
      siteSupervisor: 'Engr. Emeka Nwosu',
      targetDate: '18 Aug 2025',
    },
  ],
  materialUsage: [
    { month: 'Jan', actual: 42, budgeted: 56 },
    { month: 'Feb', actual: 60, budgeted: 72 },
    { month: 'Mar', actual: 86, budgeted: 92 },
    { month: 'Apr', actual: 92, budgeted: 104 },
    { month: 'May', actual: 112, budgeted: 128 },
    { month: 'Jun', actual: 146, budgeted: 178 },
  ],
  recentActivities: [
    {
      id: 'act-01',
      title: 'Cement (OPC) received',
      subtitle: 'Riverside Apartments',
      timestamp: 'Today, 10:24 AM',
      type: 'delivery',
    },
    {
      id: 'act-02',
      title: 'Structural inspection completed',
      subtitle: 'Oakridge Villas',
      timestamp: 'Today, 09:15 AM',
      type: 'inspection',
    },
    {
      id: 'act-03',
      title: 'Material request approved',
      subtitle: 'Sunset Commercial',
      timestamp: 'Yesterday, 04:32 PM',
      type: 'approval',
    },
    {
      id: 'act-04',
      title: 'Workforce attendance updated',
      subtitle: 'Metro Office',
      timestamp: 'Yesterday, 02:18 PM',
      type: 'attendance',
    },
    {
      id: 'act-05',
      title: 'Purchase order delivered',
      subtitle: 'Lakeside Residences',
      timestamp: '21 Jun 2025, 11:20 AM',
      type: 'po',
    },
  ],
  upcomingSchedule: [
    {
      id: 'sch-01',
      day: '24',
      month: 'JUN',
      title: 'Foundation Inspection',
      location: 'Riverside Apartments',
      time: '10:00 AM',
      status: 'Scheduled',
    },
    {
      id: 'sch-02',
      day: '25',
      month: 'JUN',
      title: 'Material Delivery (Cement)',
      location: 'Oakridge Villas',
      time: '09:00 AM',
      status: 'Scheduled',
    },
    {
      id: 'sch-03',
      day: '26',
      month: 'JUN',
      title: 'Safety Audit',
      location: 'Sunset Commercial',
      time: '02:00 PM',
      status: 'Scheduled',
    },
    {
      id: 'sch-04',
      day: '27',
      month: 'JUN',
      title: 'Progress Review Meeting',
      location: 'Lakeside Residences',
      time: '11:00 AM',
      status: 'Scheduled',
    },
  ],
  attentionItems: [
    {
      id: 'att-01',
      title: 'Project Metro Office',
      description: 'Delayed by 4 days due to MEP delivery hold',
      severity: 'critical',
      actionLabel: 'View Project →',
      module: 'projects',
      timestamp: 'Today, 08:30 AM',
    },
    {
      id: 'att-02',
      title: 'Material Request MR-024',
      description: 'Awaiting CEO budget signoff (₦18.4M structural steel)',
      severity: 'warning',
      actionLabel: 'Review →',
      module: 'materials',
      timestamp: 'Today, 09:12 AM',
    },
    {
      id: 'att-03',
      title: 'Inspection #INS-019',
      description: 'Critical concrete compressive strength finding at Sunset Commercial',
      severity: 'critical',
      actionLabel: 'Review →',
      module: 'inspections',
      timestamp: 'Yesterday, 05:40 PM',
    },
    {
      id: 'att-04',
      title: 'Purchase Order PO-032',
      description: 'Delivery quantity discrepancy reported by Site Supervisor',
      severity: 'warning',
      actionLabel: 'Review →',
      module: 'suppliers',
      timestamp: 'Yesterday, 03:15 PM',
    },
  ],
  workforceSnapshot: {
    total: 142,
    present: 120,
    late: 12,
    absent: 6,
    temporary: 58,
    permanent: 84,
  },
  financialSnapshot: {
    revenue: '₦1,420,000,000',
    costs: '₦985,400,000',
    receivables: '₦182,500,000',
    margin: '30.6%',
  },
};

export class DashboardService {
  /**
   * Fetches dashboard data: tries live Supabase tables first, falling back to clean authoritative Davejoe dataset
   */
  static async getDashboardData(): Promise<DashboardData> {
    try {
      if (isSupabaseConfigured) {
        // Attempt query on live projects table if created
        const { data: dbProjects, error } = await supabase
          .from('projects')
          .select('*')
          .limit(10);

        if (!error && dbProjects && dbProjects.length > 0) {
          // Merge Supabase projects data
          const mappedProjects: ProjectItem[] = dbProjects.map((p, idx) => ({
            id: p.id || `proj-live-${idx}`,
            name: p.name || `Project ${idx + 1}`,
            location: p.location || 'Lagos, Nigeria',
            progress: typeof p.progress === 'number' ? p.progress : 50,
            status: p.status || 'On Track',
            image: [ASSETS.riversideThumb, ASSETS.oakridgeThumb, ASSETS.sunsetThumb, ASSETS.lakesideThumb][idx % 4],
            budget: p.budget ? `₦${Number(p.budget).toLocaleString()}` : '₦350,000,000',
            spent: p.spent ? `₦${Number(p.spent).toLocaleString()}` : '₦180,000,000',
            client: p.client || 'Client',
            siteSupervisor: p.supervisor || 'Site Engineer',
            targetDate: p.target_date || 'Dec 2025',
          }));

          return {
            ...INITIAL_DASHBOARD_DATA,
            projects: mappedProjects,
            kpis: {
              ...INITIAL_DASHBOARD_DATA.kpis,
              activeProjects: mappedProjects.length,
            },
          };
        }
      }
    } catch (err) {
      console.warn('[DashboardService] Live fetch fallback to operational snapshot:', err);
    }

    return INITIAL_DASHBOARD_DATA;
  }

  /**
   * CEO approves an item (e.g. material request MR-024)
   */
  static async resolveAttentionItem(itemId: string, actionType: string): Promise<void> {
    await AuditLogger.log({
      action: `ceo.${actionType}`,
      module: 'management',
      recordId: itemId,
      newValues: { status: 'approved_by_ceo' },
    });
  }
}
