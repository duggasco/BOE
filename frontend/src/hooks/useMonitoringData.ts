// Custom hooks for monitoring data fetching

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { 
  Schedule, 
  ScheduleExecution,
  SystemMetric,
  UserActivity,
  ReportUsage,
  PerformanceMetric,
  StorageUsage,
  MonitoringDashboard
} from '../types/monitoring';
import { monitoringApi } from '../services/monitoringApi';
import { REFRESH_INTERVALS } from '../constants/monitoring';

// Hook for schedule monitoring data
export const useScheduleData = (autoRefresh = true) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [executions, setExecutions] = useState<ScheduleExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [schedulesData, executionsData] = await Promise.all([
        monitoringApi.getSchedules(),
        monitoringApi.getExecutions()
      ]);
      setSchedules(schedulesData);
      setExecutions(executionsData);
    } catch (err) {
      const errorMessage = 'Failed to load schedule data';
      setError(errorMessage);
      message.error(errorMessage);
      console.error('Error loading schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    
    if (autoRefresh) {
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 5000; // 0-5 seconds
      const interval = setInterval(() => {
        loadData();
      }, REFRESH_INTERVALS.SCHEDULE_MONITOR + jitter);
      
      return () => clearInterval(interval);
    }
  }, [loadData, autoRefresh]);

  const toggleSchedule = async (schedule: Schedule) => {
    try {
      await monitoringApi.toggleSchedule(schedule.id, !schedule.enabled);
      message.success(`Schedule ${!schedule.enabled ? 'enabled' : 'disabled'}`);
      await loadData();
    } catch (err) {
      message.error('Failed to update schedule');
      console.error('Error toggling schedule:', err);
    }
  };

  const cancelExecution = async (executionId: string) => {
    try {
      await monitoringApi.cancelExecution(executionId);
      message.success('Execution cancelled');
      await loadData();
    } catch (err) {
      message.error('Failed to cancel execution');
      console.error('Error cancelling execution:', err);
    }
  };

  return {
    schedules,
    executions,
    loading,
    error,
    refetch: loadData,
    toggleSchedule,
    cancelExecution
  };
};

// Hook for system metrics data
export const useSystemMetrics = (timeRange: string = '24h', autoRefresh = true) => {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [cpuMetrics, setCpuMetrics] = useState<SystemMetric[]>([]);
  const [memoryMetrics, setMemoryMetrics] = useState<SystemMetric[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<SystemMetric[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [reportUsage, setReportUsage] = useState<ReportUsage[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    try {
      setError(null);
      const [
        dashboardData,
        metricsData,
        activityData,
        usageData,
        perfData,
        storageData
      ] = await Promise.all([
        monitoringApi.getDashboardSummary(),
        monitoringApi.getSystemMetrics(),
        monitoringApi.getUserActivity(),
        monitoringApi.getReportUsage(),
        monitoringApi.getPerformanceMetrics(),
        monitoringApi.getStorageUsage()
      ]);

      setDashboard(dashboardData);
      setCpuMetrics(metricsData.cpu);
      setMemoryMetrics(metricsData.memory);
      setRequestMetrics(metricsData.requests);
      setUserActivity(activityData);
      setReportUsage(usageData);
      setPerformanceMetrics(perfData);
      setStorageUsage(storageData);
    } catch (err) {
      const errorMessage = 'Failed to load system metrics';
      setError(errorMessage);
      message.error(errorMessage);
      console.error('Error loading metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    
    if (autoRefresh) {
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 5000; // 0-5 seconds
      const interval = setInterval(() => {
        loadMetrics();
      }, REFRESH_INTERVALS.SYSTEM_METRICS + jitter);
      
      return () => clearInterval(interval);
    }
  }, [loadMetrics, timeRange, autoRefresh]);

  return {
    dashboard,
    cpuMetrics,
    memoryMetrics,
    requestMetrics,
    userActivity,
    reportUsage,
    performanceMetrics,
    storageUsage,
    loading,
    error,
    refetch: loadMetrics
  };
};

// Hook for calculating schedule statistics
export const useScheduleStats = (schedules: Schedule[], executions: ScheduleExecution[]) => {
  const stats = {
    total: schedules.length,
    active: schedules.filter(s => s.enabled).length,
    running: executions.filter(e => e.status === 'running').length,
    failed: executions.filter(e => 
      e.status === 'failed' && 
      new Date(e.startTime).getTime() > Date.now() - 86400000
    ).length
  };

  // Calculate performance metrics from actual data
  const recentExecutions = executions.filter(e => 
    new Date(e.startTime).getTime() > Date.now() - 86400000
  );

  const successCount = recentExecutions.filter(e => e.status === 'success').length;
  const successRate = recentExecutions.length > 0 
    ? Math.round((successCount / recentExecutions.length) * 100)
    : 0;

  const durations = recentExecutions
    .filter(e => e.duration)
    .map(e => e.duration!);
  
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const queueUtilization = Math.round(
    (executions.filter(e => e.status === 'running').length / Math.max(schedules.length, 1)) * 100
  );

  return {
    stats,
    performance: {
      successRate,
      avgDuration,
      queueUtilization
    }
  };
};