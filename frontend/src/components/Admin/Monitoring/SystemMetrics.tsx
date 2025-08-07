import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Tag, 
  Progress,
  Space,
  Button,
  Alert,
  Badge,
  Tooltip,
  message,
  Select,
  Spin
} from 'antd';
import {
  UserOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { Line, Bar, Pie } from 'recharts';
import { 
  LineChart, 
  BarChart,
  PieChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  SystemMetric, 
  UserActivity, 
  ReportUsage, 
  PerformanceMetric,
  StorageUsage,
  MonitoringDashboard
} from '../../../types/monitoring';
import { monitoringApi } from '../../../services/monitoringApi';

const { Option } = Select;

const SystemMetrics: React.FC = () => {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [cpuMetrics, setCpuMetrics] = useState<SystemMetric[]>([]);
  const [memoryMetrics, setMemoryMetrics] = useState<SystemMetric[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<SystemMetric[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [reportUsage, setReportUsage] = useState<ReportUsage[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('24h');

  // Load all metrics
  const loadMetrics = async () => {
    setLoading(true);
    try {
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
    } catch (error) {
      message.error('Failed to load system metrics');
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    // Auto-refresh every minute
    const interval = setInterval(() => {
      loadMetrics();
    }, 60000);
    return () => clearInterval(interval);
  }, [timeRange]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
    message.success('Metrics refreshed');
  };

  // Format uptime
  const formatUptime = (hours: number) => {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return '#52c41a';
      case 'warning': return '#faad14';
      case 'critical': return '#ff4d4f';
      default: return '#999';
    }
  };

  // Performance card renderer
  const renderPerformanceCard = (metric: PerformanceMetric) => {
    const icon = {
      cpu: <ClusterOutlined />,
      memory: <DatabaseOutlined />,
      disk: <DatabaseOutlined />,
      response_time: <ClockCircleOutlined />
    };

    return (
      <Card key={metric.metric} size="small">
        <Row align="middle">
          <Col span={6}>
            <div style={{ fontSize: 24, color: getStatusColor(metric.status) }}>
              {icon[metric.metric]}
            </div>
          </Col>
          <Col span={18}>
            <div style={{ marginBottom: 8 }}>
              <strong>{metric.metric.toUpperCase().replace('_', ' ')}</strong>
              <Badge 
                status={
                  metric.status === 'normal' ? 'success' : 
                  metric.status === 'warning' ? 'warning' : 'error'
                }
                style={{ marginLeft: 8 }}
              />
            </div>
            <Progress
              percent={Math.round((metric.current / metric.peak) * 100)}
              strokeColor={getStatusColor(metric.status)}
              format={() => `${metric.current.toFixed(1)} ${metric.unit}`}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              Avg: {metric.average} {metric.unit} | Peak: {metric.peak} {metric.unit}
            </div>
          </Col>
        </Row>
      </Card>
    );
  };

  // User activity columns
  const activityColumns = [
    {
      title: 'User',
      dataIndex: 'userName',
      key: 'userName',
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <strong>{text}</strong>
        </Space>
      )
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => {
        const color = action.includes('Delete') ? 'red' : 
                      action.includes('Create') ? 'green' : 'blue';
        return <Tag color={color}>{action}</Tag>;
      }
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (time: string) => {
        const date = new Date(time);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
      }
    }
  ];

  // Report usage columns
  const usageColumns = [
    {
      title: 'Report',
      dataIndex: 'reportName',
      key: 'reportName',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Executions',
      dataIndex: 'executionCount',
      key: 'executionCount',
      sorter: (a: ReportUsage, b: ReportUsage) => a.executionCount - b.executionCount,
      render: (count: number) => count.toLocaleString()
    },
    {
      title: 'Users',
      dataIndex: 'uniqueUsers',
      key: 'uniqueUsers',
      render: (users: number) => (
        <Space>
          <UserOutlined />
          {users}
        </Space>
      )
    },
    {
      title: 'Avg Time',
      dataIndex: 'avgExecutionTime',
      key: 'avgExecutionTime',
      render: (time: number) => {
        const seconds = Math.floor(time / 1000);
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
      }
    },
    {
      title: 'Trend',
      dataIndex: 'trend',
      key: 'trend',
      render: (trend: string, record: ReportUsage) => {
        const icon = trend === 'up' ? <ArrowUpOutlined /> : 
                     trend === 'down' ? <ArrowDownOutlined /> : null;
        const color = trend === 'up' ? 'green' : 
                      trend === 'down' ? 'red' : 'gray';
        return (
          <Space>
            <span style={{ color }}>{icon}</span>
            <span>{Math.abs(record.trendPercentage)}%</span>
          </Space>
        );
      }
    }
  ];

  // Prepare chart data
  const chartData = cpuMetrics.map((cpu, index) => ({
    time: cpu.label || '',
    CPU: Math.round(cpu.value),
    Memory: Math.round(memoryMetrics[index]?.value || 0),
    Requests: Math.round(requestMetrics[index]?.value || 0)
  }));

  // Storage pie chart data
  const storagePieData = storageUsage.map(storage => ({
    name: storage.type.charAt(0).toUpperCase() + storage.type.slice(1),
    value: storage.used
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  if (loading && !dashboard) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Header with refresh and time range */}
      <Row justify="space-between" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
              <Option value="1h">Last Hour</Option>
              <Option value="24h">Last 24 Hours</Option>
              <Option value="7d">Last 7 Days</Option>
              <Option value="30d">Last 30 Days</Option>
            </Select>
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      {/* System Overview Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="System Uptime"
              value={dashboard?.system.uptime || 0}
              formatter={(value) => formatUptime(value as number)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={dashboard?.system.activeUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Reports"
              value={dashboard?.system.totalReports || 0}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Storage Used"
              value={dashboard?.system.storageUsed || 0}
              suffix="GB"
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Alerts */}
      {dashboard?.alerts && dashboard.alerts.length > 0 && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {dashboard.alerts.filter(a => !a.resolved).map(alert => (
                <Alert
                  key={alert.id}
                  message={alert.title}
                  description={alert.message}
                  type={alert.type}
                  showIcon
                  closable
                />
              ))}
            </Space>
          </Col>
        </Row>
      )}

      {/* Performance Metrics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="System Performance">
            <Row gutter={16}>
              {performanceMetrics.map(metric => (
                <Col span={6} key={metric.metric}>
                  {renderPerformanceCard(metric)}
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={16}>
          <Card title="System Metrics Over Time">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Area type="monotone" dataKey="CPU" stackId="1" stroke="#8884d8" fill="#8884d8" />
                <Area type="monotone" dataKey="Memory" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                <Area type="monotone" dataKey="Requests" stackId="1" stroke="#ffc658" fill="#ffc658" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Storage Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={storagePieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {storagePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Tables */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Recent User Activity">
            <Table
              columns={activityColumns}
              dataSource={userActivity}
              rowKey="userId"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Report Usage Statistics">
            <Table
              columns={usageColumns}
              dataSource={reportUsage}
              rowKey="reportId"
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* Storage Details */}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="Storage Usage Details">
            <Row gutter={16}>
              {storageUsage.map(storage => (
                <Col span={6} key={storage.type}>
                  <Card size="small">
                    <h4>{storage.type.charAt(0).toUpperCase() + storage.type.slice(1)}</h4>
                    <Progress
                      percent={storage.percentage}
                      strokeColor={{
                        '0%': '#108ee9',
                        '100%': storage.percentage > 80 ? '#ff4d4f' : '#87d068'
                      }}
                    />
                    <div style={{ fontSize: 12, marginTop: 8 }}>
                      {storage.used} GB / {storage.total} GB
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SystemMetrics;