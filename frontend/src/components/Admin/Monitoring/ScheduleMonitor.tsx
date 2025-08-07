import React, { useState } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Space, 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Timeline, 
  Switch,
  Tooltip,
  message,
  Badge,
  Modal,
  Descriptions,
  Progress,
  Alert,
  Empty,
  Result
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  HistoryOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { Schedule, ScheduleExecution } from '../../../types/monitoring';
import { useScheduleData, useScheduleStats } from '../../../hooks/useMonitoringData';
import { STATUS_CONFIG, PAGINATION } from '../../../constants/monitoring';

const ScheduleMonitor: React.FC = () => {
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [executionModalVisible, setExecutionModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Use custom hooks for data fetching and stats
  const {
    schedules,
    executions,
    loading,
    error,
    refetch,
    toggleSchedule: handleToggleSchedule,
    cancelExecution: handleCancelExecution
  } = useScheduleData();

  const { stats, performance } = useScheduleStats(schedules, executions);

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    message.success('Data refreshed');
  };

  // Show execution history modal
  const showExecutionHistory = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setExecutionModalVisible(true);
  };

  // Status tag renderer using constants
  const renderStatus = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    const icon = {
      running: <ClockCircleOutlined />,
      success: <CheckCircleOutlined />,
      failed: <CloseCircleOutlined />,
      cancelled: <ExclamationCircleOutlined />
    };
    return (
      <Tag color={config?.color || 'default'} icon={icon[status as keyof typeof icon]}>
        {status.toUpperCase()}
      </Tag>
    );
  };

  // Schedule columns
  const scheduleColumns = [
    {
      title: 'Schedule Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Schedule) => (
        <Space>
          <Badge status={record.enabled ? 'success' : 'default'} />
          <strong>{text}</strong>
        </Space>
      )
    },
    {
      title: 'Report',
      dataIndex: 'reportName',
      key: 'reportName'
    },
    {
      title: 'Frequency',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (frequency: string) => (
        <Tag color="blue">{frequency.toUpperCase()}</Tag>
      )
    },
    {
      title: 'Next Run',
      dataIndex: 'nextRun',
      key: 'nextRun',
      render: (nextRun: string, record: Schedule) => {
        if (!record.enabled) return <span style={{ color: '#999' }}>Disabled</span>;
        if (!nextRun) return '-';
        const date = new Date(nextRun);
        const isNear = date.getTime() - Date.now() < 3600000; // Within 1 hour
        return (
          <Tooltip title={date.toLocaleString()}>
            <span style={{ color: isNear ? '#ff4d4f' : undefined }}>
              <ClockCircleOutlined /> {date.toLocaleTimeString()}
            </span>
          </Tooltip>
        );
      }
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRun',
      key: 'lastRun',
      render: (lastRun: string, record: Schedule) => {
        if (!lastRun) return '-';
        return (
          <Space>
            {record.lastStatus && renderStatus(record.lastStatus)}
            <span>{new Date(lastRun).toLocaleString()}</span>
          </Space>
        );
      }
    },
    {
      title: 'Destination',
      dataIndex: 'destination',
      key: 'destination',
      render: (dest: string, record: Schedule) => (
        <Space>
          <Tag>{dest.toUpperCase()}</Tag>
          {record.recipientCount && (
            <span style={{ color: '#999' }}>({record.recipientCount} recipients)</span>
          )}
        </Space>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      render: (_: any, record: Schedule) => (
        <Space>
          <Switch
            checked={record.enabled}
            onChange={() => handleToggleSchedule(record)}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => showExecutionHistory(record)}
          >
            History
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={!record.enabled}
          >
            Run Now
          </Button>
        </Space>
      )
    }
  ];

  // Execution columns for modal
  const executionColumns = [
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: renderStatus
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration: number) => {
        if (!duration) return '-';
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
      }
    },
    {
      title: 'Records',
      dataIndex: 'recordsProcessed',
      key: 'recordsProcessed',
      render: (records: number) => records ? records.toLocaleString() : '-'
    },
    {
      title: 'Output',
      dataIndex: 'outputFiles',
      key: 'outputFiles',
      render: (files: string[]) => {
        if (!files || files.length === 0) return '-';
        return (
          <Space direction="vertical" size="small">
            {files.map(file => (
              <Tag key={file} color="blue">{file}</Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ScheduleExecution) => {
        if (record.status === 'running') {
          return (
            <Button
              size="small"
              danger
              icon={<PauseCircleOutlined />}
              onClick={() => handleCancelExecution(record.id)}
            >
              Cancel
            </Button>
          );
        }
        return null;
      }
    }
  ];

  // Recent executions for timeline
  const recentExecutions = executions.slice(0, 5);

  // Handle error state
  if (error && !loading) {
    return (
      <Result
        status="error"
        title="Failed to load monitoring data"
        subTitle={error}
        extra={
          <Button type="primary" onClick={refetch}>
            Try Again
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Schedules"
              value={stats.total}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Schedules"
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Running Now"
              value={stats.running}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Failed (24h)"
              value={stats.failed}
              valueStyle={{ color: stats.failed > 0 ? '#cf1322' : undefined }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Row gutter={16}>
        <Col span={16}>
          <Card 
            title="Active Schedules"
            extra={
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
            }
          >
            <Table
              columns={scheduleColumns}
              dataSource={schedules}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1200 }}
              pagination={{ pageSize: PAGINATION.pageSize }}
              locale={{
                emptyText: (
                  <Empty
                    description="No schedules found"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )
              }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Recent Executions">
            <Timeline>
              {recentExecutions.map(exec => (
                <Timeline.Item
                  key={exec.id}
                  color={
                    exec.status === 'success' ? 'green' :
                    exec.status === 'failed' ? 'red' :
                    exec.status === 'running' ? 'blue' : 'gray'
                  }
                  dot={
                    exec.status === 'running' ? 
                    <ClockCircleOutlined style={{ fontSize: '16px' }} /> : undefined
                  }
                >
                  <p>
                    <strong>{exec.reportName}</strong>
                    <br />
                    <small>{new Date(exec.startTime).toLocaleString()}</small>
                  </p>
                  {renderStatus(exec.status)}
                  {exec.error && (
                    <Alert
                      message={exec.error}
                      type="error"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>

          {/* Performance Overview */}
          <Card title="Execution Performance" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <span>Success Rate (24h)</span>
                <Progress
                  percent={performance.successRate}
                  strokeColor="#52c41a"
                  format={percent => `${percent}%`}
                />
              </div>
              <div>
                <span>Average Duration</span>
                <Progress
                  percent={Math.min(100, Math.round((performance.avgDuration / 300000) * 100))}
                  strokeColor="#1890ff"
                  format={() => {
                    const seconds = Math.floor(performance.avgDuration / 1000);
                    const minutes = Math.floor(seconds / 60);
                    return `${minutes}m ${seconds % 60}s`;
                  }}
                />
              </div>
              <div>
                <span>Queue Utilization</span>
                <Progress
                  percent={performance.queueUtilization}
                  strokeColor="#faad14"
                  format={percent => `${percent}%`}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Execution History Modal */}
      <Modal
        title={`Execution History - ${selectedSchedule?.name}`}
        visible={executionModalVisible}
        onCancel={() => setExecutionModalVisible(false)}
        width={1000}
        footer={null}
      >
        {selectedSchedule && (
          <>
            <Descriptions bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Report">{selectedSchedule.reportName}</Descriptions.Item>
              <Descriptions.Item label="Frequency">{selectedSchedule.frequency.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="Created By">{selectedSchedule.createdBy}</Descriptions.Item>
              <Descriptions.Item label="Destination">{selectedSchedule.destination.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="Recipients">{selectedSchedule.recipientCount || 0}</Descriptions.Item>
              <Descriptions.Item label="Status">
                {selectedSchedule.enabled ? 
                  <Tag color="success">ENABLED</Tag> : 
                  <Tag color="default">DISABLED</Tag>
                }
              </Descriptions.Item>
            </Descriptions>
            
            <Table
              columns={executionColumns}
              dataSource={executions.filter(e => e.scheduleId === selectedSchedule.id)}
              rowKey="id"
              pagination={{ pageSize: PAGINATION.modalPageSize }}
              scroll={{ x: 800 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default ScheduleMonitor;