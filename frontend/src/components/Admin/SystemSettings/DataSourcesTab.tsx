import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataSource } from '../../../types/settings';
import { settingsApi } from '../../../services/settingsApi';
import DataSourceModal from './DataSourceModal';

const DataSourcesTab: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    setLoading(true);
    try {
      const sources = await settingsApi.getDataSources();
      setDataSources(sources);
    } catch (error) {
      message.error('Failed to load data sources');
      console.error('Error loading data sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (dataSource: DataSource) => {
    setTestingConnection(dataSource.id);
    try {
      const result = await settingsApi.testDataSourceConnection(dataSource.id);
      message[result.success ? 'success' : 'error'](result.message);
      // Reload to get updated test status
      await loadDataSources();
    } catch (error) {
      message.error('Failed to test connection');
      console.error('Error testing connection:', error);
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSave = async (values: Omit<DataSource, 'id' | 'testStatus' | 'lastTested'>) => {
    try {
      if (selectedDataSource) {
        await settingsApi.updateDataSource(selectedDataSource.id, values);
        message.success('Data source updated successfully');
      } else {
        await settingsApi.createDataSource(values);
        message.success('Data source created successfully');
      }
      setModalVisible(false);
      setSelectedDataSource(null);
      await loadDataSources();
    } catch (error) {
      message.error('Failed to save data source');
      console.error('Error saving data source:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await settingsApi.deleteDataSource(id);
      message.success('Data source deleted successfully');
      await loadDataSources();
    } catch (error) {
      message.error('Failed to delete data source');
      console.error('Error deleting data source:', error);
    }
  };

  const columns: ColumnsType<DataSource> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <DatabaseOutlined />
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Host',
      dataIndex: 'host',
      key: 'host',
    },
    {
      title: 'Database',
      dataIndex: 'database',
      key: 'database',
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: DataSource) => (
        <Space>
          {record.isActive ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>Active</Tag>
          ) : (
            <Tag color="default" icon={<CloseCircleOutlined />}>Inactive</Tag>
          )}
          {record.testStatus && (
            <Tooltip title={`Last tested: ${record.lastTested ? new Date(record.lastTested).toLocaleString() : 'Never'}`}>
              {record.testStatus === 'success' ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              )}
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: DataSource) => (
        <Space>
          <Button
            size="small"
            icon={<ApiOutlined />}
            loading={testingConnection === record.id}
            onClick={() => handleTestConnection(record)}
          >
            Test
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedDataSource(record);
              setModalVisible(true);
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete this data source?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card loading={loading}>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setSelectedDataSource(null);
          setModalVisible(true);
        }}
        style={{ marginBottom: 16 }}
      >
        Add Data Source
      </Button>

      <Table
        dataSource={dataSources}
        columns={columns}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
        }}
      />

      <DataSourceModal
        visible={modalVisible}
        dataSource={selectedDataSource}
        onSave={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setSelectedDataSource(null);
        }}
      />
    </Card>
  );
};

export default DataSourcesTab;