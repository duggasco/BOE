import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Alert,
  Progress,
  Timeline,
  Space,
  Button,
  Typography,
  Tooltip,
  Empty,
  Spin,
  Badge,
  message
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  HistoryOutlined,
  RocketOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { format, formatDistanceToNow, isAfter, addHours } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { scheduleService } from '../../services/api/scheduleService';
import type { Schedule, ScheduleExecution, ExecutionStatus } from '../../types/schedule';
import { getStatusColor, getStatusIcon, calculateSuccessRate, formatDuration } from '../../utils/scheduleUtils';
import { Line, Pie } from '@ant-design/charts';

const { Title, Text, Paragraph } = Typography;

interface MonitorStats {
  totalSchedules: number;
  activeSchedules: number;
  executionsToday: number;
  successRate: number;
  avgExecutionTime: number;
  failedLastHour: number;
  pendingExecutions: number;
  nextExecution?: string;
}

interface ExecutionMetrics {
  hourly: Array<{ hour: string; success: number; failed: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}

const ScheduleMonitor: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MonitorStats>({
    totalSchedules: 0,
    activeSchedules: 0,
    executionsToday: 0,
    successRate: 0,
    avgExecutionTime: 0,
    failedLastHour: 0,
    pendingExecutions: 0
  });
  const [recentExecutions, setRecentExecutions] = useState<ScheduleExecution[]>([]);
  const [failedSchedules, setFailedSchedules] = useState<Schedule[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<Schedule[]>([]);
  const [metrics, setMetrics] = useState<ExecutionMetrics>({
    hourly: [],
    statusDistribution: []
  });
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch monitoring data
  const fetchMonitoringData = useCallback(async () => {
    try {
      // Fetch schedules
      const schedulesResponse = await scheduleService.getSchedules({ limit: 100 });
      const schedules = schedulesResponse.schedules;
      
      // Fetch recent executions
      const executionsResponse = await scheduleService.getAllExecutions({ limit: 50 });
      const executions = executionsResponse.executions;

      // Calculate statistics
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const hourAgo = addHours(new Date(), -1);

      const activeSchedules = schedules.filter(s => s.is_active);
      const executionsToday = executions.filter(e => 
        new Date(e.started_at) >= todayStart
      );
      const failedLastHour = executions.filter(e => 
        e.status === 'failed' && new Date(e.started_at) >= hourAgo
      );
      const pendingExecutions = executions.filter(e => e.status === 'pending');

      // Calculate success rate
      const completedExecutions = executions.filter(e => 
        e.status === 'success' || e.status === 'failed'
      );
      const successRate = completedExecutions.length > 0
        ? (completedExecutions.filter(e => e.status === 'success').length / completedExecutions.length) * 100
        : 0;

      // Calculate average execution time
      const executionTimes = executions
        .filter(e => e.completed_at && e.started_at)
        .map(e => {
          const start = new Date(e.started_at).getTime();
          const end = new Date(e.completed_at!).getTime();
          return (end - start) / 1000; // Convert to seconds
        });
      const avgExecutionTime = executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;

      // Find next execution
      const nextExecution = activeSchedules
        .filter(s => s.next_run)
        .sort((a, b) => new Date(a.next_run!).getTime() - new Date(b.next_run!).getTime())[0]?.next_run;

      // Identify failed schedules
      const failed = schedules.filter(s => {
        const recentRuns = executions.filter(e => e.schedule_id === s.id);
        const lastRun = recentRuns[0];
        return lastRun && lastRun.status === 'failed';
      });

      // Get upcoming schedules (next 6 hours)
      const sixHoursFromNow = addHours(new Date(), 6);
      const upcoming = activeSchedules
        .filter(s => s.next_run && new Date(s.next_run) <= sixHoursFromNow)
        .sort((a, b) => new Date(a.next_run!).getTime() - new Date(b.next_run!).getTime())
        .slice(0, 5);

      // Calculate hourly metrics for chart
      const hourlyMetrics: Record<string, { success: number; failed: number }> = {};
      for (let i = 23; i >= 0; i--) {
        const hour = new Date();
        hour.setHours(hour.getHours() - i, 0, 0, 0);
        const hourStr = format(hour, 'HH:00');
        hourlyMetrics[hourStr] = { success: 0, failed: 0 };
      }

      executionsToday.forEach(e => {
        const hour = format(new Date(e.started_at), 'HH:00');
        if (hourlyMetrics[hour]) {
          if (e.status === 'success') {
            hourlyMetrics[hour].success++;
          } else if (e.status === 'failed') {
            hourlyMetrics[hour].failed++;
          }
        }
      });

      const hourlyData = Object.entries(hourlyMetrics).map(([hour, data]) => ({
        hour,
        ...data
      }));

      // Calculate status distribution
      const statusCounts = executions.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1),
        count
      }));

      // Update state
      setStats({
        totalSchedules: schedules.length,
        activeSchedules: activeSchedules.length,
        executionsToday: executionsToday.length,
        successRate,
        avgExecutionTime,
        failedLastHour: failedLastHour.length,
        pendingExecutions: pendingExecutions.length,
        nextExecution
      });
      setRecentExecutions(executions.slice(0, 10));
      setFailedSchedules(failed.slice(0, 5));
      setUpcomingSchedules(upcoming);
      setMetrics({
        hourly: hourlyData,
        statusDistribution
      });

    } catch (error: any) {
      console.error('Failed to fetch monitoring data:', error);
      message.error('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up auto-refresh
  useEffect(() => {
    fetchMonitoringData();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMonitoringData();
    }, 30000);
    
    setRefreshInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchMonitoringData]);


  // Line chart config
  const lineConfig = {
    data: metrics.hourly,
    xField: 'hour',
    yField: 'value',
    seriesField: 'type',
    height: 200,
    xAxis: {
      label: {
        autoRotate: true,
        autoHide: true
      }
    },
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000
      }
    },
    point: {
      size: 3,
      shape: 'circle'
    },
    // Transform data for line chart
    meta: {
      value: {
        alias: 'Executions'
      }
    }
  };

  // Transform data for line chart with memoization
  const lineData = useMemo(() => 
    metrics.hourly.flatMap(item => [
      { hour: item.hour, value: item.success, type: 'Success' },
      { hour: item.hour, value: item.failed, type: 'Failed' }
    ]),
    [metrics.hourly]
  );

  // Pie chart config
  const pieConfig = {
    data: metrics.statusDistribution,
    angleField: 'count',
    colorField: 'status',
    radius: 1,
    innerRadius: 0.6,
    height: 200,
    label: {
      type: 'inner',
      offset: '-50%',
      content: '{value}',
      style: {
        textAlign: 'center',
        fontSize: 14
      }
    },
    statistic: {
      title: false,
      content: {
        style: {
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        },
        content: 'Status'
      }
    },
    interactions: [{ type: 'element-active' }]
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip="Loading monitoring data..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Schedule Monitoring Dashboard</Title>
        <Button 
          icon={<ReloadOutlined />} 
          onClick={fetchMonitoringData}
        >
          Refresh
        </Button>
      </div>

      {/* Alert for critical issues */}
      {stats.failedLastHour > 0 && (
        <Alert
          message="Schedule Failures Detected"
          description={`${stats.failedLastHour} schedule(s) have failed in the last hour. Please review and take action.`}
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 24 }}
          action={
            <Button 
              size="small" 
              danger
              onClick={() => navigate('/schedules/failed')}
            >
              View Failed
            </Button>
          }
        />
      )}

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Schedules"
              value={stats.activeSchedules}
              suffix={`/ ${stats.totalSchedules}`}
              valueStyle={{ color: '#52c41a' }}
              prefix={<ThunderboltOutlined />}
            />
            <Progress 
              percent={(stats.activeSchedules / stats.totalSchedules) * 100} 
              showInfo={false}
              strokeColor="#52c41a"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Success Rate (24h)"
              value={stats.successRate}
              precision={1}
              suffix="%"
              valueStyle={{ 
                color: stats.successRate >= 95 ? '#52c41a' : 
                       stats.successRate >= 80 ? '#faad14' : '#ff4d4f' 
              }}
              prefix={stats.successRate >= 95 ? <CheckCircleOutlined /> : <WarningOutlined />}
            />
            <Progress 
              percent={stats.successRate} 
              showInfo={false}
              strokeColor={{
                '0%': '#ff4d4f',
                '50%': '#faad14',
                '100%': '#52c41a'
              }}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Executions Today"
              value={stats.executionsToday}
              prefix={<HistoryOutlined />}
            />
            {stats.pendingExecutions > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {stats.pendingExecutions} pending
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Avg Execution Time"
              value={stats.avgExecutionTime}
              precision={1}
              suffix="s"
              prefix={<ClockCircleOutlined />}
            />
            {stats.nextExecution && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Next run: {formatDistanceToNow(new Date(stats.nextExecution), { addSuffix: true })}
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Execution Trend (24 Hours)" bordered={false}>
            {metrics.hourly.length > 0 ? (
              <Line {...lineConfig} data={lineData} />
            ) : (
              <Empty description="No execution data available" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Status Distribution" bordered={false}>
            {metrics.statusDistribution.length > 0 ? (
              <Pie {...pieConfig} />
            ) : (
              <Empty description="No status data available" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Failed Schedules and Upcoming Runs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                <span>Failed Schedules</span>
                {failedSchedules.length > 0 && (
                  <Badge count={failedSchedules.length} style={{ marginLeft: 8 }} />
                )}
              </Space>
            }
            extra={
              <Button 
                type="link" 
                size="small"
                onClick={() => navigate('/schedules?status=failed')}
              >
                View All <RightOutlined />
              </Button>
            }
          >
            {failedSchedules.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                {failedSchedules.map(schedule => (
                  <Alert
                    key={schedule.id}
                    message={schedule.name}
                    description={`Last failed: ${schedule.last_run ? formatDistanceToNow(new Date(schedule.last_run), { addSuffix: true }) : 'Never'}`}
                    type="error"
                    showIcon={false}
                    action={
                      <Space>
                        <Button 
                          size="small"
                          onClick={() => navigate(`/schedules/${schedule.id}/history`)}
                        >
                          History
                        </Button>
                        <Button 
                          size="small"
                          type="primary"
                          onClick={async () => {
                            try {
                              await scheduleService.testSchedule(schedule.id);
                              message.success('Test run initiated');
                            } catch (error) {
                              message.error('Failed to initiate test run');
                            }
                          }}
                        >
                          Retry
                        </Button>
                      </Space>
                    }
                  />
                ))}
              </Space>
            ) : (
              <Empty 
                description="No failed schedules" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <CalendarOutlined style={{ color: '#1890ff' }} />
                <span>Upcoming Runs</span>
              </Space>
            }
            extra={
              <Button 
                type="link" 
                size="small"
                onClick={() => navigate('/schedules')}
              >
                View All <RightOutlined />
              </Button>
            }
          >
            {upcomingSchedules.length > 0 ? (
              <Timeline>
                {upcomingSchedules.map(schedule => (
                  <Timeline.Item 
                    key={schedule.id}
                    color="blue"
                    dot={<ClockCircleOutlined />}
                  >
                    <Space direction="vertical" size={0}>
                      <Text strong>{schedule.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {schedule.next_run ? format(new Date(schedule.next_run), 'MMM dd, HH:mm') : 'Not scheduled'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDistanceToNow(new Date(schedule.next_run!), { addSuffix: true })}
                      </Text>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Empty 
                description="No upcoming schedules" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Executions */}
      <Card 
        title={
          <Space>
            <RocketOutlined />
            <span>Recent Executions</span>
          </Space>
        }
        extra={
          <Button 
            type="link" 
            size="small"
            onClick={() => navigate('/schedules/executions')}
          >
            View All <RightOutlined />
          </Button>
        }
      >
        {recentExecutions.length > 0 ? (
          <Table
            dataSource={recentExecutions}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Schedule',
                dataIndex: 'schedule_id',
                key: 'schedule',
                render: (id: string) => {
                  const schedule = upcomingSchedules.find(s => s.id === id) || 
                                  failedSchedules.find(s => s.id === id);
                  return schedule?.name || 'Unknown';
                },
                ellipsis: true
              },
              {
                title: 'Started',
                dataIndex: 'started_at',
                key: 'started_at',
                render: (date: string) => (
                  <Tooltip title={format(new Date(date), 'PPpp')}>
                    <Text>{formatDistanceToNow(new Date(date), { addSuffix: true })}</Text>
                  </Tooltip>
                ),
                width: 150
              },
              {
                title: 'Duration',
                key: 'duration',
                render: (_, record) => {
                  if (!record.completed_at) return '-';
                  const duration = (new Date(record.completed_at).getTime() - 
                                   new Date(record.started_at).getTime()) / 1000;
                  return `${duration.toFixed(1)}s`;
                },
                width: 100
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status: ExecutionStatus) => (
                  <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
                    {status.toUpperCase()}
                  </Tag>
                ),
                width: 120
              },
              {
                title: 'Message',
                dataIndex: 'error_message',
                key: 'error_message',
                render: (message: string) => message ? (
                  <Tooltip title={message}>
                    <Text type="danger" ellipsis style={{ maxWidth: 200 }}>
                      {message}
                    </Text>
                  </Tooltip>
                ) : '-',
                ellipsis: true
              }
            ]}
          />
        ) : (
          <Empty description="No recent executions" />
        )}
      </Card>
    </div>
  );
};

export default ScheduleMonitor;