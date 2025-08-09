import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Tooltip,
  message,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
  Badge,
  Timeline,
  Drawer,
  Descriptions,
  Alert,
  Empty,
  Spin
} from 'antd';
import {
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  FilterOutlined,
  ReloadOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  CalendarOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { format, formatDistanceToNow, startOfDay, endOfDay } from 'date-fns';
import { useParams, useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import { scheduleService } from '../../services/api/scheduleService';
import type { Schedule, ScheduleExecution, ExecutionStatus } from '../../types/schedule';
import { getStatusColor, getStatusIcon, calculateSuccessRate, formatDuration } from '../../utils/scheduleUtils';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface ExecutionDetails extends ScheduleExecution {
  schedule_name?: string;
}

const ScheduleHistory: React.FC = () => {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [executions, setExecutions] = useState<ExecutionDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionDetails | null>(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  
  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    avgDuration: 0,
    successRate: 0
  });

  // Fetch execution history
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      let scheduleName = 'All Schedules';
      
      if (scheduleId) {
        // Fetch specific schedule history
        const scheduleData = await scheduleService.getSchedule(scheduleId);
        setSchedule(scheduleData);
        scheduleName = scheduleData.name;
        
        response = await scheduleService.getScheduleHistory(scheduleId, {
          skip: (currentPage - 1) * pageSize,
          limit: pageSize
        });
      } else {
        // Fetch all executions
        response = await scheduleService.getAllExecutions({
          skip: (currentPage - 1) * pageSize,
          limit: pageSize,
          status: statusFilter !== 'all' ? statusFilter : undefined
        });
      }
      
      // Apply client-side date filtering if needed
      let filteredExecutions = response.executions;
      if (dateRange[0] && dateRange[1]) {
        const startDate = startOfDay(dateRange[0]);
        const endDate = endOfDay(dateRange[1]);
        filteredExecutions = filteredExecutions.filter(e => {
          const execDate = new Date(e.started_at);
          return execDate >= startDate && execDate <= endDate;
        });
      }
      
      // Enhance executions with schedule name
      const enhancedExecutions = filteredExecutions.map(e => ({
        ...e,
        schedule_name: scheduleName
      }));
      
      setExecutions(enhancedExecutions);
      setTotal(response.total);
      
      // Calculate statistics
      const successful = filteredExecutions.filter(e => e.status === 'success').length;
      const failed = filteredExecutions.filter(e => e.status === 'failed').length;
      const durations = filteredExecutions
        .filter(e => e.completed_at && e.started_at)
        .map(e => {
          const start = new Date(e.started_at).getTime();
          const end = new Date(e.completed_at!).getTime();
          return (end - start) / 1000; // Convert to seconds
        });
      
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
      
      const successRate = (successful + failed) > 0
        ? (successful / (successful + failed)) * 100
        : 0;
      
      setStats({
        total: filteredExecutions.length,
        successful,
        failed,
        avgDuration,
        successRate
      });
      
    } catch (error: any) {
      console.error('Failed to fetch history:', error);
      message.error('Failed to load execution history');
    } finally {
      setLoading(false);
    }
  }, [scheduleId, currentPage, pageSize, statusFilter, dateRange]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);


  // View execution details
  const viewDetails = (execution: ExecutionDetails) => {
    setSelectedExecution(execution);
    setDetailsDrawerOpen(true);
  };

  // Download export file
  const downloadExport = async (execution: ExecutionDetails) => {
    if (!execution.export_id) {
      message.warning('No export file available');
      return;
    }
    
    try {
      // This would typically trigger a download
      message.info('Download functionality to be implemented with backend integration');
      // window.open(`/api/v1/exports/${execution.export_id}/download`, '_blank');
    } catch (error) {
      message.error('Failed to download export');
    }
  };

  // Table columns
  const columns: ColumnsType<ExecutionDetails> = [
    {
      title: 'Execution ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      ellipsis: true,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text copyable={{ text: id }} style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {id.substring(0, 8)}...
          </Text>
        </Tooltip>
      )
    },
    {
      title: 'Schedule',
      dataIndex: 'schedule_name',
      key: 'schedule_name',
      ellipsis: true,
      render: (name: string, record) => (
        <Button 
          type="link" 
          onClick={() => navigate(`/schedules/${record.schedule_id}`)}
          style={{ padding: 0 }}
        >
          {name || 'Unknown'}
        </Button>
      )
    },
    {
      title: 'Started',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 180,
      sorter: (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
      render: (date: string) => (
        <Space direction="vertical" size={0}>
          <Text>{format(new Date(date), 'MMM dd, yyyy')}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {format(new Date(date), 'HH:mm:ss')}
          </Text>
        </Space>
      )
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 100,
      render: (_, record) => {
        if (!record.completed_at) {
          if (record.status === 'running') {
            return <Tag color="processing">Running...</Tag>;
          }
          return '-';
        }
        const duration = (new Date(record.completed_at).getTime() - 
                         new Date(record.started_at).getTime()) / 1000;
        
        if (duration < 60) {
          return `${duration.toFixed(1)}s`;
        } else if (duration < 3600) {
          return `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`;
        } else {
          return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
        }
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Success', value: 'success' },
        { text: 'Failed', value: 'failed' },
        { text: 'Running', value: 'running' },
        { text: 'Pending', value: 'pending' },
        { text: 'Skipped', value: 'skipped' }
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: ExecutionStatus) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Export',
      key: 'export',
      width: 100,
      render: (_, record) => {
        if (!record.export_id) return '-';
        
        return (
          <Space>
            {record.export_size && (
              <Tooltip title={`Size: ${(record.export_size / 1024).toFixed(2)} KB`}>
                <FileTextOutlined />
              </Tooltip>
            )}
            <Tooltip title="Download export">
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => downloadExport(record)}
              />
            </Tooltip>
          </Space>
        );
      }
    },
    {
      title: 'Retries',
      dataIndex: 'retry_count',
      key: 'retry_count',
      width: 80,
      render: (count: number) => count > 0 ? (
        <Badge count={count} style={{ backgroundColor: '#faad14' }} />
      ) : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewDetails(record)}
        >
          Details
        </Button>
      )
    }
  ];

  // Render execution timeline
  const renderTimeline = () => {
    const timelineItems = executions.slice(0, 5).map(execution => ({
      color: execution.status === 'success' ? 'green' : 
             execution.status === 'failed' ? 'red' : 
             execution.status === 'running' ? 'blue' : 'gray',
      children: (
        <Space direction="vertical" size={0}>
          <Text strong>{execution.schedule_name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {format(new Date(execution.started_at), 'MMM dd, HH:mm')}
          </Text>
          <Tag color={getStatusColor(execution.status)}>
            {execution.status.toUpperCase()}
          </Tag>
        </Space>
      )
    }));

    return <Timeline items={timelineItems} />;
  };

  if (loading && executions.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip="Loading execution history..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Space align="center" style={{ marginBottom: 16 }}>
          <HistoryOutlined style={{ fontSize: 24 }} />
          <Title level={3} style={{ margin: 0 }}>
            {schedule ? `${schedule.name} - Execution History` : 'All Execution History'}
          </Title>
        </Space>
        
        {schedule && (
          <Paragraph type="secondary">
            {schedule.description || 'No description available'}
          </Paragraph>
        )}
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Executions"
              value={stats.total}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Success Rate"
              value={stats.successRate}
              precision={1}
              suffix="%"
              valueStyle={{ 
                color: stats.successRate >= 95 ? '#3f8600' : 
                       stats.successRate >= 80 ? '#faad14' : '#cf1322' 
              }}
              prefix={stats.successRate >= 95 ? <CheckCircleOutlined /> : <WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Failed"
              value={stats.failed}
              valueStyle={{ color: stats.failed > 0 ? '#cf1322' : undefined }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Duration"
              value={stats.avgDuration}
              precision={1}
              suffix="s"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filter by status"
          >
            <Option value="all">All Status</Option>
            <Option value="success">Success</Option>
            <Option value="failed">Failed</Option>
            <Option value="running">Running</Option>
            <Option value="pending">Pending</Option>
            <Option value="skipped">Skipped</Option>
          </Select>
          
          <RangePicker
            onChange={(dates) => {
              if (dates) {
                setDateRange([dates[0]?.toDate() || null, dates[1]?.toDate() || null]);
              } else {
                setDateRange([null, null]);
              }
            }}
            format="YYYY-MM-DD"
          />
          
          <Button
            icon={<FilterOutlined />}
            onClick={() => {
              setStatusFilter('all');
              setDateRange([null, null]);
              setCurrentPage(1);
            }}
          >
            Clear Filters
          </Button>
          
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchHistory}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Main Content */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={18}>
          <Card>
            {executions.length > 0 ? (
              <Table
                columns={columns}
                dataSource={executions}
                rowKey="id"
                loading={loading}
                pagination={{
                  current: currentPage,
                  pageSize: pageSize,
                  total: total,
                  onChange: (page, size) => {
                    setCurrentPage(page);
                    setPageSize(size || 20);
                  },
                  showSizeChanger: true,
                  showTotal: (total) => `Total ${total} executions`
                }}
                scroll={{ x: 1000 }}
              />
            ) : (
              <Empty description="No execution history available" />
            )}
          </Card>
        </Col>
        
        <Col xs={24} lg={6}>
          <Card title="Recent Activity" extra={<BarChartOutlined />}>
            {executions.length > 0 ? renderTimeline() : (
              <Empty 
                description="No recent activity" 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Execution Details Drawer */}
      <Drawer
        title="Execution Details"
        placement="right"
        width={600}
        onClose={() => setDetailsDrawerOpen(false)}
        open={detailsDrawerOpen}
      >
        {selectedExecution && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="Execution Status"
              description={
                <Tag 
                  color={getStatusColor(selectedExecution.status)} 
                  icon={getStatusIcon(selectedExecution.status)}
                  style={{ marginTop: 8 }}
                >
                  {selectedExecution.status.toUpperCase()}
                </Tag>
              }
              type={selectedExecution.status === 'success' ? 'success' : 
                    selectedExecution.status === 'failed' ? 'error' : 'info'}
              showIcon
            />
            
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Execution ID">
                <Text copyable style={{ fontFamily: 'monospace' }}>
                  {selectedExecution.id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Schedule ID">
                <Text copyable style={{ fontFamily: 'monospace' }}>
                  {selectedExecution.schedule_id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Started At">
                {format(new Date(selectedExecution.started_at), 'PPpp')}
              </Descriptions.Item>
              <Descriptions.Item label="Completed At">
                {selectedExecution.completed_at 
                  ? format(new Date(selectedExecution.completed_at), 'PPpp')
                  : 'Not completed'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {selectedExecution.completed_at ? (
                  (() => {
                    const duration = (new Date(selectedExecution.completed_at).getTime() - 
                                     new Date(selectedExecution.started_at).getTime()) / 1000;
                    return `${duration.toFixed(2)} seconds`;
                  })()
                ) : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Retry Count">
                {selectedExecution.retry_count}
              </Descriptions.Item>
              {selectedExecution.export_id && (
                <>
                  <Descriptions.Item label="Export ID">
                    <Text copyable style={{ fontFamily: 'monospace' }}>
                      {selectedExecution.export_id}
                    </Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Export Path">
                    {selectedExecution.export_path || 'N/A'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Export Size">
                    {selectedExecution.export_size 
                      ? `${(selectedExecution.export_size / 1024).toFixed(2)} KB`
                      : 'N/A'}
                  </Descriptions.Item>
                </>
              )}
              {selectedExecution.error_message && (
                <Descriptions.Item label="Error Message">
                  <Alert
                    message={selectedExecution.error_message}
                    type="error"
                    showIcon={false}
                  />
                </Descriptions.Item>
              )}
              {selectedExecution.delivery_info && (
                <Descriptions.Item label="Delivery Info">
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: 8, 
                    borderRadius: 4,
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(selectedExecution.delivery_info, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
            </Descriptions>
            
            <Space>
              {selectedExecution.export_id && (
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => downloadExport(selectedExecution)}
                >
                  Download Export
                </Button>
              )}
              <Button onClick={() => setDetailsDrawerOpen(false)}>
                Close
              </Button>
            </Space>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default ScheduleHistory;