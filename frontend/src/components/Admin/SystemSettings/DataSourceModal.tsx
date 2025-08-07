import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Checkbox,
  Row,
  Col,
  Divider,
  Alert,
} from 'antd';
import type { DataSource } from '../../../types/settings';
import { DATABASE_TYPES } from '../../../constants/settings';

const { Option } = Select;

interface DataSourceModalProps {
  visible: boolean;
  dataSource: DataSource | null;
  onSave: (values: Omit<DataSource, 'id' | 'testStatus' | 'lastTested'>) => void;
  onCancel: () => void;
}

const DataSourceModal: React.FC<DataSourceModalProps> = ({
  visible,
  dataSource,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (dataSource) {
        // Don't populate password field for security
        const { ...values } = dataSource;
        form.setFieldsValue(values);
      } else {
        form.resetFields();
        // Set default values for new data source
        form.setFieldsValue({
          type: 'postgresql',
          port: 5432,
          ssl: true,
          isActive: true,
          connectionPool: {
            min: 5,
            max: 20,
            idleTimeout: 30000,
          },
        });
      }
    }
  }, [visible, dataSource, form]);

  const handleOk = () => {
    form.validateFields()
      .then(values => {
        onSave(values);
        form.resetFields();
      })
      .catch(error => {
        console.error('Validation failed:', error);
      });
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const handleTypeChange = (type: string) => {
    // Update default port based on database type
    const defaultPorts: Record<string, number> = {
      postgresql: 5432,
      mysql: 3306,
      oracle: 1521,
      sqlserver: 1433,
      snowflake: 443,
    };
    form.setFieldValue('port', defaultPorts[type] || 5432);
  };

  return (
    <Modal
      title={dataSource ? 'Edit Data Source' : 'Add Data Source'}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={700}
      okText="Save"
    >
      <Form form={form} layout="vertical">
        <Alert
          message="Security Note"
          description="Passwords are never displayed for existing connections. Leave the password field empty to keep the existing password unchanged."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          name="name"
          label="Connection Name"
          rules={[
            { required: true, message: 'Please enter a connection name' },
            { max: 100, message: 'Name must be less than 100 characters' },
          ]}
        >
          <Input placeholder="e.g., Production Database" />
        </Form.Item>

        <Form.Item
          name="type"
          label="Database Type"
          rules={[{ required: true, message: 'Please select a database type' }]}
        >
          <Select onChange={handleTypeChange} placeholder="Select database type">
            {DATABASE_TYPES.map(type => (
              <Option key={type.value} value={type.value}>
                {type.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Row gutter={16}>
          <Col span={16}>
            <Form.Item
              name="host"
              label="Host"
              rules={[
                { required: true, message: 'Please enter the host' },
                {
                  pattern: /^[a-zA-Z0-9.-]+$/,
                  message: 'Invalid host format',
                },
              ]}
            >
              <Input placeholder="e.g., db.example.com or 192.168.1.1" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="port"
              label="Port"
              rules={[
                { required: true, message: 'Please enter the port' },
                {
                  type: 'number',
                  min: 1,
                  max: 65535,
                  message: 'Port must be between 1 and 65535',
                },
              ]}
            >
              <InputNumber style={{ width: '100%' }} placeholder="5432" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="database"
          label="Database Name"
          rules={[
            { required: true, message: 'Please enter the database name' },
            { max: 100, message: 'Database name must be less than 100 characters' },
          ]}
        >
          <Input placeholder="e.g., my_database" />
        </Form.Item>

        <Form.Item
          name="username"
          label="Username"
          rules={[
            { required: true, message: 'Please enter the username' },
            { max: 100, message: 'Username must be less than 100 characters' },
          ]}
        >
          <Input placeholder="e.g., db_user" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[
            { required: !dataSource, message: 'Please enter the password' },
            { min: 8, message: 'Password must be at least 8 characters' },
          ]}
          extra={dataSource ? 'Leave blank to keep existing password' : undefined}
        >
          <Input.Password
            placeholder={dataSource ? 'Leave blank to keep existing' : 'Enter password'}
            autoComplete="new-password"
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="ssl" valuePropName="checked">
              <Checkbox>Use SSL/TLS Connection</Checkbox>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="isActive" valuePropName="checked">
              <Checkbox>Active</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Divider>Connection Pool Settings</Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name={['connectionPool', 'min']}
              label="Min Connections"
              rules={[
                { required: true, message: 'Required' },
                {
                  type: 'number',
                  min: 1,
                  max: 100,
                  message: 'Must be between 1 and 100',
                },
              ]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name={['connectionPool', 'max']}
              label="Max Connections"
              rules={[
                { required: true, message: 'Required' },
                {
                  type: 'number',
                  min: 1,
                  max: 100,
                  message: 'Must be between 1 and 100',
                },
              ]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name={['connectionPool', 'idleTimeout']}
              label="Idle Timeout (ms)"
              rules={[
                { required: true, message: 'Required' },
                {
                  type: 'number',
                  min: 1000,
                  max: 3600000,
                  message: 'Must be between 1s and 1h',
                },
              ]}
            >
              <InputNumber
                min={1000}
                max={3600000}
                step={1000}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
};

export default DataSourceModal;