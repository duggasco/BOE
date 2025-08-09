import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  Tag,
  Tooltip,
  message,
  Typography,
  Descriptions,
  Alert,
  Empty,
  Popconfirm,
  Drawer,
  Select,
  InputNumber,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ShareAltOutlined,
  LockOutlined,
  UnlockOutlined,
  SaveOutlined,
  FileTextOutlined,
  MailOutlined,
  CloudUploadOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  ApiOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { format } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { templateService } from '../../services/api/scheduleService';
import { 
  type DistributionTemplate,
  type DistributionConfig,
  type EmailDistributionConfig,
  type LocalDistributionConfig,
  type CloudDistributionConfig
} from '../../types/schedule';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TemplateManager: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<DistributionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DistributionTemplate | null>(null);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DistributionTemplate | null>(null);
  const [form] = Form.useForm();

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await templateService.getTemplates();
      setTemplates(data);
    } catch (error: any) {
      console.error('Failed to fetch templates:', error);
      message.error('Failed to load distribution templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Create or update template
  const handleSubmit = async (values: any) => {
    try {
      // Build distribution config from form values
      const distributionConfig: DistributionConfig = {};
      
      // Email configuration
      if (values.email_enabled) {
        distributionConfig.email = {
          recipients: values.email_recipients?.split(',').map((e: string) => e.trim()) || [],
          cc: values.email_cc?.split(',').map((e: string) => e.trim()) || undefined,
          bcc: values.email_bcc?.split(',').map((e: string) => e.trim()) || undefined,
          subject: values.email_subject,
          custom_message: values.email_message,
          include_attachment: values.email_attachment,
          max_attachment_size: values.email_max_size
        };
      }
      
      // Local storage configuration
      if (values.local_enabled) {
        distributionConfig.local = {
          base_path: values.local_path,
          create_subdirs: values.local_subdirs,
          filename_pattern: values.local_pattern
        };
      }
      
      // Cloud storage configuration
      if (values.cloud_enabled) {
        distributionConfig.cloud = {
          provider: values.cloud_provider,
          bucket: values.cloud_bucket,
          path: values.cloud_path,
          access_key_id: values.cloud_access_key,
          secret_access_key: values.cloud_secret_key
        };
      }
      
      const templateData = {
        name: values.name,
        description: values.description,
        distribution_config: distributionConfig,
        user_id: user?.id || '', // Using actual user ID from auth context
        is_shared: values.is_shared || false
      };
      
      if (editingTemplate) {
        // Update existing template
        message.info('Template update functionality to be implemented');
        // await templateService.updateTemplate(editingTemplate.id, templateData);
        // message.success('Template updated successfully');
      } else {
        // Create new template
        await templateService.createTemplate(templateData);
        message.success('Template created successfully');
      }
      
      setFormVisible(false);
      form.resetFields();
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      message.error(error.message || 'Failed to save template');
    }
  };

  // Delete template
  const handleDelete = async (id: string) => {
    try {
      await templateService.deleteTemplate(id);
      message.success('Template deleted successfully');
      fetchTemplates();
    } catch (error: any) {
      message.error(error.message || 'Failed to delete template');
    }
  };

  // Clone template
  const handleClone = (template: DistributionTemplate) => {
    const clonedValues = {
      name: `${template.name} (Copy)`,
      description: template.description,
      is_shared: false,
      email_enabled: !!template.distribution_config.email,
      local_enabled: !!template.distribution_config.local,
      cloud_enabled: !!template.distribution_config.cloud
    };
    
    // Copy email settings
    if (template.distribution_config.email) {
      const email = template.distribution_config.email;
      Object.assign(clonedValues, {
        email_recipients: email.recipients?.join(', '),
        email_cc: email.cc?.join(', '),
        email_bcc: email.bcc?.join(', '),
        email_subject: email.subject,
        email_message: email.custom_message,
        email_attachment: email.include_attachment,
        email_max_size: email.max_attachment_size
      });
    }
    
    // Copy local settings
    if (template.distribution_config.local) {
      const local = template.distribution_config.local;
      Object.assign(clonedValues, {
        local_path: local.base_path,
        local_subdirs: local.create_subdirs,
        local_pattern: local.filename_pattern
      });
    }
    
    // Copy cloud settings
    if (template.distribution_config.cloud) {
      const cloud = template.distribution_config.cloud;
      Object.assign(clonedValues, {
        cloud_provider: cloud.provider,
        cloud_bucket: cloud.bucket,
        cloud_path: cloud.path,
        cloud_access_key: cloud.access_key_id,
        cloud_secret_key: cloud.secret_access_key
      });
    }
    
    form.setFieldsValue(clonedValues);
    setEditingTemplate(null);
    setFormVisible(true);
  };

  // View template details
  const viewDetails = (template: DistributionTemplate) => {
    setSelectedTemplate(template);
    setDetailsDrawerOpen(true);
  };

  // Get distribution channel icons
  const getChannelIcons = (config: DistributionConfig) => {
    const icons = [];
    if (config.email) {
      icons.push(
        <Tooltip key="email" title="Email Distribution">
          <MailOutlined style={{ fontSize: 16, marginRight: 8, color: '#1890ff' }} />
        </Tooltip>
      );
    }
    if (config.local) {
      icons.push(
        <Tooltip key="local" title="Local Storage">
          <FolderOpenOutlined style={{ fontSize: 16, marginRight: 8, color: '#52c41a' }} />
        </Tooltip>
      );
    }
    if (config.cloud) {
      icons.push(
        <Tooltip key="cloud" title="Cloud Storage">
          <CloudUploadOutlined style={{ fontSize: 16, marginRight: 8, color: '#722ed1' }} />
        </Tooltip>
      );
    }
    if (config.sftp) {
      icons.push(
        <Tooltip key="sftp" title="SFTP">
          <GlobalOutlined style={{ fontSize: 16, marginRight: 8, color: '#fa8c16' }} />
        </Tooltip>
      );
    }
    if (config.webhook) {
      icons.push(
        <Tooltip key="webhook" title="Webhook">
          <ApiOutlined style={{ fontSize: 16, marginRight: 8, color: '#eb2f96' }} />
        </Tooltip>
      );
    }
    return icons;
  };

  // Table columns
  const columns: ColumnsType<DistributionTemplate> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text strong>{name}</Text>
            {record.is_shared ? (
              <Tooltip title="Shared with team">
                <ShareAltOutlined style={{ color: '#1890ff' }} />
              </Tooltip>
            ) : (
              <Tooltip title="Private template">
                <LockOutlined style={{ color: '#8c8c8c' }} />
              </Tooltip>
            )}
          </Space>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Distribution Channels',
      key: 'channels',
      render: (_, record) => (
        <Space>{getChannelIcons(record.distribution_config)}</Space>
      )
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (date: string) => format(new Date(date), 'MMM dd, yyyy')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<FileTextOutlined />}
              onClick={() => viewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Clone Template">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleClone(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Template"
            description="Are you sure you want to delete this template?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>Distribution Templates</Title>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchTemplates}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setEditingTemplate(null);
                setFormVisible(true);
              }}
            >
              Create Template
            </Button>
          </Space>
        </div>

        <Alert
          message="Distribution Templates"
          description="Create reusable distribution configurations for your scheduled reports. Templates can include email settings, storage locations, and delivery options."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {templates.length > 0 ? (
          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Total ${total} templates`
            }}
          />
        ) : (
          <Empty
            description="No distribution templates yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setEditingTemplate(null);
                setFormVisible(true);
              }}
            >
              Create Your First Template
            </Button>
          </Empty>
        )}
      </Card>

      {/* Create/Edit Template Modal */}
      <Modal
        title={editingTemplate ? 'Edit Template' : 'Create Distribution Template'}
        open={formVisible}
        onCancel={() => {
          setFormVisible(false);
          form.resetFields();
          setEditingTemplate(null);
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Template Name"
            rules={[{ required: true, message: 'Please enter a template name' }]}
          >
            <Input placeholder="e.g., Daily Email Reports" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <TextArea
              rows={2}
              placeholder="Describe what this template is used for"
            />
          </Form.Item>

          <Form.Item
            name="is_shared"
            label="Share with Team"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider>Distribution Channels</Divider>

          {/* Email Configuration */}
          <Card
            title={
              <Space>
                <MailOutlined />
                <span>Email Distribution</span>
              </Space>
            }
            extra={
              <Form.Item name="email_enabled" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            }
            style={{ marginBottom: 16 }}
          >
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.email_enabled !== currentValues.email_enabled
              }
            >
              {({ getFieldValue }) =>
                getFieldValue('email_enabled') && (
                  <>
                    <Form.Item
                      name="email_recipients"
                      label="Recipients (comma-separated)"
                      rules={[{ 
                        required: getFieldValue('email_enabled'), 
                        message: 'Please enter at least one recipient' 
                      }]}
                    >
                      <Input placeholder="user1@example.com, user2@example.com" />
                    </Form.Item>
                    <Form.Item name="email_cc" label="CC (optional)">
                      <Input placeholder="cc@example.com" />
                    </Form.Item>
                    <Form.Item name="email_bcc" label="BCC (optional)">
                      <Input placeholder="bcc@example.com" />
                    </Form.Item>
                    <Form.Item name="email_subject" label="Subject Template">
                      <Input placeholder="{report_name} - {date}" />
                    </Form.Item>
                    <Form.Item name="email_message" label="Message Template">
                      <TextArea
                        rows={3}
                        placeholder="Please find the attached report..."
                      />
                    </Form.Item>
                    <Form.Item
                      name="email_attachment"
                      label="Include as Attachment"
                      valuePropName="checked"
                    >
                      <Switch defaultChecked />
                    </Form.Item>
                    <Form.Item name="email_max_size" label="Max Attachment Size (MB)">
                      <InputNumber min={1} max={50} defaultValue={25} />
                    </Form.Item>
                  </>
                )
              }
            </Form.Item>
          </Card>

          {/* Local Storage Configuration */}
          <Card
            title={
              <Space>
                <FolderOpenOutlined />
                <span>Local Storage</span>
              </Space>
            }
            extra={
              <Form.Item name="local_enabled" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            }
            style={{ marginBottom: 16 }}
          >
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.local_enabled !== currentValues.local_enabled
              }
            >
              {({ getFieldValue }) =>
                getFieldValue('local_enabled') && (
                  <>
                    <Form.Item
                      name="local_path"
                      label="Base Path"
                      rules={[{ 
                        required: getFieldValue('local_enabled'), 
                        message: 'Please enter a base path' 
                      }]}
                    >
                      <Input placeholder="/exports/scheduled" />
                    </Form.Item>
                    <Form.Item
                      name="local_subdirs"
                      label="Create Date Subdirectories"
                      valuePropName="checked"
                    >
                      <Switch defaultChecked />
                    </Form.Item>
                    <Form.Item
                      name="local_pattern"
                      label="Filename Pattern"
                      rules={[{ 
                        required: getFieldValue('local_enabled'), 
                        message: 'Please enter a filename pattern' 
                      }]}
                    >
                      <Input placeholder="{report_name}_{date}.{format}" />
                    </Form.Item>
                  </>
                )
              }
            </Form.Item>
          </Card>

          {/* Cloud Storage Configuration */}
          <Card
            title={
              <Space>
                <CloudUploadOutlined />
                <span>Cloud Storage (Day 2 Feature)</span>
              </Space>
            }
            extra={
              <Form.Item name="cloud_enabled" valuePropName="checked" noStyle>
                <Switch disabled />
              </Form.Item>
            }
            style={{ marginBottom: 16, opacity: 0.6 }}
          >
            <Alert
              message="Cloud storage integration is planned for Day 2"
              type="warning"
              showIcon
            />
          </Card>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </Button>
              <Button onClick={() => {
                setFormVisible(false);
                form.resetFields();
                setEditingTemplate(null);
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Template Details Drawer */}
      <Drawer
        title="Template Details"
        placement="right"
        width={600}
        onClose={() => setDetailsDrawerOpen(false)}
        open={detailsDrawerOpen}
      >
        {selectedTemplate && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Name">
                <Text strong>{selectedTemplate.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {selectedTemplate.description || 'No description'}
              </Descriptions.Item>
              <Descriptions.Item label="Visibility">
                {selectedTemplate.is_shared ? (
                  <Tag icon={<ShareAltOutlined />} color="blue">Shared</Tag>
                ) : (
                  <Tag icon={<LockOutlined />}>Private</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {format(new Date(selectedTemplate.created_at), 'PPp')}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {format(new Date(selectedTemplate.updated_at), 'PPp')}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5}>Distribution Configuration</Title>

            {selectedTemplate.distribution_config.email && (
              <Card title="Email Settings" size="small">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Recipients">
                    {selectedTemplate.distribution_config.email.recipients.join(', ')}
                  </Descriptions.Item>
                  {selectedTemplate.distribution_config.email.cc && (
                    <Descriptions.Item label="CC">
                      {selectedTemplate.distribution_config.email.cc.join(', ')}
                    </Descriptions.Item>
                  )}
                  {selectedTemplate.distribution_config.email.bcc && (
                    <Descriptions.Item label="BCC">
                      {selectedTemplate.distribution_config.email.bcc.join(', ')}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="Subject">
                    {selectedTemplate.distribution_config.email.subject || 'Default'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Include Attachment">
                    {selectedTemplate.distribution_config.email.include_attachment ? 'Yes' : 'No'}
                  </Descriptions.Item>
                  {selectedTemplate.distribution_config.email.max_attachment_size && (
                    <Descriptions.Item label="Max Size">
                      {selectedTemplate.distribution_config.email.max_attachment_size} MB
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            {selectedTemplate.distribution_config.local && (
              <Card title="Local Storage Settings" size="small">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Base Path">
                    {selectedTemplate.distribution_config.local.base_path}
                  </Descriptions.Item>
                  <Descriptions.Item label="Create Subdirectories">
                    {selectedTemplate.distribution_config.local.create_subdirs ? 'Yes' : 'No'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Filename Pattern">
                    {selectedTemplate.distribution_config.local.filename_pattern}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {selectedTemplate.distribution_config.cloud && (
              <Card title="Cloud Storage Settings" size="small">
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Provider">
                    {selectedTemplate.distribution_config.cloud.provider.toUpperCase()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Bucket">
                    {selectedTemplate.distribution_config.cloud.bucket}
                  </Descriptions.Item>
                  <Descriptions.Item label="Path">
                    {selectedTemplate.distribution_config.cloud.path}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            <Space>
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  handleClone(selectedTemplate);
                  setDetailsDrawerOpen(false);
                }}
              >
                Clone Template
              </Button>
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

export default TemplateManager;