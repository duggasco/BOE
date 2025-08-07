// Monitoring-related type definitions

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  scheduleName: string;
  reportName: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number; // in milliseconds
  error?: string;
  outputFiles?: string[];
  recordsProcessed?: number;
}

export interface Schedule {
  id: string;
  name: string;
  reportId: string;
  reportName: string;
  enabled: boolean;
  cronExpression: string;
  nextRun?: string;
  lastRun?: string;
  lastStatus?: 'success' | 'failed' | 'running';
  createdBy: string;
  createdAt: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  destination: 'email' | 'filesystem' | 'sftp';
  recipientCount?: number;
}

export interface SystemMetric {
  timestamp: string;
  value: number;
  label?: string;
}

export interface UserActivity {
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details?: string;
}

export interface ReportUsage {
  reportId: string;
  reportName: string;
  executionCount: number;
  uniqueUsers: number;
  avgExecutionTime: number;
  lastExecuted: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export interface PerformanceMetric {
  metric: 'cpu' | 'memory' | 'disk' | 'response_time';
  current: number;
  average: number;
  peak: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface StorageUsage {
  type: 'reports' | 'exports' | 'temp' | 'logs';
  used: number;
  total: number;
  percentage: number;
  trend: SystemMetric[];
}

export interface MonitoringDashboard {
  schedules: {
    total: number;
    active: number;
    failed: number;
    running: number;
  };
  system: {
    uptime: number;
    activeUsers: number;
    totalReports: number;
    storageUsed: number;
  };
  recentActivity: UserActivity[];
  alerts: MonitoringAlert[];
}

export interface MonitoringAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

// Also export as Alert for compatibility
export type Alert = MonitoringAlert;