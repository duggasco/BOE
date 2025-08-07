// Monitoring API service with mock data

import { 
  ScheduleExecution, 
  Schedule, 
  SystemMetric, 
  UserActivity,
  ReportUsage,
  PerformanceMetric,
  StorageUsage,
  MonitoringDashboard,
  Alert
} from '../types/monitoring';

// Generate mock schedule executions
const generateMockExecutions = (): ScheduleExecution[] => {
  const statuses = ['success', 'failed', 'running', 'cancelled'] as const;
  const reports = ['Daily Sales Report', 'Fund Performance', 'Risk Analysis', 'Monthly Summary', 'Client Portfolio'];
  
  const executions: ScheduleExecution[] = [];
  const now = Date.now();
  
  for (let i = 0; i < 50; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const startTime = new Date(now - (i * 3600000)).toISOString();
    const duration = Math.floor(Math.random() * 300000) + 30000; // 30s to 5min
    
    executions.push({
      id: `exec-${i}`,
      scheduleId: `sched-${Math.floor(i / 10)}`,
      scheduleName: `Schedule ${Math.floor(i / 10) + 1}`,
      reportName: reports[Math.floor(Math.random() * reports.length)],
      status,
      startTime,
      endTime: status !== 'running' ? new Date(new Date(startTime).getTime() + duration).toISOString() : undefined,
      duration: status !== 'running' ? duration : undefined,
      error: status === 'failed' ? 'Connection timeout to database' : undefined,
      outputFiles: status === 'success' ? [`report-${i}.pdf`, `report-${i}.xlsx`] : undefined,
      recordsProcessed: status === 'success' ? Math.floor(Math.random() * 10000) : undefined
    });
  }
  
  return executions;
};

// Generate mock schedules
const generateMockSchedules = (): Schedule[] => {
  const schedules: Schedule[] = [];
  const reports = ['Daily Sales Report', 'Fund Performance', 'Risk Analysis', 'Monthly Summary', 'Client Portfolio'];
  const frequencies = ['daily', 'weekly', 'monthly', 'custom'] as const;
  const destinations = ['email', 'filesystem', 'sftp'] as const;
  
  for (let i = 0; i < 15; i++) {
    const enabled = Math.random() > 0.3;
    const lastStatus = ['success', 'failed', 'running'][Math.floor(Math.random() * 3)] as 'success' | 'failed' | 'running';
    
    schedules.push({
      id: `sched-${i}`,
      name: `${reports[i % reports.length]} Schedule`,
      reportId: `report-${i}`,
      reportName: reports[i % reports.length],
      enabled,
      cronExpression: '0 0 * * *',
      nextRun: enabled ? new Date(Date.now() + Math.random() * 86400000).toISOString() : undefined,
      lastRun: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      lastStatus,
      createdBy: ['admin', 'john.doe', 'jane.smith'][Math.floor(Math.random() * 3)],
      createdAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
      frequency: frequencies[Math.floor(Math.random() * frequencies.length)],
      destination: destinations[Math.floor(Math.random() * destinations.length)],
      recipientCount: Math.floor(Math.random() * 20) + 1
    });
  }
  
  return schedules;
};

// Generate time series metrics
const generateTimeSeries = (points: number = 24): SystemMetric[] => {
  const metrics: SystemMetric[] = [];
  const now = Date.now();
  
  for (let i = points - 1; i >= 0; i--) {
    metrics.push({
      timestamp: new Date(now - (i * 3600000)).toISOString(),
      value: Math.random() * 100,
      label: new Date(now - (i * 3600000)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
  }
  
  return metrics;
};

// Generate user activities
const generateUserActivities = (): UserActivity[] => {
  const activities: UserActivity[] = [];
  const actions = ['Executed Report', 'Modified Schedule', 'Created Report', 'Deleted Export', 'Updated Settings'];
  const users = ['admin', 'john.doe', 'jane.smith', 'bob.wilson', 'alice.johnson'];
  
  for (let i = 0; i < 20; i++) {
    activities.push({
      userId: `user-${i % 5}`,
      userName: users[i % users.length],
      action: actions[Math.floor(Math.random() * actions.length)],
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      details: `Details for activity ${i}`
    });
  }
  
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Generate report usage stats
const generateReportUsage = (): ReportUsage[] => {
  const reports = ['Daily Sales Report', 'Fund Performance', 'Risk Analysis', 'Monthly Summary', 'Client Portfolio'];
  
  return reports.map((report, i) => ({
    reportId: `report-${i}`,
    reportName: report,
    executionCount: Math.floor(Math.random() * 1000),
    uniqueUsers: Math.floor(Math.random() * 50),
    avgExecutionTime: Math.floor(Math.random() * 300000),
    lastExecuted: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
    trendPercentage: Math.floor(Math.random() * 50) - 25
  }));
};

// Generate performance metrics
const generatePerformanceMetrics = (): PerformanceMetric[] => {
  return [
    {
      metric: 'cpu',
      current: Math.random() * 100,
      average: 45,
      peak: 92,
      unit: '%',
      status: Math.random() > 0.8 ? 'warning' : 'normal'
    },
    {
      metric: 'memory',
      current: Math.random() * 16,
      average: 8,
      peak: 14,
      unit: 'GB',
      status: 'normal'
    },
    {
      metric: 'disk',
      current: Math.random() * 500,
      average: 250,
      peak: 450,
      unit: 'GB',
      status: Math.random() > 0.9 ? 'critical' : 'normal'
    },
    {
      metric: 'response_time',
      current: Math.random() * 1000,
      average: 250,
      peak: 1500,
      unit: 'ms',
      status: 'normal'
    }
  ];
};

// Generate storage usage
const generateStorageUsage = (): StorageUsage[] => {
  return [
    {
      type: 'reports',
      used: 125,
      total: 500,
      percentage: 25,
      trend: generateTimeSeries(7)
    },
    {
      type: 'exports',
      used: 87,
      total: 200,
      percentage: 43.5,
      trend: generateTimeSeries(7)
    },
    {
      type: 'temp',
      used: 12,
      total: 50,
      percentage: 24,
      trend: generateTimeSeries(7)
    },
    {
      type: 'logs',
      used: 34,
      total: 100,
      percentage: 34,
      trend: generateTimeSeries(7)
    }
  ];
};

// Generate alerts
const generateAlerts = (): Alert[] => {
  return [
    {
      id: 'alert-1',
      type: 'error',
      title: 'Schedule Failure',
      message: 'Daily Sales Report failed to execute',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      resolved: false
    },
    {
      id: 'alert-2',
      type: 'warning',
      title: 'High Memory Usage',
      message: 'Memory usage exceeded 80% threshold',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      resolved: true
    },
    {
      id: 'alert-3',
      type: 'info',
      title: 'System Update',
      message: 'System will undergo maintenance at 2 AM',
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      resolved: false
    }
  ];
};

// API methods
export const monitoringApi = {
  // Schedule executions
  async getExecutions(scheduleId?: string): Promise<ScheduleExecution[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const executions = generateMockExecutions();
    if (scheduleId) {
      return executions.filter(e => e.scheduleId === scheduleId);
    }
    return executions;
  },

  // Schedules
  async getSchedules(): Promise<Schedule[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateMockSchedules();
  },

  async toggleSchedule(id: string, enabled: boolean): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`Schedule ${id} ${enabled ? 'enabled' : 'disabled'}`);
  },

  async cancelExecution(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`Execution ${id} cancelled`);
  },

  // Metrics
  async getSystemMetrics(): Promise<{
    cpu: SystemMetric[];
    memory: SystemMetric[];
    requests: SystemMetric[];
  }> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      cpu: generateTimeSeries(24),
      memory: generateTimeSeries(24),
      requests: generateTimeSeries(24)
    };
  },

  async getUserActivity(): Promise<UserActivity[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateUserActivities();
  },

  async getReportUsage(): Promise<ReportUsage[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateReportUsage();
  },

  async getPerformanceMetrics(): Promise<PerformanceMetric[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generatePerformanceMetrics();
  },

  async getStorageUsage(): Promise<StorageUsage[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateStorageUsage();
  },

  // Dashboard
  async getDashboardSummary(): Promise<MonitoringDashboard> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const schedules = generateMockSchedules();
    
    return {
      schedules: {
        total: schedules.length,
        active: schedules.filter(s => s.enabled).length,
        failed: schedules.filter(s => s.lastStatus === 'failed').length,
        running: schedules.filter(s => s.lastStatus === 'running').length
      },
      system: {
        uptime: Math.floor(Math.random() * 30 * 24), // hours
        activeUsers: Math.floor(Math.random() * 100),
        totalReports: Math.floor(Math.random() * 1000),
        storageUsed: Math.floor(Math.random() * 500) // GB
      },
      recentActivity: generateUserActivities().slice(0, 5),
      alerts: generateAlerts()
    };
  },

  // Alerts
  async getAlerts(): Promise<Alert[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    return generateAlerts();
  },

  async resolveAlert(id: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`Alert ${id} resolved`);
  }
};