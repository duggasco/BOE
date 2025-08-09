import React, { useState } from 'react';
import {
  Tabs,
  Form,
  Input,
  Select,
  Checkbox,
  Space,
  Typography,
  Alert,
  Card,
  Radio,
  InputNumber,
  Divider
} from 'antd';
import {
  MailOutlined,
  FolderOutlined,
  CloudUploadOutlined,
  ApiOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import EmailConfigForm from './EmailConfigForm';
import type { DistributionConfig } from '../../../types/schedule';

const { TabPane } = Tabs;
const { Text } = Typography;
const { Option } = Select;

interface DistributionSelectorProps {
  form: any;
  initialValue?: Partial<DistributionConfig>;
}

const DistributionSelector: React.FC<DistributionSelectorProps> = ({ form, initialValue }) => {
  const [activeChannels, setActiveChannels] = useState<string[]>(() => {
    const channels = [];
    if (initialValue?.email) channels.push('email');
    if (initialValue?.local) channels.push('local');
    if (initialValue?.cloud) channels.push('cloud');
    if (initialValue?.sftp) channels.push('sftp');
    if (initialValue?.webhook) channels.push('webhook');
    return channels.length > 0 ? channels : ['local']; // Default to local
  });

  const handleChannelToggle = (channel: string, checked: boolean) => {
    if (checked) {
      setActiveChannels([...activeChannels, channel]);
    } else {
      setActiveChannels(activeChannels.filter(c => c !== channel));
      // Clear the form values for this channel
      form.setFieldsValue({
        distribution_config: {
          ...form.getFieldValue('distribution_config'),
          [channel]: undefined
        }
      });
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        message="Distribution Channels"
        description="Select one or more channels to distribute your reports"
        type="info"
        showIcon
      />

      {/* Channel Selection */}
      <Card title="Select Distribution Channels" size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Checkbox
            checked={activeChannels.includes('local')}
            onChange={(e) => handleChannelToggle('local', e.target.checked)}
          >
            <Space>
              <FolderOutlined />
              <Text>Local Storage - Save to server filesystem</Text>
            </Space>
          </Checkbox>

          <Checkbox
            checked={activeChannels.includes('email')}
            onChange={(e) => handleChannelToggle('email', e.target.checked)}
          >
            <Space>
              <MailOutlined />
              <Text>Email - Send to recipients via SMTP</Text>
            </Space>
          </Checkbox>

          <Checkbox
            checked={activeChannels.includes('cloud')}
            onChange={(e) => handleChannelToggle('cloud', e.target.checked)}
            disabled
          >
            <Space>
              <CloudUploadOutlined />
              <Text>Cloud Storage - Upload to S3/Azure/GCS (Coming Soon)</Text>
            </Space>
          </Checkbox>

          <Checkbox
            checked={activeChannels.includes('sftp')}
            onChange={(e) => handleChannelToggle('sftp', e.target.checked)}
            disabled
          >
            <Space>
              <GlobalOutlined />
              <Text>SFTP/FTP - Transfer to remote server (Coming Soon)</Text>
            </Space>
          </Checkbox>

          <Checkbox
            checked={activeChannels.includes('webhook')}
            onChange={(e) => handleChannelToggle('webhook', e.target.checked)}
            disabled
          >
            <Space>
              <ApiOutlined />
              <Text>Webhook - POST to custom endpoint (Coming Soon)</Text>
            </Space>
          </Checkbox>
        </Space>
      </Card>

      {/* Channel Configuration */}
      {activeChannels.length > 0 && (
        <Tabs defaultActiveKey={activeChannels[0]}>
          {activeChannels.includes('local') && (
            <TabPane tab={<><FolderOutlined /> Local Storage</>} key="local">
              <LocalStorageConfig form={form} initialValue={initialValue?.local} />
            </TabPane>
          )}

          {activeChannels.includes('email') && (
            <TabPane tab={<><MailOutlined /> Email</>} key="email">
              <EmailConfigForm form={form} initialValue={initialValue?.email} />
            </TabPane>
          )}

          {activeChannels.includes('cloud') && (
            <TabPane tab={<><CloudUploadOutlined /> Cloud Storage</>} key="cloud">
              <CloudStorageConfig form={form} initialValue={initialValue?.cloud} />
            </TabPane>
          )}

          {activeChannels.includes('sftp') && (
            <TabPane tab={<><GlobalOutlined /> SFTP/FTP</>} key="sftp">
              <SftpConfig form={form} initialValue={initialValue?.sftp} />
            </TabPane>
          )}

          {activeChannels.includes('webhook') && (
            <TabPane tab={<><ApiOutlined /> Webhook</>} key="webhook">
              <WebhookConfig form={form} initialValue={initialValue?.webhook} />
            </TabPane>
          )}
        </Tabs>
      )}

      {activeChannels.length === 0 && (
        <Alert
          message="No Distribution Channel Selected"
          description="Please select at least one distribution channel above"
          type="warning"
          showIcon
        />
      )}
    </Space>
  );
};

// Local Storage Configuration Component
const LocalStorageConfig: React.FC<{ form: any; initialValue?: any }> = ({ form, initialValue }) => {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        message="Local Storage Settings"
        description="Reports will be saved to the server's filesystem"
        type="info"
        showIcon
      />

      <Form.Item
        name={['distribution_config', 'local', 'base_path']}
        label="Base Directory"
        initialValue={initialValue?.base_path || '/exports/scheduled'}
        rules={[{ required: true, message: 'Please enter a base directory' }]}
      >
        <Input placeholder="/exports/scheduled" />
      </Form.Item>

      <Form.Item
        name={['distribution_config', 'local', 'create_subdirs']}
        valuePropName="checked"
        initialValue={initialValue?.create_subdirs ?? true}
      >
        <Checkbox>Create subdirectories by date (YYYY/MM/DD)</Checkbox>
      </Form.Item>

      <Form.Item
        name={['distribution_config', 'local', 'filename_pattern']}
        label="Filename Pattern"
        initialValue={initialValue?.filename_pattern || '{report_name}_{date}_{time}.{format}'}
        extra="Available variables: {report_name}, {date}, {time}, {timestamp}, {format}"
      >
        <Input placeholder="{report_name}_{date}_{time}.{format}" />
      </Form.Item>
    </Space>
  );
};

// Cloud Storage Configuration Component (Placeholder)
const CloudStorageConfig: React.FC<{ form: any; initialValue?: any }> = ({ form, initialValue }) => {
  return (
    <Alert
      message="Cloud Storage Coming Soon"
      description="Cloud storage integration (S3, Azure Blob, Google Cloud Storage) will be available in a future update."
      type="info"
      showIcon
    />
  );
};

// SFTP Configuration Component (Placeholder)
const SftpConfig: React.FC<{ form: any; initialValue?: any }> = ({ form, initialValue }) => {
  return (
    <Alert
      message="SFTP/FTP Coming Soon"
      description="SFTP and FTP transfer capabilities will be available in a future update."
      type="info"
      showIcon
    />
  );
};

// Webhook Configuration Component (Placeholder)
const WebhookConfig: React.FC<{ form: any; initialValue?: any }> = ({ form, initialValue }) => {
  return (
    <Alert
      message="Webhook Integration Coming Soon"
      description="Webhook integration for custom endpoints will be available in a future update."
      type="info"
      showIcon
    />
  );
};

export default DistributionSelector;