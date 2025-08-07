import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Button,
  Row,
  Col,
  Space,
  Divider,
  Collapse,
  Checkbox,
  message,
  Spin,
  Alert,
  Popconfirm,
} from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  MailOutlined,
  CloudOutlined,
  LockOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { GlobalSettings } from '../../../types/settings';
import { settingsApi } from '../../../services/settingsApi';
import {
  TIMEZONES,
  DATE_FORMATS,
  LANGUAGES,
  STORAGE_TYPES,
} from '../../../constants/settings';

const { Panel } = Collapse;
const { Option } = Select;
const { TextArea } = Input;

const GlobalSettingsTab: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [storageType, setStorageType] = useState<string>('local');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settings = await settingsApi.getGlobalSettings();
      form.setFieldsValue(settings);
      setStorageType(settings.storage.type);
      setHasChanges(false);
    } catch (error) {
      message.error('Failed to load global settings');
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await settingsApi.updateGlobalSettings(values);
      message.success('Global settings saved successfully');
      setHasChanges(false);
    } catch (error) {
      if (error instanceof Error) {
        message.error(`Failed to save settings: ${error.message}`);
      } else {
        message.error('Failed to save settings');
      }
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadSettings();
    message.info('Settings reset to last saved values');
  };

  const handleValuesChange = () => {
    setHasChanges(true);
  };

  const handleStorageTypeChange = (value: string) => {
    setStorageType(value);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="Loading settings..." />
      </div>
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
      autoComplete="off"
    >
      <Collapse
        defaultActiveKey={['system', 'email', 'storage', 'security']}
        expandIconPosition="end"
      >
        {/* System Settings */}
        <Panel
          header={
            <Space>
              <SettingOutlined />
              <span>System Settings</span>
            </Space>
          }
          key="system"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['system', 'companyName']}
                label="Company Name"
                rules={[
                  { required: true, message: 'Company name is required' },
                  { max: 100, message: 'Maximum 100 characters' },
                ]}
              >
                <Input placeholder="Enter company name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['system', 'systemName']}
                label="System Name"
                rules={[
                  { required: true, message: 'System name is required' },
                  { max: 100, message: 'Maximum 100 characters' },
                ]}
              >
                <Input placeholder="Enter system name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['system', 'timeZone']}
                label="Time Zone"
                rules={[{ required: true, message: 'Time zone is required' }]}
              >
                <Select
                  showSearch
                  placeholder="Select time zone"
                  optionFilterProp="children"
                >
                  {TIMEZONES.map(tz => (
                    <Option key={tz.value} value={tz.value}>
                      {tz.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['system', 'dateFormat']}
                label="Date Format"
                rules={[{ required: true, message: 'Date format is required' }]}
              >
                <Select placeholder="Select date format">
                  {DATE_FORMATS.map(format => (
                    <Option key={format.value} value={format.value}>
                      {format.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['system', 'language']}
                label="Language"
                rules={[{ required: true, message: 'Language is required' }]}
              >
                <Select
                  showSearch
                  placeholder="Select language"
                  optionFilterProp="children"
                >
                  {LANGUAGES.map(lang => (
                    <Option key={lang.value} value={lang.value}>
                      {lang.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['system', 'maxUploadSize']}
                label="Max Upload Size (MB)"
                rules={[
                  { required: true, message: 'Max upload size is required' },
                  {
                    type: 'number',
                    min: 1,
                    max: 1000,
                    message: 'Must be between 1 and 1000 MB',
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  max={1000}
                  style={{ width: '100%' }}
                  placeholder="100"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['system', 'sessionTimeout']}
                label="Session Timeout (minutes)"
                rules={[
                  { required: true, message: 'Session timeout is required' },
                  {
                    type: 'number',
                    min: 5,
                    max: 1440,
                    message: 'Must be between 5 and 1440 minutes',
                  },
                ]}
              >
                <InputNumber
                  min={5}
                  max={1440}
                  style={{ width: '100%' }}
                  placeholder="30"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['system', 'maintenanceMode']}
                label="Maintenance Mode"
                valuePropName="checked"
              >
                <Switch checkedChildren="ON" unCheckedChildren="OFF" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name={['system', 'maintenanceMessage']}
                label="Maintenance Message"
                dependencies={[['system', 'maintenanceMode']]}
                rules={[
                  ({ getFieldValue }) => ({
                    required: getFieldValue(['system', 'maintenanceMode']),
                    message: 'Maintenance message is required when maintenance mode is on',
                  }),
                ]}
              >
                <TextArea
                  rows={3}
                  placeholder="Enter message to display during maintenance"
                  maxLength={500}
                  showCount
                />
              </Form.Item>
            </Col>
          </Row>
        </Panel>

        {/* Email Settings */}
        <Panel
          header={
            <Space>
              <MailOutlined />
              <span>Email Settings</span>
            </Space>
          }
          key="email"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['email', 'smtpHost']}
                label="SMTP Host"
                rules={[
                  { required: true, message: 'SMTP host is required' },
                  { max: 255, message: 'Maximum 255 characters' },
                ]}
              >
                <Input placeholder="e.g., smtp.gmail.com" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name={['email', 'smtpPort']}
                label="SMTP Port"
                rules={[
                  { required: true, message: 'SMTP port is required' },
                  {
                    type: 'number',
                    min: 1,
                    max: 65535,
                    message: 'Must be between 1 and 65535',
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="587"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name={['email', 'smtpSecure']}
                label="Use TLS/SSL"
                valuePropName="checked"
              >
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['email', 'smtpUser']}
                label="SMTP Username"
                rules={[
                  { required: true, message: 'SMTP username is required' },
                  { max: 100, message: 'Maximum 100 characters' },
                ]}
              >
                <Input placeholder="e.g., notifications@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['email', 'smtpPassword']}
                label="SMTP Password"
                extra="Leave blank to keep existing password"
              >
                <Input.Password
                  placeholder="Enter password or leave blank"
                  autoComplete="new-password"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['email', 'fromAddress']}
                label="From Address"
                rules={[
                  { required: true, message: 'From address is required' },
                  { type: 'email', message: 'Invalid email address' },
                ]}
              >
                <Input placeholder="e.g., no-reply@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['email', 'fromName']}
                label="From Name"
                rules={[
                  { required: true, message: 'From name is required' },
                  { max: 100, message: 'Maximum 100 characters' },
                ]}
              >
                <Input placeholder="e.g., BOE System" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['email', 'replyTo']}
                label="Reply To Address"
                rules={[
                  { type: 'email', message: 'Invalid email address' },
                ]}
              >
                <Input placeholder="e.g., support@example.com" />
              </Form.Item>
            </Col>
          </Row>
        </Panel>

        {/* Storage Settings */}
        <Panel
          header={
            <Space>
              <CloudOutlined />
              <span>Storage Settings</span>
            </Space>
          }
          key="storage"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['storage', 'type']}
                label="Storage Type"
                rules={[{ required: true, message: 'Storage type is required' }]}
              >
                <Select
                  placeholder="Select storage type"
                  onChange={handleStorageTypeChange}
                >
                  {STORAGE_TYPES.map(type => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['storage', 'maxFileSize']}
                label="Max File Size (MB)"
                rules={[
                  { required: true, message: 'Max file size is required' },
                  {
                    type: 'number',
                    min: 1,
                    max: 5000,
                    message: 'Must be between 1 and 5000 MB',
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  max={5000}
                  style={{ width: '100%' }}
                  placeholder="500"
                />
              </Form.Item>
            </Col>

            {storageType === 'local' && (
              <Col span={24}>
                <Form.Item
                  name={['storage', 'path']}
                  label="Storage Path"
                  rules={[
                    { required: true, message: 'Storage path is required' },
                    {
                      pattern: /^[^<>:"\|?*]+$/,
                      message: 'Invalid path characters',
                    },
                  ]}
                >
                  <Input placeholder="e.g., /var/boe/storage" />
                </Form.Item>
              </Col>
            )}

            {(storageType === 's3' || storageType === 'azure' || storageType === 'gcs') && (
              <>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'bucket']}
                    label={storageType === 'azure' ? 'Container Name' : 'Bucket Name'}
                    rules={[
                      { required: true, message: 'Bucket/Container name is required' },
                      {
                        pattern: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
                        message: 'Invalid bucket/container name',
                      },
                    ]}
                  >
                    <Input placeholder="e.g., boe-reports" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['storage', 'region']}
                    label="Region"
                    rules={[
                      { required: true, message: 'Region is required' },
                    ]}
                  >
                    <Input placeholder="e.g., us-east-1" />
                  </Form.Item>
                </Col>
              </>
            )}

            <Col span={24}>
              <Form.Item
                name={['storage', 'allowedExtensions']}
                label="Allowed File Extensions"
                rules={[
                  { required: true, message: 'At least one extension is required' },
                ]}
              >
                <Select
                  mode="multiple"
                  placeholder="Select allowed file extensions"
                  style={{ width: '100%' }}
                >
                  {['pdf', 'csv', 'xlsx', 'xls', 'docx', 'doc', 'txt', 'json', 'xml', 'png', 'jpg', 'jpeg'].map(ext => (
                    <Option key={ext} value={ext}>
                      .{ext}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Panel>

        {/* Security Settings */}
        <Panel
          header={
            <Space>
              <LockOutlined />
              <span>Security Settings</span>
            </Space>
          }
          key="security"
        >
          <Alert
            message="Password Policy"
            description="These settings apply to all user passwords in the system"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name={['security', 'passwordMinLength']}
                label="Minimum Password Length"
                rules={[
                  { required: true, message: 'Min length is required' },
                  {
                    type: 'number',
                    min: 6,
                    max: 32,
                    message: 'Must be between 6 and 32',
                  },
                ]}
              >
                <InputNumber
                  min={6}
                  max={32}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['security', 'passwordExpireDays']}
                label="Password Expiry (days)"
                rules={[
                  { required: true, message: 'Expiry days is required' },
                  {
                    type: 'number',
                    min: 0,
                    max: 365,
                    message: 'Must be between 0 and 365',
                  },
                ]}
                extra="Set to 0 to disable expiry"
              >
                <InputNumber
                  min={0}
                  max={365}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['security', 'maxLoginAttempts']}
                label="Max Login Attempts"
                rules={[
                  { required: true, message: 'Max attempts is required' },
                  {
                    type: 'number',
                    min: 3,
                    max: 10,
                    message: 'Must be between 3 and 10',
                  },
                ]}
              >
                <InputNumber
                  min={3}
                  max={10}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['security', 'lockoutDuration']}
                label="Lockout Duration (minutes)"
                rules={[
                  { required: true, message: 'Lockout duration is required' },
                  {
                    type: 'number',
                    min: 5,
                    max: 1440,
                    message: 'Must be between 5 and 1440 minutes',
                  },
                ]}
              >
                <InputNumber
                  min={5}
                  max={1440}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item
                  name={['security', 'passwordRequireUppercase']}
                  valuePropName="checked"
                >
                  <Checkbox>Require uppercase letters (A-Z)</Checkbox>
                </Form.Item>
                <Form.Item
                  name={['security', 'passwordRequireLowercase']}
                  valuePropName="checked"
                >
                  <Checkbox>Require lowercase letters (a-z)</Checkbox>
                </Form.Item>
                <Form.Item
                  name={['security', 'passwordRequireNumbers']}
                  valuePropName="checked"
                >
                  <Checkbox>Require numbers (0-9)</Checkbox>
                </Form.Item>
                <Form.Item
                  name={['security', 'passwordRequireSpecial']}
                  valuePropName="checked"
                >
                  <Checkbox>Require special characters (!@#$%^&*)</Checkbox>
                </Form.Item>
                <Form.Item
                  name={['security', 'mfaRequired']}
                  valuePropName="checked"
                >
                  <Checkbox>Require MFA for all users</Checkbox>
                </Form.Item>
              </Space>
            </Col>
          </Row>
        </Panel>
      </Collapse>

      <Divider />

      <Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          Save Settings
        </Button>
        <Popconfirm
          title="Reset Settings"
          description="Are you sure you want to reset to the last saved values?"
          onConfirm={handleReset}
          okText="Yes"
          cancelText="No"
        >
          <Button
            icon={<ReloadOutlined />}
            disabled={!hasChanges}
          >
            Reset
          </Button>
        </Popconfirm>
      </Space>

      {hasChanges && (
        <Alert
          message="You have unsaved changes"
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Form>
  );
};

export default GlobalSettingsTab;