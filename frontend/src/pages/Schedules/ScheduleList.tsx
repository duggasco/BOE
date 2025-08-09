import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Card, 
  Tag, 
  Tooltip, 
  message, 
  Modal,
  Switch,
  Dropdown,
  Badge,
  Typography,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  PlusOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  ReloadOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  CloudUploadOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { scheduleService } from '../../services/api/scheduleService';
import type { Schedule, ScheduleStatus } from '../../types/schedule';

const { Title, Text } = Typography;
const { confirm } = Modal;

const ScheduleList: React.FC = () => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [stats, setStats] = useState({
    active: 0,
    paused: 0,
    total: 0,
    successRate: 0
  });

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await scheduleService.getSchedules({
        skip: (currentPage - 1) * pageSize,
        limit: pageSize
      });
      
      setSchedules(response.schedules);
      setTotal(response.total);
      
      // Calculate stats
      const active = response.schedules.filter(s => s.is_active).length;
      const paused = response.schedules.filter(s => !s.is_active).length;
      const totalRuns = response.schedules.reduce((sum, s) => sum + s.run_count, 0);
      const successRuns = response.schedules.reduce((sum, s) => sum + s.success_count, 0);
      
      setStats({
        active,
        paused,
        total: response.total,
        successRate: totalRuns > 0 ? (successRuns / totalRuns) * 100 : 0
      });
    } catch (error: any) {
      message.error(error.message || 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Handle schedule pause/resume
  const handleToggleStatus = async (schedule: Schedule) => {
    try {
      if (schedule.is_active) {
        await scheduleService.pauseSchedule(schedule.id);
        message.success(`Schedule "${schedule.name}" paused`);
      } else {
        await scheduleService.resumeSchedule(schedule.id);
        message.success(`Schedule "${schedule.name}" resumed`);
      }
      fetchSchedules();
    } catch (error: any) {
      message.error(error.message || 'Failed to update schedule status');
    }
  };

  // Handle schedule deletion
  const handleDelete = (schedule: Schedule) => {
    confirm({
      title: 'Delete Schedule',
      content: `Are you sure you want to delete the schedule "${schedule.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await scheduleService.deleteSchedule(schedule.id);
          message.success('Schedule deleted successfully');
          fetchSchedules();
        } catch (error: any) {
          message.error(error.message || 'Failed to delete schedule');
        }
      }
    });
  };

  // Handle test run
  const handleTestRun = async (schedule: Schedule) => {
    try {
      const result = await scheduleService.testSchedule(schedule.id);
      message.success(result.message || 'Test run initiated successfully');
    } catch (error: any) {
      message.error(error.message || 'Failed to initiate test run');
    }
  };

  // Get status tag color
  const getStatusTag = (schedule: Schedule) => {
    if (!schedule.is_active) {
      return <Tag color="default">Paused</Tag>;
    }
    
    const successRate = schedule.run_count > 0 
      ? (schedule.success_count / schedule.run_count) * 100 
      : 0;
    
    if (successRate >= 95) {
      return <Tag color="success">Active</Tag>;
    } else if (successRate >= 80) {
      return <Tag color="warning">Active (Issues)</Tag>;
    } else {
      return <Tag color="error">Active (Failing)</Tag>;
    }
  };

  // Get distribution icons
  const getDistributionIcons = (schedule: Schedule) => {
    const icons = [];
    if (schedule.distribution_config.email) {
      icons.push(
        <Tooltip key="email" title="Email Distribution">
          <MailOutlined style={{ fontSize: 16, marginRight: 8 }} />
        </Tooltip>
      );
    }
    if (schedule.distribution_config.local) {
      icons.push(
        <Tooltip key="local" title="Local Storage">
          <FolderOpenOutlined style={{ fontSize: 16, marginRight: 8 }} />
        </Tooltip>
      );
    }
    if (schedule.distribution_config.cloud) {
      icons.push(
        <Tooltip key="cloud" title="Cloud Storage">
          <CloudUploadOutlined style={{ fontSize: 16, marginRight: 8 }} />
        </Tooltip>
      );
    }
    return icons;
  };

  // Table columns
  const columns: ColumnsType<Schedule> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Schedule) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Report',
      dataIndex: 'report_name',
      key: 'report_name',
      ellipsis: true
    },
    {
      title: 'Frequency',
      dataIndex: ['schedule_config', 'frequency'],
      key: 'frequency',
      render: (frequency: string) => (
        <Tag>{frequency.charAt(0).toUpperCase() + frequency.slice(1)}</Tag>
      )
    },
    {
      title: 'Distribution',
      key: 'distribution',
      render: (_, record: Schedule) => (
        <Space>{getDistributionIcons(record)}</Space>
      )
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record: Schedule) => getStatusTag(record)
    },
    {
      title: 'Last Run',
      dataIndex: 'last_run',
      key: 'last_run',
      render: (date: string) => date ? format(new Date(date), 'MMM dd, yyyy HH:mm') : '-'
    },
    {
      title: 'Next Run',
      dataIndex: 'next_run',
      key: 'next_run',
      render: (date: string, record: Schedule) => {
        if (!record.is_active) return <Text type="secondary">-</Text>;
        if (!date) return <Text type="secondary">-</Text>;
        return (
          <Tooltip title={format(new Date(date), 'PPpp')}>
            <Space>
              <ClockCircleOutlined />
              <Text>{format(new Date(date), 'MMM dd, HH:mm')}</Text>
            </Space>
          </Tooltip>
        );
      }
    },
    {
      title: 'Success Rate',
      key: 'success_rate',
      render: (_, record: Schedule) => {
        if (record.run_count === 0) return '-';
        const rate = (record.success_count / record.run_count) * 100;
        return (
          <Tooltip title={`${record.success_count}/${record.run_count} successful`}>
            <Badge
              status={rate >= 95 ? 'success' : rate >= 80 ? 'warning' : 'error'}
              text={`${rate.toFixed(0)}%`}
            />
          </Tooltip>
        );
      }
    },
    {
      title: 'Active',
      key: 'is_active',
      render: (_, record: Schedule) => (
        <Switch
          checked={record.is_active}
          onChange={() => handleToggleStatus(record)}
          checkedChildren="On"
          unCheckedChildren="Off"
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Schedule) => {
        const menuItems = [
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Edit',
            onClick: () => navigate(`/schedules/${record.id}/edit`)
          },
          {
            key: 'history',
            icon: <HistoryOutlined />,
            label: 'View History',
            onClick: () => navigate(`/schedules/${record.id}/history`)
          },
          {
            key: 'test',
            icon: <PlayCircleOutlined />,
            label: 'Test Run',
            onClick: () => handleTestRun(record)
          },
          { type: 'divider' as const },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: 'Delete',
            danger: true,
            onClick: () => handleDelete(record)
          }
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Schedules"
              value={stats.total}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active"
              value={stats.active}
              valueStyle={{ color: '#3f8600' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Paused"
              value={stats.paused}
              valueStyle={{ color: '#999' }}
              prefix={<PauseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Success Rate"
              value={stats.successRate}
              precision={1}
              valueStyle={{ color: stats.successRate >= 95 ? '#3f8600' : '#cf1322' }}
              prefix={stats.successRate >= 95 ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>Report Schedules</Title>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={fetchSchedules}
              loading={loading}
            >
              Refresh
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/schedules/new')}
            >
              Create Schedule
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size || 10);
            },
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} schedules`
          }}
        />
      </Card>
    </div>
  );
};

export default ScheduleList;